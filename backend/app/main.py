from __future__ import annotations

import logging
import os
import secrets
import json
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

APP_DIR = Path(__file__).resolve().parent
load_dotenv(APP_DIR.parent / ".env")

from app.auth import CurrentUser, get_current_user
from app.catalog import PRODUCT_BY_ID, PRODUCTS, public_product
from app.database import Order, OrderItem, PaymentAttempt, SessionLocal, init_db
from app.mailer import receipt_snapshot, send_confirmation
from app.paystack import (
    PaystackError,
    get_test_secret_key,
    initialize_transaction,
    valid_webhook_signature,
    verify_transaction,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Kora Bakes Shop API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        os.getenv("APP_ORIGIN", "").rstrip("/"),
    ])),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


class OrderLineIn(BaseModel):
    product_id: str = Field(min_length=1, max_length=80)
    quantity: int = Field(ge=1, le=25)


class OrderCreate(BaseModel):
    items: list[OrderLineIn] = Field(min_length=1, max_length=20)
    customer_name: str = Field(min_length=1, max_length=100)
    pickup_date: date
    notes: str = Field(default="", max_length=500)

    @field_validator("customer_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Please enter a name for the pickup order")
        return value

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: str) -> str:
        return value.strip()


class OrderLineOut(BaseModel):
    product_id: str
    product_name: str
    unit_price_kobo: int
    quantity: int
    line_total_kobo: int


class OrderOut(BaseModel):
    id: str
    order_number: str
    customer_name: str
    pickup_date: date
    notes: str
    subtotal_kobo: int
    currency: str
    payment_status: str
    paid_at: datetime | None
    email_status: str
    created_at: datetime
    items: list[OrderLineOut]


def serialize_order(order: Order) -> OrderOut:
    return OrderOut(
        id=str(order.id),
        order_number=order.order_number,
        customer_name=order.customer_name,
        pickup_date=order.pickup_date,
        notes=order.notes,
        subtotal_kobo=order.subtotal_kobo,
        currency=order.currency,
        payment_status=order.payment_status,
        paid_at=order.paid_at,
        email_status=order.email_status,
        created_at=order.created_at,
        items=[
            OrderLineOut(
                product_id=item.product_id,
                product_name=item.product_name,
                unit_price_kobo=item.unit_price_kobo,
                quantity=item.quantity,
                line_total_kobo=item.line_total_kobo,
            )
            for item in order.items
        ],
    )


def require_checkout_ready(payload: OrderCreate) -> None:
    today = date.today()
    if payload.pickup_date < today or payload.pickup_date > today + timedelta(days=90):
        raise HTTPException(status_code=422, detail="Choose a pickup date within the next 90 days")
    ids = [line.product_id for line in payload.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="Each product can only appear once in the cart")
    if any(product_id not in PRODUCT_BY_ID for product_id in ids):
        raise HTTPException(status_code=422, detail="Your cart contains a product that is no longer available")


def get_public_app_origin() -> str:
    origin = os.getenv("APP_ORIGIN", "").strip().rstrip("/")
    parsed_origin = urlsplit(origin)
    if (
        parsed_origin.scheme not in {"http", "https"}
        or not parsed_origin.netloc
        or parsed_origin.path
        or parsed_origin.query
        or parsed_origin.fragment
    ):
        raise PaystackError("APP_ORIGIN must be set to the public shop origin.")
    return origin


