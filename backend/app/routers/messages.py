"""
Messages API Router
Handles message retrieval, REST dispatch fallback, emoji reactions,
read receipt transitions, and disappearing messages expiration.
"""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_

from app.database import get_db
from app.models import (
    Conversation,
    ConversationParticipant,
    Message,
    MessageReaction,
    User
)
from app.schemas import (
    MessageCreate,
    MessageResponse,
    ReactionCreate,
    ReactionResponse,
    QuotedMessageResponse,
    UserResponse
)
from app.auth import get_current_user
from app.websocket_manager import manager

router = APIRouter(tags=["Messages"])


def format_message_response(msg: Message) -> MessageResponse:
    """Helper to convert Message ORM model to MessageResponse Pydantic schema."""
    # Build quoted message if reply_to exists
    quoted = None
    if msg.reply_to and not msg.reply_to.is_deleted:
        quoted = QuotedMessageResponse(
            id=msg.reply_to.id,
            sender_id=msg.reply_to.sender_id,
            sender_name=msg.reply_to.sender.display_name if msg.reply_to.sender else "User",
            content=msg.reply_to.content,
            message_type=msg.reply_to.message_type,
            attachment_url=msg.reply_to.attachment_url
        )

    # Format reactions
    reactions = [
        ReactionResponse(
            id=r.id,
            message_id=r.message_id,
            user_id=r.user_id,
            emoji=r.emoji,
            created_at=r.created_at,
            user=UserResponse.model_validate(r.user) if r.user else None
        )
        for r in msg.reactions
    ]

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender=UserResponse.model_validate(msg.sender) if msg.sender else None,
        reply_to_id=msg.reply_to_id,
        reply_to=quoted,
        content="This message was deleted" if msg.is_deleted else msg.content,
        message_type=msg.message_type,
        attachment_url=None if msg.is_deleted else msg.attachment_url,
        attachment_name=None if msg.is_deleted else msg.attachment_name,
        attachment_size=None if msg.is_deleted else msg.attachment_size,
        attachment_mime=None if msg.is_deleted else msg.attachment_mime,
        status=msg.status,
        expires_at=msg.expires_at,
        is_deleted=msg.is_deleted,
        created_at=msg.created_at,
        reactions=reactions
    )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=200),
    before: Optional[str] = Query(None, description="Cursor for pagination"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch chronological messages for a conversation.
    Cleans up expired disappearing messages before returning results.
    """
    # Check participant membership
    part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not part:
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation.")

    # Disappearing messages cleanup: delete any messages whose expires_at is past
    now = datetime.utcnow()
    expired_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.expires_at != None,
            Message.expires_at <= now
        )
        .all()
    )
    if expired_messages:
        for em in expired_messages:
            db.delete(em)
        db.commit()

    query = db.query(Message).filter(Message.conversation_id == conversation_id)
    if before:
        cursor_msg = db.query(Message).filter(Message.id == before).first()
        if cursor_msg:
            query = query.filter(Message.created_at < cursor_msg.created_at)

    messages = (
        query
        .order_by(Message.created_at.asc())
        .limit(limit)
        .all()
    )

    return [format_message_response(m) for m in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: str,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message within a conversation.
    Supports text, media attachments, reply-to quotes, and disappearing timers.
    Dispatches to conversation peers over WebSockets.
    """
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not part:
        raise HTTPException(status_code=403, detail="You are not a member of this conversation.")

    # Calculate expiration if disappearing messages enabled
    expires_at = None
    if conv.disappearing_messages_timer and conv.disappearing_messages_timer > 0:
        expires_at = datetime.utcnow() + timedelta(seconds=conv.disappearing_messages_timer)

    # Check recipient presence to determine initial status (sent vs delivered)
    other_participants = (
        db.query(ConversationParticipant.user_id)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id != current_user.id
        )
        .all()
    )
    any_online = any(manager.is_user_online(uid[0]) for uid in other_participants)
    initial_status = "delivered" if any_online else "sent"

    msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        reply_to_id=msg_in.reply_to_id,
        content=msg_in.content,
        message_type=msg_in.message_type or "text",
        attachment_url=msg_in.attachment_url,
        attachment_name=msg_in.attachment_name,
        attachment_size=msg_in.attachment_size,
        attachment_mime=msg_in.attachment_mime,
        status=initial_status,
        expires_at=expires_at,
        created_at=datetime.utcnow()
    )
    db.add(msg)
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    response_obj = format_message_response(msg)
    response_obj.temp_id = msg_in.temp_id

    # Broadcast message to all active participants in the conversation
    payload = response_obj.model_dump(mode="json")
    await manager.broadcast_to_conversation(
        conversation_id=conversation_id,
        event="new_message",
        payload={"message": payload, "temp_id": msg_in.temp_id},
        db=db
    )

    return response_obj


@router.post("/messages/{message_id}/reactions", response_model=List[ReactionResponse])
async def toggle_reaction(
    message_id: str,
    react_in: ReactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Toggle emoji reaction on a message.
    If the reaction already exists from this user, it is toggled off (removed).
    If a different reaction exists, or it's new, it is added.
    """
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    emoji = react_in.emoji.strip()
    existing = (
        db.query(MessageReaction)
        .filter(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == emoji
        )
        .first()
    )

    if existing:
        db.delete(existing)
    else:
        new_reaction = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji
        )
        db.add(new_reaction)

    db.commit()

    # Fetch updated reactions
    reactions = (
        db.query(MessageReaction)
        .filter(MessageReaction.message_id == message_id)
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
        )
        for r in reactions
    ]

    # Broadcast reaction update
    payload = [r.model_dump(mode="json") for r in reaction_responses]
    await manager.broadcast_to_conversation(
        conversation_id=msg.conversation_id,
        event="reaction_updated",
        payload={"message_id": message_id, "conversation_id": msg.conversation_id, "reactions": payload},
        db=db
    )

    return reaction_responses


@router.post("/conversations/{conversation_id}/read")
async def mark_conversation_as_read(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all unread incoming messages in a conversation as read.
    Updates the caller's last_read_at timestamp and transitions message statuses.
    Emits real-time read receipts (double blue/filled checks) to senders.
    """
    part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not part:
        raise HTTPException(status_code=403, detail="Not a participant.")

    now = datetime.utcnow()
    part.last_read_at = now

    # Update unread messages sent by others in this conversation
    unread_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
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
        # Broadcast read receipt to all conversation participants
        await manager.broadcast_to_conversation(
            conversation_id=conversation_id,
            event="message_status_updated",
            payload={
                "conversation_id": conversation_id,
                "message_ids": updated_msg_ids,
                "status": "read",
                "reader_id": current_user.id
            },
            db=db
        )

    return {"success": True, "read_count": len(updated_msg_ids)}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Soft-delete a message sent by current user.
    Replaces content with Signal's standard 'This message was deleted' indicator.
    """
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")

    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages.")

    msg.is_deleted = True
    msg.content = "This message was deleted"
    msg.attachment_url = None
    db.commit()
    db.refresh(msg)

    # Broadcast deletion
    await manager.broadcast_to_conversation(
        conversation_id=msg.conversation_id,
        event="message_deleted",
        payload={"message_id": message_id, "conversation_id": msg.conversation_id},
        db=db
    )

    return {"success": True, "message": "Message deleted."}
