from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.get("/", response_model=List[schemas.UserResponse])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Admin and Approver can view users
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Não autorizado")
    return await crud.get_users(db, skip=skip, limit=limit)

@router.post("/", response_model=schemas.UserResponse)
async def create_user(
    user: schemas.UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem criar usuários")

    # Extra security: Approvers cannot create Admins?
    # Requirement: "o Aprovador pode Cadastrar\Alterar\Excluir... Usuários"
    # Usually Approvers shouldn't touch Admins, but prompt says "Users".
    # Memory says: "strictly prohibit modifying or deleting users with the 'Admin' role."
    if current_user.role == models.UserRole.APPROVER and user.role == models.UserRole.ADMIN:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores não podem criar Administradores")

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

    # Check target user role
    target_user_crud = await crud.get_users(db, skip=0, limit=10000) # Inefficient but okay for now, or fetch by ID
    # Better to fetch directly
    # Need a get_user_by_id in crud or reuse update logic check
    # Let's rely on crud.update_user logic? No, we need to block before action if logic requires permission check on target role.
    # Crud `update_user` fetches user first. We can add check there or here.
    # Let's check here. We need a helper to get user by ID.
    # Simulating check:
    # (Assuming crud.update_user handles "not found")

    # RESTRICTION: Approvers cannot edit Admins (Memory)
    if current_user.role == models.UserRole.APPROVER:
        # We need to know the role of the user being updated.
        # Since we don't have a quick "get_by_id" exposed cleanly in this context without re-querying,
        # we can do it manually.
        from sqlalchemy.future import select
        result = await db.execute(select(models.User).where(models.User.id == user_id))
        target_user = result.scalars().first()
        if target_user and target_user.role == models.UserRole.ADMIN:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores não podem modificar Administradores")

    updated_user = await crud.update_user(db, user_id, user)
    if not updated_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return updated_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores e aprovadores podem excluir usuários")

    # RESTRICTION: Approvers cannot delete Admins
    if current_user.role == models.UserRole.APPROVER:
        from sqlalchemy.future import select
        result = await db.execute(select(models.User).where(models.User.id == user_id))
        target_user = result.scalars().first()
        if target_user and target_user.role == models.UserRole.ADMIN:
             raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Aprovadores não podem excluir Administradores")

    success = await crud.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return
