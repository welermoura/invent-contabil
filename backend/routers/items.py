from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
import shutil
import os
from datetime import datetime

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
    # Operadores agora podem ter acesso a multiplas filiais ou a todas se a flag estiver ativa.
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER, models.UserRole.AUDITOR] and not current_user.all_branches:
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
    if current_user.role == models.UserRole.OPERATOR and not current_user.all_branches:
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
        db_item = await crud.create_item(db, item_data, action_log="Item cadastrado manualmente.")
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
    # Fetch item to check permissions and current status
    item_obj = await crud.get_item(db, item_id)
    if not item_obj:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    is_admin_approver = current_user.role in [models.UserRole.ADMIN, models.UserRole.APPROVER]
    is_operator = current_user.role == models.UserRole.OPERATOR

    if not is_admin_approver and not is_operator:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role não autorizada")

    # Business Rule: Items must be Approved before moving to Maintenance or Stock
    # This applies to ALL roles to prevent bypassing the approval workflow
    target_is_operational = status_update in [models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]
    current_is_operational = item_obj.status in [models.ItemStatus.APPROVED, models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]

    if target_is_operational and not current_is_operational:
         raise HTTPException(status_code=400, detail="O item deve ser aprovado antes de ser movido para Manutenção ou Estoque")

    if is_operator:
        # Check Branch Permission
        if not current_user.all_branches:
            allowed_branches = [b.id for b in current_user.branches]
            if current_user.branch_id and current_user.branch_id not in allowed_branches:
                allowed_branches.append(current_user.branch_id)

            if item_obj.branch_id not in allowed_branches:
                raise HTTPException(status_code=403, detail="Sem permissão nesta filial")

        # Validate Transitions for Operator
        allowed_targets = [models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK, models.ItemStatus.APPROVED]
        if status_update not in allowed_targets:
             raise HTTPException(status_code=403, detail="Operadores só podem alterar para Manutenção, Estoque ou Ativo")

        # Cannot touch PENDING, REJECTED, TRANSFER/WRITEOFF PENDING via this endpoint (except moving FROM active states)
        # Operators cannot Approve a PENDING item.
        allowed_sources = [models.ItemStatus.APPROVED, models.ItemStatus.MAINTENANCE, models.ItemStatus.IN_STOCK]
        if item_obj.status not in allowed_sources:
             raise HTTPException(status_code=403, detail="Operadores não podem alterar status de itens Pendentes ou em Processo")

    # Proceed with update
    updated_item = await crud.update_item_status(db, item_id, status_update, current_user.id, fixed_asset_number, reason)

    # Trigger WebSocket notification
    from backend.websocket_manager import manager
    await manager.broadcast(f"Item {updated_item.description} status changed to {status_update}")

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

    item = await crud.request_transfer(db, item_id, target_branch_id, current_user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

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
            if not current_user.all_branches:
                allowed_branches = [b.id for b in current_user.branches]
                if current_user.branch_id and current_user.branch_id not in allowed_branches:
                    allowed_branches.append(current_user.branch_id)

                if existing_item.branch_id not in allowed_branches:
                     raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para editar este item")

            # If authorized, FORCE status to PENDING upon edit (resubmit)
            item_update.status = models.ItemStatus.PENDING
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem editar itens (ou operadores corrigindo rejeições)")

    updated_item = await crud.update_item(db, item_id, item_update)
    return updated_item
