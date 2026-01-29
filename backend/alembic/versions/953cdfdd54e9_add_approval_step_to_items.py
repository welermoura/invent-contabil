"""add approval_step to items

Revision ID: 953cdfdd54e9
Revises: 20260126173308
Create Date: 2026-01-26 18:15:32.134018

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '953cdfdd54e9'
down_revision: Union[str, None] = '20260126173308'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Robust fix: Use raw SQL for idempotency
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS approval_step INTEGER DEFAULT 1")


def downgrade() -> None:
    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.drop_column('approval_step')
