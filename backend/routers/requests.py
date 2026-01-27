from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth, notifications, workflow_engine
from backend.database import get_db
import json
from datetime import datetime
import os

router = APIRouter(prefix="/requests", tags=["requests"])

@router.get("/my-requests", response_model=List[schemas.RequestResponse])
async def read_my_requests(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    requests = await crud.get_requests(db, skip=skip, limit=limit, requester_id=current_user.id)

    # Enrich with current approvers
    for req in requests:
        action_type = models.ApprovalActionType.WRITE_OFF if req.type == models.RequestType.WRITE_OFF else models.ApprovalActionType.TRANSFER
        if req.status == models.RequestStatus.PENDING:
            approvers = await workflow_engine.get_current_step_approvers(db, req, action_type)
            req.current_approvers = [u.name for u in approvers]

    return requests

@router.get("/pending", response_model=List[schemas.RequestResponse])
async def read_pending_requests(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Fetch all PENDING requests
    all_pending = await crud.get_requests(db, status=models.RequestStatus.PENDING, limit=1000)

    visible_requests = []
    for req in all_pending:
        action_type = models.ApprovalActionType.WRITE_OFF if req.type == models.RequestType.WRITE_OFF else models.ApprovalActionType.TRANSFER

        approvers = await workflow_engine.get_current_step_approvers(db, req, action_type)
        approver_ids = [u.id for u in approvers]

        # Check if user is an approver OR is an ADMIN (Admins can usually override or see all)
        # But per strict workflow, only assigned approvers should act.
        # However, admins often want visibility.
        # Let's show to approvers AND admins.
        is_approver = current_user.id in approver_ids
        is_admin = current_user.role == models.UserRole.ADMIN

        if is_approver or is_admin:
            req.current_approvers = [u.name for u in approvers]
            visible_requests.append(req)

    return visible_requests

@router.post("/{request_id}/approve", response_model=schemas.RequestResponse)
async def approve_request(
    request_id: int,
    req_context: Request,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    req = await crud.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    if req.status != models.RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Solicitação não está pendente")

    action_type = models.ApprovalActionType.WRITE_OFF if req.type == models.RequestType.WRITE_OFF else models.ApprovalActionType.TRANSFER
    approvers = await workflow_engine.get_current_step_approvers(db, req, action_type)

    if current_user.id not in [u.id for u in approvers] and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Você não tem permissão para aprovar esta solicitação")

    # Workflow Logic
    if await workflow_engine.should_advance_step(db, req, action_type):
        # Advance Step
        req.current_step += 1
        await db.commit()

        # Notify Next Approvers
        next_approvers = await workflow_engine.get_current_step_approvers(db, req, action_type)

        # Build Message & Details
        # Reuse build_item_details from items router logic, but we need to import or replicate.
        # It's cleaner to import if possible, but it's inside items router.
        # Better to move build_item_details to notifications.py or util?
        # For speed, I'll use a simplified version here or replicate logic.
        # Let's import the helper function from items.py? No, circular import risk if items imports requests later.
        # Let's implement local helper or fetch data.

        # Fetch detailed items for email table
        # We need to reload items with relationships if not loaded deeply enough in get_request
        # get_request already loads items.branch, category, responsible.

        from backend.routers.items import build_item_details
        items_details = [build_item_details(item) for item in req.items]

        msg = f"Solicitação aguardando sua aprovação (Etapa {req.current_step}).\n"
        if req.data:
            if 'reason' in req.data: msg += f"\nMotivo: {req.data['reason']}"
            if 'justification' in req.data: msg += f"\nJustificativa: {req.data['justification']}"

        # Determine Frontend URL
        origin = req_context.headers.get("origin")
        frontend_url = origin if origin else os.getenv("FRONTEND_URL")

        if not frontend_url:
            base_url = os.getenv("APP_BASE_URL", "http://localhost:8001")
            if ":8001" in base_url:
                frontend_url = base_url.replace(":8001", ":5173")
            else:
                frontend_url = base_url.rstrip("/")

        action_url = f"{frontend_url}/pending-approvals?id={req.id}"

        html = notifications.generate_html_email(
            "Aprovação Pendente",
            msg,
            item_details=items_details,
            action_url=action_url,
            action_text="Analisar Solicitação"
        )

        try:
            await notifications.notify_users(db, next_approvers, "Aprovação Pendente", msg, email_subject="Ação Necessária: Aprovação Pendente", email_html=html)
        except Exception as e:
            print(f"Error sending notification: {e}")

    else:
        # Finalize
        req.status = models.RequestStatus.APPROVED

        # Update Items
        final_item_status = models.ItemStatus.WRITTEN_OFF
        log_action = "Baixa aprovada via Solicitação em Lote"

        if req.type == models.RequestType.TRANSFER:
            final_item_status = models.ItemStatus.IN_TRANSIT
            log_action = "Transferência aprovada via Solicitação em Lote (Em Trânsito)"

        for item in req.items:
            item.status = final_item_status
            log = models.Log(item_id=item.id, user_id=current_user.id, action=log_action)
            db.add(log)

            # Special case for transfer: might need to ensure target branch is set?
            # It was set on creation.

        await db.commit()

        # Notify Requester
        try:
            await notifications.notify_users(db, [req.requester], "Solicitação Aprovada", f"Sua solicitação {req.id} foi aprovada.")
        except:
            pass

    # Refresh to return updated data
    req = await crud.get_request(db, request_id)
    return req

@router.post("/{request_id}/reject", response_model=schemas.RequestResponse)
async def reject_request(
    request_id: int,
    req_context: Request,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    req = await crud.get_request(db, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    if req.status != models.RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Solicitação não está pendente")

    action_type = models.ApprovalActionType.WRITE_OFF if req.type == models.RequestType.WRITE_OFF else models.ApprovalActionType.TRANSFER
    approvers = await workflow_engine.get_current_step_approvers(db, req, action_type)

    if current_user.id not in [u.id for u in approvers] and current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Você não tem permissão para rejeitar esta solicitação")

    req.status = models.RequestStatus.REJECTED

    # Revert Items
    # Assuming items were active (APPROVED, IN_STOCK, MAINTENANCE) before.
    # Safe bet: Revert to APPROVED (which usually means "Active/Available").
    # Or IN_STOCK?
    # Given they were in WRITE_OFF_PENDING or TRANSFER_PENDING.
    # Most items start as APPROVED or IN_STOCK.
    # Let's set to APPROVED as a safe fallback for "Active".
    # Or check if we can restore previous status? We don't track "previous status" easily on item unless looking at logs.
    # Defaulting to APPROVED.

    for item in req.items:
        item.status = models.ItemStatus.APPROVED
        item.request_id = None # Unlink from request? Or keep for history?
        # Keeping it linked helps trace why it was rejected. But it shouldn't be "locked" by it anymore?
        # If we keep request_id, we know it BELONGED to that request.
        # But if we want to add it to a NEW request, we might need to clear it?
        # The constraint is 1-to-N. One item belongs to One Request.
        # If we want to retry, we need to create a NEW request.
        # So we should probably CLEAR request_id or just allow overwriting it later.
        # If we clear it, we lose the link.
        # Let's KEEP it. But ensure `bulk_create` checks if item is in PENDING request, not REJECTED one.

        log = models.Log(item_id=item.id, user_id=current_user.id, action="Solicitação rejeitada. Item retornado para status Ativo.")
        db.add(log)

    await db.commit()

    # Notify Requester
    try:
        await notifications.notify_users(db, [req.requester], "Solicitação Rejeitada", f"Sua solicitação {req.id} foi rejeitada.")
    except:
        pass

    req = await crud.get_request(db, request_id)
    return req
