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
    # Create CostCenter table (Idempotent)
    op.execute("""
        CREATE TABLE IF NOT EXISTS cost_centers (
            id SERIAL PRIMARY KEY,
            code VARCHAR,
            name VARCHAR,
            description VARCHAR
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_cost_centers_code ON cost_centers (code)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cost_centers_id ON cost_centers (id)")

    # Create Sector table (Idempotent)
    op.execute("""
        CREATE TABLE IF NOT EXISTS sectors (
            id SERIAL PRIMARY KEY,
            name VARCHAR,
            branch_id INTEGER REFERENCES branches(id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sectors_id ON sectors (id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sectors_name ON sectors (name)")

    # Add columns to Items (Idempotent)
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS cost_center_id INTEGER")
    op.execute("ALTER TABLE items ADD COLUMN IF NOT EXISTS sector_id INTEGER")

    # Safe FKs
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_cost_center_id_fkey') THEN
                ALTER TABLE items ADD CONSTRAINT items_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_sector_id_fkey') THEN
                ALTER TABLE items ADD CONSTRAINT items_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES sectors(id);
            END IF;
        END $$;
    """)


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
