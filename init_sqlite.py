import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from backend.models import Base, User, UserRole
from backend.auth import get_password_hash

DATABASE_URL = "sqlite+aiosqlite:///./test.db"

async def init_db():
    engine = create_async_engine(DATABASE_URL, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create Admin User
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.ext.asyncio import AsyncSession

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check if admin exists
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.email == "admin"))
        user = result.scalars().first()

        if not user:
            print("Creating admin user...")
            new_user = User(
                email="admin",
                hashed_password=get_password_hash("123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            session.add(new_user)
            await session.commit()
            print("Admin user created.")
        else:
            print("Admin user already exists.")

if __name__ == "__main__":
    asyncio.run(init_db())
