from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database import get_db
from backend.models import User, UserRole
from sqlalchemy.future import select

# Configurações de segurança
import os
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey") # Usar variável de ambiente, fallback apenas para dev
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# AUTH BYPASS: Retorna sempre o admin para desenvolvimento
async def get_current_user(db: AsyncSession = Depends(get_db)):
    # Tenta encontrar o usuário admin padrão
    result = await db.execute(select(User).where(User.email == "admin@empresa.com"))
    user = result.scalars().first()

    if user:
        return user

    # Fallback de emergência (mock) se o banco estiver vazio
    return User(
        id=1,
        name="Admin",
        email="admin@empresa.com",
        role=UserRole.ADMIN
    )
