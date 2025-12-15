from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth, notifications
from backend.database import get_db
import shutil
import os
from datetime import datetime

router = APIRouter(prefix="/items", tags=["items"])

UPLOAD_DIR = "/app/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# --- Notification Helpers ---

async def notify_new_item(db: AsyncSession, item: models.Item):
    """Notify Approvers about new pending item."""
    try:
        approvers = await notifications.get_approvers(db)
        msg = f"Um novo item foi cadastrado e aguarda aprovação.\n\nItem: {item.description}\nFilial: {item.branch.name if item.branch else 'N/A'}\nValor: {item.invoice_value}"
        html = notifications.generate_html_email("Novo Item Aguardando Aprovação", msg)
        await notifications.notify_users(db, approvers, "Novo Item Pendente", msg, email_subject="Ação Necessária: Novo Item Cadastrado", email_html=html)
    except Exception as e:
        print(f"Failed to send notification for new item {item.id}: {e}")

async def notify_transfer_request(db: AsyncSession, item: models.Item):
    """Notify Approvers about transfer request."""
    try:
        approvers = await notifications.get_approvers(db)
        target_name = item.transfer_target_branch.name if item.transfer_target_branch else "Desconhecida"
        msg = f"Solicitação de transferência criada.\n\nItem: {item.description}\nOrigem: {item.branch.name}\nDestino: {target_name}"
        html = notifications.generate_html_email("Solicitação de Transferência", msg)
        await notifications.notify_users(db, approvers, "Solicitação de Transferência", msg, email_subject="Ação Necessária: Transferência Solicitada", email_html=html)
    except Exception as e:
        print(f"Failed to send notification for transfer request {item.id}: {e}")

async def notify_write_off_request(db: AsyncSession, item: models.Item, justification: str):
    """Notify Approvers about write-off request."""
    try:
        approvers = await notifications.get_approvers(db)
        msg = f"Solicitação de baixa criada.\n\nItem: {item.description}\nFilial: {item.branch.name}\nJustificativa: {justification}"
        html = notifications.generate_html_email("Solicitação de Baixa", msg)
        await notifications.notify_users(db, approvers, "Solicitação de Baixa", msg, email_subject="Ação Necessária: Baixa Solicitada", email_html=html)
    except Exception as e:
        print(f"Failed to send notification for write-off request {item.id}: {e}")

async def notify_status_change(db: AsyncSession, item: models.Item, old_status: str, new_status: str, reason: Optional[str]):
    """
    Notify Branch Members about Approval/Rejection.
    If Transfer Approval: Notify Source and Target.
    """
    try:
        # Determine affected branches
        target_users = []

        # Logic based on transition
        is_approval = new_status in [models.ItemStatus.APPROVED, models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]
        is_rejection = new_status == models.ItemStatus.REJECTED
        is_transfer_approval = (old_status == models.ItemStatus.TRANSFER_PENDING and is_approval)
        is_write_off_approval = (old_status == models.ItemStatus.WRITE_OFF_PENDING and new_status == models.ItemStatus.WRITTEN_OFF)

        if is_transfer_approval:
            branch_users = await notifications.get_branch_members(db, item.branch_id)
            target_users.extend(branch_users)

        elif is_write_off_approval:
            # Notify Branch Members that item is gone
            branch_users = await notifications.get_branch_members(db, item.branch_id)
            target_users.extend(branch_users)

        elif is_approval or is_rejection:
            # Standard Approval/Rejection (Creation or basic status change)
            branch_users = await notifications.get_branch_members(db, item.branch_id)
            target_users.extend(branch_users)

        if not target_users:
            return

        action_label = "Aprovada" if is_approval or new_status == models.ItemStatus.WRITTEN_OFF else "Rejeitada"
        if new_status == models.ItemStatus.REJECTED: action_label = "Rejeitada"

        title = f"Atualização de Item: {action_label}"
        msg = f"O item '{item.description}' teve seu status atualizado para {new_status}.\n"
        if reason:
            msg += f"Motivo/Observação: {reason}"

        html = notifications.generate_html_email(title, msg)
        await notifications.notify_users(db, target_users, title, msg, email_subject=f"Aviso de Sistema: Item {action_label}", email_html=html)
    except Exception as e:
        print(f"Failed to send notification for status change {item.id}: {e}")


# --- Endpoints ---

