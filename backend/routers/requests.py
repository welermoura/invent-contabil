from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth, notifications, workflow_engine
from backend.database import get_db
import json
from datetime import datetime

router = APIRouter(prefix="/requests", tags=["requests"])

@router.get("/my", response_model=List[schemas.RequestResponse])
async def get_my_requests(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Returns requests initiated by the current user."""
    return await crud.get_user_requests(db, current_user.id)

@router.get("/pending", response_model=List[schemas.RequestResponse])
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Returns requests pending approval by the current user."""
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        return []

    # Logic: Get all pending requests, filter by workflow
    # Optimized approach: Get all pending requests, then filter in python?
    # Or complex query. For now, fetch pending requests and filter.
    requests = await crud.get_pending_requests(db)

    approvable_requests = []
    for req in requests:
        # Determine if current user is an approver for this step
        if not req.category_id:
            # Fallback for category-less requests? Should not happen.
            continue

        approvers = await workflow_engine.get_current_step_approvers_for_request(db, req)
        if any(u.id == current_user.id for u in approvers):
            approvable_requests.append(req)

    return approvable_requests

@router.put("/{request_id}/approve", response_model=schemas.RequestResponse)
async def approve_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    req = await crud.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    # Check permissions
    approvers = await workflow_engine.get_current_step_approvers_for_request(db, req)
    if not any(u.id == current_user.id for u in approvers):
        raise HTTPException(status_code=403, detail="Você não tem permissão para aprovar esta etapa")

    # Advance Step
    req.current_step += 1

    # Check if workflow is complete
    has_next = await workflow_engine.has_next_step(db, req)

    if not has_next:
        # Finalize
        req.status = models.RequestStatus.APPROVED
        await crud.finalize_request(db, req)

        # Notify Requester
        # await notifications.notify_request_outcome(db, req, "APPROVED")
    else:
        # Notify Next Approvers
        pass

    await db.commit()
    await db.refresh(req)
    return req

@router.put("/{request_id}/reject", response_model=schemas.RequestResponse)
async def reject_request(
    request_id: int,
    reason: str = None, # Form?
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    req = await crud.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    # Check permissions (same as approve)
    approvers = await workflow_engine.get_current_step_approvers_for_request(db, req)
    if not any(u.id == current_user.id for u in approvers):
        raise HTTPException(status_code=403, detail="Você não tem permissão para rejeitar esta etapa")

    req.status = models.RequestStatus.REJECTED

    # Release Items
    await crud.reject_request_items(db, req)

    await db.commit()
    await db.refresh(req)
    return req
