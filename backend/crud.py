from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend import models, schemas
from backend.auth import get_password_hash

# Users
async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(models.User).where(models.User.email == email))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

# Branches
async def get_branches(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(select(models.Branch).offset(skip).limit(limit))
    return result.scalars().all()

async def create_branch(db: AsyncSession, branch: schemas.BranchCreate):
    db_branch = models.Branch(**branch.dict())
    db.add(db_branch)
    await db.commit()
    await db.refresh(db_branch)
    return db_branch

# Items
async def get_items(db: AsyncSession, skip: int = 0, limit: int = 100, status: str = None, category: str = None, branch_id: int = None, search: str = None):
    query = select(models.Item)
    if status:
        query = query.where(models.Item.status == status)
    if category:
        query = query.where(models.Item.category == category)
    if branch_id:
        query = query.where(models.Item.branch_id == branch_id)
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (models.Item.description.ilike(search_filter)) |
            (models.Item.serial_number.ilike(search_filter)) |
            (models.Item.invoice_number.ilike(search_filter))
        )

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

async def create_item(db: AsyncSession, item: schemas.ItemCreate):
    db_item = models.Item(**item.dict())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def update_item_status(db: AsyncSession, item_id: int, status: models.ItemStatus, user_id: int):
    result = await db.execute(select(models.Item).where(models.Item.id == item_id))
    db_item = result.scalars().first()
    if db_item:
        db_item.status = status
        # Log the action
        log = models.Log(item_id=item_id, user_id=user_id, action=f"Status changed to {status}")
        db.add(log)
        await db.commit()
        await db.refresh(db_item)
    return db_item
