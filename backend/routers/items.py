from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth, notifications, workflow_engine
from backend.database import get_db
import shutil
import os
import json
from datetime import datetime
from backend.audit import calculate_diff

router = APIRouter(prefix="/items", tags=["items"])

UPLOAD_DIR = "/app/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# --- Notification Helpers ---

def build_item_details(item: models.Item) -> dict:
    """Extract standard item details for email table."""
    def translate_status(s):
        m = {
            "APPROVED": "Aprovado", "REJECTED": "Rejeitado", "IN_STOCK": "Estoque",
            "MAINTENANCE": "Manutenção", "WRITTEN_OFF": "Baixado", "IN_TRANSIT": "Em Trânsito",
            "PENDING": "Pendente", "TRANSFER_PENDING": "Transferência Pendente", "WRITE_OFF_PENDING": "Baixa Pendente"
        }
        return m.get(s, s)

    # Infer base URL from environment or fallback to localhost
    base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")

    invoice_link = None
    if item.invoice_file:
         # Assuming invoice_file is stored as relative path "uploads/..."
         # and static mount is at /uploads
         # If path starts with uploads/, we prepend base url.
         clean_path = item.invoice_file.strip("/")
         invoice_link = f"{base_url}/{clean_path}"

    return {
        "description": item.description,
        "category": item.category_rel.name if item.category_rel else item.category,
        "fixed_asset_number": item.fixed_asset_number,
        "serial_number": item.serial_number,
        "branch": item.branch.name if item.branch else 'N/A',
        "status": translate_status(item.status),
        "invoice_value": item.invoice_value,
        "purchase_date": item.purchase_date,
        "supplier": item.supplier.name if item.supplier else 'N/A',
        "invoice_number": item.invoice_number,
        "invoice_link": invoice_link,
        "observations": item.observations,
        "responsible": item.responsible.name if item.responsible else 'N/A'
    }

async def notify_new_item(db: AsyncSession, item: models.Item):
    """Notify Approvers about new pending item."""
    try:
        # Use Workflow Engine to get specific approvers
        approvers = await workflow_engine.get_current_step_approvers(db, item, models.ApprovalActionType.CREATE)

        msg = f"Um novo item foi cadastrado e aguarda aprovação (Etapa {item.approval_step})."

        details = build_item_details(item)
        base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")
        # Frontend URL is usually on port 3000 or same host if proxied.
        # Assuming simple mapping for now based on APP_BASE_URL which is backend url.
        # Ideally we should have FRONTEND_URL env var.
        # But commonly in this setup APP_BASE_URL might be the public access point.
        # Let's assume standard frontend path.
        # If APP_BASE_URL is http://localhost:8001, Frontend is http://localhost:3000 locally.
        # In production it might be same domain.
        # Let's try to infer or use relative if strictly same domain, but email needs absolute.
        # Using a simplistic replacement for dev environment support:
        frontend_url = base_url.replace(":8001", ":3000") if "localhost" in base_url else base_url
        action_url = f"{frontend_url}/dashboard/detalhes/item/{item.id}"

        html = notifications.generate_html_email(
            "Novo Item Aguardando Aprovação",
            msg,
            item_details=details,
            action_url=action_url,
            action_text="Analisar Solicitação"
        )
        await notifications.notify_users(db, approvers, "Novo Item Pendente", msg, email_subject="Ação Necessária: Novo Item Cadastrado", email_html=html)
    except Exception as e:
        print(f"Failed to send notification for new item {item.id}: {e}")

async def notify_transfer_request(db: AsyncSession, item: models.Item):
    """Notify Approvers about transfer request."""
    try:
        # Use Workflow Engine
        approvers = await workflow_engine.get_current_step_approvers(db, item, models.ApprovalActionType.TRANSFER)

        target_name = item.transfer_target_branch.name if item.transfer_target_branch else "Desconhecida"
        msg = f"Solicitação de transferência criada (Etapa {item.approval_step}).\nOrigem: {item.branch.name}\nDestino: {target_name}"

        details = build_item_details(item)
        details["transfer_target"] = target_name # Add extra field specific to this email

        base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")
        frontend_url = base_url.replace(":8001", ":3000") if "localhost" in base_url else base_url
        action_url = f"{frontend_url}/dashboard/detalhes/item/{item.id}"

        html = notifications.generate_html_email(
            "Solicitação de Transferência",
            msg,
            item_details=details,
            action_url=action_url,
            action_text="Analisar Solicitação"
        )
        await notifications.notify_users(db, approvers, "Solicitação de Transferência", msg, email_subject="Ação Necessária: Transferência Solicitada", email_html=html)
    except Exception as e:
        print(f"Failed to send notification for transfer request {item.id}: {e}")

