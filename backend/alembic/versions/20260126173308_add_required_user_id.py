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
    # 1. Add column safely using IF NOT EXISTS
    op.execute("ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS required_user_id INTEGER")

    # 2. Add constraint safely using PL/pgSQL DO block to avoid Transaction Aborted state
    # This checks existence *before* trying to add, so no error is ever raised
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_workflows_users') THEN
                ALTER TABLE approval_workflows ADD CONSTRAINT fk_approval_workflows_users FOREIGN KEY (required_user_id) REFERENCES users(id);
            END IF;
        END $$;
    """)

    # 3. Make role nullable
    # ALTER COLUMN ... DROP NOT NULL is idempotent in Postgres (it doesn't fail if already nullable)
    with op.batch_alter_table('approval_workflows') as batch_op:
        batch_op.alter_column('required_role', existing_type=sa.VARCHAR(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('approval_workflows') as batch_op:
        batch_op.drop_constraint('fk_approval_workflows_users', type_='foreignkey')
        batch_op.alter_column('required_role', existing_type=sa.VARCHAR(), nullable=False)
        batch_op.drop_column('required_user_id')
