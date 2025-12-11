import json
import logging
import asyncio
import os
from functools import partial
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pywebpush import webpush, WebPushException
from backend.models import PushSubscription, Notification, User, UserRole
from sqlalchemy import or_

# VAPID Keys
# Loaded from environment variables or hardcoded fallback (for development/demo purposes)
# In production, ALWAYS set these via environment variables.
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgGLinzQ9yZtiHN7tT\n32vnGK6EcIZ2iQkAG1JA5e1O3KehRANCAASjdYo9l/Nr+n2iZZo2mSYnA84lJtB3\nlJjCEijm7oJHrkmPR+IiOimzddgfw5t8YzDNbwNlCGoZJOwrCvpqX7uH\n-----END PRIVATE KEY-----")
VAPID_CLAIMS = {"sub": os.getenv("VAPID_MAILTO", "mailto:admin@example.com")}

# Public Key for Frontend
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "BKN1ij2X82v6faJlmjaZJicDziUm0HeUmMISKObugkeuSY9H4iI6KbN12B_Dm3xjMM1vA2UIahkk7CsK-mpfu4c")

logger = logging.getLogger(__name__)

def _webpush_sync(subscription_info, data):
    """Synchronous wrapper for webpush to be run in executor"""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.error("VAPID keys not configured. Cannot send push notification.")
        return

    webpush(
        subscription_info=subscription_info,
        data=json.dumps(data),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims=VAPID_CLAIMS
    )

async def send_web_push(subscription_info, data, db: AsyncSession, sub_id: int):
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None,
            partial(_webpush_sync, subscription_info, data)
        )
    except Exception as e:
        # Check for 410 Gone (Subscription Expired)
        # pywebpush raises WebPushException
        if isinstance(e, WebPushException) and e.response and e.response.status_code == 410:
            logger.info(f"Removing expired subscription {sub_id}")
            try:
                sub = await db.get(PushSubscription, sub_id)
                if sub:
                    await db.delete(sub)
                    await db.commit()
            except Exception as db_err:
                logger.error(f"Error removing subscription: {db_err}")
        else:
            logger.error(f"Web Push failed: {e}")

async def create_notification(db: AsyncSession, user_id: int, title: str, body: str, item_id: int = None, type: str = "info", click_action: str = None):
    # 1. Create DB record
    notif = Notification(
        user_id=user_id,
        title=title,
        body=body,
        item_id=item_id,
        type=type,
        click_action=click_action
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)

    # 2. Get user subscriptions
    result = await db.execute(select(PushSubscription).where(PushSubscription.user_id == user_id))
    subscriptions = result.scalars().all()

    # 3. Send Push
    payload = {
        "title": title,
        "body": body,
        "item_id": item_id,
        "type": type,
        "click_action": click_action,
        "timestamp": notif.created_at.isoformat() if notif.created_at else None,
        "id": notif.id
    }

    for sub in subscriptions:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.keys_p256dh,
                "auth": sub.keys_auth
            }
        }
        await send_web_push(sub_info, payload, db, sub.id)

async def notify_approvers(db: AsyncSession, title: str, body: str, item_id: int, type: str, click_action: str):
    result = await db.execute(select(User).where(or_(User.role == UserRole.APPROVER, User.role == UserRole.ADMIN)))
    approvers = result.scalars().all()
    for approver in approvers:
        await create_notification(db, approver.id, title, body, item_id, type, click_action)

async def notify_user(db: AsyncSession, user_id: int, title: str, body: str, item_id: int, type: str, click_action: str):
    await create_notification(db, user_id, title, body, item_id, type, click_action)

def get_vapid_public_key():
    return VAPID_PUBLIC_KEY
