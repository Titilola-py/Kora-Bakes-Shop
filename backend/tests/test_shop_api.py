import asyncio
import hashlib
import hmac
import json
from datetime import date, timedelta

import pytest

from fastapi import HTTPException

from app.auth import CurrentUser, get_current_user
from app.catalog import PRODUCTS
from app.main import app
from app.mailer import build_confirmation, send_confirmation
from app.paystack import PaystackError, get_test_secret_key


def create_pending_order(client):
    return client.post("/api/orders", json={
        "customer_name": "Mina Ade",
        "pickup_date": (date.today() + timedelta(days=2)).isoformat(),
        "items": [{"product_id": "croissant-box", "quantity": 2}],
    }).json()


def initialize_test_payment(client, monkeypatch, order_id):
    references = []

    async def initialize(reference, email, amount_kobo, callback_url):
        references.append((reference, email, amount_kobo, callback_url))
        return {"authorization_url": "https://checkout.paystack.test/start", "access_code": "test-access"}

    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test_for-tests")
    monkeypatch.setattr("app.main.initialize_transaction", initialize)
    response = client.post(f"/api/orders/{order_id}/payments/initialize")
    return response, references


def test_public_catalog_has_server_owned_prices(client):
    response = client.get("/api/products")
    assert response.status_code == 200
    assert len(response.json()) == len(PRODUCTS)
    assert response.json()[0]["price_kobo"] == 650_000


def test_order_creation_saves_snapshot_and_server_calculates_total(client, monkeypatch):
    email_calls = []

    async def mail_sent(_recipient, _order):
        email_calls.append((_recipient, _order))
        return "sent"

    monkeypatch.setattr("app.main.send_confirmation", mail_sent)
    response = client.post("/api/orders", json={
        "customer_name": "  Mina Ade  ",
        "pickup_date": (date.today() + timedelta(days=2)).isoformat(),
        "items": [{"product_id": "croissant-box", "quantity": 2}],
        "subtotal_kobo": 1,
    })
    assert response.status_code == 201
    order = response.json()
    assert order["customer_name"] == "Mina Ade"
    assert order["subtotal_kobo"] == 1_300_000
    assert order["items"][0]["line_total_kobo"] == 1_300_000
    assert order["payment_status"] == "pending"
    assert order["email_status"] == "pending"
    assert email_calls == []

    history = client.get("/api/orders")
    assert history.status_code == 200
    assert history.json()[0]["order_number"] == order["order_number"]


def test_paystack_initialization_uses_saved_server_total_and_owner_email(client, monkeypatch):
    order = create_pending_order(client)
    response, calls = initialize_test_payment(client, monkeypatch, order["id"])

    assert response.status_code == 200
    assert response.json()["authorization_url"] == "https://checkout.paystack.test/start"
    assert "sk_test_for-tests" not in response.text
    assert calls[0][1:3] == ("mina@example.com", 1_300_000)
    assert calls[0][0] == response.json()["reference"]


def test_paystack_rejects_live_secret_keys(monkeypatch):
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_live_not-allowed")
    with pytest.raises(PaystackError, match="Only a Paystack TEST"):
        get_test_secret_key()


def test_verified_payment_marks_order_paid_and_sends_email_once(client, monkeypatch):
    order = create_pending_order(client)
    initialized, _ = initialize_test_payment(client, monkeypatch, order["id"])
    reference = initialized.json()["reference"]
    email_calls = []

    async def verified(_reference):
        return {"reference": reference, "status": "success", "amount": 1_300_000, "currency": "NGN", "id": 1234}

    async def mail_sent(recipient, snapshot):
        email_calls.append((recipient, snapshot))
        return "sent"

    monkeypatch.setattr("app.main.verify_transaction", verified)
    monkeypatch.setattr("app.main.send_confirmation", mail_sent)

    first = client.post("/api/payments/verify", json={"reference": reference})
    second = client.post("/api/payments/verify", json={"reference": reference})

    assert first.status_code == second.status_code == 200
    assert first.json()["order"]["payment_status"] == "paid"
    assert first.json()["order"]["email_status"] == "sent"
    assert email_calls and len(email_calls) == 1


