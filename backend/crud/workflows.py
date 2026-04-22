from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload, noload
from sqlalchemy import or_, cast, String
from backend import models, schemas
from backend.auth import get_password_hash
from datetime import datetime
from backend.audit import calculate_diff

async def get_approval_workflows(db: AsyncSession, category_id: int = None):
    query = select(models.ApprovalWorkflow).options(
        joinedload(models.ApprovalWorkflow.category).options(noload(models.Category.items), noload(models.Category.requests)),
        joinedload(models.ApprovalWorkflow.required_user).options(noload(models.User.branches), noload(models.User.requests)),
        joinedload(models.ApprovalWorkflow.required_group).options(noload(models.UserGroup.users))
    )
    if category_id:
        query = query.where(models.ApprovalWorkflow.category_id == category_id)
    result = await db.execute(query)
    return result.scalars().all()


async def create_approval_workflow(db: AsyncSession, workflow: schemas.ApprovalWorkflowCreate):
    # Auto-calculate next step order if not provided or to ensure sequence
    # Find max step_order for this category + action
    query = select(models.ApprovalWorkflow).where(
        models.ApprovalWorkflow.category_id == workflow.category_id,
        models.ApprovalWorkflow.action_type == workflow.action_type
    ).order_by(models.ApprovalWorkflow.step_order.desc())

    result = await db.execute(query)
    existing_workflows = result.scalars().all()

    next_step = 1
    if existing_workflows:
        next_step = existing_workflows[0].step_order + 1

    db_workflow = models.ApprovalWorkflow(**workflow.dict())
    db_workflow.step_order = next_step # Override input

    db.add(db_workflow)
    await db.commit()
    await db.refresh(db_workflow)
    # Reload relation
    query = select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == db_workflow.id).options(
        joinedload(models.ApprovalWorkflow.category).options(noload(models.Category.items), noload(models.Category.requests)),
        joinedload(models.ApprovalWorkflow.required_user).options(noload(models.User.branches), noload(models.User.requests)),
        joinedload(models.ApprovalWorkflow.required_group).options(noload(models.UserGroup.users))
    )
    result = await db.execute(query)
    return result.scalars().first()


async def update_approval_workflow(db: AsyncSession, workflow_id: int, workflow_update: schemas.ApprovalWorkflowUpdate):
    result = await db.execute(select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == workflow_id))
    db_workflow = result.scalars().first()
    if db_workflow:
        # Handle mutual exclusivity: If setting user, clear group. If setting group, clear user.
        # Use model_dump to check what was explicitly sent.

        update_data = workflow_update.model_dump(exclude_unset=True) if hasattr(workflow_update, 'model_dump') else workflow_update.dict(exclude_unset=True)

        if 'required_user_id' in update_data:
             db_workflow.required_user_id = update_data['required_user_id']
             if db_workflow.required_user_id: # If setting a user (not None), clear group
                 db_workflow.required_group_id = None

        if 'required_group_id' in update_data:
             db_workflow.required_group_id = update_data['required_group_id']
             if db_workflow.required_group_id: # If setting a group, clear user
                 db_workflow.required_user_id = None

        await db.commit()
        await db.refresh(db_workflow)

        # Reload relation
        query = select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == db_workflow.id).options(
            joinedload(models.ApprovalWorkflow.category).options(noload(models.Category.items), noload(models.Category.requests)),
            joinedload(models.ApprovalWorkflow.required_user).options(noload(models.User.branches), noload(models.User.requests)),
            joinedload(models.ApprovalWorkflow.required_group).options(noload(models.UserGroup.users))
        )
        result = await db.execute(query)
        db_workflow = result.scalars().first()

    return db_workflow


async def delete_approval_workflow(db: AsyncSession, workflow_id: int):
    result = await db.execute(select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == workflow_id))
    db_workflow = result.scalars().first()
    if db_workflow:
        await db.delete(db_workflow)
        await db.commit()
        return True
    return False


async def reorder_approval_workflows(db: AsyncSession, updates: list[dict]):
    """
    Updates the step_order for a list of workflow items.
    updates format: [{'id': 1, 'step_order': 2}, {'id': 5, 'step_order': 1}]
    """
    for update in updates:
        wf_id = update['id']
        new_order = update['step_order']

        result = await db.execute(select(models.ApprovalWorkflow).where(models.ApprovalWorkflow.id == wf_id))
        db_workflow = result.scalars().first()
        if db_workflow:
            db_workflow.step_order = new_order

    await db.commit()
    return True

# Requests

