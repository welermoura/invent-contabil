"""add can_import and settings

Revision ID: b7i8j9k0l1m2
Revises: a6h9i0j1k2l3
Create Date: 2025-05-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b7i8j9k0l1m2'
down_revision = 'a6h9i0j1k2l3'
branch_labels = None
depends_on = None

def upgrade():
    # Add can_import to users
    op.add_column('users', sa.Column('can_import', sa.Boolean(), nullable=True, server_default='false'))

    # Create system_settings table
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(), nullable=True),
        sa.Column('value', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_system_settings_id'), 'system_settings', ['id'], unique=False)
    op.create_index(op.f('ix_system_settings_key'), 'system_settings', ['key'], unique=True)

def downgrade():
    op.drop_index(op.f('ix_system_settings_key'), table_name='system_settings')
    op.drop_index(op.f('ix_system_settings_id'), table_name='system_settings')
    op.drop_table('system_settings')
    op.drop_column('users', 'can_import')
