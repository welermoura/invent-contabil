from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from backend.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    APPROVER = "APPROVER"
    OPERATOR = "OPERATOR"

class ItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.OPERATOR)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    branch = relationship("Branch", back_populates="users")
    logs = relationship("Log", back_populates="user")
    items_responsible = relationship("Item", back_populates="responsible")

class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    address = Column(String)

    items = relationship("Item", back_populates="branch")
    users = relationship("User", back_populates="branch")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)

    items = relationship("Item", back_populates="category_rel")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    description = Column(String, index=True)
    category = Column(String, index=True) # Mantendo como string por enquanto para compatibilidade, mas idealmente FK
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    purchase_date = Column(DateTime)
    invoice_value = Column(Float)
    invoice_number = Column(String, index=True)
    invoice_file = Column(String, nullable=True) # Path to the file
    serial_number = Column(String, index=True, nullable=True)
    fixed_asset_number = Column(String, index=True, nullable=True) # Ativo Fixo
    branch_id = Column(Integer, ForeignKey("branches.id"))
    responsible_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(ItemStatus), default=ItemStatus.PENDING)
    observations = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    branch = relationship("Branch", back_populates="items")
    category_rel = relationship("Category", back_populates="items")
    responsible = relationship("User", back_populates="items_responsible")
    logs = relationship("Log", back_populates="item")

class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    item = relationship("Item", back_populates="logs")
    user = relationship("User", back_populates="logs")
