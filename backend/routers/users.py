from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.post("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    request: schemas.ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify current password
    if not auth.verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta")

    # Update password
    current_user.hashed_password = auth.get_password_hash(request.new_password)
    await db.commit()
    return {"message": "Senha alterada com sucesso"}

@router.get("/", response_model=List[schemas.UserResponse])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER, models.UserRole.AUDITOR]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não autorizado")
    return await crud.get_users(db, skip=skip, limit=limit, search=search)

@router.post("/", response_model=schemas.UserResponse)
async def create_user(
    user: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem criar usuários")

    if current_user.role == models.UserRole.APPROVER and user.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores não podem criar Administradores")

    if user.role == models.UserRole.OPERATOR and user.all_branches:
        raise HTTPException(status_code=400, detail="Operadores não podem ter acesso a todas as filiais")

    db_user = await crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    return await crud.create_user(db=db, user=user)

@router.put("/{user_id}", response_model=schemas.UserResponse)
async def update_user(
    user_id: int,
    user: schemas.UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem atualizar usuários")

    target_user = await crud.get_user(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if current_user.role == models.UserRole.APPROVER:
        if target_user.role == models.UserRole.ADMIN:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores não podem editar Administradores")
        if user.role == models.UserRole.ADMIN:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores não podem promover usuários a Administrador")

    # Validate Operator constraint
    final_role = user.role if user.role is not None else target_user.role
    final_all_branches = user.all_branches if user.all_branches is not None else target_user.all_branches

    if final_role == models.UserRole.OPERATOR and final_all_branches:
        raise HTTPException(status_code=400, detail="Operadores não podem ter acesso a todas as filiais")

    updated_user = await crud.update_user(db, user_id, user)
    return updated_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem remover usuários")

    target_user = await crud.get_user(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if current_user.role == models.UserRole.APPROVER and target_user.role == models.UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores não podem remover Administradores")

    success = await crud.delete_user(db, user_id)
    return
