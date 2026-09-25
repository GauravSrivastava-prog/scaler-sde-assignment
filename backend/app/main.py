"""
Signal Messenger Clone - Main Application Entrypoint
Scaler Lab AI - SDE Fullstack Assignment

Architecture Overview:
- FastAPI asynchronous ASGI framework
- REST API v1 for relational CRUD, media uploads, and session management
- WebSocket Gateway with bidirectional event dispatching, presence tracking, and receipts
- Automatic database schema migration and demo dataset seeding on startup
"""
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.config import settings, UPLOAD_DIR
from app.database import engine, Base, SessionLocal, get_db
from app.models import (
    User,
    Conversation,
    ConversationParticipant,
    Message,
    MessageReaction
)
from app.schemas import MessageResponse, QuotedMessageResponse, ReactionResponse, UserResponse
from app.auth import get_current_user_ws
from app.websocket_manager import manager
from app.seed import seed_database

# Routers
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.contacts import router as contacts_router
from app.routers.conversations import router as conversations_router
from app.routers.groups import router as groups_router
from app.routers.messages import router as messages_router, format_message_response
from app.routers.uploads import router as uploads_router

logger = logging.getLogger("signal.main")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.
    Initializes SQLite tables and seeds the database with realistic Signal demo data.
    """
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    
    with SessionLocal() as db:
        seed_database(db)
        
    logger.info("Signal clone backend ready to accept connections.")
    yield
    logger.info("Signal clone backend shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade Signal Messenger Clone API for Scaler Lab AI",
    lifespan=lifespan
)

# Configure Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local media directory for serving image, audio, and file attachments
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_FOLDER), name="uploads")

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(contacts_router, prefix=settings.API_V1_STR)
app.include_router(conversations_router, prefix=settings.API_V1_STR)
app.include_router(groups_router, prefix=settings.API_V1_STR)
app.include_router(messages_router, prefix=settings.API_V1_STR)
app.include_router(uploads_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat()
    }


# -------------------------------------------------------------------------
# Real-time WebSocket Protocol Gateway
# -------------------------------------------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """
    Real-Time WebSocket Gateway for Signal Clone.
    Authenticates clients via JWT token during the initial handshake.
    Manages presence, bidirectional messaging, live typing indicators,
    reactions, and delivery/read receipts.
    """
    db: Session = SessionLocal()
    user = None
    try:
        # Authenticate JWT token
        user = get_current_user_ws(token, db)
        if not user:
            logger.warning("WebSocket handshake rejected: Invalid or expired token.")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        # Register connection in connection manager
        await manager.connect(user.id, websocket, db)

        # Main real-time event loop
        while True:
            raw_text = await websocket.receive_text()
            try:
                event_data = json.loads(raw_text)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"event": "error", "payload": {"message": "Invalid JSON"}}))
                continue

            action = event_data.get("action")
            data = event_data.get("data", {})

            # 1. Heartbeat Keepalive
            if action == "ping":
                await websocket.send_text(json.dumps({
                    "event": "pong",
                    "payload": {"timestamp": datetime.utcnow().isoformat()}
                }))

            # 2. Real-Time Message Dispatch
            elif action == "send_message":
                conv_id = data.get("conversation_id")
                content = data.get("content")
                temp_id = data.get("temp_id")
                reply_to_id = data.get("reply_to_id")
                msg_type = data.get("message_type", "text")
                att_url = data.get("attachment_url")
                att_name = data.get("attachment_name")
                att_size = data.get("attachment_size")
                att_mime = data.get("attachment_mime")

                if not conv_id:
                    continue

                # Verify sender is a participant
                part = (
                    db.query(ConversationParticipant)
                    .filter(
                        ConversationParticipant.conversation_id == conv_id,
                        ConversationParticipant.user_id == user.id
                    )
                    .first()
                )
                if not part:
                    continue

                conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
                if not conv:
                    continue

                # Calculate expiration if disappearing messages enabled
                expires_at = None
                if conv.disappearing_messages_timer and conv.disappearing_messages_timer > 0:
                    expires_at = datetime.utcnow() + timedelta(seconds=conv.disappearing_messages_timer)

                # Check if recipients are currently online to set initial status
                other_participants = (
                    db.query(ConversationParticipant.user_id)
                    .filter(
                        ConversationParticipant.conversation_id == conv_id,
                        ConversationParticipant.user_id != user.id
                    )
                    .all()
                )
                any_online = any(manager.is_user_online(uid[0]) for uid in other_participants)
                initial_status = "delivered" if any_online else "sent"

                msg = Message(
                    conversation_id=conv_id,
                    sender_id=user.id,
                    reply_to_id=reply_to_id,
                    content=content,
                    message_type=msg_type,
                    attachment_url=att_url,
                    attachment_name=att_name,
                    attachment_size=att_size,
                    attachment_mime=att_mime,
                    status=initial_status,
                    expires_at=expires_at,
                    created_at=datetime.utcnow()
                )
                db.add(msg)
                conv.updated_at = datetime.utcnow()
                db.commit()
                db.refresh(msg)

                msg_response = format_message_response(msg)
                msg_response.temp_id = temp_id
                payload = msg_response.model_dump(mode="json")

                # Broadcast to all conversation members (including the sender for ack)
                await manager.broadcast_to_conversation(
                    conversation_id=conv_id,
                    event="new_message",
                    payload={"message": payload, "temp_id": temp_id},
                    db=db
                )

            # 3. Live Typing Indicator
            elif action == "typing":
                conv_id = data.get("conversation_id")
                is_typing = bool(data.get("is_typing", False))
                if conv_id:
                    await manager.broadcast_to_conversation(
                        conversation_id=conv_id,
                        event="typing_indicator",
                        payload={
                            "conversation_id": conv_id,
                            "user_id": user.id,
                            "display_name": user.display_name,
                            "is_typing": is_typing
                        },
                        db=db,
                        exclude_user_id=user.id
                    )

            # 4. Mark Conversation as Read
            elif action == "mark_read":
                conv_id = data.get("conversation_id")
                if conv_id:
                    part = (
                        db.query(ConversationParticipant)
                        .filter(
                            ConversationParticipant.conversation_id == conv_id,
                            ConversationParticipant.user_id == user.id
                        )
                        .first()
                    )
                    if part:
                        part.last_read_at = datetime.utcnow()
                        unread_messages = (
                            db.query(Message)
                            .filter(
                                Message.conversation_id == conv_id,
                                Message.sender_id != user.id,
                                Message.status != "read"
                            )
                            .all()
                        )
                        updated_msg_ids = []
                        for m in unread_messages:
                            m.status = "read"
                            updated_msg_ids.append(m.id)
                        db.commit()

                        if updated_msg_ids:
                            await manager.broadcast_to_conversation(
                                conversation_id=conv_id,
                                event="message_status_updated",
                                payload={
                                    "conversation_id": conv_id,
                                    "message_ids": updated_msg_ids,
                                    "status": "read",
                                    "reader_id": user.id
                                },
                                db=db
                            )

            # 5. Emoji Reaction
            elif action == "react":
                msg_id = data.get("message_id")
                emoji = data.get("emoji")
                if msg_id and emoji:
                    msg = db.query(Message).filter(Message.id == msg_id).first()
                    if msg:
                        existing = (
                            db.query(MessageReaction)
                            .filter(
                                MessageReaction.message_id == msg_id,
                                MessageReaction.user_id == user.id,
                                MessageReaction.emoji == emoji
                            )
                            .first()
                        )
                        if existing:
                            db.delete(existing)
                        else:
                            new_react = MessageReaction(
                                message_id=msg_id,
                                user_id=user.id,
                                emoji=emoji
                            )
                            db.add(new_react)
                        db.commit()

                        # Re-fetch reactions
                        reactions = (
                            db.query(MessageReaction)
                            .filter(MessageReaction.message_id == msg_id)
                            .all()
                        )
                        reaction_responses = [
                            ReactionResponse(
                                id=r.id,
                                message_id=r.message_id,
                                user_id=r.user_id,
                                emoji=r.emoji,
                                created_at=r.created_at,
                                user=UserResponse.model_validate(r.user)
                            ).model_dump(mode="json")
                            for r in reactions
                        ]

                        await manager.broadcast_to_conversation(
                            conversation_id=msg.conversation_id,
                            event="reaction_updated",
                            payload={
                                "message_id": msg_id,
                                "conversation_id": msg.conversation_id,
                                "reactions": reaction_responses
                            },
                            db=db
                        )

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {user.username if user else 'unauthenticated'}")
    except Exception as exc:
        logger.error(f"WebSocket unhandled error: {exc}", exc_info=True)
    finally:
        if user:
            await manager.disconnect(user.id, websocket, db)
        db.close()
