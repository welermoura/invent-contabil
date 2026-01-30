"""Add MAINTENANCE and IN_STOCK to itemstatus enum

Revision ID: a6h9i0j1k2l3
Revises: 95g7h8i9j0k1
Create Date: 2024-12-05 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a6h9i0j1k2l3'
down_revision = '95g7h8i9j0k1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'MAINTENANCE' and 'IN_STOCK' to itemstatus enum
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE itemstatus ADD VALUE IF NOT EXISTS 'MAINTENANCE'")
            op.execute("ALTER TYPE itemstatus ADD VALUE IF NOT EXISTS 'IN_STOCK'")


def downgrade() -> None:
    pass
