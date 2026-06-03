import base64
import json
import time
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/auth", tags=["auth"])


class DemoLoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    display_name: str = Field(..., min_length=1, max_length=80)


@router.post("/demo-login")
async def demo_login(body: DemoLoginRequest) -> dict[str, Any]:
    """Sign in with email and display name; returns a session token for the API."""
    import uuid

    user_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, body.email.lower()))
    payload = {
        "sub": user_id,
        "email": body.email,
        "name": body.display_name,
        "user_metadata": {"display_name": body.display_name},
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400 * 7,
        "aud": "authenticated",
    }
    header = base64.urlsafe_b64encode(
        json.dumps({"alg": "none", "typ": "JWT"}).encode()
    ).rstrip(b"=").decode()
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(
        b"="
    ).decode()
    token = f"{header}.{payload_b64}."
    return {
        "accessToken": token,
        "user": {
            "id": user_id,
            "email": body.email,
            "name": body.display_name,
        },
    }
