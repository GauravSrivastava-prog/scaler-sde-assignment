"""
Authentication & Authorization Module
Handles JWT token issuance/verification, password hashing, mock OTP validation,
and FastAPI dependency injection for HTTP endpoints and WebSocket handshakes.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict
import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

import bcrypt

# OAuth2 scheme for Swagger UI & Authorization header parsing
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

# In-memory mock OTP storage: {phone_number: {"otp": "123456", "expires_at": datetime}}
MOCK_OTP_STORE: Dict[str, dict] = {}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify raw password against bcrypt hash."""
    if not hashed_password or not plain_password:
        return False
    try:
        # Truncate to 72 bytes to adhere to bcrypt standard specification
        plain_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hash_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash password using direct native bcrypt with salt rounds."""
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")



def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Issue a cryptographically signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    HTTP route dependency to extract and authenticate current user from Bearer token.
    Raises 401 if unauthenticated.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if not payload:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise credentials_exception

    return user


def get_current_user_ws(token: str, db: Session) -> Optional[User]:
    """
    Extracts user for WebSocket connection during initial handshake.
    Returns None if token is invalid or expired.
    """
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def generate_mock_otp(phone_number: str) -> str:
    """
    Generate or return standard mock OTP for testing.
    Standardized to settings.DEFAULT_MOCK_OTP ('123456') for predictable testing.
    """
    otp = settings.DEFAULT_MOCK_OTP
    MOCK_OTP_STORE[phone_number] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10)
    }
    return otp


def verify_mock_otp(phone_number: str, otp: str) -> bool:
    """
    Verifies submitted OTP against mock store or allows the standard test OTP '123456'.
    """
    # Accept universal mock OTP for convenience
    if otp == settings.DEFAULT_MOCK_OTP:
        return True
    
    stored = MOCK_OTP_STORE.get(phone_number)
    if not stored:
        return False
    if stored["expires_at"] < datetime.utcnow():
        del MOCK_OTP_STORE[phone_number]
        return False
    return stored["otp"] == otp
