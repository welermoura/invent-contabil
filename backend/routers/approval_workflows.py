from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db

router = APIRouter(prefix="/approval-workflows", tags=["approval-workflows"])

@router.get("/", response_model=List[schemas.ApprovalWorkflowResponse])
async def read_approval_workflows(
    category_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await crud.get_approval_workflows(db, category_id=category_id)

@router.post("/", response_model=schemas.ApprovalWorkflowResponse)
async def create_approval_workflow(
    workflow: schemas.ApprovalWorkflowCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Optional: Check if duplicate exists?
    # For now, just create
    return await crud.create_approval_workflow(db, workflow)

@router.put("/{workflow_id}", response_model=schemas.ApprovalWorkflowResponse)
async def update_approval_workflow(
    workflow_id: int,
    workflow_update: schemas.ApprovalWorkflowUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=403, detail="Not authorized")

    updated = await crud.update_approval_workflow(db, workflow_id, workflow_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return updated

@router.put("/reorder", tags=["approval-workflows"])
async def reorder_approval_workflows(
    updates: List[dict],
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=403, detail="Not authorized")

    await crud.reorder_approval_workflows(db, updates)
    return {"message": "Reordered successfully"}

@router.delete("/{workflow_id}")
async def delete_approval_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        raise HTTPException(status_code=403, detail="Not authorized")

    success = await crud.delete_approval_workflow(db, workflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"message": "Deleted successfully"}
