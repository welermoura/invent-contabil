from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_items_by_ids(db: AsyncSession, item_ids: list[int]):
    """Fetch items by a list of IDs."""
    if not item_ids:
        return []
    query = select(models.Item).options(
        joinedload(models.Item.branch),
        joinedload(models.Item.transfer_target_branch),
        joinedload(models.Item.category_rel),
        joinedload(models.Item.supplier),
        joinedload(models.Item.responsible),
        joinedload(models.Item.cost_center),
        joinedload(models.Item.sector)
    ).where(models.Item.id.in_(item_ids))
    result = await db.execute(query)
    return result.scalars().all()


async def get_pending_action_items(db: AsyncSession, user_id: int, user_branches: list[int]):
    """
    Items needing operator action:
    1. IN_TRANSIT where target branch is in user_branches.
    2. READY_FOR_WRITE_OFF where responsible is user OR branch in user_branches.
    """
    query = select(models.Item).options(
        joinedload(models.Item.branch),
        joinedload(models.Item.transfer_target_branch),
        joinedload(models.Item.category_rel),
        joinedload(models.Item.responsible),
        joinedload(models.Item.cost_center),
        joinedload(models.Item.sector)
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
    from sqlalchemy.orm import joinedload, noload
    # Use joinedload for single-item relationships to avoid N+1 queries effectively
    # and reduce "loader depth" complexity warning from recursive selectinloads.
    query = select(models.Item).options(
        joinedload(models.Item.branch).options(noload(models.Branch.items)),
        joinedload(models.Item.transfer_target_branch),
        joinedload(models.Item.category_rel).options(noload(models.Category.items)),
        joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
        joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
        joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
        joinedload(models.Item.sector).options(noload(models.Sector.items))
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
        joinedload(models.Item.branch),
        joinedload(models.Item.transfer_target_branch),
        joinedload(models.Item.category_rel),
        joinedload(models.Item.supplier),
        joinedload(models.Item.responsible),
        joinedload(models.Item.cost_center),
        joinedload(models.Item.sector)
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

    # Calculate initial diff (from empty to created state) using None as old_obj
    # Actually for creation, we might just dump the whole object to changes if needed,
    # but typically creation log is enough. Let's add details.
    changes = calculate_diff(db_item, item.dict(), exclude=[]) # Effectively new values

    log = models.Log(item_id=db_item.id, user_id=item.responsible_id, action=log_message, changes=changes)
    db.add(log)
    await db.commit()
    # Eager load relationships for Pydantic serialization
    query = select(models.Item).where(models.Item.id == db_item.id).options(
        joinedload(models.Item.branch).options(noload(models.Branch.items)),
        joinedload(models.Item.transfer_target_branch),
        joinedload(models.Item.category_rel).options(noload(models.Category.items)),
        joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
        joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
        joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
        joinedload(models.Item.sector).options(noload(models.Sector.items))
    )
    result = await db.execute(query)
    return result.scalars().first()


async def get_item_by_fixed_asset(db: AsyncSession, fixed_asset_number: str, exclude_item_id: int = None):
    query = select(models.Item).where(models.Item.fixed_asset_number == fixed_asset_number)

    if exclude_item_id:
        query = query.where(models.Item.id != exclude_item_id)

    query = query.options(
        joinedload(models.Item.branch),
        joinedload(models.Item.category_rel),
        joinedload(models.Item.supplier),
        joinedload(models.Item.responsible),
        joinedload(models.Item.cost_center),
        joinedload(models.Item.sector)
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
            joinedload(models.Item.branch).options(noload(models.Branch.items)),
            joinedload(models.Item.transfer_target_branch),
            joinedload(models.Item.category_rel).options(noload(models.Category.items)),
            joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
            joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
            joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
            joinedload(models.Item.sector).options(noload(models.Sector.items))
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

    return db_item

# System Settings

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
            joinedload(models.Item.branch).options(noload(models.Branch.items)),
            joinedload(models.Item.transfer_target_branch),
            joinedload(models.Item.category_rel).options(noload(models.Category.items)),
            joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
            joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
            joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
            joinedload(models.Item.sector).options(noload(models.Sector.items))
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
            joinedload(models.Item.branch).options(noload(models.Branch.items)),
            joinedload(models.Item.transfer_target_branch),
            joinedload(models.Item.category_rel).options(noload(models.Category.items)),
            joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
            joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
            joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
            joinedload(models.Item.sector).options(noload(models.Sector.items))
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
            joinedload(models.Item.branch).options(noload(models.Branch.items)),
            joinedload(models.Item.transfer_target_branch),
            joinedload(models.Item.category_rel).options(noload(models.Category.items)),
            joinedload(models.Item.supplier).options(noload(models.Supplier.items)),
            joinedload(models.Item.responsible).options(noload(models.User.items_responsible), noload(models.User.branches)),
            joinedload(models.Item.cost_center).options(noload(models.CostCenter.items)),
            joinedload(models.Item.sector).options(noload(models.Sector.items))
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

    return db_item

# Approval Workflows

