from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, Enum, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from backend.database import Base

# Tabela de associação para User <-> Branch (N:N)
user_branches = Table(
    "user_branches",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("branch_id", Integer, ForeignKey("branches.id"), primary_key=True),
    extend_existing=True
)

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    APPROVER = "APPROVER"
    OPERATOR = "OPERATOR"
    AUDITOR = "AUDITOR"

class ItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    TRANSFER_PENDING = "TRANSFER_PENDING"
    WRITE_OFF_PENDING = "WRITE_OFF_PENDING"
    WRITTEN_OFF = "WRITTEN_OFF"

class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    address = Column(String)
    cnpj = Column(String, nullable=True)

    # Nota: foreign_keys como string lista para evitar erro de inicialização
    items = relationship("Item", foreign_keys="[Item.branch_id]", back_populates="branch", lazy="selectin")
    # Restaurado nome users_legacy para tentar compatibilidade com cache teimoso, mas definindo antes de User
    users_legacy = relationship("User", back_populates="branch", lazy="selectin")
    users = relationship("User", secondary=user_branches, back_populates="branches", lazy="selectin")

class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.OPERATOR)
    # branch_id mantido para compatibilidade
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    # Relacionamento legado (Many-to-One)
    branch = relationship("Branch", back_populates="users_legacy")
    # Novo relacionamento (Many-to-Many)
    branches = relationship("Branch", secondary=user_branches, back_populates="users", lazy="selectin")

    logs = relationship("Log", back_populates="user")
    items_responsible = relationship("Item", back_populates="responsible")

class Category(Base):
    __tablename__ = "categories"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    depreciation_months = Column(Integer, nullable=True)

    items = relationship("Item", back_populates="category_rel", lazy="selectin")

class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    cnpj = Column(String, unique=True, index=True)

    items = relationship("Item", back_populates="supplier", lazy="selectin")

class Item(Base):
    __tablename__ = "items"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, index=True)
    category = Column(String, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    purchase_date = Column(DateTime)
    invoice_value = Column(Float)
    invoice_number = Column(String, index=True)
    invoice_file = Column(String, nullable=True)
    serial_number = Column(String, index=True, nullable=True)
    fixed_asset_number = Column(String, index=True, nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    transfer_target_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    responsible_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(ItemStatus), default=ItemStatus.PENDING)
    observations = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    branch = relationship("Branch", foreign_keys=[branch_id], back_populates="items", lazy="selectin")
    transfer_target_branch = relationship("Branch", foreign_keys=[transfer_target_branch_id], lazy="selectin")
    category_rel = relationship("Category", back_populates="items", lazy="selectin")
    supplier = relationship("Supplier", back_populates="items", lazy="selectin")
    responsible = relationship("User", back_populates="items_responsible", lazy="selectin")
    logs = relationship("Log", back_populates="item", lazy="selectin")

class Log(Base):
    __tablename__ = "logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("Item", back_populates="logs", lazy="selectin")
    user = relationship("User", back_populates="logs", lazy="selectin")
