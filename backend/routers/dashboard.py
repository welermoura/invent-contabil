from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlalchemy.future import select
from backend import models, auth
from backend.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Base Filters based on user role
    branch_filter = None
    # AUDITOR também pode ver tudo
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER, models.UserRole.AUDITOR]:
         # Filtrar por lista de branches permitidas
         allowed_branches = [b.id for b in current_user.branches]
         if current_user.branch_id and current_user.branch_id not in allowed_branches:
             allowed_branches.append(current_user.branch_id)

         if allowed_branches:
             branch_filter = models.Item.branch_id.in_(allowed_branches)
         else:
             # Se não tem branches, não vê nada (filtros impossível)
             branch_filter = models.Item.id == -1

    # Total Pending Items
    query_pending = select(func.count(models.Item.id)).where(models.Item.status == models.ItemStatus.PENDING)
    if branch_filter is not None:
        query_pending = query_pending.where(branch_filter)
    result_pending = await db.execute(query_pending)
    pending_count = result_pending.scalar()

    # Total Value of Pending Items
    query_value = select(func.sum(models.Item.invoice_value)).where(models.Item.status == models.ItemStatus.PENDING)
    if branch_filter is not None:
        query_value = query_value.where(branch_filter)
    result_value = await db.execute(query_value)
    pending_value = result_value.scalar() or 0.0

    # Total Write-off Pending Items
    query_write_off = select(func.count(models.Item.id)).where(models.Item.status == models.ItemStatus.WRITE_OFF_PENDING)
    if branch_filter is not None:
        query_write_off = query_write_off.where(branch_filter)
    result_write_off = await db.execute(query_write_off)
    write_off_count = result_write_off.scalar()

    # Items by Category (Pending only? Request says "Itens Pendentes" behavior... usually dashboard shows aggregates.
    # Let's filter aggregates by the user's branch if they are an operator, otherwise all.)
    query_category = select(models.Item.category, func.count(models.Item.id))
    # Note: User request implies "Inventory button empty... items pending white page".
    # The stats should also reflect what they can see.
    if branch_filter is not None:
        query_category = query_category.where(branch_filter)

    query_category = query_category.group_by(models.Item.category)
    result_category = await db.execute(query_category)
    items_by_category = [{"category": row[0], "count": row[1]} for row in result_category.all()]

    # Items by Branch
    # We need to join with Branch table to get branch name and ID
    query_branch = select(models.Branch.id, models.Branch.name, func.count(models.Item.id)).join(models.Branch, models.Item.branch_id == models.Branch.id)
    if branch_filter is not None:
        query_branch = query_branch.where(branch_filter)

    query_branch = query_branch.group_by(models.Branch.id, models.Branch.name)
    result_branch = await db.execute(query_branch)
    items_by_branch = [{"branch_id": row[0], "branch": row[1], "count": row[2]} for row in result_branch.all()]

    return {
        "pending_items_count": pending_count,
        "pending_items_value": pending_value,
        "write_off_count": write_off_count,
        "items_by_category": items_by_category,
        "items_by_branch": items_by_branch
    }
