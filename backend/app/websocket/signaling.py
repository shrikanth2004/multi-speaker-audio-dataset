import json
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.websocket.room_manager import Participant, room_manager

router = APIRouter()


@router.websocket("/ws/meeting/{room_id}")
async def meeting_signaling(websocket: WebSocket, room_id: str) -> None:
    await websocket.accept()
    peer_id = str(uuid.uuid4())
    room = room_manager.get_or_create(room_id)
    current: Participant | None = None

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            msg_type = data.get("type")

            if msg_type == "join":
                user_id = data.get("userId", peer_id)
                display_name = data.get("displayName", "Guest")
                is_host = bool(data.get("isHost", False))

                current = Participant(
                    peer_id=peer_id,
                    user_id=user_id,
                    display_name=display_name,
                    websocket=websocket,
                    is_host=is_host,
                    muted=bool(data.get("muted", False)),
                )
                room.participants[peer_id] = current

                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "welcome",
                            "peerId": peer_id,
                            "participants": room.participant_list(),
                            "participantCount": room.count,
                        }
                    )
                )

                await room_manager.broadcast(
                    room_id,
                    {
                        "type": "peer-joined",
                        "peerId": peer_id,
                        "userId": user_id,
                        "displayName": display_name,
                        "isHost": is_host,
                        "muted": current.muted,
                        "participantCount": room.count,
                        "participants": room.participant_list(),
                    },
                    exclude_peer=peer_id,
                )
                continue

            if not current:
                await websocket.send_text(
                    json.dumps({"type": "error", "message": "Send join first"})
                )
                continue

            if msg_type in ("offer", "answer", "ice-candidate"):
                target = data.get("targetPeerId")
                if target:
                    await room_manager.send_to_peer(
                        room_id,
                        target,
                        {**data, "fromPeerId": peer_id},
                    )
                continue

            if msg_type == "mute-state":
                current.muted = bool(data.get("muted", False))
                await room_manager.broadcast(
                    room_id,
                    {
                        "type": "peer-muted",
                        "peerId": peer_id,
                        "muted": current.muted,
                        "participants": room.participant_list(),
                    },
                )
                continue

            if msg_type == "meeting-started":
                if current.is_host:
                    await room_manager.broadcast(
                        room_id,
                        {"type": "meeting-started", "startedAt": data.get("startedAt")},
                    )
                continue

            if msg_type == "meeting-ended":
                if current.is_host:
                    await room_manager.broadcast(
                        room_id,
                        {"type": "meeting-ended", "endedAt": data.get("endedAt")},
                    )
                continue

            if msg_type == "chat":
                await room_manager.broadcast(
                    room_id,
                    {
                        "type": "notification",
                        "message": data.get("message", ""),
                        "from": current.display_name,
                    },
                    exclude_peer=peer_id if data.get("private") else None,
                )

    except WebSocketDisconnect:
        pass
    finally:
        if current:
            remaining = room_manager.remove_participant(room_id, peer_id)
            if remaining:
                await room_manager.broadcast(
                    room_id,
                    {
                        "type": "peer-left",
                        "peerId": peer_id,
                        "displayName": current.display_name,
                        "participantCount": remaining.count,
                        "participants": remaining.participant_list(),
                    },
                )
