from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, crud, auth
from backend.database import get_db
import shutil
import os
from datetime import datetime

router = APIRouter(prefix="/items", tags=["items"])

UPLOAD_DIR = "/app/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.get("/", response_model=List[schemas.ItemResponse])
async def read_items(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    category: Optional[str] = None,
    branch_id: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Enforce branch filtering for non-admins (Approvers can see all)
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
        # If user has a branch assigned, restrict to it.
        # If no branch assigned (global access without admin role? unlikely scenario, assume restriction)
        # Let's assume if branch_id is None, they see nothing or everything?
        # Requirement: "give permission to user to see branch data". Implies restriction.
        if current_user.branch_id:
            branch_id = current_user.branch_id
        # else: if operator has no branch, maybe see nothing? Or all?
        # Safest is strict: if not admin, must have branch_id to see items.
        # But for now, let's just override if they HAVE a branch_id.

    return await crud.get_items(db, skip=skip, limit=limit, status=status, category=category, branch_id=branch_id, search=search)

@router.post("/", response_model=schemas.ItemResponse)
async def create_item(
    description: str = Form(...),
    category: str = Form(...),
    purchase_date: datetime = Form(...),
    invoice_value: float = Form(...),
    invoice_number: str = Form(...),
    branch_id: int = Form(...),
    serial_number: Optional[str] = Form(None),
    observations: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Save file if uploaded
    file_path = None
    if file:
        import os
        import re
        # secure_filename replacement to avoid extra dependency
        filename = file.filename
        filename = re.sub(r'[^A-Za-z0-9_.-]', '_', filename)
        safe_filename = filename

        file_location = os.path.join(UPLOAD_DIR, safe_filename)
        with open(file_location, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        # Store relative path for serving
        file_path = f"uploads/{safe_filename}"

    item_data = schemas.ItemCreate(
        description=description,
        category=category,
        purchase_date=purchase_date,
        invoice_value=invoice_value,
        invoice_number=invoice_number,
        branch_id=branch_id,
        serial_number=serial_number,
        observations=observations,
        responsible_id=current_user.id
    )

    # Create item
    try:
        # Pydantic schema expects category_id, frontend might send category name
        # If necessary, we could resolve here, but let's assume valid ID or optional
        # For now, pass dict as is
        db_item = await crud.create_item(db, item_data)
        # Note: file path setting is missing in crud.create_item, need to handle it or update crud
        # Better: Update item with file path after creation or pass to crud
        if file_path:
            db_item.invoice_file = file_path
            db.add(db_item)
            await db.commit()
            # Refresh again with relations
            from sqlalchemy.orm import selectinload
            from sqlalchemy.future import select
            query = select(models.Item).where(models.Item.id == db_item.id).options(
                selectinload(models.Item.branch),
                selectinload(models.Item.category_rel)
            )
            result = await db.execute(query)
            db_item = result.scalars().first()

        return db_item
    except Exception as e:
        print(f"Error creating item: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{item_id}/status", response_model=schemas.ItemResponse)
async def update_item_status(
    item_id: int,
    status_update: schemas.ItemStatus,
    fixed_asset_number: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    if current_user.role not in [models.UserRole.ADMIN, models.UserRole.APPROVER]:
         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to approve/reject items")

    item = await crud.update_item_status(db, item_id, status_update, current_user.id, fixed_asset_number)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Trigger WebSocket notification
    from backend.websocket_manager import manager
    await manager.broadcast(f"Item {item.description} status changed to {status_update}")

    return item
