"""add asset_class to categories

Revision ID: 52a1b3c4d5e6
Revises: 
Create Date: 2026-04-14 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '52a1b3c4d5e6'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # add column with a try/catch or just execute
    try:
        op.add_column('categories', sa.Column('asset_class', sa.String(), nullable=True))
    except Exception as e:
        print("Column asset_class might already exist", e)


def downgrade():
    try:
        op.drop_column('categories', 'asset_class')
    except Exception as e:
        print("Column asset_class might not exist", e)
