"""Add AUDITOR to userrole enum

Revision ID: 50b2e4f5g6h7
Revises: 40a1d3e4f5g6
Create Date: 2024-12-04 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '50b2e4f5g6h7'
down_revision = '40a1d3e4f5g6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'AUDITOR' to userrole enum
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'AUDITOR'")


def downgrade() -> None:
    # Cannot easily drop enum value in Postgres
    pass
