from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_cost_centers(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.CostCenter).options(noload(models.CostCenter.items))
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                models.CostCenter.name.ilike(search_filter),
                models.CostCenter.code.ilike(search_filter)
            )
        )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_cost_center_by_code(db: AsyncSession, code: str):
    result = await db.execute(select(models.CostCenter).where(models.CostCenter.code == code))
    return result.scalars().first()


async def create_cost_center(db: AsyncSession, cost_center: schemas.CostCenterCreate):
    db_cc = models.CostCenter(**cost_center.dict())
    db.add(db_cc)
    await db.commit()
    await db.refresh(db_cc)
    return db_cc


async def update_cost_center(db: AsyncSession, cost_center_id: int, cost_center: schemas.CostCenterUpdate):
    result = await db.execute(select(models.CostCenter).where(models.CostCenter.id == cost_center_id))
    db_cc = result.scalars().first()
    if db_cc:
        update_data = cost_center.model_dump(exclude_unset=True) if hasattr(cost_center, 'model_dump') else cost_center.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_cc, key, value)
        await db.commit()
        await db.refresh(db_cc)
    return db_cc


async def delete_cost_center(db: AsyncSession, cost_center_id: int):
    result = await db.execute(select(models.CostCenter).where(models.CostCenter.id == cost_center_id))
    db_cc = result.scalars().first()
    if db_cc:
        await db.delete(db_cc)
        await db.commit()
        return True
    return False

# Sectors

