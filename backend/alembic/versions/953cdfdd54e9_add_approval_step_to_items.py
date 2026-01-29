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
    # Use batch_alter_table for SQLite compatibility
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c['name'] for c in inspector.get_columns('items')]

    with op.batch_alter_table('items', schema=None) as batch_op:
        if 'approval_step' not in columns:
            batch_op.add_column(sa.Column('approval_step', sa.Integer(), server_default='1', nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.drop_column('approval_step')
