from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend import schemas, models, auth
from backend.database import get_db

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=List[schemas.NotificationResponse])
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = select(models.Notification).where(models.Notification.user_id == current_user.id)

    if unread_only:
        query = query.where(models.Notification.read == False)

    query = query.order_by(models.Notification.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()
    return notifications

@router.put("/{notification_id}/read", response_model=schemas.NotificationResponse)
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    query = select(models.Notification).where(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    )
    result = await db.execute(query)
    notification = result.scalars().first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")

    notification.read = True
    await db.commit()
    await db.refresh(notification)
    return notification

@router.put("/read-all", status_code=204)
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
    return None
