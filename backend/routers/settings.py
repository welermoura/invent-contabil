from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
from typing import Dict
import os
import shutil
import time

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/", response_model=Dict[str, str])
async def read_settings(db: AsyncSession = Depends(get_db)):
    # Public access allowed for title/favicon on login screen
    settings_list = await crud.get_system_settings(db)
    return {s.key: s.value for s in settings_list}

@router.put("/", response_model=Dict[str, str])
async def update_settings(
    settings: Dict[str, str],
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem alterar configurações do sistema")

    updated = {}
    for key, value in settings.items():
        s = await crud.update_system_setting(db, key, value)
        updated[s.key] = s.value
    return updated

@router.post("/favicon")
async def upload_favicon(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem alterar o favicon")

    UPLOAD_DIR = "/app/uploads/settings"
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR)

    ext = file.filename.split('.')[-1]
    filename = f"favicon_{int(time.time())}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Relative path for frontend serving
    url = f"uploads/settings/{filename}"
    await crud.update_system_setting(db, "favicon_url", url)

    return {"url": url}
