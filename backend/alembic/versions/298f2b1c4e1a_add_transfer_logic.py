"""Add transfer logic

Revision ID: 298f2b1c4e1a
Revises:
Create Date: 2024-05-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '298f2b1c4e1a'
down_revision = 'add_fixed_asset'
branch_labels = None
depends_on = None

def upgrade():
    # Since I cannot guarantee the state, I will use "checkfirst" logic conceptually,
    # but Alembic commands are declarative.
    bind = op.get_bind()
    # Adding column transfer_target_branch_id
    with op.batch_alter_table('items') as batch_op:
        batch_op.add_column(sa.Column('transfer_target_branch_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_items_transfer_target', 'branches', ['transfer_target_branch_id'], ['id'])

    # Adding 'TRANSFER_PENDING' to enum.
    # Postgres enums are tricky.
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE itemstatus ADD VALUE IF NOT EXISTS 'TRANSFER_PENDING'")

def downgrade():
    op.drop_column('items', 'transfer_target_branch_id')
    # Dropping enum value is not directly supported in Postgres easily without recreating type.
    pass