async def settle_verified_payment(
    reference: str,
    transaction: dict[str, object],
    db: Session,
) -> Order | None:
    attempt = db.scalar(
        select(PaymentAttempt)
        .where(PaymentAttempt.reference == reference)
        .with_for_update()
    )
    if attempt is None:
        return None
    order = db.scalar(
        select(Order)
        .where(Order.id == attempt.order_id)
        .options(selectinload(Order.items))
        .with_for_update()
    )
    if order is None:
        return None

    amount = transaction.get("amount")
    if (
        transaction.get("reference") != reference
        or not isinstance(amount, int)
        or isinstance(amount, bool)
        or amount != attempt.amount_kobo
        or amount != order.subtotal_kobo
        or transaction.get("currency") != order.currency
        or transaction.get("status") != "success"
    ):
        raise HTTPException(status_code=409, detail="Paystack payment details do not match this order")

    attempt.status = "success"
    transaction_id = transaction.get("id")
    attempt.gateway_transaction_id = str(transaction_id) if transaction_id is not None else None
    if order.payment_status != "paid":
        order.payment_status = "paid"
        order.paid_at = datetime.now(timezone.utc)

    send_email = order.email_status == "pending"
    if send_email:
        order.email_status = "sending"
    db.commit()

    if send_email:
        snapshot_items = [
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "line_total_kobo": item.line_total_kobo,
            }
            for item in order.items
        ]
        snapshot = receipt_snapshot(
            order.order_number,
            order.customer_name,
            order.pickup_date,
            order.notes,
            order.subtotal_kobo,
            snapshot_items,
        )
        order.email_status = await send_confirmation(order.user_email, snapshot)
        try:
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Order %s was paid, but email status could not be recorded", order.order_number)

    db.refresh(order)
    return order


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/config")
def public_config() -> dict[str, str | bool]:
    # The Supabase anon key is public. Privileged database and Mailgun secrets
    # are never returned here or compiled into the frontend.
    return {
        "supabaseUrl": os.getenv("SUPABASE_URL", ""),
        "supabaseAnonKey": os.getenv("SUPABASE_ANON_KEY", ""),
        "configured": bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY")),
        "shopName": "Kora Bakes",
    }


@app.get("/api/products")
def list_products() -> list[dict[str, object]]:
    return [public_product(product) for product in PRODUCTS]


class PaymentInitializeOut(BaseModel):
    reference: str
    authorization_url: str


class PaymentVerifyIn(BaseModel):
    reference: str = Field(min_length=1, max_length=100)


class PaymentVerifyOut(BaseModel):
    reference: str
    attempt_status: str
    order: OrderOut


@app.get("/api/orders", response_model=list[OrderOut])
def list_orders(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrderOut]:
    orders = db.scalars(
        select(Order)
        .where(Order.user_id == user.id)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
    ).all()
    return [serialize_order(order) for order in orders]


