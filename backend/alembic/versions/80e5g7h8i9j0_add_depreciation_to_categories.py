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
    with op.batch_alter_table('categories') as batch_op:
        batch_op.add_column(sa.Column('depreciation_months', sa.Integer(), nullable=True))

def downgrade():
    with op.batch_alter_table('categories') as batch_op:
        batch_op.drop_column('depreciation_months')
