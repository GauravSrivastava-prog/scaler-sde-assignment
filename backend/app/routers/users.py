"""
Users API Router
Search users, fetch profiles, update display details and avatar.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import User
from app.schemas import UserResponse, UserUpdate
from app.auth import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/search", response_model=List[UserResponse])
def search_users(
    q: str = Query("", description="Query string to search username, display name, or phone number"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search for registered Signal users. Automatically excludes current user.
    """
    query_str = q.strip().lower()
    if not query_str:
        # Return recent contacts/users limit 20
        users = (
            db.query(User)
            .filter(User.id != current_user.id)
            .order_by(User.created_at.desc())
            .limit(20)
            .all()
        )
        return [UserResponse.model_validate(u) for u in users]

    pattern = f"%{query_str}%"
    users = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            or_(
                User.username.ilike(pattern),
                User.display_name.ilike(pattern),
                User.phone_number.ilike(pattern)
            )
        )
        .limit(25)
        .all()
    )
    return [UserResponse.model_validate(u) for u in users]


@router.get("/all", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all active users on the platform (useful for quickly starting new chats in evaluation).
    """
    users = (
        db.query(User)
        .filter(User.id != current_user.id)
        .order_by(User.display_name.asc())
        .limit(50)
        .all()
    )
    return [UserResponse.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve user information by user ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse.model_validate(user)


@router.patch("/me", response_model=UserResponse)
def update_profile(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update personal profile information (display name, about bio, avatar URL).
    """
    if user_update.display_name is not None:
        name = user_update.display_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Display name cannot be empty")
        current_user.display_name = name

    if user_update.about is not None:
        current_user.about = user_update.about.strip()

    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url.strip()

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)
