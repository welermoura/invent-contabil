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
    # 1. Safely create ENUM types
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'requesttype') THEN
                CREATE TYPE requesttype AS ENUM ('TRANSFER', 'WRITE_OFF');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'requeststatus') THEN
                CREATE TYPE requeststatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
            END IF;
        END $$;
    """)

    # 2. Safely create table using raw SQL check or IF NOT EXISTS (postgres allows CREATE TABLE IF NOT EXISTS)
    # But for columns using the ENUM we just created, we need to refer to it.

    # We can use pure SQLAlchemy for the table, but we need to tell it NOT to create the enum type again.
    # We do this by passing the Enum type object differently or relying on `create_type=False` if we were defining it inline,
    # but since we are inside op.create_table, it's cleaner to just use CREATE TABLE IF NOT EXISTS via raw SQL or
    # check existence.

    # Let's use `op.create_table` but with `sa.Enum(..., create_type=False)` so it uses the existing type we just ensured exists.

    tables = sa.inspect(op.get_bind()).get_table_names()
    if 'requests' not in tables:
        op.create_table('requests',
            sa.Column('id', sa.Integer(), nullable=False),
            # Set create_type=False because we handled it above manually
            sa.Column('type', sa.Enum('TRANSFER', 'WRITE_OFF', name='requesttype', create_type=False), nullable=True),
            sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='requeststatus', create_type=False), nullable=True),
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

    # 3. Add column to items safely
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS request_id INTEGER")

    # 4. Add FK to items safely
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_request_id_fkey') THEN
                 -- Note: Alembic generated constraint name was likely auto-generated (None).
                 -- We should check if ANY foreign key on request_id exists or try to name it explicitly.
                 -- Ideally we name it 'fk_items_request'.
                 -- If the previous run created it with a random name, checking by name 'fk_items_request' might return false
                 -- and we create a duplicate.
                 -- However, typical auto-gen name is items_request_id_fkey.

                 ALTER TABLE items ADD CONSTRAINT fk_items_request FOREIGN KEY (request_id) REFERENCES requests(id);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # 1. Drop FK
    # We used a specific name 'fk_items_request' in upgrade, so we should drop that.
    # But if the original migration ran partially, it might have a different name.
    # Let's try to drop generic constraint if known, or just the column.
    op.execute("ALTER TABLE items DROP CONSTRAINT IF EXISTS fk_items_request")

    with op.batch_alter_table('items') as batch_op:
        batch_op.drop_column('request_id')

    op.drop_index(op.f('ix_requests_type'), table_name='requests')
    op.drop_index(op.f('ix_requests_status'), table_name='requests')
    op.drop_index(op.f('ix_requests_id'), table_name='requests')
    op.drop_table('requests')

    # Drop types for Postgres
    op.execute("DROP TYPE IF EXISTS requesttype")
    op.execute("DROP TYPE IF EXISTS requeststatus")
