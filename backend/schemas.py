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
    branch_ids: Optional[List[int]] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    branch_id: Optional[int] = None
    branch_ids: Optional[List[int]] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    branch_id: Optional[int] = None
    branches: List["BranchResponse"] = []

    class Config:
        from_attributes = True

# Branch
class BranchBase(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None

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

# Log Forward Declaration
class LogResponse(BaseModel):
    id: int
    item_id: int
    user_id: int
    action: str
    timestamp: datetime
    user: UserResponse

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
    fixed_asset_number: Optional[str] = None
    observations: Optional[str] = None

class ItemResponse(ItemBase):
    id: int
    status: ItemStatus
    description: Optional[str] = None
    category: Optional[str] = None
    purchase_date: Optional[datetime] = None
    invoice_value: Optional[float] = None
    invoice_number: Optional[str] = None
    fixed_asset_number: Optional[str] = None
    invoice_file: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    branch: Optional[BranchResponse] = None
    transfer_target_branch_id: Optional[int] = None
    transfer_target_branch: Optional[BranchResponse] = None
    category_rel: Optional[CategoryResponse] = None
    responsible: Optional[UserResponse] = None
    logs: List[LogResponse] = []

    class Config:
        from_attributes = True
