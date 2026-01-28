from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend import models
from typing import List, Optional, Union

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

async def get_current_step_approvers(db: AsyncSession, entity: Union[models.Item, models.Request], action_type: models.ApprovalActionType) -> List[models.User]:
    """
    Determines who should approve the entity (Item or Request) at its current step.
    Returns a list of User objects.
    """
    category_id = entity.category_id
    if isinstance(entity, models.Item):
        current_step_num = entity.approval_step or 1
    else:
        current_step_num = entity.current_step or 1

    if not category_id:
        print(f"WORKFLOW DEBUG: No category_id for entity. Fallback to ADMIN.")
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN])

    steps = await get_workflow_steps(db, category_id, action_type)

    if not steps:
        print(f"WORKFLOW DEBUG: No steps found for Category {category_id} Action {action_type}. Fallback to ADMIN.")
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN])

    # Steps are mapped to step number (1-based index)
    # Step 1 -> steps[0]

    # Safety check
    if current_step_num > len(steps):
         print(f"WORKFLOW DEBUG: Step {current_step_num} exceeds workflow length {len(steps)}. Fallback to ADMIN.")
         from backend.crud import get_users_by_role
         return await get_users_by_role(db, [models.UserRole.ADMIN])

    current_rule = steps[current_step_num - 1]
    approvers = []

    # Resolve Users
    if current_rule.required_user_id:
        # Specific User
        result = await db.execute(select(models.User).where(models.User.id == current_rule.required_user_id))
        user = result.scalars().first()
        if user: approvers = [user]

    elif current_rule.required_group_id:
        # User Group
        # Fetch all users in the group
        from sqlalchemy.orm import selectinload
        result = await db.execute(select(models.UserGroup).options(selectinload(models.UserGroup.users)).where(models.UserGroup.id == current_rule.required_group_id))
        group = result.scalars().first()
        if group: approvers = group.users

    elif current_rule.required_role:
        # Specific Role
        roles = [current_rule.required_role]
        from backend.crud import get_users_by_role
        approvers = await get_users_by_role(db, roles)

    if not approvers:
        print(f"WORKFLOW DEBUG: Rule found but no users resolved. Rule ID: {current_rule.id}. Fallback to ADMIN.")
        from backend.crud import get_users_by_role
        return await get_users_by_role(db, [models.UserRole.ADMIN])

    return approvers

async def should_advance_step(db: AsyncSession, entity: Union[models.Item, models.Request], action_type: models.ApprovalActionType) -> bool:
    """
    Checks if there is a next step after the current one.
    """
    category_id = entity.category_id
    if isinstance(entity, models.Item):
        current_step_num = entity.approval_step or 1
    else:
        current_step_num = entity.current_step or 1

    if not category_id:
        return False

    steps = await get_workflow_steps(db, category_id, action_type)
    if not steps:
        return False

    # If current step is less than total steps, we can advance.
    return current_step_num < len(steps)
