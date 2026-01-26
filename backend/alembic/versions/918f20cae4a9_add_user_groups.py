"""add user groups

Revision ID: 918f20cae4a9
Revises: 953cdfdd54e9
Create Date: 2026-01-26 19:48:08.613144

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '918f20cae4a9'
down_revision: Union[str, None] = '953cdfdd54e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create User Groups Table
    op.create_table('user_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_groups_id'), 'user_groups', ['id'], unique=False)
    op.create_index(op.f('ix_user_groups_name'), 'user_groups', ['name'], unique=True)

    # 2. Create Association Table
    op.create_table('user_group_members',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['group_id'], ['user_groups.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('user_id', 'group_id')
    )

    # 3. Add required_group_id to ApprovalWorkflow
    with op.batch_alter_table('approval_workflows', schema=None) as batch_op:
        batch_op.add_column(sa.Column('required_group_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_approval_workflows_group', 'user_groups', ['required_group_id'], ['id'])


def downgrade() -> None:
    with op.batch_alter_table('approval_workflows', schema=None) as batch_op:
        batch_op.drop_constraint('fk_approval_workflows_group', type_='foreignkey')
        batch_op.drop_column('required_group_id')

    op.drop_table('user_group_members')
    op.drop_index(op.f('ix_user_groups_name'), table_name='user_groups')
    op.drop_index(op.f('ix_user_groups_id'), table_name='user_groups')
    op.drop_table('user_groups')
