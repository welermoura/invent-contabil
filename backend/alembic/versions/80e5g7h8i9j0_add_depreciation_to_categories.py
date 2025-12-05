"""add depreciation time to categories

Revision ID: 80e5g7h8i9j0
Revises: 70d4f6g7h8j0_add_cnpj_to_branches
Create Date: 2023-10-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '80e5g7h8i9j0'
down_revision = '70d4f6g7h8j0'
branch_labels = None
depends_on = None

def upgrade():
    # Use raw SQL to be safe against model definition mismatches
    op.execute("ALTER TABLE categories ADD COLUMN IF NOT EXISTS depreciation_months INTEGER")

def downgrade():
    op.execute("ALTER TABLE categories DROP COLUMN IF EXISTS depreciation_months")
