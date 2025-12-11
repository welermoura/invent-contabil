from pydantic import BaseModel, EmailStr, computed_field
from typing import Optional, List
from datetime import datetime, date
from backend.models import UserRole, ItemStatus

# Token
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# User
class UserBase(BaseModel):
    # Alterado de EmailStr para str para permitir login "admin" simplificado
    email: str
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
    email: Optional[str] = None
    role: Optional[UserRole] = None
    branch_id: Optional[int] = None
    branch: Optional["BranchResponse"] = None
    branches: List["BranchResponse"] = []

    class Config:
        from_attributes = True

# Branch
class BranchBase(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    cnpj: Optional[str] = None

class BranchCreate(BranchBase):
    pass

class BranchResponse(BranchBase):
    id: int

    class Config:
        from_attributes = True

# Category
class CategoryBase(BaseModel):
    name: str
    depreciation_months: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: int

    class Config:
        from_attributes = True

# Supplier
class SupplierBase(BaseModel):
    name: str
    cnpj: str

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: int

    class Config:
        from_attributes = True

# Log Forward Declaration
class ItemSummary(BaseModel):
    id: int
    description: str
    fixed_asset_number: Optional[str] = None

    class Config:
        from_attributes = True

class LogResponse(BaseModel):
    id: int
    item_id: int
    user_id: Optional[int] = None
    action: str
    timestamp: datetime
    user: Optional[UserResponse] = None
    item: Optional[ItemSummary] = None

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
    supplier_id: Optional[int] = None

class ItemCreate(ItemBase):
    category_id: Optional[int] = None
    fixed_asset_number: Optional[str] = None

class ItemUpdate(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    invoice_value: Optional[float] = None
    status: Optional[ItemStatus] = None
    fixed_asset_number: Optional[str] = None
    observations: Optional[str] = None
    supplier_id: Optional[int] = None

class ItemResponse(ItemBase):
    id: int
    status: ItemStatus
    description: Optional[str] = None
    category: Optional[str] = None
    purchase_date: Optional[datetime] = None
    invoice_value: Optional[float] = None
    invoice_number: Optional[str] = None
    branch_id: Optional[int] = None
    fixed_asset_number: Optional[str] = None
    invoice_file: Optional[str] = None
    supplier_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    branch: Optional[BranchResponse] = None
    transfer_target_branch_id: Optional[int] = None
    transfer_target_branch: Optional[BranchResponse] = None
    category_rel: Optional[CategoryResponse] = None
    supplier: Optional[SupplierResponse] = None
    responsible: Optional[UserResponse] = None
    logs: List[LogResponse] = []

    class Config:
        from_attributes = True

    @computed_field
    @property
    def accounting_value(self) -> float:
        return self.calculate_accounting_value()

    def calculate_accounting_value(self) -> float:
        if self.invoice_value is None or self.purchase_date is None:
            return 0.0

        depreciation_months = None
        if self.category_rel:
            depreciation_months = self.category_rel.depreciation_months

        # Se não houver depreciação configurada ou for 0, mantém o valor original
        if not depreciation_months or depreciation_months <= 0:
            return self.invoice_value

        from dateutil.relativedelta import relativedelta

        # Normaliza datas para evitar problemas com timezones e frações de dia (usa apenas a data)
        start_date = self.purchase_date.date() if isinstance(self.purchase_date, datetime) else self.purchase_date
        today = date.today()

        # Calcula data final baseado nos meses
        end_date = start_date + relativedelta(months=depreciation_months)

        # Calcula dias totais de vida útil e dias passados
        total_days = (end_date - start_date).days
        elapsed_days = (today - start_date).days

        if total_days <= 0:
            return 0.0

        if elapsed_days >= total_days:
            return 0.0

        if elapsed_days < 0:
            return self.invoice_value

        # Cálculo linear por dia
        remaining_ratio = 1 - (elapsed_days / total_days)

        # Garante que não retorne negativo (embora a checagem acima já deva prevenir)
        final_value = max(0.0, self.invoice_value * remaining_ratio)

        return round(final_value, 2)
