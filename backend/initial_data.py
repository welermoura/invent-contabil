from sqlalchemy.ext.asyncio import AsyncSession
from backend import models, schemas, crud
from backend.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    async with SessionLocal() as db:
        try:
            # Check branches (still create default branch if missing, nice to have)
            branches = await crud.get_branches(db)
            if not branches:
                logger.info("Creating default branch...")
                branch_data = schemas.BranchCreate(name="Sede Central", address="Av. Paulista, 1000")
                await crud.create_branch(db, branch_data)
                logger.info("Default branch created.")

            # Note: Admin user is NOT created here anymore.
            # It must be created via /setup endpoint on first run.

        except Exception as e:
            logger.error(f"Error during initial data seeding: {e}")
