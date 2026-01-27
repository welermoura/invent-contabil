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
    DEPRECATED for new Request model flow, but kept for backward compatibility if needed.
    """
    if not item.category_id:
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

    steps = await get_workflow_steps(db, item.category_id, action_type)

    if not steps:
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

    current_step_num = item.approval_step or 1

    if current_step_num > len(steps):
         from backend.crud import get_users_by_role
         return await get_users_by_role(db, [models.UserRole.ADMIN])

    current_rule = steps[current_step_num - 1]
    return await _resolve_rule_users(db, current_rule)

async def get_current_step_approvers_for_request(db: AsyncSession, request: models.Request) -> List[models.User]:
    """
    Determines who should approve the REQUEST at its current_step.
    """
    if not request.category_id:
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

    steps = await get_workflow_steps(db, request.category_id, request.type)

    if not steps:
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN, models.UserRole.APPROVER])

    current_step_num = request.current_step or 1

    if current_step_num > len(steps):
         # If beyond defined steps, usually means done or admin fallback
         from backend.crud import get_users_by_role
         return await get_users_by_role(db, [models.UserRole.ADMIN])

    current_rule = steps[current_step_num - 1]
    return await _resolve_rule_users(db, current_rule)

async def _resolve_rule_users(db: AsyncSession, rule: models.ApprovalWorkflow) -> List[models.User]:
    if rule.required_user_id:
        result = await db.execute(select(models.User).where(models.User.id == rule.required_user_id))
        user = result.scalars().first()
        return [user] if user else []

    elif rule.required_group_id:
        from sqlalchemy.orm import selectinload
        result = await db.execute(select(models.UserGroup).options(selectinload(models.UserGroup.users)).where(models.UserGroup.id == rule.required_group_id))
        group = result.scalars().first()
        return group.users if group else []

    elif rule.required_role:
        roles = [rule.required_role]
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, roles)

    return []

async def should_advance_step(db: AsyncSession, item: models.Item, action_type: models.ApprovalActionType) -> bool:
    """
    Checks if there is a next step after the current one.
    DEPRECATED in favor of has_next_step for Request
    """
    if not item.category_id:
        return False

    steps = await get_workflow_steps(db, item.category_id, action_type)
    if not steps:
        return False

    current_step_num = item.approval_step or 1
    return current_step_num < len(steps)

async def has_next_step(db: AsyncSession, request: models.Request) -> bool:
    """
    Checks if the request has more approval steps.
    """
    if not request.category_id:
        return False

    steps = await get_workflow_steps(db, request.category_id, request.type)
    if not steps:
        return False

    return request.current_step < len(steps)
