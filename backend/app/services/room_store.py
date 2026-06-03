"""In-memory meeting room store."""

import secrets
import string
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _room_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "-".join(
        "".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2)
    )


class InMemoryRoomStore:
    def __init__(self) -> None:
        self.rooms: dict[str, dict[str, Any]] = {}

    def create_room(self, host_id: str, host_name: str) -> dict[str, Any]:
        room_id = str(uuid4())
        room_code = _room_code()
        room = {
            "id": room_id,
            "room_code": room_code,
            "host_id": host_id,
            "host_name": host_name,
            "status": "waiting",
            "created_at": _utc_now(),
            "started_at": None,
            "ended_at": None,
        }
        self.rooms[room_id] = room
        return room

    def get_room(self, identifier: str) -> dict[str, Any] | None:
        room = self.rooms.get(identifier)
        if room:
            return room
        code = identifier.upper().replace(" ", "")
        for r in self.rooms.values():
            if isinstance(r, dict) and r.get("room_code", "").replace("-", "") == code.replace(
                "-", ""
            ):
                return r
        return None

    def update_room(self, room_id: str, **kwargs: Any) -> dict[str, Any] | None:
        room = self.rooms.get(room_id)
        if not room or not isinstance(room, dict):
            return None
        room.update(kwargs)
        return room



room_store = InMemoryRoomStore()
