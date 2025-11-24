from fastapi import APIRouter, Depends
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
    return await crud.get_branches(db, skip=skip, limit=limit)
