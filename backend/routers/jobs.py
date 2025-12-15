from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend import models, crud, notifications, auth
from backend.database import get_db
from datetime import datetime, timedelta
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.post("/check-depreciation")
async def check_depreciation_alerts(
    db: AsyncSession = Depends(get_db),
    # Optional: protect this endpoint with a secret key or admin only
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Checks for items nearing end of useful life (60, 30, 10, 0 days) and notifies relevant users.
    Should be called daily via cron or manually.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can trigger jobs manually")

    today = datetime.now().date()

    # 1. Fetch all items with category (to get depreciation_months)
    # We filter in python because depreciation calc is complex in SQL with the current schema
    # (purchase_date + months)

    query = select(models.Item).options(
        selectinload(models.Item.category_rel),
        selectinload(models.Item.branch)
    ).where(
        models.Item.status.in_([models.ItemStatus.APPROVED, models.ItemStatus.IN_STOCK, models.ItemStatus.MAINTENANCE]),
        models.Item.purchase_date.isnot(None),
        models.Item.category_id.isnot(None)
    )

    result = await db.execute(query)
    items = result.scalars().all()

    alerts_sent = 0

    for item in items:
        if not item.category_rel or not item.category_rel.depreciation_months:
            continue

        purchase_date = item.purchase_date.date()
        # Calculate End of Life Date
        # Simplification: add days (months * 30) or use exact date math
        # Ideally use dateutil.relativedelta but let's use approx for now or standard py logic
        # Using exact month addition logic if possible, or 30.44 days avg

        # Simple approximation:
        days_life = item.category_rel.depreciation_months * 30
        end_of_life_date = purchase_date + timedelta(days=days_life)

        days_remaining = (end_of_life_date - today).days

        # Check thresholds
        thresholds = [60, 30, 10, 0]

        if days_remaining in thresholds:
            # Trigger Alert

            # Determine urgency
            urgency = "ALERTA CRÍTICO" if days_remaining <= 0 else "Aviso de Depreciação"
            msg = f"O item '{item.description}' (Ativo: {item.fixed_asset_number}) "

            if days_remaining <= 0:
                msg += "atingiu o fim da sua vida útil hoje."
            else:
                msg += f"está a {days_remaining} dias do fim da vida útil."

            msg += f"\nFilial: {item.branch.name}\nData Compra: {purchase_date}\nFim Vida Útil: {end_of_life_date}"

            html = notifications.generate_html_email(f"{urgency}: Fim de Vida Útil", msg)

            # Target Users: Approvers + Branch Members
            approvers = await notifications.get_approvers(db)
            branch_members = await notifications.get_branch_members(db, item.branch_id)

            # Combine unique users
            recipients = list({u.id: u for u in (approvers + branch_members)}.values())

            await notifications.notify_users(
                db,
                recipients,
                f"{urgency}: {item.description}",
                msg,
                email_subject=f"{urgency} - {item.description}",
                email_html=html
            )
            alerts_sent += 1

    return {"status": "success", "alerts_sent": alerts_sent}
