"""
Database Engine & Session Configuration
Configures SQLite with Foreign Key constraints enabled and FastAPI dependency.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

# Engine configuration
# Note: check_same_thread=False is needed for SQLite when used across multiple FastAPI request threads
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# CRITICAL FOR SQLITE: Foreign key constraints are disabled by default in SQLite.
# This event listener guarantees referential integrity across all connections.
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session and guarantees closure
    even if exceptions occur during request processing.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
