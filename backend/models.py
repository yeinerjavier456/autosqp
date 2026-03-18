from sqlalchemy import Boolean, Column, Integer, String, ForeignKey, Enum as SqEnum, JSON, DateTime, Text
from sqlalchemy.orm import relationship
from database import Base
import enum
import datetime

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    INVENTARIO = "inventario"
    ASESOR = "asesor"
    USER = "user"
    # Legacy support
    USUARIO = "usuario"
    VENDEDOR = "vendedor"
    COORDINADOR = "coordinador"
    ALIADO = "aliado"
    COMPRAS = "compras"

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(50), default="#000000")
    secondary_color = Column(String(50), default="#ffffff")
    
    users = relationship("User", back_populates="company")
    integration_settings = relationship("IntegrationSettings", uselist=False, back_populates="company")
    leads = relationship("Lead", back_populates="company")
    vehicles = relationship("Vehicle", back_populates="company")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True) # e.g. "super_admin"
    label = Column(String(50)) # e.g. "Super Admin Global"
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    permissions_json = Column(Text, nullable=True)
    menu_order_json = Column(Text, nullable=True)
    is_system = Column(Boolean, default=False)
    base_role_name = Column(String(50), nullable=True, index=True)
    auto_assign_leads = Column(Boolean, default=False)

class CarBrand(Base):
    __tablename__ = "car_brands"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    logo_url = Column(String(500), nullable=True)
    
    models = relationship("CarModel", back_populates="brand")

class CarModel(Base):
    __tablename__ = "car_models"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    brand_id = Column(Integer, ForeignKey("car_brands.id"))
    
    brand = relationship("CarBrand", back_populates="models")

class LeadSource(str, enum.Enum):
    FACEBOOK = "facebook"
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    WEB = "web"
    OTHER = "other"

class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    INTERESTED = "interested"
    CREDIT_APPLICATION = "credit_application"
    QUALIFIED = "qualified"
    LOST = "lost"
    SOLD = "sold"
    ALLY_MANAGED = "ally_managed"

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    source = Column(String(50), default=LeadSource.WEB) 
    status = Column(String(50), default=LeadStatus.NEW)
    status_updated_at = Column(DateTime, default=datetime.datetime.utcnow) # Track when status changed
    message = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    has_unread_reply = Column(Integer, default=0)
    last_reply_at = Column(DateTime, nullable=True)
    
    company_id = Column(Integer, ForeignKey("companies.id"))
    company = relationship("Company", back_populates="leads")
    
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="leads")
    
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="leads_created")

    history = relationship("LeadHistory", back_populates="lead")
    conversation = relationship("Conversation", back_populates="lead", uselist=False)
    process_detail = relationship("LeadProcessDetail", back_populates="lead", uselist=False)
    notes = relationship("LeadNote", back_populates="lead", cascade="all, delete-orphan")
    files = relationship("LeadFile", back_populates="lead", cascade="all, delete-orphan")
    purchase_options = relationship("PurchaseOption", back_populates="lead", cascade="all, delete-orphan")
    supervisor_links = relationship("LeadSupervisor", back_populates="lead", cascade="all, delete-orphan")
    supervisors = relationship(
        "User",
        secondary="lead_supervisors",
        primaryjoin="Lead.id == LeadSupervisor.lead_id",
        secondaryjoin="User.id == LeadSupervisor.user_id",
        back_populates="supervised_leads",
        overlaps="supervisor_links,lead,supervisor,assigned_by"
    )

    @property
    def supervisor_ids(self):
        return [user.id for user in (self.supervisors or [])]


class LeadSupervisor(Base):
    __tablename__ = "lead_supervisors"

    lead_id = Column(Integer, ForeignKey("leads.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lead = relationship("Lead", back_populates="supervisor_links", overlaps="supervisors")
    supervisor = relationship("User", foreign_keys=[user_id], overlaps="supervised_leads,supervisors")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

class LeadNote(Base):
    __tablename__ = "lead_notes"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lead = relationship("Lead", back_populates="notes")
    user = relationship("User")

class LeadFile(Base):
    __tablename__ = "lead_files"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50), nullable=True) # e.g., image/png, application/pdf
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lead = relationship("Lead", back_populates="files")
    user = relationship("User")

