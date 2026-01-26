"""add write_off_reason

Revision ID: d3e4f5g6h7i8
Revises: c2d3e4f5g6h7
Create Date: 2024-05-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd3e4f5g6h7i8'
down_revision = 'c2d3e4f5g6h7'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('items') as batch_op:
        batch_op.add_column(sa.Column('write_off_reason', sa.String(), nullable=True))

def downgrade():
    op.drop_column('items', 'write_off_reason')
