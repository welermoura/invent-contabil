"""Add Request model

Revision ID: 2950cdddf333
Revises: 3e9d4f69b6dd
Create Date: 2026-01-27 18:27:29.920787

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2950cdddf333'
down_revision: Union[str, None] = '3e9d4f69b6dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('TRANSFER', 'WRITE_OFF', name='requesttype'), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='requeststatus'), nullable=True),
        sa.Column('requester_id', sa.Integer(), nullable=True),
        sa.Column('category_id', sa.Integer(), nullable=True),
        sa.Column('current_step', sa.Integer(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_requests_id'), 'requests', ['id'], unique=False)
    op.create_index(op.f('ix_requests_status'), 'requests', ['status'], unique=False)
    op.create_index(op.f('ix_requests_type'), 'requests', ['type'], unique=False)

    op.add_column('items', sa.Column('request_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'items', 'requests', ['request_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'items', type_='foreignkey')
    op.drop_column('items', 'request_id')
    op.drop_index(op.f('ix_requests_type'), table_name='requests')
    op.drop_index(op.f('ix_requests_status'), table_name='requests')
    op.drop_index(op.f('ix_requests_id'), table_name='requests')
    op.drop_table('requests')

    # Drop types for Postgres
    op.execute("DROP TYPE IF EXISTS requesttype")
    op.execute("DROP TYPE IF EXISTS requeststatus")
