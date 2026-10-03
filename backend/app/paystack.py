from __future__ import annotations

import hashlib
import hmac
import os
from urllib.parse import quote

import httpx

PAYSTACK_API = "https://api.paystack.co"


class PaystackError(RuntimeError):
    pass


def get_test_secret_key() -> str:
    secret_key = os.getenv("PAYSTACK_SECRET_KEY", "").strip()
    if not secret_key:
        raise PaystackError("Paystack is not configured. Set PAYSTACK_SECRET_KEY.")
    if not secret_key.startswith("sk_test_") or len(secret_key) <= len("sk_test_"):
        raise PaystackError("Only a Paystack TEST secret key is accepted.")
    return secret_key


async def initialize_transaction(
    reference: str,
    email: str,
    amount_kobo: int,
    callback_url: str,
) -> dict[str, str]:
    secret_key = get_test_secret_key()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{PAYSTACK_API}/transaction/initialize",
                headers={"Authorization": f"Bearer {secret_key}"},
                json={
                    "email": email,
                    "amount": amount_kobo,
                    "currency": "NGN",
                    "reference": reference,
                    "callback_url": callback_url,
                },
            )
            response.raise_for_status()
            body = response.json()
    except httpx.HTTPError as exc:
        raise PaystackError("Paystack could not initialize this payment.") from exc

    if not isinstance(body, dict):
        raise PaystackError("Paystack returned an invalid initialization response.")
    data = body.get("data") if body.get("status") else None
    if not isinstance(data, dict) or not data.get("authorization_url"):
        raise PaystackError("Paystack returned an invalid initialization response.")
    return {
        "authorization_url": str(data["authorization_url"]),
        "access_code": str(data.get("access_code", "")),
    }


async def verify_transaction(reference: str) -> dict[str, object]:
    secret_key = get_test_secret_key()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{PAYSTACK_API}/transaction/verify/{quote(reference, safe='')}",
                headers={"Authorization": f"Bearer {secret_key}"},
            )
            response.raise_for_status()
            body = response.json()
    except httpx.HTTPError as exc:
        raise PaystackError("Paystack could not verify this payment.") from exc

    if not isinstance(body, dict):
        raise PaystackError("Paystack returned an invalid verification response.")
    data = body.get("data") if body.get("status") else None
    if not isinstance(data, dict):
        raise PaystackError("Paystack returned an invalid verification response.")
    return data


def valid_webhook_signature(payload: bytes, signature: str, secret_key: str) -> bool:
    expected = hmac.new(secret_key.encode(), payload, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)
