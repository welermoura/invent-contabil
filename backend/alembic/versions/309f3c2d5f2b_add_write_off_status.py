"""Add write-off status

Revision ID: 309f3c2d5f2b
Revises: 298f2b1c4e1a
Create Date: 2024-05-22 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '309f3c2d5f2b'
down_revision = '298f2b1c4e1a'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE itemstatus ADD VALUE IF NOT EXISTS 'WRITE_OFF_PENDING'")


def downgrade():
    pass
