import json
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket


@dataclass
class Participant:
    peer_id: str
    user_id: str
    display_name: str
    websocket: WebSocket
    is_host: bool = False
    muted: bool = False


@dataclass
class MeetingRoom:
    room_id: str
    participants: dict[str, Participant] = field(default_factory=dict)

    def participant_list(self) -> list[dict[str, Any]]:
        return [
            {
                "peerId": p.peer_id,
                "userId": p.user_id,
                "displayName": p.display_name,
                "isHost": p.is_host,
                "muted": p.muted,
                "connected": True,
            }
            for p in self.participants.values()
        ]

    @property
    def count(self) -> int:
        return len(self.participants)


class RoomManager:
    def __init__(self) -> None:
        self._rooms: dict[str, MeetingRoom] = {}

    def get_or_create(self, room_id: str) -> MeetingRoom:
        if room_id not in self._rooms:
            self._rooms[room_id] = MeetingRoom(room_id=room_id)
        return self._rooms[room_id]

    def get(self, room_id: str) -> MeetingRoom | None:
        return self._rooms.get(room_id)

    def remove_participant(self, room_id: str, peer_id: str) -> MeetingRoom | None:
        room = self._rooms.get(room_id)
        if not room:
            return None
        room.participants.pop(peer_id, None)
        if not room.participants:
            del self._rooms[room_id]
            return None
        return room

    async def broadcast(
        self,
        room_id: str,
        message: dict[str, Any],
        exclude_peer: str | None = None,
    ) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        payload = json.dumps(message)
        dead: list[str] = []
        for peer_id, participant in room.participants.items():
            if peer_id == exclude_peer:
                continue
            try:
                await participant.websocket.send_text(payload)
            except Exception:
                dead.append(peer_id)
        for peer_id in dead:
            room.participants.pop(peer_id, None)

    async def send_to_peer(
        self, room_id: str, target_peer_id: str, message: dict[str, Any]
    ) -> None:
        room = self._rooms.get(room_id)
        if not room:
            return
        participant = room.participants.get(target_peer_id)
        if participant:
            await participant.websocket.send_text(json.dumps(message))


room_manager = RoomManager()
