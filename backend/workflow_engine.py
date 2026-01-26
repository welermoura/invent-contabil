from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend import models
from typing import List, Optional

async def get_workflow_steps(db: AsyncSession, category_id: int, action_type: models.ApprovalActionType) -> List[models.ApprovalWorkflow]:
    """
    Fetches the approval workflow steps for a given category and action.
    Returns ordered steps by step_order.
    """
    query = select(models.ApprovalWorkflow).where(
        models.ApprovalWorkflow.category_id == category_id,
        models.ApprovalWorkflow.action_type == action_type
    ).order_by(models.ApprovalWorkflow.step_order)

    result = await db.execute(query)
    return result.scalars().all()

async def get_current_step_approvers(db: AsyncSession, item: models.Item, action_type: models.ApprovalActionType) -> List[models.User]:
    """
    Determines who should approve the item at its current approval_step.
    Returns a list of User objects.
    """
    if not item.category_id:
        # Fallback: All Approvers if no category (should not happen in valid items)
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

    steps = await get_workflow_steps(db, item.category_id, action_type)

    if not steps:
        # No workflow defined -> Default to All Approvers/Admins
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

    # Steps are mapped to item.approval_step (1-based index)
    # Step 1 -> steps[0]
    current_step_num = item.approval_step or 1

    # Safety check
    if current_step_num > len(steps):
         # We are somehow past the configured steps (maybe workflow changed).
         # Fallback to Admin to unblock.
         from backend.crud import get_users_by_role
         return await get_users_by_role(db, [models.UserRole.ADMIN])

    current_rule = steps[current_step_num - 1]

    # Resolve Users
    if current_rule.required_user_id:
        # Specific User
        result = await db.execute(select(models.User).where(models.User.id == current_rule.required_user_id))
        user = result.scalars().first()
        return [user] if user else []

    elif current_rule.required_role:
        # Specific Role
        # If required is APPROVER, ADMINs are also implicitly approvers.
        roles = [current_rule.required_role]
        if current_rule.required_role == models.UserRole.APPROVER:
            if models.UserRole.ADMIN not in roles:
                roles.append(models.UserRole.ADMIN)

        from backend.crud import get_users_by_role
        return await get_users_by_role(db, roles)

    # Fallback if rule is empty (should not happen)
    return []

async def should_advance_step(db: AsyncSession, item: models.Item, action_type: models.ApprovalActionType) -> bool:
    """
    Checks if there is a next step after the current one.
    """
    if not item.category_id:
        return False

    steps = await get_workflow_steps(db, item.category_id, action_type)
    if not steps:
        return False

    current_step_num = item.approval_step or 1

    # If current step is less than total steps, we can advance.
    return current_step_num < len(steps)
