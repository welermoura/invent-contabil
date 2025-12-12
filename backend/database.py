from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fallback to env vars for construction if URL not fully string
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    db_host = os.getenv("DB_HOST", "db")
    db_name = os.getenv("POSTGRES_DB", "inventory")
    DATABASE_URL = f"postgresql+asyncpg://{user}:{password}@{db_host}:5432/{db_name}"

# echo=True means all SQL queries are logged to stdout
# This should be False in production
sql_echo_env = os.getenv("SQL_ECHO", "False").lower()
echo_sql = sql_echo_env == "true"

engine = create_async_engine(DATABASE_URL, echo=echo_sql)

SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Exporting this factory to be used manually in contexts where Depends() is not available
# or when we need a one-off session (like WebSockets manual auth)
async_session_factory = SessionLocal

Base = declarative_base()

async def get_db():
    async with SessionLocal() as session:
        yield session
