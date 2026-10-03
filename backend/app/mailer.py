from __future__ import annotations

import html
import logging
import os
from datetime import date

import httpx

logger = logging.getLogger(__name__)


def naira(kobo: int) -> str:
    return f"₦{kobo // 100:,.0f}"


def build_confirmation(order: dict[str, object]) -> tuple[str, str]:
    order_number = html.escape(str(order["order_number"]))
    customer = html.escape(str(order["customer_name"]))
    pickup_date = html.escape(str(order["pickup_date"]))
    items = list(order["items"])  # type: ignore[arg-type]
    rows_html = "".join(
        "<tr>"
        f"<td style='padding:10px 0;border-bottom:1px solid #eee6da'>{html.escape(str(item['product_name']))} × {int(item['quantity'])}</td>"
        f"<td align='right' style='padding:10px 0;border-bottom:1px solid #eee6da'>{naira(int(item['line_total_kobo']))}</td>"
        "</tr>"
        for item in items
    )
    rows_text = "\n".join(
        f"- {item['product_name']} × {item['quantity']}: {naira(int(item['line_total_kobo']))}"
        for item in items
    )
    total = naira(int(order["subtotal_kobo"]))
    subject = f"Your Kora Bakes order {order_number} is confirmed"
    text = (
        f"Hi {customer},\n\nYour order {order_number} is confirmed.\n\n{rows_text}\n\n"
        f"Total: {total}\nPickup date: {pickup_date}\n\nWe'll have it fresh for you.\nKora Bakes, Lagos"
    )
    body = f"""<!doctype html><html><body style="margin:0;background:#f7f3ec;font-family:Arial,sans-serif;color:#2c352b">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf9;border-radius:20px;padding:32px">
      <tr><td><div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#a46c49">Kora Bakes · Lagos</div>
      <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:500;margin:18px 0 8px">Your order is in the oven.</h1>
      <p style="color:#64675d;margin:0 0 24px">Hi {customer}, we’ve saved your pickup order.</p>
      <div style="background:#f4eee4;border-radius:12px;padding:16px;margin-bottom:24px"><strong>Order {order_number}</strong><br>
      <span style="color:#64675d">Pickup date: {pickup_date}</span></div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">{rows_html}</table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding-top:18px;font-weight:bold">Total</td>
      <td align="right" style="padding-top:18px;font-weight:bold">{total}</td></tr></table>
      <p style="margin:28px 0 0;color:#64675d;line-height:1.6">Thank you for making room for something good. Pick up at our Yaba counter on your selected day.</p>
      </td></tr></table></td></tr></table></body></html>"""
    return subject, text + "\n\n" + body


async def send_confirmation(recipient: str, order: dict[str, object]) -> str:
    api_key = os.getenv("MAILGUN_API_KEY", "")
    domain = os.getenv("MAILGUN_DOMAIN", "")
    sender = os.getenv("MAILGUN_FROM_EMAIL", "")
    if not api_key or not domain or not sender:
        return "not_configured"

    subject, body = build_confirmation(order)
    # Keep a plain-text alternative and a separate HTML body for email clients.
    text_part, html_part = body.split("<!doctype html>", 1)
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                f"https://api.eu.mailgun.net/v3/{domain}/messages",
                auth=("api", api_key),
                data={
                    "from": sender,
                    "to": recipient,
                    "subject": subject,
                    "text": text_part.strip(),
                    "html": "<!doctype html>" + html_part,
                },
            )
    except httpx.HTTPError:
        logger.exception("Mailgun request failed for order %s", order["order_number"])
        return "failed"

    if response.status_code not in (200, 202):
        logger.error("Mailgun rejected confirmation for order %s (HTTP %s)", order["order_number"], response.status_code)
        return "failed"
    return "sent"


def receipt_snapshot(
    order_number: str,
    customer_name: str,
    pickup_date: date,
    notes: str,
    subtotal_kobo: int,
    items: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "order_number": order_number,
        "customer_name": customer_name,
        "pickup_date": pickup_date.isoformat(),
        "notes": notes,
        "subtotal_kobo": subtotal_kobo,
        "items": items,
    }
