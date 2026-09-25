"""
Group Messaging API Router
Manages group creation, membership invitations, administrative controls,
and group lifecycle events.
"""
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Conversation,
    ConversationParticipant,
    Message,
    User
)
from app.schemas import (
    GroupCreate,
    ConversationSummaryResponse,
    AddMemberRequest,
    ConversationParticipantResponse,
    MessageResponse
)
from app.auth import get_current_user
from app.routers.conversations import format_conversation_summary
from app.websocket_manager import manager

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.post("", response_model=ConversationSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_in: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new group conversation with a designated title, optional group avatar,
    and member list. The creator is granted the 'admin' role.
    """
    title = group_in.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Group title cannot be empty.")

    # Generate initials avatar for group if not provided
    initials = "".join([w[0].upper() for w in title.split()[:2]]) or "GP"
    avatar = group_in.avatar_url or f"https://api.dicebear.com/7.x/identicon/svg?seed={title}&backgroundColor=2c6bed"

    # Create group conversation
    conv = Conversation(
        is_group=True,
        title=title,
        avatar_url=avatar,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(conv)
    db.flush()

    # Add creator as admin
    creator_part = ConversationParticipant(
        conversation_id=conv.id,
        user_id=current_user.id,
        role="admin"
    )
    db.add(creator_part)

    # Add other members
    added_members = set()
    added_members.add(current_user.id)

    for member_id in group_in.member_user_ids:
        if member_id in added_members:
            continue
        user = db.query(User).filter(User.id == member_id).first()
        if user:
            part = ConversationParticipant(
                conversation_id=conv.id,
                user_id=member_id,
                role="member"
            )
            db.add(part)
            added_members.add(member_id)

    # Add initial system message
    sys_msg = Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=f"{current_user.display_name} created the group \"{title}\"",
        message_type="system",
        status="delivered"
    )
    db.add(sys_msg)

    db.commit()
    db.refresh(conv)

    summary = format_conversation_summary(conv, current_user.id, db)
    summary_data = summary.model_dump(mode="json")

    # Broadcast conversation creation to all added members
    for uid in added_members:
        await manager.send_to_user(uid, "conversation_created", {"conversation": summary_data})

    return summary


@router.get("/{conversation_id}/members", response_model=List[ConversationParticipantResponse])
def get_group_members(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all members in the group along with their roles (admin vs member).
    """
    # Verify caller is a member
    caller_part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not caller_part:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation.")

    members = (
        db.query(ConversationParticipant)
        .filter(ConversationParticipant.conversation_id == conversation_id)
        .all()
    )
    return [
        ConversationParticipantResponse.model_validate(m)
        for m in members
    ]


@router.post("/{conversation_id}/members", response_model=ConversationParticipantResponse)
async def add_group_member(
    conversation_id: str,
    member_req: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new member to an existing group. (Requires admin role or open policy).
    """
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.is_group == True).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group conversation not found.")

    caller_part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not caller_part:
        raise HTTPException(status_code=403, detail="You are not a member of this group.")

    # Check if target user exists
    target_user = db.query(User).filter(User.id == member_req.user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found.")

    # Check if already a member
    existing = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == member_req.user_id
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already in this group.")

    new_part = ConversationParticipant(
        conversation_id=conversation_id,
        user_id=member_req.user_id,
        role=member_req.role or "member"
    )
    db.add(new_part)

    # Insert system event message
    sys_msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=f"{current_user.display_name} added {target_user.display_name} to the group.",
        message_type="system",
        status="delivered"
    )
    db.add(sys_msg)
    conv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(new_part)
    db.refresh(sys_msg)

    # Broadcast system message
    msg_data = MessageResponse.model_validate(sys_msg).model_dump(mode="json")
    await manager.broadcast_to_conversation(
        conversation_id=conversation_id,
        event="new_message",
        payload={"message": msg_data},
        db=db
    )

    return ConversationParticipantResponse.model_validate(new_part)


@router.delete("/{conversation_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_group_member(
    conversation_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a member from the group.
    Admins can remove any member; non-admins can only remove themselves (leave).
    """
    conv = db.query(Conversation).filter(Conversation.id == conversation_id, Conversation.is_group == True).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Group conversation not found.")

    caller_part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id
        )
        .first()
    )
    if not caller_part:
        raise HTTPException(status_code=403, detail="You are not a member of this group.")

    if user_id != current_user.id and caller_part.role != "admin":
        raise HTTPException(status_code=403, detail="Only group admins can remove other members.")

    target_part = (
        db.query(ConversationParticipant)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id
        )
        .first()
    )
    if not target_part:
        raise HTTPException(status_code=404, detail="Member not found in this group.")

    target_user = target_part.user

    db.delete(target_part)

    # Insert system event message
    action_text = f"{target_user.display_name} left the group." if user_id == current_user.id else f"{current_user.display_name} removed {target_user.display_name} from the group."
    sys_msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=action_text,
        message_type="system",
        status="delivered"
    )
    db.add(sys_msg)
    conv.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(sys_msg)

    # Broadcast system message
    msg_data = MessageResponse.model_validate(sys_msg).model_dump(mode="json")
    await manager.broadcast_to_conversation(
        conversation_id=conversation_id,
        event="new_message",
        payload={"message": msg_data},
        db=db
    )

    return None