@router.get("/", response_model=List[schemas.ItemResponse])
async def read_items(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    category: Optional[str] = None,
    branch_id: Optional[int] = None,
    search: Optional[str] = None,
    description: Optional[str] = None,
    fixed_asset_number: Optional[str] = None,
    purchase_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce branch filtering for non-admins (Approvers and Auditors can see all)
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER, models.UserRole.AUDITOR] and not current_user.all_branches:
        allowed_branches = [b.id for b in current_user.branches]
        if current_user.branch_id and current_user.branch_id not in allowed_branches:
            allowed_branches.append(current_user.branch_id)

        if branch_id:
            if branch_id not in allowed_branches:
                 raise HTTPException(status_code=403, detail="Acesso negado a esta filial")
        else:
            return await crud.get_items(
                db, skip=skip, limit=limit, status=status, category=category, branch_id=None,
                search=search, allowed_branch_ids=allowed_branches, description=description,
                fixed_asset_number=fixed_asset_number, purchase_date=purchase_date
            )

    return await crud.get_items(
        db, skip=skip, limit=limit, status=status, category=category, branch_id=branch_id,
        search=search, description=description, fixed_asset_number=fixed_asset_number, purchase_date=purchase_date
    )

from pydantic import BaseModel

class CheckAssetResponse(BaseModel):
    exists: bool
    item: Optional[schemas.ItemResponse] = None

