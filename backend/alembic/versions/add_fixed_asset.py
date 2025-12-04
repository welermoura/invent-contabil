"""Add fixed_asset_number to items

Revision ID: add_fixed_asset
Revises: add_user_branch
Create Date: 2023-10-27 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_fixed_asset'
down_revision: Union[str, None] = 'add_user_branch'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS to prevent DuplicateColumnError
    # Postgres supports this syntax.
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS fixed_asset_number VARCHAR")

    # Create index securely
    op.execute("CREATE INDEX IF NOT EXISTS ix_items_fixed_asset_number ON items (fixed_asset_number)")


def downgrade() -> None:
    op.drop_index(op.f('ix_items_fixed_asset_number'), table_name='items')
    op.drop_column('items', 'fixed_asset_number')
