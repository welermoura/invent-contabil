from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models import PushSubscription, Notification, User
from backend.auth import get_current_user
from backend.notification_service import get_vapid_public_key

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    responses={404: {"description": "Not found"}},
)

class SubscriptionSchema(BaseModel):
    endpoint: str
    keys: Optional[dict] = None

class UnsubscribeSchema(BaseModel):
    endpoint: str

class NotificationResponse(BaseModel):
    id: int
    title: str
    body: str
    item_id: Optional[int]
    type: str
    click_action: Optional[str]
    read: bool
    created_at: str # ISO format

    class Config:
        from_attributes = True

@router.get("/vapid-public-key")
async def get_vapid_key():
    return {"publicKey": get_vapid_public_key()}

@router.post("/subscribe")
async def subscribe(subscription: SubscriptionSchema, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Check if subscription already exists
    result = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == subscription.endpoint))
    existing = result.scalars().first()

    if existing:
        # Update user if changed? usually endpoints are unique per browser profile
        existing.user_id = current_user.id
        existing.keys_p256dh = subscription.keys.get("p256dh")
        existing.keys_auth = subscription.keys.get("auth")
    else:
        new_sub = PushSubscription(
            user_id=current_user.id,
            endpoint=subscription.endpoint,
            keys_p256dh=subscription.keys.get("p256dh"),
            keys_auth=subscription.keys.get("auth")
        )
        db.add(new_sub)

    await db.commit()
    return {"status": "success"}

@router.post("/unsubscribe")
async def unsubscribe(payload: UnsubscribeSchema, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint))
    existing = result.scalars().first()
    if existing:
        await db.delete(existing)
        await db.commit()
    return {"status": "success"}

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.read == False)

    query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.put("/{notification_id}/read")
async def mark_read(notification_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id))
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.read = True
    await db.commit()
    return {"status": "marked as read"}

@router.put("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Update all unread
    query = select(Notification).where(Notification.user_id == current_user.id, Notification.read == False)
    result = await db.execute(query)
    notifications = result.scalars().all()

    for n in notifications:
        n.read = True

    await db.commit()
    return {"status": "all marked as read", "count": len(notifications)}
