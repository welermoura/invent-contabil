from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlalchemy.future import select
from backend import models, auth
from backend.database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Total Pending Items
    result_pending = await db.execute(select(func.count(models.Item.id)).where(models.Item.status == models.ItemStatus.PENDING))
    pending_count = result_pending.scalar()

    # Total Value of Pending Items
    result_value = await db.execute(select(func.sum(models.Item.invoice_value)).where(models.Item.status == models.ItemStatus.PENDING))
    pending_value = result_value.scalar() or 0.0

    # Items by Category
    result_category = await db.execute(select(models.Item.category, func.count(models.Item.id)).group_by(models.Item.category))
    items_by_category = [{"category": row[0], "count": row[1]} for row in result_category.all()]

    # Items by Branch
    # We need to join with Branch table to get branch name
    result_branch = await db.execute(
        select(models.Branch.name, func.count(models.Item.id))
        .join(models.Branch, models.Item.branch_id == models.Branch.id)
        .group_by(models.Branch.name)
    )
    items_by_branch = [{"branch": row[0], "count": row[1]} for row in result_branch.all()]

    return {
        "pending_items_count": pending_count,
        "pending_items_value": pending_value,
        "items_by_category": items_by_category,
        "items_by_branch": items_by_branch
    }