@pytest.mark.parametrize(
    "transaction_amount,transaction_currency",
    [(1_299_999, "NGN"), (1_300_000, "USD")],
)
def test_verification_rejects_amount_or_currency_mismatch_without_confirming_or_emailing(
    client, monkeypatch, transaction_amount, transaction_currency
):
    order = create_pending_order(client)
    initialized, _ = initialize_test_payment(client, monkeypatch, order["id"])
    reference = initialized.json()["reference"]
    email_calls = []

    async def mismatched(_reference):
        return {
            "reference": reference,
            "status": "success",
            "amount": transaction_amount,
            "currency": transaction_currency,
        }

    async def mail_sent(*_args):
        email_calls.append(True)
        return "sent"

    monkeypatch.setattr("app.main.verify_transaction", mismatched)
    monkeypatch.setattr("app.main.send_confirmation", mail_sent)
    response = client.post("/api/payments/verify", json={"reference": reference})

    assert response.status_code == 409
    assert client.get(f"/api/orders/{order['id']}").json()["payment_status"] == "pending"
    assert email_calls == []


@pytest.mark.parametrize("remote_status", ["cancelled", "abandoned"])
def test_cancelled_or_abandoned_payment_stays_unpaid(client, monkeypatch, remote_status):
    order = create_pending_order(client)
    initialized, _ = initialize_test_payment(client, monkeypatch, order["id"])
    reference = initialized.json()["reference"]

    async def not_completed(_reference):
        return {"reference": reference, "status": remote_status, "amount": 1_300_000, "currency": "NGN"}

    monkeypatch.setattr("app.main.verify_transaction", not_completed)
    response = client.post("/api/payments/verify", json={"reference": reference})

    assert response.status_code == 200
    assert response.json()["attempt_status"] == remote_status
    assert response.json()["order"]["payment_status"] == "pending"
    assert response.json()["order"]["email_status"] == "pending"


def test_failed_payment_keeps_order_pending_and_can_initialize_a_new_attempt(client, monkeypatch):
    order = create_pending_order(client)
    initialized, init_calls = initialize_test_payment(client, monkeypatch, order["id"])
    reference = initialized.json()["reference"]

    async def failed(_reference):
        return {"reference": reference, "status": "failed", "amount": 1_300_000, "currency": "NGN"}

    monkeypatch.setattr("app.main.verify_transaction", failed)
    response = client.post("/api/payments/verify", json={"reference": reference})
    assert response.status_code == 200
    assert response.json()["attempt_status"] == "failed"
    assert response.json()["order"]["payment_status"] == "pending"
    assert response.json()["order"]["email_status"] == "pending"

    retry, retry_calls = initialize_test_payment(client, monkeypatch, order["id"])
    assert retry.status_code == 200
    assert retry_calls[0][0] != init_calls[0][0]


def test_payment_verification_is_scoped_to_order_owner(client, current_user, monkeypatch):
    order = create_pending_order(client)
    initialized, _ = initialize_test_payment(client, monkeypatch, order["id"])
    current_user["user"] = CurrentUser(
        id="22222222-2222-4222-8222-222222222222", email="tola@example.com", display_name="Tola"
    )
    response = client.post("/api/payments/verify", json={"reference": initialized.json()["reference"]})
    assert response.status_code == 404


def test_signed_webhook_verifies_and_settles_idempotently(client, monkeypatch):
    order = create_pending_order(client)
    initialized, _ = initialize_test_payment(client, monkeypatch, order["id"])
    reference = initialized.json()["reference"]
    email_calls = []

    async def verified(_reference):
        return {"reference": reference, "status": "success", "amount": 1_300_000, "currency": "NGN", "id": 1234}

    async def mail_sent(*_args):
        email_calls.append(True)
        return "sent"

    monkeypatch.setattr("app.main.verify_transaction", verified)
    monkeypatch.setattr("app.main.send_confirmation", mail_sent)
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test_for-tests")
    raw_body = json.dumps({"event": "charge.success", "data": {"reference": reference}}, separators=(",", ":")).encode()
    signature = hmac.new(b"sk_test_for-tests", raw_body, hashlib.sha512).hexdigest()

    first = client.post("/api/payments/webhook", content=raw_body, headers={"X-Paystack-Signature": signature})
    second = client.post("/api/payments/webhook", content=raw_body, headers={"X-Paystack-Signature": signature})

    assert first.status_code == second.status_code == 200
    assert first.json()["status"] == "processed"
    assert len(email_calls) == 1


