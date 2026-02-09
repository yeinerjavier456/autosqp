from sqlalchemy import Column, Integer, String, ForeignKey, Enum as SqEnum, JSON, DateTime
from sqlalchemy.orm import relationship
from database import Base
import enum
import datetime

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ASESOR = "asesor"
    USER = "user"
    # Legacy support
    USUARIO = "usuario"
    VENDEDOR = "vendedor"
    COORDINADOR = "coordinador"

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
    QUALIFIED = "qualified"
    LOST = "lost"
    SOLD = "sold"

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    source = Column(String(50), default=LeadSource.WEB) 
    status = Column(String(50), default=LeadStatus.NEW)
    message = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    company_id = Column(Integer, ForeignKey("companies.id"))
    company = relationship("Company", back_populates="leads")
    
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = relationship("User", back_populates="leads")
    history = relationship("LeadHistory", back_populates="lead")
    conversation = relationship("Conversation", back_populates="lead", uselist=False)

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

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    # role = Column(String(50)) # Deprecated in favor of role_id
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    commission_percentage = Column(Integer, default=0) # e.g. 5 for 5%
    
    # New fields
    base_salary = Column(Integer, nullable=True) # Sueldo base
    payment_dates = Column(String(100), nullable=True) # Fechas de pago e.g. "15 y 30"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    company = relationship("Company", back_populates="users")
    role = relationship("Role") # Relationship to Role model
    leads = relationship("Lead", back_populates="assigned_to")
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

class IntegrationSettings(Base):
    __tablename__ = "integration_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True)
    
    # Facebook
    facebook_access_token = Column(String(255), nullable=True)
    facebook_pixel_id = Column(String(100), nullable=True)
    
    # Instagram
    instagram_access_token = Column(String(255), nullable=True)
    
    # TikTok
    tiktok_access_token = Column(String(255), nullable=True)
    tiktok_pixel_id = Column(String(100), nullable=True)
    
    # WhatsApp
    whatsapp_api_key = Column(String(255), nullable=True)
    whatsapp_phone_number_id = Column(String(100), nullable=True)
    
    # ChatGPT
    openai_api_key = Column(String(255), nullable=True)
    gw_model = Column(String(50), default="gpt-4o")

    company = relationship("Company", back_populates="integration_settings")




class VehicleStatus(str, enum.Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    SOLD = "sold"

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    make = Column(String(100)) # Marca
    model = Column(String(100)) # Modelo
    year = Column(Integer) # Año
    price = Column(Integer) # Precio
    plate = Column(String(20), index=True) # Placa
    mileage = Column(Integer, nullable=True) # Kilometraje
    color = Column(String(50), nullable=True)
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
    
    company = relationship("Company")
    assigned_to = relationship("User")

