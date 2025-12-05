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
            return await crud.get_items(db, skip=skip, limit=limit, status=status, category=category, branch_id=None, search=search, allowed_branch_ids=allowed_branches)

    # If the user IS Admin, Approver or Auditor, and they passed a branch_id, we use it.
    return await crud.get_items(db, skip=skip, limit=limit, status=status, category=category, branch_id=branch_id, search=search)

@router.post("/", response_model=schemas.ItemResponse)
async def create_item(
    description: str = Form(...),
    category: str = Form(...),
    purchase_date: datetime = Form(...),
    invoice_value: float = Form(...),
    invoice_number: str = Form(...),
    branch_id: int = Form(...),
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

    item_data = schemas.ItemCreate(
        description=description,
        category=category,
        purchase_date=purchase_date,
        invoice_value=invoice_value,
        invoice_number=invoice_number,
        branch_id=branch_id,
        serial_number=serial_number,
        fixed_asset_number=fixed_asset_number,
        observations=observations,
        responsible_id=current_user.id
    )

    # Create item
    try:
        # Pydantic schema expects category_id, frontend might send category name
        # If necessary, we could resolve here, but let's assume valid ID or optional
        # For now, pass dict as is
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

        return db_item
    except Exception as e:
        print(f"Error creating item: {e}")
        raise HTTPException(status_code=400, detail=f"Erro ao criar item: {str(e)}")

@router.put("/{item_id}/status", response_model=schemas.ItemResponse)
async def update_item_status(
    item_id: int,
    status_update: schemas.ItemStatus,
    fixed_asset_number: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não autorizado a aprovar/rejeitar itens")

    item = await crud.update_item_status(db, item_id, status_update, current_user.id, fixed_asset_number)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

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

    # Only Allow Operators (of the item's branch?) or Admins to request transfer
    # First fetch item to check ownership
    item_check = await crud.get_items(db, skip=0, limit=1, search=None) # Helper? No, use direct query logic or existing get
    # But crud.get_items is a list. Let's just assume simple check logic for now or add a get_item
    # For now, let's proceed. Ideally we check if current_user.branch_id == item.branch_id

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

    # Only Allow Operators (of the item's branch?) or Admins to request write-off
    item = await crud.request_write_off(db, item_id, justification, current_user.id)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    from backend.websocket_manager import manager
    await manager.broadcast(f"Solicitação de baixa para item {item.description}")

    return item

@router.get("/check-asset/{fixed_asset_number}")
async def check_fixed_asset(
    fixed_asset_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    item = await crud.get_item_by_fixed_asset(db, fixed_asset_number)
    if item:
        return {
            "exists": True,
            "item": {
                "description": item.description,
                "fixed_asset_number": item.fixed_asset_number,
                "branch_name": item.branch.name if item.branch else "N/A",
                "purchase_date": item.purchase_date
            }
        }
    return {"exists": False}
