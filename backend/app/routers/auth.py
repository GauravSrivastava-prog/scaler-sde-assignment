"""
Authentication Endpoints
Handles user registration, login, mock OTP verification, and session token generation.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import User
from app.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    TokenResponse,
    OTPRequest,
    OTPVerify
)
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    generate_mock_otp,
    verify_mock_otp
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user with phone number and username.
    Validates uniqueness and returns a signed JWT token.
    """
    # Check if username or phone already exists
    existing = db.query(User).filter(
        or_(User.username == user_in.username.strip().lower(), User.phone_number == user_in.phone_number.strip())
    ).first()
    
    if existing:
        if existing.username == user_in.username.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this phone number already exists."
        )

    hashed_pw = get_password_hash(user_in.password) if user_in.password else None

    # Generate initials avatar if no avatar provided
    initials = "".join([part[0].upper() for part in user_in.display_name.split()[:2]]) or "SG"
    avatar = user_in.avatar_url or f"https://api.dicebear.com/7.x/initials/svg?seed={initials}&backgroundColor=2c6bed,0a84ff,007aff"

    new_user = User(
        phone_number=user_in.phone_number.strip(),
        username=user_in.username.strip().lower(),
        display_name=user_in.display_name.strip(),
        avatar_url=avatar,
        about=user_in.about or "Hey there! I am using Signal.",
        hashed_password=hashed_pw,
        is_online=True,
        last_seen=datetime.utcnow()
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(data={"sub": new_user.id, "username": new_user.username})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user)
    )


@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Log in using either phone number or username.
    """
    identifier = login_data.phone_or_username.strip().lower()
    user = db.query(User).filter(
        or_(
            User.username == identifier,
            User.phone_number == login_data.phone_or_username.strip()
        )
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this username or phone number."
        )

    # If user has a password set and password was provided, verify it
    if user.hashed_password and login_data.password:
        if not verify_password(login_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect password."
            )

    # Update online status
    user.is_online = True
    user.last_seen = datetime.utcnow()
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.id, "username": user.username})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.post("/send-otp")
def send_otp(otp_req: OTPRequest):
    """
    Mock OTP generation for Signal phone number verification flow.
    Returns the mock OTP so the user can easily see it or auto-fill it.
    """
    phone = otp_req.phone_number.strip()
    otp = generate_mock_otp(phone)
    return {
        "success": True,
        "message": f"Verification code sent to {phone}. For demo testing, use code: {otp}",
        "mock_otp": otp
    }


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp_and_login(verify_data: OTPVerify, db: Session = Depends(get_db)):
    """
    Verify mock OTP. If phone exists, logs in; if not, provisions a new account.
    """
    phone = verify_data.phone_number.strip()
    if not verify_mock_otp(phone, verify_data.otp.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code. Use '123456'."
        )

    user = db.query(User).filter(User.phone_number == phone).first()

    if not user:
        # Create a new user with supplied or fallback details
        username = (verify_data.username or f"user_{phone[-4:]}").strip().lower()
        # Ensure unique username
        existing_u = db.query(User).filter(User.username == username).first()
        if existing_u:
            username = f"{username}_{datetime.utcnow().strftime('%S')}"

        display_name = verify_data.display_name or f"Signal User {phone[-4:]}"
        initials = "".join([part[0].upper() for part in display_name.split()[:2]]) or "SU"
        avatar = f"https://api.dicebear.com/7.x/initials/svg?seed={initials}&backgroundColor=2c6bed,0a84ff"

        user = User(
            phone_number=phone,
            username=username,
            display_name=display_name,
            avatar_url=avatar,
            is_online=True,
            last_seen=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.is_online = True
        user.last_seen = datetime.utcnow()
        db.commit()
        db.refresh(user)

    token = create_access_token(data={"sub": user.id, "username": user.username})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current user profile from authenticated session token.
    """
    return UserResponse.model_validate(current_user)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Log out current session and update last seen timestamp.
    """
    current_user.is_online = False
    current_user.last_seen = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Logged out successfully."}
