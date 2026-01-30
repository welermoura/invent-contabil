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
    # Safely create ENUMs first
    # Using sqlalchemy's postgresql.ENUM with checkfirst=True doesn't always work inside op.create_table
    # for async drivers or when types are used inline.
    # Manual creation is safest.

    # 1. Create Types safely
    postgresql.ENUM('TRANSFER', 'WRITE_OFF', name='requesttype').create(op.get_bind(), checkfirst=True)
    postgresql.ENUM('PENDING', 'APPROVED', 'REJECTED', name='requeststatus').create(op.get_bind(), checkfirst=True)

    # 2. Create Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS requests (
            id SERIAL PRIMARY KEY,
            type requesttype,
            status requeststatus,
            requester_id INTEGER REFERENCES users(id),
            category_id INTEGER REFERENCES categories(id),
            current_step INTEGER,
            data JSON,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE
        )
    """)

    # 3. Create Indexes safely
    op.execute("CREATE INDEX IF NOT EXISTS ix_requests_id ON requests (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_requests_status ON requests (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_requests_type ON requests (type)")

    # 4. Add column to Items
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS request_id INTEGER")

    # Safe FK
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_request_id_fkey') THEN
                ALTER TABLE items ADD CONSTRAINT items_request_id_fkey FOREIGN KEY (request_id) REFERENCES requests(id);
            END IF;
        END $$;
    """)


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
