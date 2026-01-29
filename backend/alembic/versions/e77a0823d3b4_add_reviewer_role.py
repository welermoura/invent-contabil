"""add_reviewer_role

Revision ID: e77a0823d3b4
Revises:
Create Date: 2024-05-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e77a0823d3b4'
down_revision: Union[str, None] = 'd3e4f5g6h7i8'

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres Enum handling
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'REVIEWER'")


def downgrade() -> None:
    # Removing enum value is not directly supported in Postgres easily without recreation
    pass
