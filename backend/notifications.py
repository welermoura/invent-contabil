from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from backend import models, crud, schemas
from backend.websocket_manager import manager
from backend.database import get_db

async def notify_users(
    db: AsyncSession,
    title: str,
    message: str,
    target_roles: Optional[List[models.UserRole]] = None,
    target_users: Optional[List[int]] = None,
    target_branch_id: Optional[int] = None,
    exclude_user_id: Optional[int] = None
):
    """
    Creates notifications in the database and broadcasts them via WebSocket.

    Args:
        db: Database session
        title: Notification title
        message: Notification message
        target_roles: List of user roles to receive the notification
        target_users: List of specific user IDs to receive the notification
        target_branch_id: Filter users by branch (optional)
        exclude_user_id: ID of the user who triggered the action (to avoid self-notification)
    """
    recipients = set()

    # Find users by role
    if target_roles:
        query = select(models.User).where(models.User.role.in_(target_roles))
        result = await db.execute(query)
        role_users = result.scalars().all()

        for user in role_users:
            # Check branch constraint if specified
            if target_branch_id:
                # If user has access to all branches, or is assigned to this branch
                if user.all_branches:
                    recipients.add(user.id)
                elif user.branch_id == target_branch_id:
                     recipients.add(user.id)
                else:
                    # Check many-to-many branches
                    # We need to reload or check eager loaded branches if not present
                    # Ideally, role_users should have branches loaded.
                    # For simplicity, assuming selectinload is default on User (it is)
                    user_branch_ids = [b.id for b in user.branches]
                    if target_branch_id in user_branch_ids:
                        recipients.add(user.id)
            else:
                recipients.add(user.id)

    # Add specific users
    if target_users:
        for uid in target_users:
            recipients.add(uid)

    # Exclude actor
    if exclude_user_id and exclude_user_id in recipients:
        recipients.remove(exclude_user_id)

    # Create notifications in DB
    notifications_to_create = []
    for user_id in recipients:
        notification = models.Notification(
            user_id=user_id,
            title=title,
            message=message
        )
        db.add(notification)
        notifications_to_create.append(notification)

    if notifications_to_create:
        try:
            await db.commit()
        except Exception as e:
            print(f"Error saving notifications: {e}")
            await db.rollback()

    # Broadcast via WebSocket (Simplified broadcast, frontend will filter if needed,
    # but ideally we send to specific users. Current WS implementation is broadcast-all).
    # We will send a message that the frontend parses.
    # To make it efficient, we just broadcast the text for now,
    # but since we have DB persistence, the frontend can poll/refresh.
    # We'll send a signal to refresh.

    # Send detailed payload so frontend can decide to show toast
    # We broadcast to everyone, and frontend decides based on user ID or Role.
    # Since we can't easily target WS connections by User ID in current manager without map.
    await manager.broadcast(f"NOTIFICATION:{title}:{message}")
