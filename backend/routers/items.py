from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
import shutil
import os
from datetime import datetime
from backend.notification_service import notify_approvers, notify_user

router = APIRouter(prefix="/items", tags=["items"])

UPLOAD_DIR = "/app/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

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
    # Operadores agora podem ter acesso a multiplas filiais.
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER, models.UserRole.AUDITOR]:
        # Se o usuário passou um branch_id, verifica se ele tem acesso.
        # Se não passou, precisamos filtrar por todas as filiais que ele tem acesso.

        allowed_branches = [b.id for b in current_user.branches]
        # Adicionar branch_id legado se existir e não estiver na lista (segurança)
        if current_user.branch_id and current_user.branch_id not in allowed_branches:
            allowed_branches.append(current_user.branch_id)

        if branch_id:
            if branch_id not in allowed_branches:
                 # Se tentar acessar filial que não tem permissão, retorna vazio ou erro?
                 # Melhor retornar vazio para não vazar existência, ou tratar como filtro restritivo.
                 # Vamos forçar um filtro impossível ou levantar erro.
                 raise HTTPException(status_code=403, detail="Acesso negado a esta filial")
        else:
            return await crud.get_items(
                db,
                skip=skip,
                limit=limit,
                status=status,
                category=category,
                branch_id=None,
                search=search,
                allowed_branch_ids=allowed_branches,
                description=description,
                fixed_asset_number=fixed_asset_number,
                purchase_date=purchase_date
            )

    # If the user IS Admin, Approver or Auditor, and they passed a branch_id, we use it.
    return await crud.get_items(
        db,
        skip=skip,
        limit=limit,
        status=status,
        category=category,
        branch_id=branch_id,
        search=search,
        description=description,
        fixed_asset_number=fixed_asset_number,
        purchase_date=purchase_date
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

    # Validate branch permission for OPERATOR
    if current_user.role == models.UserRole.OPERATOR:
        allowed_branches = [b.id for b in current_user.branches]
        if current_user.branch_id and current_user.branch_id not in allowed_branches:
            allowed_branches.append(current_user.branch_id)

        if branch_id not in allowed_branches:
            raise HTTPException(status_code=403, detail="Você não tem permissão para criar itens nesta filial")

    # Save file if uploaded
    file_path = None
    if file:
        import os
        import re
        # secure_filename replacement to avoid extra dependency
        filename = file.filename
        filename = re.sub(r'[^A-Za-z0-9_.-]', '_', filename)
        safe_filename = filename

        file_location = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        # Store relative path for serving
        file_path = f"uploads/{safe_filename}"

    # Resolve category_id from name if provided
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

    # Create item
    try:
        db_item = await crud.create_item(db, item_data)
        # Note: file path setting is missing in crud.create_item, need to handle it or update crud
        # Better: Update item with file path after creation or pass to crud
        if file_path:
            db_item.invoice_file = file_path
            db.add(db_item)
            await db.commit()
            # Refresh again with relations
            from sqlalchemy.orm import selectinload
            from sqlalchemy.future import select
            query = select(models.Item).where(models.Item.id == db_item.id).options(
                selectinload(models.Item.branch),
                selectinload(models.Item.category_rel)
            )
            result = await db.execute(query)
            db_item = result.scalars().first()

        # NOTIFICATION: Notify Approvers
        await notify_approvers(
            db,
            title="Novo item aguardando aprovação",
            body=f"O usuário {current_user.name} cadastrou o item {db_item.description}.",
            item_id=db_item.id,
            type="cadastro",
            click_action=f"/inventory?status=PENDING&item_id={db_item.id}"
        )

        return db_item
    except Exception as e:
        print(f"Error creating item: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao criar item: {str(e)}")

class ItemStatusUpdate(BaseModel):
    status: schemas.ItemStatus
    fixed_asset_number: Optional[str] = None
    reason: Optional[str] = None

@router.put("/{item_id}/status", response_model=schemas.ItemResponse)
async def update_item_status(
    item_id: int,
    update_data: ItemStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não autorizado a aprovar/rejeitar itens")

    item = await crud.update_item_status(db, item_id, update_data.status, current_user.id, update_data.fixed_asset_number)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    # Notify Operator
    if item.responsible_id:
        if update_data.status == models.ItemStatus.APPROVED:
            await notify_user(
                db,
                item.responsible_id,
                "Item aprovado",
                f"O item {item.description} foi aprovado por {current_user.name}.",
                item.id,
                "aprovacao",
                f"/inventory?item_id={item.id}"
            )
        elif update_data.status == models.ItemStatus.REJECTED:
            reason_msg = f" Motivo: {update_data.reason}" if update_data.reason else ""
            await notify_user(
                db,
                item.responsible_id,
                "Item rejeitado",
                f"O item {item.description} foi rejeitado por {current_user.name}.{reason_msg}",
                item.id,
                "rejeicao",
                f"/inventory?item_id={item.id}"
            )

    # Trigger WebSocket notification
    from backend.websocket_manager import manager
    await manager.broadcast(f"Item {item.description} status changed to {status_update}")

    return item

@router.post("/{item_id}/transfer", response_model=schemas.ItemResponse)
async def request_transfer(
    item_id: int,
    target_branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role == models.UserRole.AUDITOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auditores não podem solicitar transferências")

    # Verify item ownership for Operators
    item = await crud.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    if current_user.role == models.UserRole.OPERATOR:
        allowed_branches = [b.id for b in current_user.branches]
        if current_user.branch_id and current_user.branch_id not in allowed_branches:
            allowed_branches.append(current_user.branch_id)

        if item.branch_id not in allowed_branches:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para transferir este item")

    source_branch_name = item.branch.name if item.branch else "Desconhecida"

    item = await crud.request_transfer(db, item_id, target_branch_id, current_user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    target_branch_name = item.transfer_target_branch.name if item.transfer_target_branch else "Desconhecida"

    # Notify Approvers about transfer
    # Also ideally notify responsible of target branch?
    # For now, per rules: "Enviar para responsáveis da filial origem e destino"
    # This is tricky because we don't track "Branch Manager".
    # We will notify Approvers as they manage everything, and maybe the operator responsible for item.

    await notify_approvers(
        db,
        "Transferência de Item",
        f"O item {item.description} foi transferido de {source_branch_name} para {target_branch_name}.",
        item.id,
        "transferencia",
        f"/inventory?item_id={item.id}"
    )

    from backend.websocket_manager import manager
    await manager.broadcast(f"Solicitação de transferência para item {item.description}")

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

    # Verify item ownership for Operators
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

    # Notify Approvers
    await notify_approvers(
        db,
        "Solicitação de baixa",
        f"O item {item.description} foi enviado para baixa por {current_user.name}.",
        item.id,
        "baixa",
        f"/inventory?status=WRITE_OFF_PENDING&item_id={item.id}"
    )

    from backend.websocket_manager import manager
    await manager.broadcast(f"Solicitação de baixa para item {item.description}")

    return item

@router.put("/{item_id}", response_model=schemas.ItemResponse)
async def update_item(
    item_id: int,
    item_update: schemas.ItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Fetch existing item to check existence
    existing_item = await crud.get_item(db, item_id)
    if not existing_item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    # Permission logic
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        # Check if Operator and item is REJECTED
        if current_user.role == models.UserRole.OPERATOR and existing_item.status == models.ItemStatus.REJECTED:
             # Check branch permission
            allowed_branches = [b.id for b in current_user.branches]
            if current_user.branch_id and current_user.branch_id not in allowed_branches:
                allowed_branches.append(current_user.branch_id)

            if existing_item.branch_id not in allowed_branches:
                 raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para editar este item")

            # If authorized, FORCE status to PENDING upon edit (resubmit)
            item_update.status = models.ItemStatus.PENDING

            # Notify Approvers about resubmission
            await notify_approvers(
                db,
                "Item Reenviado para Aprovação",
                f"O item {existing_item.description} foi corrigido e reenviado por {current_user.name}.",
                existing_item.id,
                "cadastro",
                f"/inventory?item_id={existing_item.id}"
            )
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem editar itens (ou operadores corrigindo rejeições)")

    # If Approver edits, maybe notify someone? Not required by strict rules but good practice.
    # For now keep as is.

    updated_item = await crud.update_item(db, item_id, item_update)
    return updated_item
