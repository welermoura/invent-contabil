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
    # 1. Create User Groups Table safely
    op.execute("CREATE TABLE IF NOT EXISTS user_groups (id SERIAL PRIMARY KEY, name VARCHAR, description VARCHAR)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_groups_id ON user_groups (id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_user_groups_name ON user_groups (name)")

    # 2. Create Association Table safely
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_group_members (
            user_id INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, group_id),
            FOREIGN KEY(group_id) REFERENCES user_groups (id),
            FOREIGN KEY(user_id) REFERENCES users (id)
        )
    """)

    # 3. Add required_group_id to ApprovalWorkflow safely
    op.execute("ALTER TABLE approval_workflows ADD COLUMN IF NOT EXISTS required_group_id INTEGER")

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_approval_workflows_group') THEN
                ALTER TABLE approval_workflows ADD CONSTRAINT fk_approval_workflows_group FOREIGN KEY (required_group_id) REFERENCES user_groups(id);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    with op.batch_alter_table('approval_workflows', schema=None) as batch_op:
        batch_op.drop_constraint('fk_approval_workflows_group', type_='foreignkey')
        batch_op.drop_column('required_group_id')

    op.drop_table('user_group_members')
    op.drop_index(op.f('ix_user_groups_name'), table_name='user_groups')
    op.drop_index(op.f('ix_user_groups_id'), table_name='user_groups')
    op.drop_table('user_groups')