class LeadHistory(Base):
    __tablename__ = "lead_history"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # changes can be system too
    previous_status = Column(String(50))
    new_status = Column(String(50))
    comment = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    lead = relationship("Lead", back_populates="history")
    user = relationship("User")

class LeadProcessDetail(Base):
    __tablename__ = "lead_process_details"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), unique=True)
    has_vehicle = Column(Boolean, default=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True) # Si tiene el vehículo
    desired_vehicle = Column(String(200), nullable=True) # Si no lo tiene
    business_sheet_url = Column(String(500), nullable=True) # Ruta del archivo
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    lead = relationship("Lead", back_populates="process_detail")
    vehicle = relationship("Vehicle")

class PurchaseOption(Base):
    __tablename__ = "purchase_options"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    photos = Column(JSON, nullable=True)
    decision_status = Column(String(30), default="pending")
    decision_note = Column(Text, nullable=True)
    decision_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decision_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lead = relationship("Lead", back_populates="purchase_options")
    user = relationship("User", foreign_keys=[user_id])
    decision_user = relationship("User", foreign_keys=[decision_user_id])

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    full_name = Column(String(150), nullable=True) # Nombre Completo
    hashed_password = Column(String(255))
    # role = Column(String(50)) # Deprecated in favor of role_id
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    commission_percentage = Column(Integer, default=0) # e.g. 5 for 5%
    
    # New fields
    base_salary = Column(Integer, nullable=True) # Sueldo base
    payment_dates = Column(String(100), nullable=True) # Fechas de pago e.g. "15 y 30"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active = Column(DateTime, default=datetime.datetime.utcnow)
    
    company = relationship("Company", back_populates="users")
    role = relationship("Role") # Relationship to Role model
    leads = relationship("Lead", foreign_keys="[Lead.assigned_to_id]", back_populates="assigned_to")
    leads_created = relationship("Lead", foreign_keys="[Lead.created_by_id]", back_populates="created_by")
    supervised_leads = relationship(
        "Lead",
        secondary="lead_supervisors",
        primaryjoin="User.id == LeadSupervisor.user_id",
        secondaryjoin="Lead.id == LeadSupervisor.lead_id",
        back_populates="supervisors",
        overlaps="supervisor_links,lead,supervisor,assigned_by"
    )
    sales = relationship("Sale", foreign_keys="[Sale.seller_id]", back_populates="seller")

class SaleStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), unique=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    seller_id = Column(Integer, ForeignKey("users.id"))
    company_id = Column(Integer, ForeignKey("companies.id"))
    
    sale_price = Column(Integer) # Final price sold
    commission_percentage = Column(Integer) # Snapshot of % at time of sale
    commission_amount = Column(Integer) # Calculated amount
    net_revenue = Column(Integer) # sale_price - commission_amount
    
    status = Column(String(50), default=SaleStatus.PENDING)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sale_date = Column(DateTime, default=datetime.datetime.utcnow)
    
    vehicle = relationship("Vehicle")
    lead = relationship("Lead")
    seller = relationship("User", foreign_keys=[seller_id], back_populates="sales")
    company = relationship("Company")
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    payment_receipts = relationship("PaymentReceipt", back_populates="sale", cascade="all, delete-orphan")


