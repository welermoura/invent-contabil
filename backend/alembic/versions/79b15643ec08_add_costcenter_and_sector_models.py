"""Add CostCenter and Sector models

Revision ID: 79b15643ec08
Revises: 2722e21ed647
Create Date: 2026-01-27 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '79b15643ec08'
down_revision: Union[str, None] = '2722e21ed647'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create CostCenter table
    op.create_table('cost_centers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cost_centers_code'), 'cost_centers', ['code'], unique=True)
    op.create_index(op.f('ix_cost_centers_id'), 'cost_centers', ['id'], unique=False)

    # Create Sector table
    op.create_table('sectors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('branch_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sectors_id'), 'sectors', ['id'], unique=False)
    op.create_index(op.f('ix_sectors_name'), 'sectors', ['name'], unique=False)

    # Add columns to Items
    op.add_column('items', sa.Column('cost_center_id', sa.Integer(), nullable=True))
    op.add_column('items', sa.Column('sector_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'items', 'cost_centers', ['cost_center_id'], ['id'])
    op.create_foreign_key(None, 'items', 'sectors', ['sector_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'items', type_='foreignkey')
    op.drop_constraint(None, 'items', type_='foreignkey')
    op.drop_column('items', 'sector_id')
    op.drop_column('items', 'cost_center_id')
    op.drop_index(op.f('ix_sectors_name'), table_name='sectors')
    op.drop_index(op.f('ix_sectors_id'), table_name='sectors')
    op.drop_table('sectors')
    op.drop_index(op.f('ix_cost_centers_id'), table_name='cost_centers')
    op.drop_index(op.f('ix_cost_centers_code'), table_name='cost_centers')
    op.drop_table('cost_centers')
