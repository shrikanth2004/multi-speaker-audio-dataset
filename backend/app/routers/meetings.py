from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.config import get_settings
from app.services.room_store import room_store

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def _meeting_link(room_id: str, room_code: str) -> str:
    settings = get_settings()
    return (
        f"{settings.meeting_base_url}/meeting/index.html?code={room_code}"
        f"&roomId={room_id}"
    )


@router.post("/create")
async def create_meeting_room(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    host_id = user["id"]
    host_name = user["name"]
    room = room_store.create_room(host_id, host_name)

    return {
        "roomId": room["id"],
        "roomCode": room["room_code"],
        "hostId": host_id,
        "hostName": host_name,
        "status": room.get("status", "waiting"),
        "meetingLink": _meeting_link(room["id"], room["room_code"]),
    }


@router.get("/{identifier}")
async def get_meeting_room(
    identifier: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    room = room_store.get_room(identifier)
    if not room:
        raise HTTPException(404, "Meeting room not found")
    return {
        "roomId": room["id"],
        "roomCode": room["room_code"],
        "hostId": room["host_id"],
        "hostName": room["host_name"],
        "status": room["status"],
        "meetingLink": _meeting_link(room["id"], room["room_code"]),
        "isHost": room["host_id"] == user["id"],
    }


@router.post("/{room_id}/start")
async def start_meeting(
    room_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    room = room_store.get_room(room_id)
    if not room:
        raise HTTPException(404, "Meeting room not found")
    if room["host_id"] != user["id"]:
        raise HTTPException(403, "Only the host can start the meeting")

    started_at = datetime.now(timezone.utc).isoformat()
    room_store.update_room(room["id"], status="live", started_at=started_at)
    return {"status": "live", "startedAt": started_at}


@router.post("/{room_id}/end")
async def end_meeting(
    room_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    room = room_store.get_room(room_id)
    if not room:
        raise HTTPException(404, "Meeting room not found")
    if room["host_id"] != user["id"]:
        raise HTTPException(403, "Only the host can end the meeting")

    ended_at = datetime.now(timezone.utc).isoformat()
    room_store.update_room(room["id"], status="ended", ended_at=ended_at)
    return {"status": "ended", "endedAt": ended_at}
