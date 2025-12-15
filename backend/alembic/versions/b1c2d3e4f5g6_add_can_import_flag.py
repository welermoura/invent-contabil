"""add can_import flag

Revision ID: b1c2d3e4f5g6
Revises: a6h9i0j1k2l3
Create Date: 2024-05-22 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5g6'
down_revision = 'a6h9i0j1k2l3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('can_import', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    op.drop_column('users', 'can_import')
