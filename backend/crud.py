from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime

# Users
async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(models.User).where(models.User.email == email))
    return result.scalars().first()

async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(models.User)
        .options(selectinload(models.User.branches), selectinload(models.User.branch))
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

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    # Eager load branches for UserResponse
    query = select(models.User).options(selectinload(models.User.branches), selectinload(models.User.branch))
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
        selectinload(models.User.branches),
        selectinload(models.User.branch)
    ).where(models.User.role.in_(roles))
    result = await db.execute(query)
    return result.scalars().all()

async def update_user(db: AsyncSession, user_id: int, user: schemas.UserUpdate):
    result = await db.execute(
        select(models.User)
        .options(selectinload(models.User.branches), selectinload(models.User.branch))
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

        await db.commit()
        # Reload user to ensure clean state and avoid async refresh issues
        result = await db.execute(
            select(models.User)
            .options(selectinload(models.User.branches), selectinload(models.User.branch))
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

# Branches
async def get_branches(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.Branch)
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

# Categories
async def get_categories(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.Category)
    if search:
        query = query.where(models.Category.name.ilike(f"%{search}%"))
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

async def get_category_by_name(db: AsyncSession, name: str):
    result = await db.execute(select(models.Category).where(models.Category.name == name))
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
async def get_suppliers(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.Supplier)
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
async def get_items(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    category: str = None,
    branch_id: int = None,
    search: str = None,
    allowed_branch_ids: list[int] = None,
    description: str = None,
    fixed_asset_number: str = None,
    purchase_date: str = None
):
    query = select(models.Item).options(
        selectinload(models.Item.branch),
        selectinload(models.Item.transfer_target_branch),
        selectinload(models.Item.category_rel),
        selectinload(models.Item.supplier),
        selectinload(models.Item.responsible)
    )
    if status:
        query = query.where(models.Item.status == status)
    if category:
        query = query.where(models.Item.category == category)
    if branch_id:
        query = query.where(models.Item.branch_id == branch_id)

    # Filter by Allowed Branches AND Incoming Transfers for those branches
    if allowed_branch_ids is not None:
        # User sees:
        # 1. Items physically in their branches (branch_id in allowed)
        # 2. Items IN TRANSIT *towards* their branches (transfer_target_branch_id in allowed AND status == IN_TRANSIT)

        # If specific branch_id filter was already applied above, this OR condition logic might need adjustment if users filter specifically for "incoming".
        # However, the `branch_id` argument is typically for strict filtering (e.g. looking at a specific branch inventory).
        # If `branch_id` is None, we show everything the user is allowed to see.

        if branch_id:
            # If strictly filtering by a branch, we assume we only want items currently there.
            # But what if we want to see incoming items FOR that branch?
            # Usually users select "All Branches" view to see everything.
            # Let's keep strict branch_id filter if provided.
            pass
        else:
            # No specific branch selected, show all accessible items + incoming
            query = query.where(
                or_(
                    models.Item.branch_id.in_(allowed_branch_ids),
                    (models.Item.transfer_target_branch_id.in_(allowed_branch_ids)) & (models.Item.status == models.ItemStatus.IN_TRANSIT)
                )
            )

    # Specific column filters
    if description:
        query = query.where(models.Item.description.ilike(f"%{description}%"))
    if fixed_asset_number:
        query = query.where(models.Item.fixed_asset_number.ilike(f"%{fixed_asset_number}%"))
    if purchase_date:
        query = query.where(cast(models.Item.purchase_date, String).ilike(f"%{purchase_date}%"))

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (models.Item.description.ilike(search_filter)) |
            (models.Item.serial_number.ilike(search_filter)) |
            (models.Item.invoice_number.ilike(search_filter)) |
            (models.Item.fixed_asset_number.ilike(search_filter))
        )

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

async def get_item(db: AsyncSession, item_id: int):
    query = select(models.Item).where(models.Item.id == item_id).options(
        selectinload(models.Item.branch),
        selectinload(models.Item.transfer_target_branch),
        selectinload(models.Item.category_rel),
        selectinload(models.Item.supplier),
        selectinload(models.Item.responsible)
    )
    result = await db.execute(query)
    return result.scalars().first()

STATUS_TRANSLATION = {
    models.ItemStatus.PENDING: "Pendente",
    models.ItemStatus.APPROVED: "Aprovado",
    models.ItemStatus.REJECTED: "Rejeitado",
    models.ItemStatus.TRANSFER_PENDING: "Transf. Pendente",
    models.ItemStatus.WRITE_OFF_PENDING: "Baixa Pendente",
    models.ItemStatus.WRITTEN_OFF: "Baixado",
    models.ItemStatus.MAINTENANCE: "Manutenção",
    models.ItemStatus.IN_STOCK: "Estoque",
    models.ItemStatus.IN_TRANSIT: "Em Trânsito"
}

async def create_item(db: AsyncSession, item: schemas.ItemCreate, action_log: str = None):
    db_item = models.Item(**item.dict())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item) # Need ID for logging

    # Log creation
    status_pt = STATUS_TRANSLATION.get(db_item.status, str(db_item.status))
    log_message = action_log if action_log else f"Item cadastrado. Status: {status_pt}"

    log = models.Log(item_id=db_item.id, user_id=item.responsible_id, action=log_message)
    db.add(log)
    await db.commit()
    # Eager load relationships for Pydantic serialization
    query = select(models.Item).where(models.Item.id == db_item.id).options(
        selectinload(models.Item.branch),
        selectinload(models.Item.category_rel),
        selectinload(models.Item.supplier),
        selectinload(models.Item.responsible)
    )
    result = await db.execute(query)
    return result.scalars().first()

