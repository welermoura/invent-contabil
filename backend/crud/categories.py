from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_categories(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.Category).options(
        noload(models.Category.items),
        noload(models.Category.requests),
        noload(models.Category.approval_workflows)
    )
    if search:
        query = query.where(models.Category.name.ilike(f"%{search}%"))
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_category_by_name(db: AsyncSession, name: str):
    result = await db.execute(select(models.Category).where(models.Category.name.ilike(name)))
    return result.scalars().first()


async def create_category(db: AsyncSession, category: schemas.CategoryCreate):
    db_category = models.Category(**category.dict())
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category


async def update_category(db: AsyncSession, category_id: int, category: schemas.CategoryBase):
    result = await db.execute(select(models.Category).where(models.Category.id == category_id))
    db_category = result.scalars().first()
    if db_category:
        if category.name: db_category.name = category.name
        # Update depreciation_months explicitly if present (even if 0, but check for None if field is optional)
        if category.depreciation_months is not None:
            db_category.depreciation_months = category.depreciation_months
        await db.commit()
        await db.refresh(db_category)
    return db_category


async def delete_category(db: AsyncSession, category_id: int):
    result = await db.execute(select(models.Category).where(models.Category.id == category_id))
    db_category = result.scalars().first()
    if db_category:
        await db.delete(db_category)
        await db.commit()
        return True
    return False

# Suppliers

