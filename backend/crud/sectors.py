from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_sectors(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None, branch_id: int = None):
    query = select(models.Sector).options(
        joinedload(models.Sector.branch).options(noload(models.Branch.items), noload(models.Branch.users)),
        noload(models.Sector.items)
    )
    if branch_id:
        query = query.where(or_(models.Sector.branch_id == branch_id, models.Sector.branch_id == None))
    if search:
        query = query.where(models.Sector.name.ilike(f"%{search}%"))

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def create_sector(db: AsyncSession, sector: schemas.SectorCreate):
    db_sector = models.Sector(**sector.dict())
    db.add(db_sector)
    await db.commit()
    await db.refresh(db_sector)
    return db_sector


async def update_sector(db: AsyncSession, sector_id: int, sector: schemas.SectorUpdate):
    result = await db.execute(select(models.Sector).where(models.Sector.id == sector_id))
    db_sector = result.scalars().first()
    if db_sector:
        update_data = sector.model_dump(exclude_unset=True) if hasattr(sector, 'model_dump') else sector.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_sector, key, value)
        await db.commit()
        await db.refresh(db_sector)
    return db_sector


async def delete_sector(db: AsyncSession, sector_id: int):
    result = await db.execute(select(models.Sector).where(models.Sector.id == sector_id))
    db_sector = result.scalars().first()
    if db_sector:
        await db.delete(db_sector)
        await db.commit()
        return True
    return False

# Categories

