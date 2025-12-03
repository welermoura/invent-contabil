from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, crud, auth, models
from backend.database import get_db

router = APIRouter(prefix="/branches", tags=["branches"])

@router.get("/", response_model=List[schemas.BranchResponse])
async def read_branches(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    branches = await crud.get_branches(db, skip=skip, limit=limit)

    # Filter for Operators: only return assigned branches
    if current_user.role == models.UserRole.OPERATOR:
        allowed_branch_ids = {b.id for b in current_user.branches}
        if current_user.branch_id:
            allowed_branch_ids.add(current_user.branch_id)

        # Filter the list
        branches = [b for b in branches if b.id in allowed_branch_ids]

    return branches

@router.post("/", response_model=schemas.BranchResponse)
async def create_branch(
    branch: schemas.BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem criar filiais")

    return await crud.create_branch(db, branch=branch)

@router.put("/{branch_id}", response_model=schemas.BranchResponse)
async def update_branch(
    branch_id: int,
    branch: schemas.BranchBase,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem editar filiais")

    updated = await crud.update_branch(db, branch_id, branch)
    if not updated:
         raise HTTPException(status_code=404, detail="Filial não encontrada")
    return updated

@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem excluir filiais")

    success = await crud.delete_branch(db, branch_id)
    if not success:
         raise HTTPException(status_code=404, detail="Filial não encontrada")
    return
