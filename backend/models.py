from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, Enum, Table, JSON
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

class UserGroup(Base):
    __tablename__ = "user_groups"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)

    users = relationship("User", back_populates="group", lazy="selectin")
    approval_workflows = relationship("ApprovalWorkflow", back_populates="required_group")

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
    READY_FOR_WRITE_OFF = "READY_FOR_WRITE_OFF"
    WRITTEN_OFF = "WRITTEN_OFF"
    MAINTENANCE = "MAINTENANCE"
    IN_STOCK = "IN_STOCK"
    IN_TRANSIT = "IN_TRANSIT"

class ApprovalActionType(str, enum.Enum):
    CREATE = "CREATE"
    TRANSFER = "TRANSFER"
    WRITE_OFF = "WRITE_OFF"

class RequestType(str, enum.Enum):
    TRANSFER = "TRANSFER"
    WRITE_OFF = "WRITE_OFF"

class RequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"

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
    all_branches = Column(Boolean, default=False)
    can_import = Column(Boolean, default=False)
    # branch_id mantido para compatibilidade
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    group_id = Column(Integer, ForeignKey("user_groups.id"), nullable=True)

    # Relacionamento legado (Many-to-One)
    branch = relationship("Branch", back_populates="users_legacy")
    # Novo relacionamento (Many-to-Many)
    branches = relationship("Branch", secondary=user_branches, back_populates="users", lazy="selectin")

    # Grupo (Many-to-One)
    group = relationship("UserGroup", back_populates="users", lazy="selectin")

    logs = relationship("Log", back_populates="user")
    items_responsible = relationship("Item", back_populates="responsible")
    # Changed from lazy="selectin" to lazy="select" (or default) to avoid performance issues
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    requests = relationship("Request", back_populates="requester")

class Category(Base):
    __tablename__ = "categories"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    depreciation_months = Column(Integer, nullable=True)

    items = relationship("Item", back_populates="category_rel", lazy="selectin")
    approval_workflows = relationship("ApprovalWorkflow", back_populates="category", lazy="selectin")
    requests = relationship("Request", back_populates="category", lazy="selectin")

class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    cnpj = Column(String, unique=True, index=True)

    items = relationship("Item", back_populates="supplier", lazy="selectin")

class CostCenter(Base):
    __tablename__ = "cost_centers"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)

    items = relationship("Item", back_populates="cost_center", lazy="selectin")

class Sector(Base):
    __tablename__ = "sectors"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True) # Null = Global, Value = Specific Branch

    branch = relationship("Branch", lazy="selectin")
    items = relationship("Item", back_populates="sector", lazy="selectin")

class Request(Base):
    __tablename__ = "requests"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(RequestType), index=True)
    status = Column(Enum(RequestStatus), default=RequestStatus.PENDING, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"))
    category_id = Column(Integer, ForeignKey("categories.id"))
    current_step = Column(Integer, default=1)
    data = Column(JSON, nullable=True) # Stores metadata like reason, target_branch_id, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    requester = relationship("User", back_populates="requests", lazy="selectin")
    category = relationship("Category", back_populates="requests", lazy="selectin")
    items = relationship("Item", back_populates="request", lazy="selectin")

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
    transfer_invoice_number = Column(String, nullable=True)
    transfer_invoice_series = Column(String, nullable=True)
    transfer_invoice_date = Column(DateTime, nullable=True)
    responsible_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(ItemStatus), default=ItemStatus.PENDING)
    observations = Column(Text, nullable=True)
    write_off_reason = Column(String, nullable=True)
    approval_step = Column(Integer, default=1)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=True)
    cost_center_id = Column(Integer, ForeignKey("cost_centers.id"), nullable=True)
    sector_id = Column(Integer, ForeignKey("sectors.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    branch = relationship("Branch", foreign_keys=[branch_id], back_populates="items", lazy="selectin")
    transfer_target_branch = relationship("Branch", foreign_keys=[transfer_target_branch_id], lazy="selectin")
    category_rel = relationship("Category", back_populates="items", lazy="selectin")
    supplier = relationship("Supplier", back_populates="items", lazy="selectin")
    responsible = relationship("User", back_populates="items_responsible", lazy="selectin")
    logs = relationship("Log", back_populates="item", lazy="selectin")
    request = relationship("Request", back_populates="items", lazy="selectin")
    cost_center = relationship("CostCenter", back_populates="items", lazy="selectin")
    sector = relationship("Sector", back_populates="items", lazy="selectin")

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

class SystemSetting(Base):
    __tablename__ = "system_settings"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(String)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")

class ApprovalWorkflow(Base):
    __tablename__ = "approval_workflows"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    action_type = Column(Enum(ApprovalActionType))
    required_role = Column(Enum(UserRole), nullable=True)
    required_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    required_group_id = Column(Integer, ForeignKey("user_groups.id"), nullable=True)
    step_order = Column(Integer, default=1)

    category = relationship("Category", back_populates="approval_workflows", lazy="selectin")
    required_user = relationship("User", lazy="selectin")
    required_group = relationship("UserGroup", back_populates="approval_workflows", lazy="selectin")
