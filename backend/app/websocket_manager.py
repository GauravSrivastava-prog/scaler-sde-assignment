"""
Production-Grade WebSocket Connection Manager
Handles real-time bidirectional communication, presence tracking,
multi-device multiplexing, room broadcasting, and delivery/read receipts.

Architectural Design:
- In-memory registry mapping User ID -> Set[WebSocket] (allows multiple simultaneous tabs/devices per user)
- Asynchronous concurrency control via asyncio.Lock
- Graceful error isolation (dead socket pruning without failing broadcast to other peers)
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, List, Any
from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.models import User, ConversationParticipant, Message

logger = logging.getLogger("signal.websocket")
logging.basicConfig(level=logging.INFO)


class ConnectionManager:
    """
    Manages active WebSocket connections with presence tracking
    and resilient fan-out broadcasting.
    """
    def __init__(self):
        # Maps user_id -> Set of active WebSocket instances
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Concurrency lock to prevent race conditions during connect/disconnect mutations
        self.lock = asyncio.Lock()

    async def connect(self, user_id: str, websocket: WebSocket, db: Optional[Session] = None):
        """
        Accept an incoming WebSocket connection and register it under the user's ID.
        Updates user's online status in DB if this is their first active session.
        """
        await websocket.accept()
        async with self.lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
            logger.info(f"User {user_id} connected. Active connections for user: {len(self.active_connections[user_id])}")

        # If user just came online, update database and broadcast presence
        if db:
            user = db.query(User).filter(User.id == user_id).first()
            if user and not user.is_online:
                user.is_online = True
                user.last_seen = datetime.utcnow()
                db.commit()
                # Broadcast presence to user's conversation peers
                await self.broadcast_presence(user_id, True, db)

    async def disconnect(self, user_id: str, websocket: WebSocket, db: Optional[Session] = None):
        """
        Gracefully deregister a WebSocket. If no remaining active sockets exist for the user,
        mark them as offline in the DB and notify peers.
        """
        user_went_offline = False
        async with self.lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                    user_went_offline = True
                logger.info(f"Socket disconnected for user {user_id}. User offline: {user_went_offline}")

        if user_went_offline and db:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                user.is_online = False
                user.last_seen = datetime.utcnow()
                db.commit()
                await self.broadcast_presence(user_id, False, db)

    def is_user_online(self, user_id: str) -> bool:
        """Check if user has at least one active WebSocket connection."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_to_user(self, user_id: str, event: str, payload: dict) -> int:
        """
        Deliver an event payload to all open sockets belonging to a specific user.
        Safely prunes any stale sockets encountered during transmission.
        Returns number of successful deliveries.
        """
        sockets: List[WebSocket] = []
        async with self.lock:
            if user_id in self.active_connections:
                sockets = list(self.active_connections[user_id])

        if not sockets:
            return 0

        message_data = json.dumps({"event": event, "payload": payload})
        stale_sockets = []
        delivered_count = 0

        for ws in sockets:
            try:
                await asyncio.wait_for(ws.send_text(message_data), timeout=1.0)
                delivered_count += 1
            except Exception as exc:
                logger.warning(f"Error or timeout sending WebSocket frame to user {user_id}: {exc}")
                stale_sockets.append(ws)

        # Cleanup dead sockets
        if stale_sockets:
            async with self.lock:
                if user_id in self.active_connections:
                    for ws in stale_sockets:
                        self.active_connections[user_id].discard(ws)

        return delivered_count

    async def broadcast_to_conversation(
        self,
        conversation_id: str,
        event: str,
        payload: dict,
        db: Session,
        exclude_user_id: Optional[str] = None
    ) -> List[str]:
        """
        Broadcast an event to all participants of a conversation.
        Returns list of online user IDs who received the message.
        """
        participants = (
            db.query(ConversationParticipant.user_id)
            .filter(ConversationParticipant.conversation_id == conversation_id)
            .all()
        )
        delivered_users = []
        for (part_user_id,) in participants:
            if exclude_user_id and part_user_id == exclude_user_id:
                continue
            delivered = await self.send_to_user(part_user_id, event, payload)
            if delivered > 0:
                delivered_users.append(part_user_id)

        return delivered_users

    async def broadcast_presence(self, user_id: str, is_online: bool, db: Session):
        """
        Notify all users sharing a conversation with this user about their presence change.
        """
        # Find all conversations the user is in
        conv_subq = (
            db.query(ConversationParticipant.conversation_id)
            .filter(ConversationParticipant.user_id == user_id)
            .subquery()
        )
        peer_ids = (
            db.query(ConversationParticipant.user_id)
            .filter(
                ConversationParticipant.conversation_id.in_(conv_subq),
                ConversationParticipant.user_id != user_id
            )
            .distinct()
            .all()
        )

        payload = {
            "user_id": user_id,
            "is_online": is_online,
            "last_seen": datetime.utcnow().isoformat()
        }

        for (peer_id,) in peer_ids:
            await self.send_to_user(peer_id, "presence_changed", payload)


# Global singleton manager instance
manager = ConnectionManager()