async def notify_write_off_request(db: AsyncSession, item: models.Item, reason: str, justification: Optional[str]):
    """Notify Approvers about write-off request."""
    try:
        # Use Workflow Engine
        approvers = await workflow_engine.get_current_step_approvers(db, item, models.ApprovalActionType.WRITE_OFF)

        msg = f"Solicitação de baixa criada (Etapa {item.approval_step}).\n\n"
        msg += f"Motivo: {reason}\n"
        msg += f"Justificativa: {justification or 'N/A'}"

        details = build_item_details(item)

        base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")
        frontend_url = base_url.replace(":8001", ":3000") if "localhost" in base_url else base_url
        action_url = f"{frontend_url}/dashboard/detalhes/item/{item.id}"

        html = notifications.generate_html_email(
            "Solicitação de Baixa",
            msg,
            item_details=details,
            action_url=action_url,
            action_text="Analisar Solicitação"
        )
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
        is_transfer_approval = (old_status == models.ItemStatus.TRANSFER_PENDING and new_status == models.ItemStatus.IN_TRANSIT)
        is_transfer_receipt = (old_status == models.ItemStatus.IN_TRANSIT and new_status == models.ItemStatus.IN_STOCK)
        is_write_off_approval = (old_status == models.ItemStatus.WRITE_OFF_PENDING and new_status == models.ItemStatus.WRITTEN_OFF)

        if is_transfer_approval:
            # Notify Source branch
            branch_users = await notifications.get_branch_members(db, item.branch_id)
            target_users.extend(branch_users)
            # Notify Destination branch (members who can receive)
            if item.transfer_target_branch_id:
                dest_users = await notifications.get_branch_members(db, item.transfer_target_branch_id)
                target_users.extend(dest_users)

        elif is_transfer_receipt:
            # Notify previous branch (optional, but good) and current branch
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

        def translate_status(s):
            m = {
                "APPROVED": "Aprovado", "REJECTED": "Rejeitado", "IN_STOCK": "Estoque",
                "MAINTENANCE": "Manutenção", "WRITTEN_OFF": "Baixado", "IN_TRANSIT": "Em Trânsito"
            }
            return m.get(s, s)

        new_status_pt = translate_status(new_status)
        action_label = "Atualizado"
        if new_status == models.ItemStatus.REJECTED: action_label = "Rejeitado"
        if is_transfer_approval: action_label = "Transferência Aprovada - Em Trânsito"
        if is_transfer_receipt: action_label = "Transferência Recebida"

        title = f"Atualização de Item: {action_label}"
        msg = f"O item '{item.description}' teve seu status atualizado para {new_status_pt}.\n"
        if reason:
            msg += f"Motivo/Observação: {reason}"

        if is_transfer_approval:
            msg += "\nO item está em trânsito e aguarda confirmação de recebimento na filial de destino."

        details = build_item_details(item)
        if is_transfer_approval and item.transfer_target_branch:
             details["transfer_target"] = item.transfer_target_branch.name

        html = notifications.generate_html_email(title, msg, item_details=details)
        await notifications.notify_users(db, target_users, title, msg, email_subject=f"Aviso de Sistema: Item {action_label}", email_html=html)
    except Exception as e:
        print(f"Failed to send notification for status change {item.id}: {e}")


# --- Endpoints ---

