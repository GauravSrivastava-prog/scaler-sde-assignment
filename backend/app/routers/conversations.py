"""
Conversations API Router
Manages 1-on-1 chats and group thread listings, unread counters,
last message previews, and disappearing message policies.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_

from app.database import get_db
from app.models import (
    Conversation,
    ConversationParticipant,
    Message,
    User
)
from app.schemas import (
    ConversationSummaryResponse,
    ConversationCreateDirect,
    ConversationParticipantResponse,
    MessageResponse,
    UserResponse,
    DisappearingTimerUpdate
)
from app.auth import get_current_user
from app.websocket_manager import manager

router = APIRouter(prefix="/conversations", tags=["Conversations"])


def format_conversation_summary(
    conv: Conversation,
    current_user_id: str,
    db: Session
) -> ConversationSummaryResponse:
    """
    Helper function to enrich a Conversation model with participants,
    direct peer profile, latest message, and unread counts.
    """
    # Fetch all participants with their user models
    participants = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.conversation_id == conv.id)
        .all()
    )

    participant_responses = [
        ConversationParticipantResponse(
            id=p.id,
            user_id=p.user_id,
            role=p.role,
            last_read_message_id=p.last_read_message_id,
            last_read_at=p.last_read_at,
            joined_at=p.joined_at,
            user=UserResponse.model_validate(p.user)
        )
        for p in participants
    ]

    # Find the current user's participant entry
    my_part = next((p for p in participants if p.user_id == current_user_id), None)

    # Determine direct peer if 1-on-1
    recipient = None
    if not conv.is_group:
        peer = next((p.user for p in participants if p.user_id != current_user_id), None)
        # Handle "Note to Self" edge case where conversation is with oneself
        if not peer:
            peer = next((p.user for p in participants if p.user_id == current_user_id), None)
        if peer:
            recipient = UserResponse.model_validate(peer)

    # Fetch last message
    last_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id, Message.is_deleted == False)
        .order_by(desc(Message.created_at))
        .first()
    )
    last_msg_response = MessageResponse.model_validate(last_msg) if last_msg else None

    # Calculate unread messages
    unread_count = 0
    if my_part:
        if my_part.last_read_at:
            unread_count = (
                db.query(func.count(Message.id))
                .filter(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user_id,
                    Message.created_at > my_part.last_read_at,
                    Message.is_deleted == False
                )
                .scalar() or 0
            )
        else:
            unread_count = (
                db.query(func.count(Message.id))
                .filter(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user_id,
                    Message.is_deleted == False
                )
                .scalar() or 0
            )

    return ConversationSummaryResponse(
        id=conv.id,
        is_group=conv.is_group,
        title=conv.title,
        avatar_url=conv.avatar_url,
        created_by=conv.created_by,
        disappearing_messages_timer=conv.disappearing_messages_timer or 0,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        participants=participant_responses,
        last_message=last_msg_response,
        unread_count=unread_count,
        recipient=recipient
    )


@router.get("", response_model=List[ConversationSummaryResponse])
def get_user_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all active conversations for the authenticated user,
    ordered by most recent activity (Signal default).
    """
    # Find all conversation IDs where current user is participant
    conv_ids = (
        db.query(ConversationParticipant.conversation_id)
        .filter(ConversationParticipant.user_id == current_user.id)
        .all()
    )
    conv_id_list = [cid[0] for cid in conv_ids]

    if not conv_id_list:
        return []

    conversations = (
        db.query(Conversation)
        .filter(Conversation.id.in_(conv_id_list))
        .order_by(desc(Conversation.updated_at))
        .all()
    )

    return [format_conversation_summary(c, current_user.id, db) for c in conversations]


