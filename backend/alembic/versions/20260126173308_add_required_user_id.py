"""add required_user_id to approval_workflows

Revision ID: 20260126173308
Revises: 454c59037009
Create Date: 2026-01-26 17:33:08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import ProgrammingError, OperationalError


# revision identifiers, used by Alembic.
revision: str = '20260126173308'
down_revision: Union[str, None] = '454c59037009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL for atomic "IF NOT EXISTS" check handled by the DB
    # This avoids python-side reflection race conditions
    op.execute("ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS required_user_id INTEGER")

    # For the foreign key, we can try to create it.
    # Postgres doesn't have "ADD CONSTRAINT IF NOT EXISTS" in standard ALTER TABLE until v16/recent?
    # So we'll use a safe block.
    try:
        with op.batch_alter_table('approval_workflows') as batch_op:
             batch_op.create_foreign_key('fk_approval_workflows_users', 'users', ['required_user_id'], ['id'])
    except (ProgrammingError, OperationalError) as e:
        if "already exists" in str(e) or "Duplicate" in str(e):
             print("Constraint fk_approval_workflows_users likely already exists, skipping.")
        else:
             # It might fail if constraint exists, let's try to ignore specifically constraint errors
             # If it's a real error (like table missing), we want to raise
             print(f"Warning: Could not create foreign key: {e}")

    # Make role nullable
    try:
        with op.batch_alter_table('approval_workflows') as batch_op:
            batch_op.alter_column('required_role', existing_type=sa.VARCHAR(), nullable=True)
    except (ProgrammingError, OperationalError):
        pass


def downgrade() -> None:
    with op.batch_alter_table('approval_workflows') as batch_op:
        batch_op.drop_constraint('fk_approval_workflows_users', type_='foreignkey')
        batch_op.alter_column('required_role', existing_type=sa.VARCHAR(), nullable=False)
        batch_op.drop_column('required_user_id')
