
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from backend.models import Base, User, Branch, UserRole
# from backend.database import SQLALCHEMY_DATABASE_URL # Removed
import bcrypt

# Ensure we use the correct URL for SQLite
DATABASE_URL = "sqlite+aiosqlite:///./test.db"

async def init_db():
    if os.path.exists("./test.db"):
        os.remove("./test.db")
        print("Deleted existing test.db")

    engine = create_async_engine(DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Tables created.")

    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.ext.asyncio import AsyncSession

    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        # Create Branch
        branch = Branch(name="Sede Central", address="Rua Exemplo, 123")
        session.add(branch)
        await session.flush()

        # Create Admin
        hashed = bcrypt.hashpw("123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin = User(
            name="Admin",
            email="admin",
            hashed_password=hashed,
            role=UserRole.ADMIN
        )
        session.add(admin)

        # Create Categories
        from backend.models import Category
        cat1 = Category(name="Eletrônicos", depreciation_months=60)
        cat2 = Category(name="Móveis", depreciation_months=120)
        session.add(cat1)
        session.add(cat2)

        await session.commit()
        print("Admin user and default data created.")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(init_db())
