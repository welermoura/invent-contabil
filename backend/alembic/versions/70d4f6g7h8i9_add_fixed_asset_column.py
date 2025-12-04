"""Add fixed_asset_number column to items

Revision ID: 70d4f6g7h8i9
Revises: 60c3e5f6g7h8
Create Date: 2024-12-04 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '70d4f6g7h8i9'
down_revision = '60c3e5f6g7h8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('items', sa.Column('fixed_asset_number', sa.String(), nullable=True))
    op.create_index(op.f('ix_items_fixed_asset_number'), 'items', ['fixed_asset_number'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_items_fixed_asset_number'), table_name='items')
    op.drop_column('items', 'fixed_asset_number')
