"""
File Uploads API Router
Supports image, audio notes, and document uploads for attachments.
"""
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from app.config import settings
from app.models import User
from app.auth import get_current_user

router = APIRouter(prefix="/uploads", tags=["Uploads"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an attachment (image, audio recording, document).
    Generates a collision-resistant filename and returns accessibility URL.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename required.")

    # Generate safe unique filename
    ext = Path(file.filename).suffix.lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = Path(settings.UPLOAD_FOLDER) / unique_name

    # Write file to disk in chunks to avoid memory spikes
    total_size = 0
    try:
        with open(dest_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_size += len(chunk)
                if total_size > settings.MAX_UPLOAD_SIZE:
                    dest_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed size ({settings.MAX_UPLOAD_SIZE // (1024*1024)}MB)."
                    )
                buffer.write(chunk)
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise exc
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"File write failed: {str(exc)}")

    # Determine message_type
    content_type = file.content_type or "application/octet-stream"
    if content_type.startswith("image/"):
        msg_type = "image"
    elif content_type.startswith("audio/"):
        msg_type = "audio"
    else:
        msg_type = "file"

    return {
        "url": f"/uploads/{unique_name}",
        "filename": file.filename,
        "content_type": content_type,
        "size": total_size,
        "message_type": msg_type
    }
