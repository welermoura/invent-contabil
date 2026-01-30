
"""add suppliers

Revision ID: 90f6h7i8j9k0
Revises: 80e5g7h8i9j0
Create Date: 2024-05-24 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '90f6h7i8j9k0'
down_revision = '80e5g7h8i9j0'
branch_labels = None
depends_on = None


def upgrade():
    # Create Suppliers table
    op.create_table(
        'suppliers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('cnpj', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_suppliers_id'), 'suppliers', ['id'], unique=False)
    op.create_index(op.f('ix_suppliers_name'), 'suppliers', ['name'], unique=False)
    op.create_index(op.f('ix_suppliers_cnpj'), 'suppliers', ['cnpj'], unique=True)

    # Add supplier_id to items
    with op.batch_alter_table('items') as batch_op:
        batch_op.add_column(sa.Column('supplier_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_items_suppliers', 'suppliers', ['supplier_id'], ['id'])


def downgrade():
    op.drop_constraint(None, 'items', type_='foreignkey')
    op.drop_column('items', 'supplier_id')
    op.drop_index(op.f('ix_suppliers_cnpj'), table_name='suppliers')
    op.drop_index(op.f('ix_suppliers_name'), table_name='suppliers')
    op.drop_index(op.f('ix_suppliers_id'), table_name='suppliers')
    op.drop_table('suppliers')
