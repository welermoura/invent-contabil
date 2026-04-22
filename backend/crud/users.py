from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(models.User).where(models.User.email.ilike(email)))
    return result.scalars().first()


async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.branches).options(noload(models.Branch.users)),
            joinedload(models.User.branch)
        )
        .where(models.User.id == user_id)
    )
    return result.scalars().first()


async def create_user(db: AsyncSession, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
        role=user.role,
        branch_id=user.branch_id,
        all_branches=user.all_branches,
        can_import=user.can_import
    )

    if user.branch_ids and not user.all_branches:
        # Fetch branches to associate
        result = await db.execute(select(models.Branch).where(models.Branch.id.in_(user.branch_ids)))
        branches = result.scalars().all()
        db_user.branches = branches

    if user.group_id is not None:
        db_user.group_id = user.group_id

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    # Eager load branches for UserResponse
    query = select(models.User).options(
        selectinload(models.User.branches).options(noload(models.Branch.users)),
        joinedload(models.User.branch),
        joinedload(models.User.group).options(noload(models.UserGroup.users))
    )
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            or_(
                models.User.name.ilike(search_filter),
                models.User.email.ilike(search_filter)
            )
        )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_users_by_role(db: AsyncSession, roles: list[models.UserRole]):
    """Fetch users by a list of roles."""
    query = select(models.User).options(
        selectinload(models.User.branches).options(noload(models.Branch.users)),
        joinedload(models.User.branch)
    ).where(models.User.role.in_(roles))
    result = await db.execute(query)
    return result.scalars().all()


async def update_user(db: AsyncSession, user_id: int, user: schemas.UserUpdate):
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.branches).options(noload(models.Branch.users)),
            joinedload(models.User.branch)
        )
        .where(models.User.id == user_id)
    )
    db_user = result.scalars().first()
    if db_user:
        if user.name: db_user.name = user.name
        if user.role: db_user.role = user.role
        if user.branch_id is not None: db_user.branch_id = user.branch_id # Legacy update
        if user.all_branches is not None: db_user.all_branches = user.all_branches
        if user.can_import is not None: db_user.can_import = user.can_import
        if user.password:
            db_user.hashed_password = get_password_hash(user.password)

        if user.branch_ids is not None:
            # Update branches association only if strictly passed (empty list is valid update to clear)
            if user.all_branches:
                db_user.branches = []
            else:
                result = await db.execute(select(models.Branch).where(models.Branch.id.in_(user.branch_ids)))
                branches = result.scalars().all()
                db_user.branches = branches

        # Allow setting group_id to None (unassign)
        # Check if the field was explicitly set in the request
        if user.group_id is not None:
            db_user.group_id = user.group_id
        # Note: In Pydantic v2/FastAPI, 'None' might be passed if explicitly set to null.
        # But if we use exclude_unset=True in router (typical), we rely on iteration.
        # Here we are using Pydantic model directly.
        # For simplicity in this codebase context where 'None' usually means 'no change',
        # we need a way to clear it.
        # If we assume -1 or some sentinel clears it, or if we trust the Pydantic model `group_id`
        # is strictly Optional and defaults to None.
        # BUT, the Frontend sends `group_id: ''` or `group_id: '1'`.
        # The schema `UserUpdate` defines `group_id: Optional[int]`.
        # If frontend sends null, Pydantic parses as None.
        # So `if user.group_id is not None` skips the update if null is sent.
        # FIX: We need to update if it's in the dict, or handle a specific clear logic.
        # Since `UserUpdate` fields default to None, we can't distinguish "unset" vs "set to null" easily
        # without `exclude_unset` dict from the router.
        # However, let's assume if it is NOT None, we update.
        # Wait, if I want to UNASSIGN, I must send None. But `if user.group_id is not None` prevents that.

        # We need to change the check.
        # However, `update_user` signature takes `user: schemas.UserUpdate`.
        # If I change the logic to always update `db_user.group_id = user.group_id`,
        # then not sending it (default None) will clear existing groups unexpectedly.

        # Solution: Use `user.dict(exclude_unset=True)` logic pattern if possible,
        # but here we are manual.
        # Let's rely on a specific value for clearing? Or check `__fields_set__` if Pydantic v1/v2.

        # Pydantic v2 uses `model_dump(exclude_unset=True)`.
        # backend/schemas.py uses `pydantic.BaseModel`.
        # Let's use `model_dump` if available or `dict`.

        update_data = user.model_dump(exclude_unset=True) if hasattr(user, 'model_dump') else user.dict(exclude_unset=True)

        if 'group_id' in update_data:
            db_user.group_id = update_data['group_id']

        await db.commit()
        # Reload user to ensure clean state and avoid async refresh issues
        result = await db.execute(
            select(models.User)
            .options(selectinload(models.User.branches), joinedload(models.User.branch))
            .where(models.User.id == user_id)
        )
        db_user = result.scalars().first()
    return db_user


async def delete_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    db_user = result.scalars().first()
    if db_user:
        await db.delete(db_user)
        await db.commit()
        return True
    return False

# User Groups

async def get_user_groups(db: AsyncSession, skip: int = 0, limit: int = 100):
    # Use selectinload for 1:N collection (users) but prevent recursion
    query = select(models.UserGroup).options(
        selectinload(models.UserGroup.users).options(
            noload(models.User.group),
            noload(models.User.branches),
            noload(models.User.requests)
        ),
        noload(models.UserGroup.approval_workflows)
    )
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def create_user_group(db: AsyncSession, group: schemas.UserGroupCreate):
    db_group = models.UserGroup(**group.dict())
    db.add(db_group)
    await db.commit()
    await db.refresh(db_group)
    return db_group


async def update_user_group(db: AsyncSession, group_id: int, group: schemas.UserGroupUpdate):
    result = await db.execute(select(models.UserGroup).where(models.UserGroup.id == group_id))
    db_group = result.scalars().first()
    if db_group:
        if group.name: db_group.name = group.name
        if group.description: db_group.description = group.description
        await db.commit()
        await db.refresh(db_group)
    return db_group


async def delete_user_group(db: AsyncSession, group_id: int):
    result = await db.execute(select(models.UserGroup).where(models.UserGroup.id == group_id))
    db_group = result.scalars().first()
    if db_group:
        await db.delete(db_group)
        await db.commit()
        return True
    return False

# Branches