class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), index=True, nullable=False)
    sale_id = Column(Integer, ForeignKey("sales.id"), index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    concept = Column(String(200), nullable=True)
    movement_type = Column(String(20), default="income")
    receipt_number = Column(String(120), nullable=True)
    payment_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    amount = Column(Integer, nullable=False, default=0)
    category = Column(String(50), default="sale_payment")
    notes = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    file_type = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sale = relationship("Sale", back_populates="payment_receipts")
    company = relationship("Company")
    user = relationship("User")

class NotificationType(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"
    ERROR = "error"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(100))
    message = Column(String(500))
    type = Column(String(20), default=NotificationType.INFO)
    is_read = Column(Integer, default=0) # 0: unread, 1: read
    link = Column(String(200), nullable=True) # Optional link to resource
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", backref="notifications")

class LeadReminder(Base):
    __tablename__ = "lead_reminders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lead_id = Column(Integer, ForeignKey("leads.id"))
    reminder_date = Column(DateTime)
    note = Column(String(500))
    is_completed = Column(Integer, default=0) # 0: pending, 1: completed/notified
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", backref="reminders")
    lead = relationship("Lead", backref="reminders")

class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    event_type = Column(String(50)) # 'time_in_status', 'status_change', 'general'
    condition_value = Column(String(50)) # e.g. 'new', 'contacted' (the status to watch)
    time_value = Column(Integer, default=0)
    time_unit = Column(String(20), default='minutes') # 'minutes', 'hours', 'days'
    
    recipient_type = Column(String(50)) # 'assigned_advisor', 'all_admins', 'specific_user'
    specific_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    company_id = Column(Integer, ForeignKey("companies.id")) # specific to company
    
    is_repeating = Column(Boolean, default=False)
    repeat_interval = Column(Integer, default=0) # in minutes
    
    is_active = Column(Integer, default=1) # 1: active, 0: inactive
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SentAlertLog(Base):
    __tablename__ = "sent_alert_logs"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("automation_rules.id"))
    lead_id = Column(Integer, ForeignKey("leads.id"))
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)



class IntegrationSettings(Base):
    __tablename__ = "integration_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True)
    
    # Facebook
    facebook_access_token = Column(Text, nullable=True)
    facebook_pixel_id = Column(String(100), nullable=True)
    
    # Instagram
    instagram_access_token = Column(Text, nullable=True)
    
    # TikTok
    tiktok_access_token = Column(Text, nullable=True)
    tiktok_pixel_id = Column(String(100), nullable=True)
    
    # WhatsApp
    whatsapp_api_key = Column(Text, nullable=True)
    whatsapp_phone_number_id = Column(String(100), nullable=True)
    
    # ChatGPT
    openai_api_key = Column(Text, nullable=True)
    gw_model = Column(String(50), default="gpt-4o")
    chatbot_bot_name = Column(String(120), default="Jennifer Quimbayo")
    chatbot_typing_min_ms = Column(Integer, default=7000)
    chatbot_typing_max_ms = Column(Integer, default=18000)

    # Gmail
    gmail_enabled = Column(Boolean, default=False)
    gmail_client_id = Column(Text, nullable=True)
    gmail_client_secret = Column(Text, nullable=True)
    gmail_redirect_uri = Column(String(500), nullable=True)
    gmail_refresh_token = Column(Text, nullable=True)
    gmail_monitored_sender = Column(String(255), nullable=True)
    gmail_label = Column(String(120), nullable=True)

    company = relationship("Company", back_populates="integration_settings")




