import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    PROJECT_NAME: str = "Signal Messenger Clone API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Security / Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "signal-clone-scaler-ultra-secure-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days session
    DEFAULT_MOCK_OTP: str = "123456"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/signal.db")

    # Uploads
    UPLOAD_FOLDER: str = str(UPLOAD_DIR)
    MAX_UPLOAD_SIZE: int = 25 * 1024 * 1024  # 25 MB max attachment

    # CORS
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "*"
    ]

settings = Settings()
