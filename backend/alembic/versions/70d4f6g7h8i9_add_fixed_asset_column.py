"""Add fixed_asset_number column to items - REDUNDANT FIX

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
    # This migration was redundant and caused DuplicateColumnErrors.
    # The column 'fixed_asset_number' is already handled by 'add_fixed_asset.py'.
    # We pass here to allow the migration history to proceed without error.
    pass


def downgrade() -> None:
    pass