@router.get("/check-asset/{fixed_asset_number}", response_model=CheckAssetResponse)
async def check_asset(
    fixed_asset_number: str,
    exclude_item_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = await crud.get_item_by_fixed_asset(db, fixed_asset_number, exclude_item_id)
    if item:
        return CheckAssetResponse(exists=True, item=item)
    return CheckAssetResponse(exists=False, item=None)

@router.post("/", response_model=schemas.ItemResponse)
async def create_item(
    description: str = Form(...),
    category: str = Form(...),
    purchase_date: datetime = Form(...),
    invoice_value: float = Form(...),
    invoice_number: str = Form(...),
    branch_id: int = Form(...),
    supplier_id: Optional[int] = Form(None),
    serial_number: Optional[str] = Form(None),
    fixed_asset_number: Optional[str] = Form(None),
    observations: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role == models.UserRole.AUDITOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditores não podem criar itens")

    if current_user.role == models.UserRole.OPERATOR and not current_user.all_branches:
        allowed_branches = [b.id for b in current_user.branches]
        if current_user.branch_id and current_user.branch_id not in allowed_branches:
            allowed_branches.append(current_user.branch_id)
        if branch_id not in allowed_branches:
            raise HTTPException(status_code=403, detail="Você não tem permissão para criar itens nesta filial")

    file_path = None
    if file:
        import os
        import re
        filename = file.filename
        filename = re.sub(r'[^A-Za-z0-9_.-]', '_', filename)
        safe_filename = filename
        file_location = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_path = f"uploads/{safe_filename}"

    category_id = None
    if category:
        cat_obj = await crud.get_category_by_name(db, category)
        if cat_obj:
            category_id = cat_obj.id

    item_data = schemas.ItemCreate(
        description=description,
        category=category,
        category_id=category_id,
        purchase_date=purchase_date,
        invoice_value=invoice_value,
        invoice_number=invoice_number,
        branch_id=branch_id,
        supplier_id=supplier_id,
        serial_number=serial_number,
        fixed_asset_number=fixed_asset_number,
        observations=observations,
        responsible_id=current_user.id
    )

    try:
        db_item = await crud.create_item(db, item_data, action_log="Item cadastrado manualmente.")
        if file_path:
            db_item.invoice_file = file_path
            db.add(db_item)
            await db.commit()

        # Explicitly refresh with relationships to prevent MissingGreenlet in notification logic
        from sqlalchemy.orm import selectinload
        from sqlalchemy.future import select
        query = select(models.Item).where(models.Item.id == db_item.id).options(
            selectinload(models.Item.branch),
            selectinload(models.Item.category_rel)
        )
        result = await db.execute(query)
        db_item = result.scalars().first()

        # Notify Approvers
        if db_item.status == models.ItemStatus.PENDING:
            # WebSocket Broadcast (Legacy but needed for toasts)
            from backend.websocket_manager import manager
            await manager.broadcast(f"Novo item cadastrado: {db_item.description}")

            # Persistent Notification & Email
            await notify_new_item(db, db_item)

        return db_item
    except Exception as e:
        print(f"Error creating item: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao criar item: {str(e)}")

@router.put("/{item_id}/status", response_model=schemas.ItemResponse)
async def update_item_status(
    item_id: int,
    status_update: schemas.ItemStatus,
    fixed_asset_number: Optional[str] = None,
    reason: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item_obj = await crud.get_item(db, item_id)
    if not item_obj:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    old_status = item_obj.status # Capture old status before update

    is_admin_approver = current_user.role in [models.UserRole.ADMIN, models.UserRole.APPROVER]
    is_operator = current_user.role == models.UserRole.OPERATOR

    if not is_admin_approver and not is_operator:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role não autorizada")

    target_is_operational = status_update in [models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]
    current_is_operational = item_obj.status in [models.ItemStatus.APPROVED, models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]

    if target_is_operational and not current_is_operational:
         raise HTTPException(status_code=400, detail="O item deve ser aprovado antes de ser movido para Manutenção ou Estoque")

    if is_operator:
        if not current_user.all_branches:
            allowed_branches = [b.id for b in current_user.branches]
            if current_user.branch_id and current_user.branch_id not in allowed_branches:
                allowed_branches.append(current_user.branch_id)
            if item_obj.branch_id not in allowed_branches:
                raise HTTPException(status_code=403, detail="Sem permissão nesta filial")

        allowed_targets = [models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK, models.ItemStatus.APPROVED]
        if status_update not in allowed_targets:
             raise HTTPException(status_code=403, detail="Operadores só podem alterar para Manutenção, Estoque ou Ativo")

        allowed_sources = [models.ItemStatus.APPROVED, models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]
        if item_obj.status not in allowed_sources:
             raise HTTPException(status_code=403, detail="Operadores não podem alterar status de itens Pendentes ou em Processo")

    updated_item = await crud.update_item_status(db, item_id, status_update, current_user.id, fixed_asset_number, reason)

    # Websocket
    from backend.websocket_manager import manager
    await manager.broadcast(f"Item {updated_item.description} status changed to {status_update}")

    # Notify Branch Members about the outcome
    await notify_status_change(db, updated_item, old_status, status_update, reason)

    return updated_item

@router.post("/{item_id}/transfer", response_model=schemas.ItemResponse)
async def request_transfer(
    item_id: int,
    target_branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role == models.UserRole.AUDITOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditores não podem solicitar transferências")

    item = await crud.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    if current_user.role == models.UserRole.OPERATOR:
        allowed_branches = [b.id for b in current_user.branches]
        if current_user.branch_id and current_user.branch_id not in allowed_branches:
            allowed_branches.append(current_user.branch_id)
        if item.branch_id not in allowed_branches:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para transferir este item")

    item = await crud.request_transfer(db, item_id, target_branch_id, current_user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    from backend.websocket_manager import manager
    await manager.broadcast(f"Solicitação de transferência para item {item.description}")

    # Notify Approvers
    await notify_transfer_request(db, item)

    return item

@router.post("/{item_id}/write-off", response_model=schemas.ItemResponse)
async def request_write_off(
    item_id: int,
    justification: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role == models.UserRole.AUDITOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditores não podem solicitar baixas")

    item = await crud.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    if current_user.role == models.UserRole.OPERATOR:
        allowed_branches = [b.id for b in current_user.branches]
        if current_user.branch_id and current_user.branch_id not in allowed_branches:
            allowed_branches.append(current_user.branch_id)
        if item.branch_id not in allowed_branches:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para solicitar baixa deste item")

    item = await crud.request_write_off(db, item_id, justification, current_user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    from backend.websocket_manager import manager
    await manager.broadcast(f"Solicitação de baixa para item {item.description}")

    # Notify Approvers
    await notify_write_off_request(db, item, justification)

    return item

@router.put("/{item_id}", response_model=schemas.ItemResponse)
async def update_item(
    item_id: int,
    item_update: schemas.ItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    existing_item = await crud.get_item(db, item_id)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        if current_user.role == models.UserRole.OPERATOR and existing_item.status == models.ItemStatus.REJECTED:
            if not current_user.all_branches:
                allowed_branches = [b.id for b in current_user.branches]
                if current_user.branch_id and current_user.branch_id not in allowed_branches:
                    allowed_branches.append(current_user.branch_id)
                if existing_item.branch_id not in allowed_branches:
                     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para editar este item")
            item_update.status = models.ItemStatus.PENDING
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem editar itens")

    updated_item = await crud.update_item(db, item_id, item_update)

    # Notify if re-submitted
    if existing_item.status == models.ItemStatus.REJECTED and updated_item.status == models.ItemStatus.PENDING:
         await notify_new_item(db, updated_item) # Reuse new item logic for re-submission

    return updated_item
