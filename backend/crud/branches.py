from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_branches(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    # Explicitly disable recursive loading for items and users
    query = select(models.Branch).options(
        noload(models.Branch.items),
        noload(models.Branch.users),
        noload(models.Branch.users_legacy)
    )
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                models.Branch.name.ilike(search_filter),
                models.Branch.cnpj.ilike(search_filter)
            )
        )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def create_branch(db: AsyncSession, branch: schemas.BranchCreate):
    db_branch = models.Branch(**branch.dict())
    db.add(db_branch)
    await db.commit()
    await db.refresh(db_branch)
    return db_branch


async def update_branch(db: AsyncSession, branch_id: int, branch: schemas.BranchBase): # Assuming Base has updatable fields
    result = await db.execute(select(models.Branch).where(models.Branch.id == branch_id))
    db_branch = result.scalars().first()
    if db_branch:
        if branch.name: db_branch.name = branch.name
        if branch.address: db_branch.address = branch.address
        if branch.cnpj: db_branch.cnpj = branch.cnpj
        await db.commit()
        await db.refresh(db_branch)
    return db_branch


async def delete_branch(db: AsyncSession, branch_id: int):
    result = await db.execute(select(models.Branch).where(models.Branch.id == branch_id))
    db_branch = result.scalars().first()
    if db_branch:
        await db.delete(db_branch)
        await db.commit()
        return True
    return False

# Cost Centers

async def get_branch(db: AsyncSession, branch_id: int):
    result = await db.execute(select(models.Branch).where(models.Branch.id == branch_id))
    return result.scalars().first()


