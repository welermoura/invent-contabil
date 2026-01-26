from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db

router = APIRouter(prefix="/groups", tags=["user-groups"])

@router.get("/", response_model=List[schemas.UserGroupResponse])
async def read_user_groups(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await crud.get_user_groups(db, skip=skip, limit=limit)

@router.post("/", response_model=schemas.UserGroupResponse)
async def create_user_group(
    group: schemas.UserGroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can create groups")

    return await crud.create_user_group(db, group)

@router.put("/{group_id}", response_model=schemas.UserGroupResponse)
async def update_user_group(
    group_id: int,
    group: schemas.UserGroupUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can update groups")

    updated = await crud.update_user_group(db, group_id, group)
    if not updated:
        raise HTTPException(status_code=404, detail="Group not found")
    return updated

@router.delete("/{group_id}")
async def delete_user_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Admins can delete groups")

    success = await crud.delete_user_group(db, group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"message": "Deleted successfully"}
