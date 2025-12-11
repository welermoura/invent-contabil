"""add all_branches flag to users

Revision ID: 95g7h8i9j0k1
Revises: 90f6h7i8j9k0
Create Date: 2024-05-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '95g7h8i9j0k1'
down_revision = '90f6h7i8j9k0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('all_branches', sa.Boolean(), server_default='false', nullable=False))


def downgrade():
    op.drop_column('users', 'all_branches')