class VehicleStatus(str, enum.Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    SOLD = "sold"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    make = Column(String(100)) # Marca o (Marca y Modelo combinados)
    model = Column(String(100), nullable=True) # Modelo (ahora opcional)
    year = Column(Integer) # Año
    price = Column(Integer) # Precio de Venta
    purchase_price = Column(Integer, nullable=True) # PRECIO COMPRA
    faseco = Column(Integer, nullable=True) # FASECO
    plate = Column(String(20), index=True) # Placa
    mileage = Column(Integer, nullable=True) # Kilómetros
    color = Column(String(50), nullable=True) # Color
    fuel_type = Column(String(50), nullable=True) # Combustible
    transmission = Column(String(50), nullable=True) # Transmisión
    engine = Column(String(50), nullable=True) # Motor
    soat = Column(DateTime, nullable=True) # Soat (Vencimiento)
    tecno = Column(DateTime, nullable=True) # Tecno (Vencimiento)
    internal_code = Column(String(50), nullable=True) # Cod
    location = Column(String(100), nullable=True) # Ubicación
    description = Column(String(500), nullable=True)
    status = Column(String(50), default="available") # available, reserved, sold
    photos = Column(JSON, nullable=True) # List of image URLs
    
    company_id = Column(Integer, ForeignKey("companies.id"))
    company = relationship("Company", back_populates="vehicles")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    last_message_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    lead = relationship("Lead", back_populates="conversation")
    company = relationship("Company")
    messages = relationship("Message", back_populates="conversation")

class MessageType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    document = "document"
    AUDIO = "audio"
    OTHER = "other"

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    sender_type = Column(String(50)) # 'user' or 'lead'
    content = Column(String(2000), nullable=True) # Text content or Caption
    media_url = Column(String(1000), nullable=True)
    message_type = Column(String(20), default=MessageType.TEXT) # text, image, etc
    whatsapp_message_id = Column(String(100), nullable=True)
    status = Column(String(20), default="sent") # sent, delivered, read
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")


class CreditStatus(str, enum.Enum):
    PENDING = "pending" # Solicitud Recibida
    IN_REVIEW = "in_review" # En Estudio
    APPROVED = "approved" # Aprobado
    REJECTED = "rejected" # Rechazado
    COMPLETED = "completed" # Finalizado/Vendido

class CreditApplication(Base):
    __tablename__ = "credit_applications"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True, index=True)
    client_name = Column(String(100))
    phone = Column(String(50))
    email = Column(String(100), nullable=True)
    
    # Financial Profile
    desired_vehicle = Column(String(100)) # e.g. "Mazda 3 2020"
    monthly_income = Column(Integer, nullable=True)
    other_income = Column(Integer, default=0)
    occupation = Column(String(50)) # Empleado, Independiente, Pensionado
    application_mode = Column(String(50), default="individual") # Individual, Conjoint
    down_payment = Column(Integer, default=0) # Cuota inicial disponible
    
    status = Column(String(50), default=CreditStatus.PENDING)
    notes = Column(String(2000), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    company_id = Column(Integer, ForeignKey("companies.id"))
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    lead = relationship("Lead")
    company = relationship("Company")
    assigned_to = relationship("User")

class InternalMessage(Base):
    __tablename__ = "internal_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    sender_id = Column(Integer, ForeignKey("users.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Valid for DMs, Null for Broadcast
    content = Column(String(2000))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    company = relationship("Company")
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])

class PublicChatSession(Base):
    __tablename__ = "public_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_token = Column(String(120), unique=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    source_page = Column(String(200), nullable=True)  # e.g. "/autos", "/autos/12"
    status = Column(String(30), default="active")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    company = relationship("Company")
    lead = relationship("Lead")
    messages = relationship("PublicChatMessage", back_populates="session", cascade="all, delete-orphan")

class PublicChatMessage(Base):
    __tablename__ = "public_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("public_chat_sessions.id"))
    role = Column(String(20))  # system, user, assistant
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("PublicChatSession", back_populates="messages")


class ChannelChatSession(Base):
    __tablename__ = "channel_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    source = Column(String(50), nullable=False, index=True)
    external_user_id = Column(String(120), nullable=False, index=True)
    recipient_id = Column(String(120), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    last_message_at = Column(DateTime, default=datetime.datetime.utcnow)

    company = relationship("Company")
    lead = relationship("Lead")
    conversation = relationship("Conversation")

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Que usuario hizo la accion. Null = Sistema
    action = Column(String(50)) # e.g. "LOGIN", "CREATE_VEHICLE", "UPDATE_LEAD", "DELETE_USER"
    entity_type = Column(String(50), nullable=True) # e.g. "Vehicle", "Lead", "User", "Auth"
    entity_id = Column(Integer, nullable=True) # El ID del registro afectado
    details = Column(Text, nullable=True) # Descripcion libre o JSON stringified con los cambios
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User")
