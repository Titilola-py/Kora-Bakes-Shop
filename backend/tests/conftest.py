import os

# Tests always use their local SQLite database, even if the developer shell has
# DATABASE_URL set to a real Supabase instance.
os.environ["DATABASE_URL"] = "sqlite:///./test_orders.db"
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

import pytest
from fastapi.testclient import TestClient

from app.auth import CurrentUser, get_current_user
from app.database import CartItem, Order, PaymentAttempt, SessionLocal
from app.main import app, get_db

USER_A = CurrentUser(id="11111111-1111-4111-8111-111111111111", email="mina@example.com", display_name="Mina Ade")
USER_B = CurrentUser(id="22222222-2222-4222-8222-222222222222", email="tola@example.com", display_name="Tola")


@pytest.fixture
def current_user():
    return {"user": USER_A}


@pytest.fixture
def client(current_user):
    def override_user():
        return current_user["user"]

    def override_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        with SessionLocal() as db:
            db.query(CartItem).delete()
            db.query(PaymentAttempt).delete()
            db.query(Order).delete()
            db.commit()
        yield test_client
    app.dependency_overrides.clear()