@router.post("/direct", response_model=ConversationSummaryResponse)
def get_or_create_direct_conversation(
    conv_in: ConversationCreateDirect,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initiate or retrieve an existing 1-on-1 conversation with another user.
    Guarantees that duplicate 1-on-1 rooms are never created between the same pair.
    """
    recipient_id = conv_in.recipient_user_id.strip()
    recipient = db.query(User).filter(User.id == recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found.")

    # Check if a 1-on-1 conversation already exists between these two users
    if recipient_id == current_user.id:
        # Note to self
        conv = (
            db.query(Conversation)
            .filter(Conversation.is_group == False, Conversation.created_by == current_user.id)
            .join(ConversationParticipant)
            .filter(ConversationParticipant.user_id == current_user.id)
            .first()
        )
        if conv:
            return format_conversation_summary(conv, current_user.id, db)
    else:
        # Find shared non-group conversation
        my_convs = (
            db.query(ConversationParticipant.conversation_id)
            .filter(ConversationParticipant.user_id == current_user.id)
            .subquery()
        )
        existing_participant = (
            db.query(ConversationParticipant)
            .join(Conversation, Conversation.id == ConversationParticipant.conversation_id)
            .filter(
                Conversation.is_group == False,
                ConversationParticipant.user_id == recipient_id,
                ConversationParticipant.conversation_id.in_(my_convs)
            )
            .first()
        )
        if existing_participant:
            conv = db.query(Conversation).filter(Conversation.id == existing_participant.conversation_id).first()
            if conv:
                return format_conversation_summary(conv, current_user.id, db)

    # Create new 1-on-1 conversation
    new_conv = Conversation(
        is_group=False,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_conv)
    db.flush()

    # Add participants
    p1 = ConversationParticipant(
        conversation_id=new_conv.id,
        user_id=current_user.id,
        role="admin"
    )
    db.add(p1)

    if recipient_id != current_user.id:
        p2 = ConversationParticipant(
            conversation_id=new_conv.id,
            user_id=recipient_id,
            role="member"
        )
        db.add(p2)

    db.commit()
    db.refresh(new_conv)

    return format_conversation_summary(new_conv, current_user.id, db)


@router.get("/{conversation_id}", response_model=ConversationSummaryResponse)
def get_conversation_by_id(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get conversation details and participants by conversation ID.
    Enforces authorization check that caller is a member.
    """
    is_member = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a participant in this conversation."
        )

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    return format_conversation_summary(conv, current_user.id, db)


@router.patch("/{conversation_id}/disappearing", response_model=ConversationSummaryResponse)
async def set_disappearing_timer(
    conversation_id: str,
    timer_in: DisappearingTimerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update the disappearing messages timer for a conversation.
    Emits a system notification message into the thread and notifies participants via WebSocket.
    """
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    is_member = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    conv.disappearing_messages_timer = timer_in.timer_seconds
    conv.updated_at = datetime.utcnow()

    # Human readable text
    if timer_in.timer_seconds == 0:
        desc = f"{current_user.display_name} turned off disappearing messages."
    elif timer_in.timer_seconds < 60:
        desc = f"{current_user.display_name} set disappearing messages to {timer_in.timer_seconds} seconds."
    elif timer_in.timer_seconds < 3600:
        desc = f"{current_user.display_name} set disappearing messages to {timer_in.timer_seconds // 60} minute(s)."
    elif timer_in.timer_seconds < 86400:
        desc = f"{current_user.display_name} set disappearing messages to {timer_in.timer_seconds // 3600} hour(s)."
    else:
        desc = f"{current_user.display_name} set disappearing messages to {timer_in.timer_seconds // 86400} day(s)."

    # Insert system event message
    sys_msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=desc,
        message_type="system",
        status="delivered"
    )
    db.add(sys_msg)
    db.commit()
    db.refresh(conv)
    db.refresh(sys_msg)

    # Broadcast system message via WebSocket
    msg_data = MessageResponse.model_validate(sys_msg).model_dump(mode="json")
    await manager.broadcast_to_conversation(
        conversation_id=conversation_id,
        event="new_message",
        payload={"message": msg_data},
        db=db
    )

    return format_conversation_summary(conv, current_user.id, db)
