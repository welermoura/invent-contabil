from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from backend import schemas, models, auth, crud
from backend.database import get_db
from sqlalchemy.future import select
from sqlalchemy import func

router = APIRouter()

@router.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # Autenticar usuário
    # OAuth2PasswordRequestForm espera username e password. Aqui usaremos email como username.
    result = await db.execute(select(models.User).where(models.User.email == form_data.username))
    user = result.scalars().first()

    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role.value, "can_import": user.can_import}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/setup-status")
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    # Check if there are any admins
    result = await db.execute(select(func.count(models.User.id)).where(models.User.role == models.UserRole.ADMIN))
    count = result.scalar()
    return {"is_setup": count > 0}

@router.post("/setup", response_model=schemas.UserResponse)
async def setup_admin(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    # Verify no admins exist
    result = await db.execute(select(func.count(models.User.id)).where(models.User.role == models.UserRole.ADMIN))
    count = result.scalar()

    if count > 0:
        raise HTTPException(status_code=403, detail="Configuração inicial já concluída. Existem administradores cadastrados.")

    # Create the master admin
    # Force role to ADMIN
    user.role = models.UserRole.ADMIN
    return await crud.create_user(db, user)
