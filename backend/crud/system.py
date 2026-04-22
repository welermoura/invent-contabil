from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_system_settings(db: AsyncSession):
    result = await db.execute(select(models.SystemSetting))
    return result.scalars().all()


async def get_system_setting(db: AsyncSession, key: str):
    result = await db.execute(select(models.SystemSetting).where(models.SystemSetting.key == key))
    return result.scalars().first()


async def update_system_setting(db: AsyncSession, key: str, value: str):
    setting = await get_system_setting(db, key)
    if setting:
        setting.value = value
    else:
        setting = models.SystemSetting(key=key, value=value)
        db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting


async def get_all_logs(db: AsyncSession, limit: int = 1000):
    query = select(models.Log).options(
        joinedload(models.Log.user),
        joinedload(models.Log.item)
    ).order_by(models.Log.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


