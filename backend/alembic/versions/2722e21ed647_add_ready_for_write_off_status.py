"""Add READY_FOR_WRITE_OFF status

Revision ID: 2722e21ed647
Revises: 2950cdddf333
Create Date: 2026-01-27 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2722e21ed647'
down_revision: Union[str, None] = '2950cdddf333'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres hack to add value to enum
    op.execute("ALTER TYPE itemstatus ADD VALUE IF NOT EXISTS 'READY_FOR_WRITE_OFF'")


def downgrade() -> None:
    # Removing value from enum is hard in Postgres, usually ignored in downgrade
    pass
