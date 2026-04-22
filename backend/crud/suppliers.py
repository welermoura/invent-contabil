from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_suppliers(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.Supplier).options(noload(models.Supplier.items))
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                models.Supplier.name.ilike(search_filter),
                models.Supplier.cnpj.ilike(search_filter)
            )
        )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_supplier_by_cnpj(db: AsyncSession, cnpj: str):
    result = await db.execute(select(models.Supplier).where(models.Supplier.cnpj == cnpj))
    return result.scalars().first()


async def create_supplier(db: AsyncSession, supplier: schemas.SupplierCreate):
    db_supplier = models.Supplier(**supplier.dict())
    db.add(db_supplier)
    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier


async def update_supplier(db: AsyncSession, supplier_id: int, supplier_update: schemas.SupplierBase):
    result = await db.execute(select(models.Supplier).where(models.Supplier.id == supplier_id))
    db_supplier = result.scalars().first()
    if db_supplier:
        if supplier_update.name: db_supplier.name = supplier_update.name
        if supplier_update.cnpj: db_supplier.cnpj = supplier_update.cnpj
        await db.commit()
        await db.refresh(db_supplier)
    return db_supplier


async def delete_supplier(db: AsyncSession, supplier_id: int):
    result = await db.execute(select(models.Supplier).where(models.Supplier.id == supplier_id))
    db_supplier = result.scalars().first()
    if db_supplier:
        await db.delete(db_supplier)
        await db.commit()
        return True
    return False

# Items

