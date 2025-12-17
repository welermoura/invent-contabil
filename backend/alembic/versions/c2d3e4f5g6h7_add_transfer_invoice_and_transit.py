"""Add transfer invoice and transit

Revision ID: c2d3e4f5g6h7
Revises: b1c2d3e4f5g6
Create Date: 2024-05-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c2d3e4f5g6h7'
down_revision = 'b1c2d3e4f5g6'
branch_labels = None
depends_on = None

def upgrade():
    # Add IN_TRANSIT to ItemStatus enum
    # Note: ALTER TYPE ... ADD VALUE cannot be executed in a transaction block in some Postgres versions,
    # but Alembic usually handles it using autocommit_block().
    # However, since we are doing manual SQL for Enums:
    op.execute("ALTER TYPE itemstatus ADD VALUE IF NOT EXISTS 'IN_TRANSIT'")

    # Add transfer invoice columns to items table
    op.add_column('items', sa.Column('transfer_invoice_number', sa.String(), nullable=True))
    op.add_column('items', sa.Column('transfer_invoice_series', sa.String(), nullable=True))
    op.add_column('items', sa.Column('transfer_invoice_date', sa.DateTime(), nullable=True))

def downgrade():
    op.drop_column('items', 'transfer_invoice_date')
    op.drop_column('items', 'transfer_invoice_series')
    op.drop_column('items', 'transfer_invoice_number')
    # Dropping enum value is complex, skipping
