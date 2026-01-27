from sqlalchemy import Column, Integer, String, ForeignKey, Enum as SqEnum, JSON
from sqlalchemy.orm import relationship
from database import Base
import enum

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

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True)
    hashed_password = Column(String(255))
    # role = Column(String(50)) # Deprecated in favor of role_id
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    
    company = relationship("Company", back_populates="users")
    role = relationship("Role") # Relationship to Role model

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


class LeadSource(str, enum.Enum):
    FACEBOOK = "facebook"
    TIKTOK = "tiktok"
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    OTHER = "other"

class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    CONVERTED = "converted"
    CLOSED = "closed"

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(String(50)) # Using string for simplicity, or DateTime
    updated_at = Column(String(50), nullable=True)
    source = Column(String(50)) # e.g. "facebook"
    name = Column(String(100), nullable=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    message = Column(String(500), nullable=True)
    status = Column(String(50), default="new")
    
    company_id = Column(Integer, ForeignKey("companies.id"))
    company = relationship("Company", back_populates="leads")
    
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_to = relationship("User")

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
