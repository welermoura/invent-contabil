from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime

# Users
async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(models.User).where(models.User.email.ilike(email)))
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

    if user.group_id is not None:
        db_user.group_id = user.group_id

    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def get_users(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    # Eager load branches for UserResponse
    query = select(models.User).options(
        selectinload(models.User.branches),
        selectinload(models.User.branch),
        selectinload(models.User.group)
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

# User Groups
async def get_user_groups(db: AsyncSession, skip: int = 0, limit: int = 100):
    query = select(models.UserGroup).options(selectinload(models.UserGroup.users))
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

# Cost Centers
async def get_cost_centers(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.CostCenter)
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
async def get_sectors(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None, branch_id: int = None):
    query = select(models.Sector).options(selectinload(models.Sector.branch))
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
async def get_categories(db: AsyncSession, skip: int = 0, limit: int = 100, search: str = None):
    query = select(models.Category)
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
async def get_items_by_ids(db: AsyncSession, item_ids: list[int]):
    """Fetch items by a list of IDs."""
    if not item_ids:
        return []
    query = select(models.Item).options(
        selectinload(models.Item.branch),
        selectinload(models.Item.transfer_target_branch),
        selectinload(models.Item.category_rel),
        selectinload(models.Item.supplier),
        selectinload(models.Item.responsible),
        selectinload(models.Item.cost_center),
        selectinload(models.Item.sector)
    ).where(models.Item.id.in_(item_ids))
    result = await db.execute(query)
    return result.scalars().all()

async def get_branch(db: AsyncSession, branch_id: int):
    result = await db.execute(select(models.Branch).where(models.Branch.id == branch_id))
    return result.scalars().first()

async def get_pending_action_items(db: AsyncSession, user_id: int, user_branches: list[int]):
    """
    Items needing operator action:
    1. IN_TRANSIT where target branch is in user_branches.
    2. READY_FOR_WRITE_OFF where responsible is user OR branch in user_branches.
    """
    query = select(models.Item).options(
        selectinload(models.Item.branch),
        selectinload(models.Item.transfer_target_branch),
        selectinload(models.Item.category_rel),
        selectinload(models.Item.responsible),
        selectinload(models.Item.cost_center),
        selectinload(models.Item.sector)
    ).where(
        or_(
            (models.Item.status == models.ItemStatus.IN_TRANSIT) & (models.Item.transfer_target_branch_id.in_(user_branches)),
            (models.Item.status == models.ItemStatus.READY_FOR_WRITE_OFF) & (
                (models.Item.responsible_id == user_id) | (models.Item.branch_id.in_(user_branches))
            )
        )
    )
    result = await db.execute(query)
    return result.scalars().all()

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
        selectinload(models.Item.responsible),
        selectinload(models.Item.cost_center),
        selectinload(models.Item.sector)
    )
    if status:
        query = query.where(models.Item.status == status)
    if category:
        query = query.where(models.Item.category == category)
    if branch_id:
        query = query.where(models.Item.branch_id == branch_id)

    # Filter by Allowed Branches AND Incoming Transfers for those branches
    if allowed_branch_ids is not None:
        if branch_id:
            pass
        else:
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
        selectinload(models.Item.responsible),
        selectinload(models.Item.cost_center),
        selectinload(models.Item.sector)
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
    models.ItemStatus.IN_TRANSIT: "Em Trânsito",
    models.ItemStatus.READY_FOR_WRITE_OFF: "Aguardando Baixa"
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
        selectinload(models.Item.responsible),
        selectinload(models.Item.cost_center),
        selectinload(models.Item.sector)
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
        selectinload(models.Item.responsible),
        selectinload(models.Item.cost_center),
        selectinload(models.Item.sector)
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
                old_branch_name = db_item.branch.name if db_item.branch else "N/A"
                # Eager load target branch name before clearing ID if not loaded, but it should be loaded from previous ops
                # Assuming transfer_target_branch relationship is loaded or we can fetch it.
                # Since db_item might not have it loaded if session is fresh in this context without specific options in select above:
                target_branch_name = "Destino"
                if db_item.transfer_target_branch:
                     target_branch_name = db_item.transfer_target_branch.name
                else:
                     # Fetch it if missing
                     tb_res = await db.execute(select(models.Branch).where(models.Branch.id == db_item.transfer_target_branch_id))
                     tb = tb_res.scalars().first()
                     if tb: target_branch_name = tb.name

                # Update Branch ID
                db_item.branch_id = db_item.transfer_target_branch_id
                db_item.transfer_target_branch_id = None
                db_item.status = models.ItemStatus.IN_STOCK

                # Special Log for History Requirements: "Filial X transferiu para Filial Y"
                # The action is triggered by the RECEIVER confirming receipt, but the narrative is "Transfer Completed"
                # The user request: "history it has to show 'Branch X transferred to Branch Y'"
                # We can append a specific log entry for this completion event.

                transfer_log = models.Log(item_id=item_id, user_id=user_id, action=f"Transferência concluída: {old_branch_name} para {target_branch_name}")
                db.add(transfer_log)

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
            selectinload(models.Item.responsible),
            selectinload(models.Item.cost_center),
            selectinload(models.Item.sector)
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

async def request_write_off(db: AsyncSession, item_id: int, justification: str, user_id: int, reason: str = None):
    result = await db.execute(select(models.Item).where(models.Item.id == item_id))
    db_item = result.scalars().first()
    if db_item:
        db_item.status = models.ItemStatus.WRITE_OFF_PENDING
        db_item.approval_step = 1  # Reset approval step
        if reason:
            db_item.write_off_reason = reason

        log = models.Log(item_id=item_id, user_id=user_id, action=f"Solicitação de baixa. {justification}")
        db.add(log)
        await db.commit()

        # Reload with relationships
        query = select(models.Item).where(models.Item.id == item_id).options(
            selectinload(models.Item.branch),
            selectinload(models.Item.transfer_target_branch),
            selectinload(models.Item.category_rel),
            selectinload(models.Item.supplier),
            selectinload(models.Item.responsible),
            selectinload(models.Item.cost_center),
            selectinload(models.Item.sector)
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
        if item.cost_center_id is not None:
            db_item.cost_center_id = item.cost_center_id
        if item.sector_id is not None:
            db_item.sector_id = item.sector_id

        await db.commit()

        # Reload with relationships
        query = select(models.Item).where(models.Item.id == item_id).options(
            selectinload(models.Item.branch),
            selectinload(models.Item.transfer_target_branch),
            selectinload(models.Item.category_rel),
            selectinload(models.Item.supplier),
            selectinload(models.Item.responsible),
            selectinload(models.Item.cost_center),
            selectinload(models.Item.sector)
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
        db_item.approval_step = 1  # Reset approval step
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
            selectinload(models.Item.responsible),
            selectinload(models.Item.cost_center),
            selectinload(models.Item.sector)
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

    return db_item

# Approval Workflows
async def get_approval_workflows(db: AsyncSession, category_id: int = None):
    query = select(models.ApprovalWorkflow).options(
        selectinload(models.ApprovalWorkflow.category),
        selectinload(models.ApprovalWorkflow.required_user),
        selectinload(models.ApprovalWorkflow.required_group)
    )
    if category_id:
        query = query.where(models.ApprovalWorkflow.category_id == category_id)
    result = await db.execute(query)
    return result.scalars().all()

async def create_approval_workflow(db: AsyncSession, workflow: schemas.ApprovalWorkflowCreate):
    # Auto-calculate next step order if not provided or to ensure sequence
    # Find max step_order for this category + action
    query = select(models.ApprovalWorkflow).where(
        models.ApprovalWorkflow.category_id == workflow.category_id,
        models.ApprovalWorkflow.action_type == workflow.action_type
    ).order_by(models.ApprovalWorkflow.step_order.desc())

    result = await db.execute(query)
    existing_workflows = result.scalars().all()

    next_step = 1
    if existing_workflows:
        next_step = existing_workflows[0].step_order + 1

    db_workflow = models.ApprovalWorkflow(**workflow.dict())
    db_workflow.step_order = next_step # Override input

    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)
    # Reload relation
    query = select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == db_workflow.id).options(
        selectinload(models.ApprovalWorkflow.category),
        selectinload(models.ApprovalWorkflow.required_user),
        selectinload(models.ApprovalWorkflow.required_group)
    )
    result = await db.execute(query)
    return result.scalars().first()

async def update_approval_workflow(db: AsyncSession, workflow_id: int, workflow_update: schemas.ApprovalWorkflowUpdate):
    result = await db.execute(select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == workflow_id))
    db_workflow = result.scalars().first()
    if db_workflow:
        # Handle mutual exclusivity: If setting user, clear group. If setting group, clear user.
        # Use model_dump to check what was explicitly sent.

        update_data = workflow_update.model_dump(exclude_unset=True) if hasattr(workflow_update, 'model_dump') else workflow_update.dict(exclude_unset=True)

        if 'required_user_id' in update_data:
             db_workflow.required_user_id = update_data['required_user_id']
             if db_workflow.required_user_id: # If setting a user (not None), clear group
                 db_workflow.required_group_id = None

        if 'required_group_id' in update_data:
             db_workflow.required_group_id = update_data['required_group_id']
             if db_workflow.required_group_id: # If setting a group, clear user
                 db_workflow.required_user_id = None

        await db.commit()
        await db.refresh(db_workflow)

        # Reload relation
        query = select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == db_workflow.id).options(
            selectinload(models.ApprovalWorkflow.category),
            selectinload(models.ApprovalWorkflow.required_user),
            selectinload(models.ApprovalWorkflow.required_group)
        )
        result = await db.execute(query)
        db_workflow = result.scalars().first()

    return db_workflow

