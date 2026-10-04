import os
from pathlib import Path
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, Uuid, create_engine, event, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker


DEFAULT_DB = Path(__file__).resolve().parents[1] / "kora-bakes.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB.as_posix()}")
# Supabase provides postgresql:// URLs, while this project installs psycopg v3.
# Make the driver explicit so SQLAlchemy does not look for psycopg2.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), nullable=False, index=True)
    user_email: Mapped[str] = mapped_column(String(320), nullable=False)
    order_number: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    customer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    pickup_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    subtotal_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    payment_status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan", lazy="selectin")
    payment_attempts: Mapped[list["PaymentAttempt"]] = relationship(back_populates="order", cascade="all, delete-orphan", lazy="selectin")


class PaymentAttempt(Base):
    __tablename__ = "payment_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    amount_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="NGN")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending")
    authorization_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    gateway_transaction_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    order: Mapped[Order] = relationship(back_populates="payment_attempts")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(String(80), nullable=False)
    product_name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit_price_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total_kobo: Mapped[int] = mapped_column(Integer, nullable=False)
    order: Mapped[Order] = relationship(back_populates="items")

class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (CheckConstraint("quantity between 1 and 25", name="cart_items_quantity_bounds"),)

    user_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


def init_db() -> None:
    Base.metadata.create_all(engine)
    if DATABASE_URL.startswith("sqlite"):
        with engine.begin() as connection:
            columns = {
                row[1]
                for row in connection.exec_driver_sql("PRAGMA table_info(orders)").fetchall()
            }
            if "payment_status" not in columns:
                connection.exec_driver_sql(
                    "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(24) NOT NULL DEFAULT 'pending'"
                )
            if "paid_at" not in columns:
                connection.exec_driver_sql("ALTER TABLE orders ADD COLUMN paid_at DATETIME")
