"""add request model

Revision ID: 8c5afbcdaab7
Revises: 3e9d4f69b6dd
Create Date: 2026-01-27 16:04:11.013715

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '8c5afbcdaab7'
down_revision: Union[str, None] = '3e9d4f69b6dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use dialect-specific logic for safety
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        # PostgreSQL: Use IF NOT EXISTS to prevent transaction aborts
        op.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR,
                value VARCHAR
            );
        """)
        op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_system_settings_key ON system_settings (key);")
        op.execute("CREATE INDEX IF NOT EXISTS ix_system_settings_id ON system_settings (id);")

        op.execute("""
            CREATE TABLE IF NOT EXISTS requests (
                id SERIAL PRIMARY KEY,
                type VARCHAR,
                status VARCHAR,
                requester_id INTEGER REFERENCES users(id),
                category_id INTEGER REFERENCES categories(id),
                current_step INTEGER,
                data JSON,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        op.execute("CREATE INDEX IF NOT EXISTS ix_requests_id ON requests (id);")

        # Add column safely
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='request_id') THEN
                    ALTER TABLE items ADD COLUMN request_id INTEGER REFERENCES requests(id);
                END IF;
            END $$;
        """)

        # Update Users safely
        op.execute("ALTER TABLE users ALTER COLUMN all_branches DROP NOT NULL;")
        op.execute("ALTER TABLE users ALTER COLUMN all_branches SET DEFAULT false;")

    else:
        # SQLite / Others: Use Inspector (safer on SQLite as transactions aren't strict)
        inspector = Inspector.from_engine(bind)
        existing_tables = inspector.get_table_names()

        if 'system_settings' not in existing_tables:
            op.create_table('system_settings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('key', sa.String(), nullable=True),
            sa.Column('value', sa.String(), nullable=True),
            sa.PrimaryKeyConstraint('id')
            )
            op.create_index(op.f('ix_system_settings_id'), 'system_settings', ['id'], unique=False)
            op.create_index(op.f('ix_system_settings_key'), 'system_settings', ['key'], unique=True)

        if 'requests' not in existing_tables:
            op.create_table('requests',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('type', sa.Enum('CREATE', 'TRANSFER', 'WRITE_OFF', name='approvalactiontype'), nullable=True),
            sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='requeststatus'), nullable=True),
            sa.Column('requester_id', sa.Integer(), nullable=True),
            sa.Column('category_id', sa.Integer(), nullable=True),
            sa.Column('current_step', sa.Integer(), nullable=True),
            sa.Column('data', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
            sa.ForeignKeyConstraint(['requester_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
            )
            op.create_index(op.f('ix_requests_id'), 'requests', ['id'], unique=False)

        items_columns = [c['name'] for c in inspector.get_columns('items')]
        with op.batch_alter_table('items', schema=None) as batch_op:
            if 'request_id' not in items_columns:
                batch_op.add_column(sa.Column('request_id', sa.Integer(), nullable=True))
                batch_op.create_foreign_key('fk_items_request_id', 'requests', ['request_id'], ['id'])

        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.alter_column('all_branches',
                   existing_type=sa.BOOLEAN(),
                   nullable=True,
                   existing_server_default=sa.text("'false'"))


def downgrade() -> None:
    # Downgrade logic simplified for safety
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        op.execute("ALTER TABLE users ALTER COLUMN all_branches SET NOT NULL;")
        op.execute("ALTER TABLE items DROP COLUMN IF EXISTS request_id;")
        op.execute("DROP TABLE IF EXISTS requests;")
        op.execute("DROP TABLE IF EXISTS system_settings;")
    else:
        conn = op.get_bind()
        inspector = Inspector.from_engine(conn)
        items_columns = [c['name'] for c in inspector.get_columns('items')]

        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.alter_column('all_branches',
                   existing_type=sa.BOOLEAN(),
                   nullable=False,
                   existing_server_default=sa.text("'false'"))

        with op.batch_alter_table('items', schema=None) as batch_op:
            if 'request_id' in items_columns:
                batch_op.drop_constraint('fk_items_request_id', type_='foreignkey')
                batch_op.drop_column('request_id')

        if 'requests' in inspector.get_table_names():
            op.drop_index(op.f('ix_requests_id'), table_name='requests')
            op.drop_table('requests')

        if 'system_settings' in inspector.get_table_names():
            op.drop_index(op.f('ix_system_settings_key'), table_name='system_settings')
            op.drop_index(op.f('ix_system_settings_id'), table_name='system_settings')
            op.drop_table('system_settings')
