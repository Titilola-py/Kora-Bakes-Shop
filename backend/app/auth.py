import os
from dataclasses import dataclass

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    display_name: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in with Google to continue")

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not supabase_url or not anon_key:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured yet")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={"apikey": anon_key, "Authorization": f"Bearer {credentials.credentials}"},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Could not reach the sign-in service") from exc

    if response.status_code in (401, 403):
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="The sign-in service could not verify your session")

    payload = response.json()
    user_id = payload.get("id")
    email = payload.get("email")
    if not user_id or not email:
        raise HTTPException(status_code=401, detail="Your Google account did not provide an email address")
    metadata = payload.get("user_metadata") or {}
    return CurrentUser(
        id=str(user_id),
        email=str(email),
        display_name=str(metadata.get("full_name") or metadata.get("name") or email.split("@", 1)[0]),
    )
