
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

@router.get("/", response_model=List[schemas.SupplierResponse])
async def read_suppliers(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Todos podem visualizar
    return await crud.get_suppliers(db, skip=skip, limit=limit, search=search)

@router.post("/", response_model=schemas.SupplierResponse)
async def create_supplier(
    supplier: schemas.SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Todas as filiais podem cadastrar (qualquer usuário logado)
    # Verificar se CNPJ já existe
    existing = await crud.get_supplier_by_cnpj(db, supplier.cnpj)
    if existing:
        raise HTTPException(status_code=400, detail="CNPJ já cadastrado")
    return await crud.create_supplier(db, supplier)

@router.put("/{supplier_id}", response_model=schemas.SupplierResponse)
async def update_supplier(
    supplier_id: int,
    supplier: schemas.SupplierBase,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Apenas Aprovador e Admin podem editar
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem editar fornecedores")

    updated = await crud.update_supplier(db, supplier_id, supplier)
    if not updated:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return updated

@router.delete("/{supplier_id}", response_model=bool)
async def delete_supplier(
    supplier_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Apenas Admin pode deletar (assumindo restrição similar a Branch/Category, ou Admin/Approver?)
    # Pedido diz: "editar apenas Aprovador e Admin". Não especificou deletar, vou assumir mesmo grupo.
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada")

    success = await crud.delete_supplier(db, supplier_id)
    if not success:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado")
    return True
