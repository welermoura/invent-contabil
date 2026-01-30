import os
import sys
from sqlalchemy import create_engine, inspect, text
from alembic.config import Config
from alembic import command

# Ensure backend directory is in path if needed, though running from backend/ works
sys.path.append(os.getcwd())

def check_and_migrate():
    # Get DB URL from environment
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set.")
        sys.exit(1)

    # Convert asyncpg URL to psycopg2 for synchronous inspection
    if "asyncpg" in db_url:
        db_url = db_url.replace("+asyncpg", "")

    print(f"Connecting to DB for inspection...") # Don't log full URL with password

    try:
        engine = create_engine(db_url)

        # Check connection
        with engine.connect() as connection:
            insp = inspect(engine)
            tables = insp.get_table_names()

            has_users = 'users' in tables
            has_alembic = 'alembic_version' in tables

            # Load Alembic Config
            alembic_cfg = Config("alembic.ini")

            if has_users and not has_alembic:
                print("⚠️  DETECTED: Existing data ('users' table) but missing migration history.")
                print("🔄 Action: Stamping database as 'head' to skip unnecessary migrations.")
                command.stamp(alembic_cfg, "head")
                print("✅ Database stamped.")
            elif not has_users and not has_alembic:
                print("🆕 DETECTED: Fresh database.")
                print("🚀 Action: Running all migrations.")
                command.upgrade(alembic_cfg, "head")
            else:
                print("ℹ️  Database appears initialized.")
                print("🔍 Checking for pending migrations...")
                command.upgrade(alembic_cfg, "head")

    except Exception as e:
        print(f"CRITICAL ERROR during DB check/migration: {e}")
        # We exit with error to restart container if DB isn't ready,
        # though start.sh loop handles connection check.
        sys.exit(1)

if __name__ == "__main__":
    check_and_migrate()
