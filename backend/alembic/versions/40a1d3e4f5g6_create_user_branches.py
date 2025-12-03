"""create user_branches table

Revision ID: 40a1d3e4f5g6
Revises: 309f3c2d5f2b
Create Date: 2024-12-04 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '40a1d3e4f5g6'
down_revision = '309f3c2d5f2b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('user_branches',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('branch_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('user_id', 'branch_id')
    )


def downgrade() -> None:
    op.drop_table('user_branches')
