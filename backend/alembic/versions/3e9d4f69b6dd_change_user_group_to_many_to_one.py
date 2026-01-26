"""change user group to many-to-one

Revision ID: 3e9d4f69b6dd
Revises: 918f20cae4a9
Create Date: 2026-01-26 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e9d4f69b6dd'
down_revision: Union[str, None] = '918f20cae4a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add group_id to users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('group_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_users_group', 'user_groups', ['group_id'], ['id'])

    # 2. Drop the N:N association table
    op.drop_table('user_group_members')


def downgrade() -> None:
    # 1. Recreate N:N table
    op.create_table('user_group_members',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['group_id'], ['user_groups.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('user_id', 'group_id')
    )

    # 2. Drop group_id from users
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('fk_users_group', type_='foreignkey')
        batch_op.drop_column('group_id')