async def get_item_by_fixed_asset(db: AsyncSession, fixed_asset_number: str, exclude_item_id: int = None):
    query = select(models.Item).where(models.Item.fixed_asset_number == fixed_asset_number)

    if exclude_item_id:
        query = query.where(models.Item.id != exclude_item_id)

    query = query.options(
        selectinload(models.Item.branch),
        selectinload(models.Item.category_rel),
        selectinload(models.Item.supplier),
        selectinload(models.Item.responsible)
    )
    result = await db.execute(query)
    return result.scalars().first()

async def update_item_status(db: AsyncSession, item_id: int, status: models.ItemStatus, user_id: int, fixed_asset_number: str = None, reason: str = None):
    result = await db.execute(select(models.Item).where(models.Item.id == item_id))
    db_item = result.scalars().first()
    if db_item:
        # Transfer Logic
        if db_item.status == models.ItemStatus.TRANSFER_PENDING:
            if status == models.ItemStatus.APPROVED:
                # NEW LOGIC: Move to IN_TRANSIT, do NOT change branch_id yet.
                db_item.status = models.ItemStatus.IN_TRANSIT
                status = models.ItemStatus.IN_TRANSIT # For logging below
            elif status == models.ItemStatus.REJECTED:
                # Cancel Transfer
                db_item.transfer_target_branch_id = None
                db_item.status = models.ItemStatus.APPROVED # Revert to Approved state

        # Receipt Logic (In Transit -> Stock/Approved)
        elif db_item.status == models.ItemStatus.IN_TRANSIT and status == models.ItemStatus.IN_STOCK:
            # Execute Transfer Finalization
            if db_item.transfer_target_branch_id:
                db_item.branch_id = db_item.transfer_target_branch_id
                db_item.transfer_target_branch_id = None
                db_item.status = models.ItemStatus.IN_STOCK
                # Also clear transfer invoice fields? Maybe keep for history? Keep them.

        # Write-off Logic
        elif db_item.status == models.ItemStatus.WRITE_OFF_PENDING:
            if status == models.ItemStatus.WRITTEN_OFF:
                 db_item.status = models.ItemStatus.WRITTEN_OFF
            elif status == models.ItemStatus.REJECTED:
                 db_item.status = models.ItemStatus.APPROVED # Revert to Approved

        else:
            # Normal Approval
            db_item.status = status

        if fixed_asset_number:
            db_item.fixed_asset_number = fixed_asset_number

        # Log the action
        status_pt = STATUS_TRANSLATION.get(status, str(status))
        action_text = f"Status alterado para {status_pt}"
        if reason:
            action_text += f". Motivo: {reason}"

        log = models.Log(item_id=item_id, user_id=user_id, action=action_text)
        db.add(log)
        await db.commit()

        # Reload item with relationships to prevent MissingGreenlet
        query = select(models.Item).where(models.Item.id == item_id).options(
            selectinload(models.Item.branch),
            selectinload(models.Item.transfer_target_branch),
            selectinload(models.Item.category_rel),
            selectinload(models.Item.supplier),
            selectinload(models.Item.responsible)
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

    return db_item

# System Settings
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
        selectinload(models.Log.user),
        selectinload(models.Log.item)
    ).order_by(models.Log.timestamp.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

async def request_write_off(db: AsyncSession, item_id: int, justification: str, user_id: int):
    result = await db.execute(select(models.Item).where(models.Item.id == item_id))
    db_item = result.scalars().first()
    if db_item:
        db_item.status = models.ItemStatus.WRITE_OFF_PENDING

        log = models.Log(item_id=item_id, user_id=user_id, action=f"Solicitação de baixa. Motivo: {justification}")
        db.add(log)
        await db.commit()

        # Reload with relationships
        query = select(models.Item).where(models.Item.id == item_id).options(
            selectinload(models.Item.branch),
            selectinload(models.Item.transfer_target_branch),
            selectinload(models.Item.category_rel),
            selectinload(models.Item.supplier),
            selectinload(models.Item.responsible)
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

    return db_item

async def update_item(db: AsyncSession, item_id: int, item: schemas.ItemUpdate):
    result = await db.execute(select(models.Item).where(models.Item.id == item_id))
    db_item = result.scalars().first()
    if db_item:
        if item.description is not None:
            db_item.description = item.description
        if item.category is not None:
            db_item.category = item.category
            # Update category_id
            cat_obj = await get_category_by_name(db, item.category)
            if cat_obj:
                db_item.category_id = cat_obj.id
            else:
                 # Should we unset it if not found? Probably safe to keep existing or unset.
                 # If category string is set but ID not found, maybe invalid category?
                 db_item.category_id = None

        if item.invoice_value is not None:
            db_item.invoice_value = item.invoice_value
        if item.status is not None:
            db_item.status = item.status
        if item.fixed_asset_number is not None:
            db_item.fixed_asset_number = item.fixed_asset_number
        if item.observations is not None:
            db_item.observations = item.observations
        if item.supplier_id is not None:
            db_item.supplier_id = item.supplier_id

        await db.commit()

        # Reload with relationships
        query = select(models.Item).where(models.Item.id == item_id).options(
            selectinload(models.Item.branch),
            selectinload(models.Item.transfer_target_branch),
            selectinload(models.Item.category_rel),
            selectinload(models.Item.supplier),
            selectinload(models.Item.responsible)
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

    return db_item

async def request_transfer(db: AsyncSession, item_id: int, target_branch_id: int, user_id: int,
                           transfer_invoice_number: str = None, transfer_invoice_series: str = None,
                           transfer_invoice_date: datetime = None):
    result = await db.execute(select(models.Item).where(models.Item.id == item_id))
    db_item = result.scalars().first()
    if db_item:
        db_item.status = models.ItemStatus.TRANSFER_PENDING
        db_item.transfer_target_branch_id = target_branch_id

        if transfer_invoice_number: db_item.transfer_invoice_number = transfer_invoice_number
        if transfer_invoice_series: db_item.transfer_invoice_series = transfer_invoice_series
        if transfer_invoice_date: db_item.transfer_invoice_date = transfer_invoice_date

        # Fetch branch name for logging
        branch_result = await db.execute(select(models.Branch).where(models.Branch.id == target_branch_id))
        target_branch = branch_result.scalars().first()
        branch_name = target_branch.name if target_branch else str(target_branch_id)

        log = models.Log(item_id=item_id, user_id=user_id, action=f"Solicitação de transferência para filial {branch_name}")
        db.add(log)
        await db.commit()

        # Reload with relationships
        query = select(models.Item).where(models.Item.id == item_id).options(
            selectinload(models.Item.branch),
            selectinload(models.Item.transfer_target_branch),
            selectinload(models.Item.category_rel),
            selectinload(models.Item.supplier),
            selectinload(models.Item.responsible)
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

    return db_item
