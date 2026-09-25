"""
Contacts API Router
Manage Signal address book: list contacts, add by user ID / username / phone, remove contacts.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import Contact, User
from app.schemas import ContactCreate, ContactResponse
from app.auth import get_current_user

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=List[ContactResponse])
def get_contacts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch all contacts in the authenticated user's address book.
    """
    contacts = (
        db.query(Contact)
        .filter(Contact.user_id == current_user.id)
        .join(Contact.contact_user)
        .order_by(User.display_name.asc())
        .all()
    )
    return [ContactResponse.model_validate(c) for c in contacts]


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def add_contact(
    contact_in: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a new contact by either `contact_user_id` or `phone_or_username`.
    """
    target_user = None

    if contact_in.contact_user_id:
        target_user = db.query(User).filter(User.id == contact_in.contact_user_id).first()
    elif contact_in.phone_or_username:
        query_val = contact_in.phone_or_username.strip()
        target_user = db.query(User).filter(
            or_(User.username == query_val.lower(), User.phone_number == query_val)
        ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact user could not be found."
        )

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot add yourself as a contact."
        )

    # Check if already added
    existing = (
        db.query(Contact)
        .filter(Contact.user_id == current_user.id, Contact.contact_user_id == target_user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{target_user.display_name} is already in your contacts."
        )

    contact = Contact(
        user_id=current_user.id,
        contact_user_id=target_user.id,
        nickname=contact_in.nickname
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)

    return ContactResponse.model_validate(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Remove a contact from the address book.
    """
    contact = (
        db.query(Contact)
        .filter(Contact.id == contact_id, Contact.user_id == current_user.id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found.")

    db.delete(contact)
    db.commit()
    return None
