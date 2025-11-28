from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from backend.models import UserRole, ItemStatus

# Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# User
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.OPERATOR

class UserCreate(UserBase):
    password: str
    branch_id: Optional[int] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    branch_id: Optional[int] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    branch_id: Optional[int] = None

    class Config:
        from_attributes = True

# Branch
class BranchBase(BaseModel):
    name: str
    address: str

class BranchCreate(BranchBase):
    pass

class BranchResponse(BranchBase):
    id: int

    class Config:
        from_attributes = True

# Category
class CategoryBase(BaseModel):
    name: str

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int

    class Config:
        from_attributes = True

# Item
class ItemBase(BaseModel):
    description: str
    category: str
    purchase_date: datetime
    invoice_value: float
    invoice_number: str
    serial_number: Optional[str] = None
    branch_id: int
    responsible_id: Optional[int] = None
    observations: Optional[str] = None

class ItemCreate(ItemBase):
    category_id: Optional[int] = None

class ItemUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    invoice_value: Optional[float] = None
    status: Optional[ItemStatus] = None
    observations: Optional[str] = None

class ItemResponse(ItemBase):
    id: int
    status: ItemStatus
    invoice_file: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    branch: BranchResponse
    category_rel: Optional[CategoryResponse] = None
    responsible: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# Log
class LogResponse(BaseModel):
    id: int
    item_id: int
    user_id: int
    action: str
    timestamp: datetime
    user: UserResponse

    class Config:
        from_attributes = True
