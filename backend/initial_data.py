from sqlalchemy.ext.asyncio import AsyncSession
from backend import models, schemas, crud
from backend.database import SessionLocal, engine
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
                branch_data = schemas.BranchCreate(name="Sede Central", address="Av. Paulista, 1000", cnpj="00.000.000/0001-00")
                await crud.create_branch(db, branch_data)
                logger.info("Default branch created.")

            # Check if admin exists
            user = await crud.get_user_by_email(db, "admin")
            if not user:
                logger.info("Creating default admin user (admin/123)...")
                # Need to manually construct because schemas might have validation that 'admin' is not email
                # But looking at UserCreate, it uses UserBase which has email: str (not EmailStr)
                admin_data = schemas.UserCreate(
                    name="Admin",
                    email="admin", # Login simplificado
                    password="123", # Senha solicitada
                    role=models.UserRole.ADMIN,
                    all_branches=True
                )
                user = await crud.create_user(db, admin_data)
                logger.info("Default admin created: admin / 123")

            # Create some inventory items for testing checkboxes
            items = await crud.get_items(db)
            if not items:
                 logger.info("Creating test items...")
                 # Fetch the branch we just created
                 branches = await crud.get_branches(db)
                 branch_id = branches[0].id

                 # Create category if needed
                 cats = await crud.get_categories(db)
                 if not cats:
                     await crud.create_category(db, schemas.CategoryCreate(name="Eletronicos"))

                 item_data = schemas.ItemCreate(
                     description="Test Item 1",
                     category="Eletronicos",
                     purchase_date="2023-01-01",
                     invoice_value=100.0,
                     invoice_number="123",
                     branch_id=branch_id,
                     fixed_asset_number="ATV-001",
                     responsible_id=user.id if user else 1
                 )
                 # crud.create_item only takes (db, item, action_log)
                 await crud.create_item(db, item_data)
                 logger.info("Test item created.")

        except Exception as e:
            logger.error(f"Error during initial data seeding: {e}")
            import traceback
            traceback.print_exc()