@app.post("/api/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOut:
    require_checkout_ready(payload)

    order_id = str(uuid4())
    order_number = f"CB-{datetime.now(timezone.utc):%y%m%d}-{secrets.token_hex(3).upper()}"
    lines: list[OrderItem] = []
    subtotal = 0
    for line in payload.items:
        product = PRODUCT_BY_ID[line.product_id]
        line_total = product.price_kobo * line.quantity
        subtotal += line_total
        lines.append(OrderItem(
            order_id=order_id,
            product_id=product.id,
            product_name=product.name,
            unit_price_kobo=product.price_kobo,
            quantity=line.quantity,
            line_total_kobo=line_total,
        ))

    order = Order(
        id=order_id,
        user_id=user.id,
        user_email=user.email,
        order_number=order_number,
        customer_name=payload.customer_name,
        pickup_date=payload.pickup_date,
        notes=payload.notes,
        subtotal_kobo=subtotal,
        currency="NGN",
        payment_status="pending",
        email_status="pending",
        items=lines,
    )
    db.add(order)
    try:
        db.commit()
        db.refresh(order)
    except Exception as exc:
        db.rollback()
        logger.exception("Could not save order %s", order_number)
        raise HTTPException(status_code=503, detail="We could not save your order. Please try again") from exc
    db.refresh(order)
    return serialize_order(order)


@app.post("/api/orders/{order_id}/payments/initialize", response_model=PaymentInitializeOut)
async def initialize_order_payment(
    order_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentInitializeOut:
    order = db.scalar(
        select(Order)
        .where(Order.id == str(order_id), Order.user_id == user.id)
        .options(selectinload(Order.payment_attempts))
        .with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == "paid":
        raise HTTPException(status_code=409, detail="This order has already been paid")

    pending_attempt = next(
        (attempt for attempt in reversed(order.payment_attempts) if attempt.status == "pending"),
        None,
    )
    if pending_attempt and pending_attempt.authorization_url:
        return PaymentInitializeOut(
            reference=pending_attempt.reference,
            authorization_url=pending_attempt.authorization_url,
        )
    if pending_attempt:
        raise HTTPException(status_code=409, detail="Payment setup is still pending. Please check this order again shortly.")

    attempt = PaymentAttempt(
        order_id=order.id,
        reference=f"CB-{secrets.token_hex(16)}",
        amount_kobo=order.subtotal_kobo,
        currency=order.currency,
        status="pending",
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    try:
        callback_url = f"{get_public_app_origin()}/"
        result = await initialize_transaction(
            attempt.reference,
            order.user_email,
            order.subtotal_kobo,
            callback_url,
        )
    except PaystackError as exc:
        attempt.status = "failed"
        db.commit()
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    attempt.authorization_url = result["authorization_url"]
    db.commit()
    return PaymentInitializeOut(
        reference=attempt.reference,
        authorization_url=attempt.authorization_url,
    )


@app.post("/api/payments/verify", response_model=PaymentVerifyOut)
async def verify_order_payment(
    payload: PaymentVerifyIn,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentVerifyOut:
    attempt = db.scalar(
        select(PaymentAttempt)
        .join(Order, PaymentAttempt.order_id == Order.id)
        .where(PaymentAttempt.reference == payload.reference, Order.user_id == user.id)
    )
    if attempt is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    try:
        transaction = await verify_transaction(payload.reference)
    except PaystackError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if transaction.get("reference") != payload.reference:
        raise HTTPException(status_code=409, detail="Paystack returned a different payment reference")

    transaction_status = str(transaction.get("status", "pending")).lower()
    if transaction_status == "success":
        order = await settle_verified_payment(payload.reference, transaction, db)
        if order is None:
            raise HTTPException(status_code=404, detail="Payment not found")
        attempt_status = "success"
    else:
        if attempt.status != "success":
            if transaction_status in {"failed", "cancelled", "canceled", "abandoned"}:
                attempt.status = "cancelled" if transaction_status == "canceled" else transaction_status
            else:
                attempt.status = "pending"
            db.commit()
        order = db.scalar(
            select(Order)
            .where(Order.id == attempt.order_id, Order.user_id == user.id)
            .options(selectinload(Order.items))
        )
        if order is None:
            raise HTTPException(status_code=404, detail="Order not found")
        attempt_status = attempt.status

    return PaymentVerifyOut(
        reference=payload.reference,
        attempt_status=attempt_status,
        order=serialize_order(order),
    )


@app.post("/api/payments/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    raw_body = await request.body()
    try:
        secret_key = get_test_secret_key()
    except PaystackError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not x_paystack_signature or not valid_webhook_signature(raw_body, x_paystack_signature, secret_key):
        raise HTTPException(status_code=401, detail="Invalid Paystack webhook signature")

    try:
        event_body = json.loads(raw_body)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook payload") from exc
    if not isinstance(event_body, dict) or event_body.get("event") != "charge.success":
        return {"status": "ignored"}

    data = event_body.get("data")
    reference = data.get("reference") if isinstance(data, dict) else None
    if not isinstance(reference, str) or not reference:
        return {"status": "ignored"}
    attempt = db.scalar(select(PaymentAttempt).where(PaymentAttempt.reference == reference))
    if attempt is None:
        return {"status": "ignored"}

    try:
        transaction = await verify_transaction(reference)
    except PaystackError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if transaction.get("status") != "success":
        return {"status": "ignored"}
    order = await settle_verified_payment(reference, transaction, db)
    if order is None:
        return {"status": "ignored"}
    return {"status": "processed"}


@app.get("/api/orders/{order_id}", response_model=OrderOut)
def get_order(
    order_id: UUID,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOut:
    order = db.scalar(
        select(Order)
        .where(Order.id == str(order_id), Order.user_id == user.id)
        .options(selectinload(Order.items))
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return serialize_order(order)


@app.get("/api/me")
def get_profile(user: CurrentUser = Depends(get_current_user)) -> dict[str, str]:
    return {"id": user.id, "email": user.email, "display_name": user.display_name}


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
