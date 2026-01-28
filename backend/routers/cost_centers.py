from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db

router = APIRouter(prefix="/cost-centers", tags=["cost-centers"])

@router.get("/", response_model=List[schemas.CostCenterResponse])
async def read_cost_centers(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # All authenticated users can read (for dropdowns)
    return await crud.get_cost_centers(db, skip=skip, limit=limit, search=search)

@router.post("/", response_model=schemas.CostCenterResponse)
async def create_cost_center(
    cost_center: schemas.CostCenterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem criar centros de custo")

    return await crud.create_cost_center(db, cost_center)

@router.put("/{cost_center_id}", response_model=schemas.CostCenterResponse)
async def update_cost_center(
    cost_center_id: int,
    cost_center: schemas.CostCenterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada")

    updated = await crud.update_cost_center(db, cost_center_id, cost_center)
    if not updated:
        raise HTTPException(status_code=404, detail="Centro de custo não encontrado")
    return updated

@router.delete("/{cost_center_id}")
async def delete_cost_center(
    cost_center_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada")

    success = await crud.delete_cost_center(db, cost_center_id)
    if not success:
        raise HTTPException(status_code=404, detail="Centro de custo não encontrado")
    return {"message": "Centro de custo removido"}