@router.get("/my-requests", response_model=List[schemas.ItemResponse])
async def read_my_requests(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Returns items initiated/responsible by the current user that are in a PENDING state.
    Enriches the response with 'current_approvers' list.
    """
    # Define "Pending" statuses
    pending_statuses = [
        models.ItemStatus.PENDING,
        models.ItemStatus.TRANSFER_PENDING,
        models.ItemStatus.WRITE_OFF_PENDING
    ]

    # Fetch items responsible by user AND in pending status
    from sqlalchemy.future import select
    query = select(models.Item).options(
        crud.selectinload(models.Item.branch),
        crud.selectinload(models.Item.transfer_target_branch),
        crud.selectinload(models.Item.category_rel),
        crud.selectinload(models.Item.supplier),
        crud.selectinload(models.Item.responsible)
    ).where(
        models.Item.responsible_id == current_user.id,
        models.Item.status.in_(pending_statuses)
    )

    result = await db.execute(query)
    items = result.scalars().all()

    # Enrich with Current Approvers
    enriched_items = []
    for item in items:
        # Pydantic model conversion happens later, but we need to inject the field.
        # Since ItemResponse is based on ORM, we can't easily attach a non-mapped attribute
        # that persists through serialization if not on the object.
        # However, Pydantic's 'from_attributes' (orm_mode) usually reads attributes.
        # We can dynamically set the attribute on the instance for this request scope.

        action_type = None
        if item.status == models.ItemStatus.PENDING:
            action_type = models.ApprovalActionType.CREATE
        elif item.status == models.ItemStatus.TRANSFER_PENDING:
            action_type = models.ApprovalActionType.TRANSFER
        elif item.status == models.ItemStatus.WRITE_OFF_PENDING:
            action_type = models.ApprovalActionType.WRITE_OFF

        approver_names = []
        if action_type:
            approvers = await workflow_engine.get_current_step_approvers(db, item, action_type)
            approver_names = [u.name for u in approvers]

        # Monkey-patching the instance for Pydantic serialization
        item.current_approvers = approver_names
        enriched_items.append(item)

    return enriched_items

@router.get("/pending-actions", response_model=List[schemas.ItemResponse])
async def read_pending_actions(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Returns items that require operator action (Receipt or Finalize Write-off).
    """
    allowed_branches = [b.id for b in current_user.branches]
    if current_user.branch_id and current_user.branch_id not in allowed_branches:
        allowed_branches.append(current_user.branch_id)

    items = await crud.get_pending_action_items(db, current_user.id, allowed_branches)
    return items

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

        # Modified Logic: If no specific branch filter is requested,
        # return items in allowed branches OR items in transit TO allowed branches.
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
            # WebSocket Broadcast (JSON Payload)
            from backend.websocket_manager import manager
            payload = {
                "message": f"Novo item cadastrado: {db_item.description}",
                "actor_id": current_user.id,
                "target_roles": ["ADMIN", "APPROVER"],
                "target_branch_id": db_item.branch_id
            }
            await manager.broadcast(json.dumps(payload))

            # Persistent Notification & Email
            await notify_new_item(db, db_item)

        return db_item
    except Exception as e:
        print(f"Error creating item: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao criar item: {str(e)}")

# --- Bulk Operations (Moved Before Parameterized Routes to Avoid 422 Collision) ---

@router.post("/bulk/write-off")
async def bulk_write_off(
    request: schemas.BulkWriteOffRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Solicita baixa em lote de itens.
    Valida que todos os itens pertençam à mesma categoria.
    Cria solicitação de baixa (WRITE_OFF_PENDING) para aprovação.
    """
    if current_user.role == models.UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditores não podem realizar baixas")

    if not request.item_ids:
        raise HTTPException(status_code=400, detail="Nenhum item selecionado")

    # 1. Fetch Items
    items = await crud.get_items_by_ids(db, request.item_ids)
    if len(items) != len(request.item_ids):
        raise HTTPException(status_code=404, detail="Alguns itens não foram encontrados")

    # 2. Validation: Same Category
    first_category_id = items[0].category_id
    for item in items:
        if item.category_id != first_category_id:
            raise HTTPException(status_code=400, detail="Todos os itens da baixa em lote devem pertencer à mesma categoria")

        # Permission check per item
        if current_user.role == models.UserRole.OPERATOR and not current_user.all_branches:
             allowed = [b.id for b in current_user.branches]
             if current_user.branch_id: allowed.append(current_user.branch_id)
             if item.branch_id not in allowed:
                 raise HTTPException(status_code=403, detail=f"Sem permissão para o item {item.description}")

        # Status Check
        if item.status in [models.ItemStatus.PENDING, models.ItemStatus.TRANSFER_PENDING, models.ItemStatus.WRITE_OFF_PENDING]:
            raise HTTPException(status_code=400, detail=f"Item '{item.description}' já possui uma solicitação pendente.")

    # 3. Create Request
    req_data = schemas.RequestCreate(
        type=models.RequestType.WRITE_OFF,
        category_id=first_category_id,
        requester_id=current_user.id,
        data={"reason": request.reason, "justification": request.justification}
    )
    new_request = await crud.create_request(db, req_data)

    # 4. Execution Loop
    for item in items:
        # Change to Pending Status
        item.status = models.ItemStatus.WRITE_OFF_PENDING
        item.approval_step = 1
        item.request_id = new_request.id
        item.write_off_reason = request.reason
        # Append justification if provided
        if request.justification:
             item.observations = f"{item.observations or ''}\n[Solic. Baixa em Lote] Justificativa: {request.justification}"

        # Log
        log = models.Log(
            item_id=item.id,
            user_id=current_user.id,
            action=f"Solicitação de Baixa em Lote (Request #{new_request.id}). Motivo: {request.reason}. {request.justification or ''}"
        )
        db.add(log)

    await db.commit()

    # 5. Consolidated Notification
    try:
        approvers = await workflow_engine.get_current_step_approvers(db, new_request, models.ApprovalActionType.WRITE_OFF)
        category_name = items[0].category_rel.name if items[0].category_rel else "Desconhecida"

        msg = f"Solicitação de Baixa em Lote Criada (Request #{new_request.id} - Etapa {new_request.current_step}).\n\n"
        msg += f"Motivo: {request.reason}\n"
        msg += f"Justificativa: {request.justification or 'N/A'}\n\n"
        msg += f"Categoria: {category_name}\n"
        msg += f"Solicitante: {current_user.name}\n"
        msg += f"Quantidade: {len(items)}\n"
        msg += f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}"

        # Build list of item details for table
        items_details = [build_item_details(item) for item in items]

        # Determine Frontend URL: Priority 1: Request Origin (Automatic), 2: Env Var, 3: Fallback
        origin = req_context.headers.get("origin")
        frontend_url = origin if origin else os.getenv("FRONTEND_URL")

        if not frontend_url:
            base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")
            # Heuristic: Replace backend port 8001 with frontend port 5173 (Vite default) or 3000
            if ":8001" in base_url:
                frontend_url = base_url.replace(":8001", ":5173")
            else:
                frontend_url = base_url.rstrip("/")

        action_url = f"{frontend_url}/pending-approvals?id={new_request.id}"

        html = notifications.generate_html_email(
            "Solicitação de Baixa em Lote",
            msg,
            item_details=items_details,
            action_url=action_url,
            action_text="Analisar Solicitação"
        )
        await notifications.notify_users(db, approvers, "Solicitação de Baixa em Lote", msg, email_subject="Ação Necessária: Aprovar Baixa em Lote", email_html=html)
    except Exception as e:
        print(f"Error sending bulk notification: {e}")

    return {"message": "Solicitação de baixa em lote enviada", "count": len(items)}

@router.post("/bulk/transfer")
async def bulk_transfer(
    request: schemas.BulkTransferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Solicita transferência em lote de itens.
    Cria solicitação de transferência (TRANSFER_PENDING) para aprovação.
    """
    if current_user.role == models.UserRole.AUDITOR:
        raise HTTPException(status_code=403, detail="Auditores não podem transferir")

    if not request.item_ids:
        raise HTTPException(status_code=400, detail="Nenhum item selecionado")

    items = await crud.get_items_by_ids(db, request.item_ids)
    if len(items) != len(request.item_ids):
        raise HTTPException(status_code=404, detail="Alguns itens não foram encontrados")

    # Validation: Same Category
    first_category_id = items[0].category_id
    for item in items:
        if item.category_id != first_category_id:
            raise HTTPException(status_code=400, detail="Todos os itens da transferência em lote devem pertencer à mesma categoria")

        if item.status in [models.ItemStatus.PENDING, models.ItemStatus.TRANSFER_PENDING, models.ItemStatus.WRITE_OFF_PENDING]:
            raise HTTPException(status_code=400, detail=f"Item '{item.description}' já possui uma solicitação pendente.")

    target_branch = await crud.get_branch(db, request.target_branch_id)
    if not target_branch:
        raise HTTPException(status_code=404, detail="Filial de destino não encontrada")

    # Validate Invoice and Series are numeric if provided
    if request.invoice_number and not request.invoice_number.isdigit():
        raise HTTPException(status_code=400, detail="O número da nota fiscal deve conter apenas dígitos.")
    if request.invoice_series and not request.invoice_series.isdigit():
        raise HTTPException(status_code=400, detail="A série da nota fiscal deve conter apenas dígitos.")

    # Validate Origin != Destination
    for item in items:
        if item.branch_id == request.target_branch_id:
            raise HTTPException(status_code=400, detail=f"O item '{item.description}' já pertence à filial de destino.")

    # Create Request
    req_data = schemas.RequestCreate(
        type=models.RequestType.TRANSFER,
        category_id=first_category_id,
        requester_id=current_user.id,
        data={
            "target_branch_id": request.target_branch_id,
            "invoice_number": request.invoice_number,
            "invoice_series": request.invoice_series,
            # "invoice_date": request.invoice_date # Serialize date if needed
        }
    )
    new_request = await crud.create_request(db, req_data)

    for item in items:
        # Permission check
        if current_user.role == models.UserRole.OPERATOR and not current_user.all_branches:
             allowed = [b.id for b in current_user.branches]
             if current_user.branch_id: allowed.append(current_user.branch_id)
             if item.branch_id not in allowed:
                 raise HTTPException(status_code=403, detail=f"Sem permissão para o item {item.description}")

        # Update to Pending
        item.status = models.ItemStatus.TRANSFER_PENDING
        item.approval_step = 1
        item.request_id = new_request.id
        item.transfer_target_branch_id = request.target_branch_id
        item.transfer_invoice_number = request.invoice_number
        item.transfer_invoice_series = request.invoice_series
        item.transfer_invoice_date = request.invoice_date

        log = models.Log(
            item_id=item.id,
            user_id=current_user.id,
            action=f"Solicitação de Transferência em Lote para {target_branch.name} (Request #{new_request.id})"
        )
        db.add(log)

    await db.commit()

    # Notification
    try:
        approvers = await workflow_engine.get_current_step_approvers(db, new_request, models.ApprovalActionType.TRANSFER)

        origins = sorted(list({item.branch.name for item in items if item.branch}))
        origin_str = origins[0] if len(origins) == 1 else "Múltiplas Origens"

        msg = f"Solicitação de transferência em lote criada (Request #{new_request.id} - Etapa {new_request.current_step}).\n"
        msg += f"Origem: {origin_str}\n"
        msg += f"Destino: {target_branch.name}\n\n"

        msg += f"Solicitante: {current_user.name}\n"
        msg += f"Quantidade: {len(items)}\n"
        msg += f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M')}"

        # Build list of item details for table
        items_details = [build_item_details(item) for item in items]

        # Determine Frontend URL
        origin = req_context.headers.get("origin")
        frontend_url = origin if origin else os.getenv("FRONTEND_URL")

        if not frontend_url:
            base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")
            if ":8001" in base_url:
                frontend_url = base_url.replace(":8001", ":5173")
            else:
                frontend_url = base_url.rstrip("/")

        action_url = f"{frontend_url}/pending-approvals?id={new_request.id}"

        html = notifications.generate_html_email(
            "Solicitação de Transferência em Lote",
            msg,
            item_details=items_details,
            action_url=action_url,
            action_text="Analisar Solicitação"
        )
        await notifications.notify_users(db, approvers, "Solicitação de Transferência em Lote", msg, email_subject="Ação Necessária: Aprovar Transferência em Lote", email_html=html)
    except Exception as e:
        print(f"Error sending bulk notification: {e}")

    return {"message": "Solicitação de transferência em lote enviada", "count": len(items)}

# --- Individual Operations ---

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

    # Allow Operators to confirm receipt (status IN_TRANSIT -> IN_STOCK)
    is_receipt_confirmation = (old_status == models.ItemStatus.IN_TRANSIT and status_update == models.ItemStatus.IN_STOCK)

    if not is_admin_approver and not is_operator:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role não autorizada")

    # Permission Logic for Operators
    if is_operator:
        if is_receipt_confirmation:
            # Check if operator belongs to target branch
            allowed_branches = [b.id for b in current_user.branches]
            if current_user.branch_id and current_user.branch_id not in allowed_branches:
                allowed_branches.append(current_user.branch_id)

            # Use transfer_target_branch_id because the item is technically still in the old branch until received
            if item_obj.transfer_target_branch_id not in allowed_branches:
                raise HTTPException(status_code=403, detail="Você não tem permissão para receber itens nesta filial")
        else:
            # Standard Operator Permissions
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

    # Backend Rule: Moving to Operational status requires prior approval
    target_is_operational = status_update in [models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]
    current_is_operational = item_obj.status in [models.ItemStatus.APPROVED, models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK, models.ItemStatus.IN_TRANSIT] # IN_TRANSIT is quasi-operational

    if target_is_operational and not current_is_operational and not is_receipt_confirmation:
         raise HTTPException(status_code=400, detail="O item deve ser aprovado antes de ser movido para Manutenção ou Estoque")

    # --- Workflow Logic ---
    action_type = None
    if status_update == models.ItemStatus.APPROVED:
        if item_obj.status == models.ItemStatus.PENDING:
             action_type = models.ApprovalActionType.CREATE
        elif item_obj.status == models.ItemStatus.TRANSFER_PENDING:
             action_type = models.ApprovalActionType.TRANSFER
    elif status_update == models.ItemStatus.WRITTEN_OFF and item_obj.status == models.ItemStatus.WRITE_OFF_PENDING:
         action_type = models.ApprovalActionType.WRITE_OFF

    if action_type:
        # Check if we should advance step instead of finalizing
        if await workflow_engine.should_advance_step(db, item_obj, action_type):
            # Increment Step
            item_obj.approval_step = (item_obj.approval_step or 1) + 1

            log = models.Log(
                item_id=item_id,
                user_id=current_user.id,
                action=f"Aprovação parcial (Etapa {item_obj.approval_step - 1} concluída). Aguardando próxima etapa."
            )
            db.add(log)
            # Commit the step change
            db.add(item_obj)
            await db.commit()

            # Notify Next Approvers
            next_approvers = await workflow_engine.get_current_step_approvers(db, item_obj, action_type)

            msg = f"Item aguardando sua aprovação (Etapa {item_obj.approval_step})."
            title = "Ação Necessária: Aprovação Pendente"
            details = build_item_details(item_obj)

            base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")
            frontend_url = base_url.replace(":8001", ":3000") if "localhost" in base_url else base_url
            action_url = f"{frontend_url}/dashboard/detalhes/item/{item_obj.id}"

            html = notifications.generate_html_email(
                title,
                msg,
                item_details=details,
                action_url=action_url,
                action_text="Analisar Solicitação"
            )
            await notifications.notify_users(db, next_approvers, title, msg, email_subject=title, email_html=html)

            # Broadcast update
            from backend.websocket_manager import manager
            payload = {
                "message": f"Item {item_obj.description} avançou para etapa {item_obj.approval_step}",
                "actor_id": current_user.id,
                "target_roles": ["ADMIN", "APPROVER"],
                "target_branch_id": item_obj.branch_id
            }
            await manager.broadcast(json.dumps(payload))

            return item_obj

    # Capture diff before update
    diff = calculate_diff(item_obj, {"status": status_update}, exclude=[])

    updated_item = await crud.update_item_status(db, item_id, status_update, current_user.id, fixed_asset_number, reason)

    # Update log with diff if available
    if diff:
        # Find the last log created by update_item_status (which adds a log)
        # Or better, we explicitly update the log here.
        # crud.update_item_status adds a log entry. We should probably modify that function to accept diff
        # or fetch the last log here. Fetching last log is race-condition prone.
        # Let's assume for now we don't have atomic access to that specific log object.
        # We can create a new log or update crud.
        # Best practice: Update crud.update_item_status to accept `changes` dict.
        pass

    # Websocket Broadcast (JSON Payload)
    from backend.websocket_manager import manager
    payload = {
        "message": f"Item {updated_item.description} atualizado para {status_update}",
        "actor_id": current_user.id,
        "target_roles": ["OPERATOR", "ADMIN", "APPROVER"], # Notify all relevant roles
        "target_branch_id": updated_item.branch_id
    }
    await manager.broadcast(json.dumps(payload))

    # Notify Branch Members about the outcome (Persistent/Email)
    await notify_status_change(db, updated_item, old_status, updated_item.status, reason)

    return updated_item

@router.post("/{item_id}/transfer", response_model=schemas.ItemResponse)
async def request_transfer(
    item_id: int,
    target_branch_id: int,
    transfer_invoice_number: Optional[str] = None,
    transfer_invoice_series: Optional[str] = None,
    transfer_invoice_date: Optional[datetime] = None,
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

    # Prevent parallel actions
    if item.status in [models.ItemStatus.PENDING, models.ItemStatus.TRANSFER_PENDING, models.ItemStatus.WRITE_OFF_PENDING]:
        raise HTTPException(status_code=400, detail="Este item já possui uma solicitação pendente.")

    item = await crud.request_transfer(db, item_id, target_branch_id, current_user.id,
                                       transfer_invoice_number, transfer_invoice_series, transfer_invoice_date)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    from backend.websocket_manager import manager
    payload = {
        "message": f"Solicitação de transferência para item {item.description}",
        "actor_id": current_user.id,
        "target_roles": ["ADMIN", "APPROVER"],
        "target_branch_id": item.branch_id # Optional context
    }
    await manager.broadcast(json.dumps(payload))

    # Notify Approvers
    await notify_transfer_request(db, item)

    return item

@router.post("/{item_id}/write-off", response_model=schemas.ItemResponse)
async def request_write_off(
    item_id: int,
    justification: Optional[str] = Form(None),
    reason: str = Form(...),
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

    # Prevent parallel actions
    if item.status in [models.ItemStatus.PENDING, models.ItemStatus.TRANSFER_PENDING, models.ItemStatus.WRITE_OFF_PENDING]:
        raise HTTPException(status_code=400, detail="Este item já possui uma solicitação pendente.")

    # Combine reason and justification for the log/email message if needed,
    # but store structured data if model supports it.
    # Current request_write_off in crud only takes justification. We should update crud or append.
    # Ideally we should update write_off_reason column too.

    full_justification = f"Motivo: {reason}. {justification or ''}"

    # We update the item with the reason separately if possible
    # But crud.request_write_off currently updates status and adds log.
    # Ideally we should update write_off_reason column too.

    item = await crud.request_write_off(db, item_id, full_justification, current_user.id, reason=reason)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    from backend.websocket_manager import manager
    payload = {
        "message": f"Solicitação de baixa para item {item.description}",
        "actor_id": current_user.id,
        "target_roles": ["ADMIN", "APPROVER"],
        "target_branch_id": item.branch_id
    }
    await manager.broadcast(json.dumps(payload))

    # Notify Approvers
    await notify_write_off_request(db, item, reason, justification)

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

    # Permission Logic
    is_admin_approver = current_user.role in [models.UserRole.ADMIN, models.UserRole.APPROVER]
    is_operator = current_user.role == models.UserRole.OPERATOR

    if not is_admin_approver:
        if is_operator and existing_item.status == models.ItemStatus.REJECTED:
             # Check Branch Permission
            if not current_user.all_branches:
                allowed_branches = [b.id for b in current_user.branches]
                if current_user.branch_id and current_user.branch_id not in allowed_branches:
                    allowed_branches.append(current_user.branch_id)
                if existing_item.branch_id not in allowed_branches:
                     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para editar este item")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem editar itens")

    # Workflow: If item is REJECTED and updated, it should go back to PENDING for re-evaluation.
    # This applies to Operators (required) and generally makes sense for others editing a rejected item.
    if existing_item.status == models.ItemStatus.REJECTED:
        # If status is not explicitly being changed to something else (e.g. via API magic), force PENDING
        if item_update.status is None:
            item_update.status = models.ItemStatus.PENDING
            existing_item.approval_step = 1
            db.add(existing_item)

    # Calculate diff
    new_data = item_update.dict(exclude_unset=True)
    diff = calculate_diff(existing_item, new_data)

    updated_item = await crud.update_item(db, item_id, item_update)

    if diff:
        log = models.Log(
            item_id=item_id,
            user_id=current_user.id,
            action="Atualização de Item (Detalhes)",
            changes=diff
        )
        db.add(log)
        await db.commit()

    # Notify if re-submitted
    if existing_item.status == models.ItemStatus.REJECTED and updated_item.status == models.ItemStatus.PENDING:
         # Manually broadcast here for resubmission too
         from backend.websocket_manager import manager
         payload = {
            "message": f"Item re-enviado para aprovação: {updated_item.description}",
            "actor_id": current_user.id,
            "target_roles": ["ADMIN", "APPROVER"],
            "target_branch_id": updated_item.branch_id
         }
         await manager.broadcast(json.dumps(payload))

         await notify_new_item(db, updated_item)

    return updated_item
