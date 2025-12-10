import asyncio
import os
import sys

# Add current directory to sys.path so we can import backend
sys.path.append(os.getcwd())

from backend.database import engine, Base
from backend.models import User, Branch, UserRole
from backend.auth import get_password_hash
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

async def init_db():
    print("Creating tables...")
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    # Create session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Check if admin exists
        print("Checking for admin user...")
        result = await session.execute(select(User).where(User.email == "admin"))
        user = result.scalars().first()

        if not user:
            print("Creating admin user...")
            # Removed is_active as it's not in the model
            admin_user = User(
                email="admin",
                hashed_password=get_password_hash("123"),
                role=UserRole.ADMIN
            )
            session.add(admin_user)
            await session.commit()
            print("Admin created: admin / 123")
        else:
            print("Admin already exists.")

if __name__ == "__main__":
    if "sqlite" not in os.getenv("DATABASE_URL", ""):
        print("Warning: DATABASE_URL does not look like sqlite. This script is intended for sqlite init in sandbox.")

    asyncio.run(init_db())
