from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel
from datetime import datetime

from backend import models, crud, auth
from backend.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Get all notifications for the current user, ordered by creation date desc.
    """
    # Using a direct query here since crud for notifications is simple
    from sqlalchemy.future import select
    query = select(models.Notification).where(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc())

    result = await db.execute(query)
    notifications = result.scalars().all()
    return notifications

@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    from sqlalchemy.future import select
    query = select(models.Notification).where(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    )
    result = await db.execute(query)
    notification = result.scalars().first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.read = True
    await db.commit()
    await db.refresh(notification)
    return notification

@router.put("/read-all", response_model=List[NotificationResponse])
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    from sqlalchemy import update
    query = update(models.Notification).where(
        models.Notification.user_id == current_user.id,
        models.Notification.read == False
    ).values(read=True)

    await db.execute(query)
    await db.commit()

    # Return updated list
    return await get_notifications(db, current_user)
