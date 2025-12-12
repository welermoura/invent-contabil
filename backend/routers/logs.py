
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from backend import models, crud, auth, schemas
from backend.database import get_db

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/", response_model=List[schemas.LogResponse])
async def read_logs(
    limit: int = 1000,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Only Admin/Approver/Auditor can see audit logs
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER, models.UserRole.AUDITOR]:
        # Operator can't see system-wide logs
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Not authorized to view system logs")

    return await crud.get_all_logs(db, limit=limit)
