"""add changes to logs

Revision ID: 888888888888
Revises: 79b15643ec08
Create Date: 2026-01-27 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '888888888888'
down_revision: Union[str, None] = 'd3e4f5g6h7i8'
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table('logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('changes', sa.JSON(), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('logs', schema=None) as batch_op:
        batch_op.drop_column('changes')
