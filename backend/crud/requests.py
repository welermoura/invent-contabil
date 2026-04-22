from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def create_request(db: AsyncSession, request: schemas.RequestCreate):
    db_request = models.Request(**request.dict())
    db.add(db_request)
    await db.commit()
    await db.refresh(db_request)
    return db_request


async def get_request(db: AsyncSession, request_id: int):
    # Optimize loading depth by using specific loader options
    # We use selectinload for the collection (items) and then joinedload for 1:1 relations inside items
    # to avoid excessively deep recursion warnings and improve performance for 80k+ items scale.
    from sqlalchemy.orm import joinedload, noload

    query = select(models.Request).where(models.Request.id == request_id).options(
        joinedload(models.Request.requester).options(noload(models.User.requests), noload(models.User.branches)),
        joinedload(models.Request.category).options(noload(models.Category.requests)),
        selectinload(models.Request.items).options(
             noload(models.Item.request),
             joinedload(models.Item.branch).options(noload(models.Branch.items)),
             joinedload(models.Item.transfer_target_branch),
             joinedload(models.Item.category_rel).options(noload(models.Category.items)),
             joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
             joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
             joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
             joinedload(models.Item.sector).options(noload(models.Sector.items))
        )
    )
    result = await db.execute(query)
    return result.scalars().first()


async def get_requests(db: AsyncSession, skip: int = 0, limit: int = 100,
                       requester_id: int = None, status: models.RequestStatus = None):
    query = select(models.Request).options(
        joinedload(models.Request.requester).options(noload(models.User.requests), noload(models.User.branches)),
        joinedload(models.Request.category).options(noload(models.Category.requests)),
        selectinload(models.Request.items).options(
            noload(models.Item.request),
            joinedload(models.Item.branch).options(noload(models.Branch.items)),
            joinedload(models.Item.responsible).options(noload(models.User.items_responsible))
        )
    )
    if requester_id:
        query = query.where(models.Request.requester_id == requester_id)
    if status:
        query = query.where(models.Request.status == status)

    query = query.order_by(models.Request.created_at.desc())
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def update_request(db: AsyncSession, request_id: int, request_update: schemas.RequestUpdate):
    result = await db.execute(select(models.Request).where(models.Request.id == request_id))
    db_request = result.scalars().first()
    if db_request:
        if request_update.status:
            db_request.status = request_update.status
        if request_update.current_step is not None:
            db_request.current_step = request_update.current_step
        await db.commit()
        await db.refresh(db_request)
        # Reload relationships
        from sqlalchemy.orm import joinedload, noload
        query = select(models.Request).where(models.Request.id == request_id).options(
            joinedload(models.Request.requester).options(noload(models.User.requests), noload(models.User.branches)),
            joinedload(models.Request.category).options(noload(models.Category.requests)),
            selectinload(models.Request.items).options(
                 noload(models.Item.request),
                 joinedload(models.Item.branch).options(noload(models.Branch.items)),
                 joinedload(models.Item.transfer_target_branch),
                 joinedload(models.Item.category_rel).options(noload(models.Category.items)),
                 joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
                 joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
                 joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
                 joinedload(models.Item.sector).options(noload(models.Sector.items))
            )
        )
        result = await db.execute(query)
        db_request = result.scalars().first()
    return db_request

