"""Add WRITTEN_OFF to itemstatus enum

Revision ID: 60c3e5f6g7h8
Revises: 50b2e4f5g6h7
Create Date: 2024-12-04 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '60c3e5f6g7h8'
down_revision = '50b2e4f5g6h7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'WRITTEN_OFF' to itemstatus enum
    # We must use autocommit block for ALTER TYPE inside a transaction
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE itemstatus ADD VALUE IF NOT EXISTS 'WRITTEN_OFF'")


def downgrade() -> None:
    pass
