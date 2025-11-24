from sqlalchemy.ext.asyncio import AsyncSession
from backend import models, schemas, crud
from backend.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    async with SessionLocal() as db:
        try:
            # Check if admin exists
            user = await crud.get_user_by_email(db, "admin@empresa.com")
            if not user:
                logger.info("Creating default admin user...")
                admin_data = schemas.UserCreate(
                    name="Admin",
                    email="admin@empresa.com",
                    password="admin123",
                    role=models.UserRole.ADMIN
                )
                await crud.create_user(db, admin_data)
                logger.info("Default admin created: admin@empresa.com / admin123")
            else:
                logger.info("Admin user already exists.")

            # Check branches
            branches = await crud.get_branches(db)
            if not branches:
                logger.info("Creating default branch...")
                branch_data = schemas.BranchCreate(name="Sede Central", address="Av. Paulista, 1000")
                await crud.create_branch(db, branch_data)
                logger.info("Default branch created.")

        except Exception as e:
            logger.error(f"Error during initial data seeding: {e}")
