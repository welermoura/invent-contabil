"""add_transfer_invoice_fields

Revision ID: 2b4c6d8e0f1g
Revises: a1b2c3d4e5f6
Create Date: 2024-05-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2b4c6d8e0f1g'
down_revision = '1a2b3c4d5e6f'
branch_labels = None
depends_on = None


def upgrade():
    # Use raw SQL to avoid issues with table reflection if it fails
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS transfer_invoice_number VARCHAR")
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS transfer_invoice_series VARCHAR")
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS transfer_invoice_date TIMESTAMP WITHOUT TIME ZONE")


def downgrade():
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS transfer_invoice_number")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS transfer_invoice_series")
    op.execute("ALTER TABLE items DROP COLUMN IF EXISTS transfer_invoice_date")
