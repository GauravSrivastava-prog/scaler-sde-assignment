"""
Pydantic Schemas for Request & Response Serialization
Strict type validation, response formatting, and metadata schemas.
Adheres to Pydantic V2 specification (ConfigDict, json_schema_extra).
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ----------------------------------------------------
# User Schemas
# ----------------------------------------------------
class UserBase(BaseModel):
    phone_number: str = Field(...)
    username: str = Field(...)
    display_name: str = Field(...)
    about: Optional[str] = Field("Hey there! I am using Signal.")
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: Optional[str] = None


class UserLogin(BaseModel):
    phone_or_username: str = Field(...)
    password: Optional[str] = None


class OTPRequest(BaseModel):
    phone_number: str = Field(...)


class OTPVerify(BaseModel):
    phone_number: str = Field(...)
    otp: str = Field(...)
    username: Optional[str] = None
    display_name: Optional[str] = None


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    about: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    phone_number: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    about: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ----------------------------------------------------
# Contact Schemas
# ----------------------------------------------------
class ContactCreate(BaseModel):
    contact_user_id: Optional[str] = None
    phone_or_username: Optional[str] = None
    nickname: Optional[str] = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    contact_user_id: str
    nickname: Optional[str] = None
    created_at: datetime
    contact_user: UserResponse


# ----------------------------------------------------
# Reaction Schemas
# ----------------------------------------------------
class ReactionCreate(BaseModel):
    emoji: str = Field(...)


class ReactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    message_id: str
    user_id: str
    emoji: str
    created_at: datetime
    user: Optional[UserResponse] = None


# ----------------------------------------------------
# Message Schemas
# ----------------------------------------------------
class MessageBase(BaseModel):
    content: Optional[str] = None
    message_type: str = Field("text")  # "text", "image", "file", "audio", "system"
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_size: Optional[int] = None
    attachment_mime: Optional[str] = None
    reply_to_id: Optional[str] = None


class MessageCreate(MessageBase):
    temp_id: Optional[str] = None  # Frontend optimistic ID


class QuotedMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sender_id: str
    sender_name: Optional[str] = None
    content: Optional[str] = None
    message_type: str = "text"
    attachment_url: Optional[str] = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    sender_id: str
    sender: Optional[UserResponse] = None
    reply_to_id: Optional[str] = None
    reply_to: Optional[QuotedMessageResponse] = None
    content: Optional[str] = None
    message_type: str = "text"
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_size: Optional[int] = None
    attachment_mime: Optional[str] = None
    status: str = "sent"
    expires_at: Optional[datetime] = None
    is_deleted: bool = False
    created_at: datetime
    reactions: List[ReactionResponse] = []
    temp_id: Optional[str] = None


# ----------------------------------------------------
# Conversation Schemas
# ----------------------------------------------------
class ConversationParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    role: str
    last_read_message_id: Optional[str] = None
    last_read_at: Optional[datetime] = None
    joined_at: datetime
    user: UserResponse


class ConversationCreateDirect(BaseModel):
    recipient_user_id: str


class GroupCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    avatar_url: Optional[str] = None
    member_user_ids: List[str] = Field(..., min_length=1)


class DisappearingTimerUpdate(BaseModel):
    timer_seconds: int = Field(0, ge=0, le=604800)  # 0 to 7 days


class AddMemberRequest(BaseModel):
    user_id: str
    role: Optional[str] = "member"


class ConversationSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_group: bool
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    created_by: Optional[str] = None
    disappearing_messages_timer: int = 0
    created_at: datetime
    updated_at: datetime
    participants: List[ConversationParticipantResponse] = []
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    recipient: Optional[UserResponse] = None


# ----------------------------------------------------
# WebSocket Events
# ----------------------------------------------------
class WSEventIn(BaseModel):
    action: str  # "ping", "send_message", "typing", "mark_read", "react"
    data: dict = Field(default_factory=dict)


class WSEventOut(BaseModel):
    event: str
    payload: dict = Field(default_factory=dict)