def test_webhook_rejects_invalid_signature(client, monkeypatch):
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test_for-tests")
    response = client.post(
        "/api/payments/webhook",
        content=b'{"event":"charge.success","data":{"reference":"unknown"}}',
        headers={"X-Paystack-Signature": "invalid"},
    )
    assert response.status_code == 401


def test_other_account_cannot_read_an_order(client, current_user, monkeypatch):
    async def mail_sent(_recipient, _order):
        return "sent"

    monkeypatch.setattr("app.main.send_confirmation", mail_sent)
    response = client.post("/api/orders", json={
        "customer_name": "Mina",
        "pickup_date": (date.today() + timedelta(days=2)).isoformat(),
        "items": [{"product_id": "banana-bread", "quantity": 1}],
    })
    order_id = response.json()["id"]
    current_user["user"] = CurrentUser(
        id="22222222-2222-4222-8222-222222222222", email="tola@example.com", display_name="Tola"
    )
    assert client.get(f"/api/orders/{order_id}").status_code == 404
    assert client.get("/api/orders").json() == []


@pytest.mark.parametrize("items", [[], [{"product_id": "not-a-product", "quantity": 1}], [{"product_id": "croissant-box", "quantity": 26}]])
def test_rejects_empty_unknown_or_excessive_cart(client, items):
    response = client.post("/api/orders", json={
        "customer_name": "Mina",
        "pickup_date": (date.today() + timedelta(days=2)).isoformat(),
        "items": items,
    })
    assert response.status_code == 422


def test_rejects_pickup_dates_in_the_past(client):
    response = client.post("/api/orders", json={
        "customer_name": "Mina",
        "pickup_date": (date.today() - timedelta(days=1)).isoformat(),
        "items": [{"product_id": "croissant-box", "quantity": 1}],
    })
    assert response.status_code == 422


def test_orders_require_an_authenticated_user(client):
    app.dependency_overrides.pop(get_current_user, None)
    response = client.get("/api/orders")
    assert response.status_code == 401


def test_expired_supabase_token_is_rejected(monkeypatch):
    class UnauthorizedResponse:
        status_code = 401

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, *_args, **_kwargs):
            return UnauthorizedResponse()

    monkeypatch.setattr("app.auth.httpx.AsyncClient", lambda **_kwargs: FakeClient())
    from fastapi.security import HTTPAuthorizationCredentials

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="expired-token")
    with pytest.raises(HTTPException) as error:
        asyncio.run(get_current_user(credentials))
    assert error.value.status_code == 401


def test_confirmation_email_escapes_customer_content():
    subject, body = build_confirmation({
        "order_number": "CB-261001-ABC123",
        "customer_name": "<Mina>",
        "pickup_date": date.today().isoformat(),
        "subtotal_kobo": 650_000,
        "items": [{"product_name": "Butter Croissant Box", "quantity": 1, "line_total_kobo": 650_000}],
    })
    assert subject == "Your Kora Bakes order CB-261001-ABC123 is confirmed"
    assert "&lt;Mina&gt;" in body
    assert "₦6,500" in body


def test_missing_mailgun_settings_are_reported_without_sending(monkeypatch):
    monkeypatch.delenv("MAILGUN_API_KEY", raising=False)
    monkeypatch.delenv("MAILGUN_DOMAIN", raising=False)
    monkeypatch.delenv("MAILGUN_FROM_EMAIL", raising=False)
    result = asyncio.run(send_confirmation("mina@example.com", {"order_number": "CB-TEST"}))
    assert result == "not_configured"