async def delete_approval_workflow(db: AsyncSession, workflow_id: int):
    result = await db.execute(select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == workflow_id))
    db_workflow = result.scalars().first()
    if db_workflow:
        await db.delete(db_workflow)
        await db.commit()
        return True
    return False

async def reorder_approval_workflows(db: AsyncSession, updates: list[dict]):
    """
    Updates the step_order for a list of workflow items.
    updates format: [{'id': 1, 'step_order': 2}, {'id': 5, 'step_order': 1}]
    """
    for update in updates:
        wf_id = update['id']
        new_order = update['step_order']

        result = await db.execute(select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == wf_id))
        db_workflow = result.scalars().first()
        if db_workflow:
            db_workflow.step_order = new_order

    await db.commit()
    return True

# Requests
async def create_request(db: AsyncSession, request: schemas.RequestCreate):
    db_request = models.Request(**request.dict())
    db.add(db_request)
    await db.commit()
    await db.refresh(db_request)
    return db_request

async def get_request(db: AsyncSession, request_id: int):
    query = select(models.Request).where(models.Request.id == request_id).options(
        selectinload(models.Request.requester),
        selectinload(models.Request.category),
        selectinload(models.Request.items).options(
             selectinload(models.Item.branch), # Need deeper loading for item display
             selectinload(models.Item.transfer_target_branch),
             selectinload(models.Item.category_rel),
             selectinload(models.Item.supplier),
             selectinload(models.Item.responsible),
             selectinload(models.Item.cost_center),
             selectinload(models.Item.sector)
        )
    )
    result = await db.execute(query)
    return result.scalars().first()

async def get_requests(db: AsyncSession, skip: int = 0, limit: int = 100,
                       requester_id: int = None, status: models.RequestStatus = None):
    query = select(models.Request).options(
        selectinload(models.Request.requester),
        selectinload(models.Request.category),
        selectinload(models.Request.items)
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
        query = select(models.Request).where(models.Request.id == request_id).options(
            selectinload(models.Request.requester),
            selectinload(models.Request.category),
            selectinload(models.Request.items).options(
                 selectinload(models.Item.branch),
                 selectinload(models.Item.transfer_target_branch),
                 selectinload(models.Item.category_rel),
                 selectinload(models.Item.supplier),
                 selectinload(models.Item.responsible)
            )
        )
        result = await db.execute(query)
        db_request = result.scalars().first()
    return db_request
