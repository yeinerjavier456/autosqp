from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class CompanyBase(BaseModel):
    name: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = "#000000"
    secondary_color: Optional[str] = "#ffffff"

class CompanyCreate(CompanyBase):
    pass

class Company(CompanyBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: Optional[int] = None

class RoleBase(BaseModel):
    name: str
    label: str

class Role(RoleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str
    role_id: int
    company_id: Optional[int] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    company_id: Optional[int] = None

class User(UserBase):
    id: int
    role_id: Optional[int] = None
    role: Optional[Role] = None
    company_id: Optional[int] = None
    company: Optional[Company] = None

    model_config = ConfigDict(from_attributes=True)

class DashboardStats(BaseModel):
    companies_count: int
    users_count: int

class UserList(BaseModel):
    items: list[User]
    total: int

class CompanyList(BaseModel):
    items: list[Company]
    total: int

class IntegrationSettingsBase(BaseModel):
    facebook_access_token: Optional[str] = None
    facebook_pixel_id: Optional[str] = None
    instagram_access_token: Optional[str] = None
    tiktok_access_token: Optional[str] = None
    tiktok_pixel_id: Optional[str] = None
    whatsapp_api_key: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    openai_api_key: Optional[str] = None
    gw_model: Optional[str] = "gpt-4o"

class IntegrationSettingsUpdate(IntegrationSettingsBase):
    pass

class IntegrationSettings(IntegrationSettingsBase):
    id: int
    company_id: int
    
    model_config = ConfigDict(from_attributes=True)

# --- LEADS ---
from typing import List

class LeadBase(BaseModel):
    source: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = "new"
    updated_at: Optional[str] = None

class LeadCreate(LeadBase):
    company_id: Optional[int] = None

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    message: Optional[str] = None
    assigned_to_id: Optional[int] = None

class Lead(LeadBase):
    id: int
    created_at: Optional[str] = None
    company_id: int
    assigned_to_id: Optional[int] = None
    assigned_to: Optional[User] = None
    
    model_config = ConfigDict(from_attributes=True)

class LeadList(BaseModel):
    items: List[Lead]
    total: int

class LeadBulkAssign(BaseModel):
    lead_ids: List[int]
    assigned_to_id: int

class ReportsStats(BaseModel):
    total_leads: int
    conversion_rate: float
    leads_by_status: dict
    leads_by_source: dict
    leads_by_advisor: dict
    # New metrics (Mocked for now)
    leads_by_brand: dict
    leads_by_model: dict
    avg_response_time: list # List of values for a line chart e.g. [30, 25, 20...] mins over time

# --- BRANDS & MODELS ---
class CarModelBase(BaseModel):
    name: str

class CarModel(CarModelBase):
    id: int
    brand_id: int
    model_config = ConfigDict(from_attributes=True)

class CarBrandBase(BaseModel):
    name: str
    logo_url: Optional[str] = None

class CarBrand(CarBrandBase):
    id: int
    models: List[CarModel] = []
    model_config = ConfigDict(from_attributes=True)

# --- VEHICLES ---
class VehicleBase(BaseModel):
    make: str
    model: str
    year: int
    price: int
    plate: str
    mileage: Optional[int] = 0
    color: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = "available"
    photos: Optional[List[str]] = []

class VehicleCreate(VehicleBase):
    company_id: Optional[int] = None

class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    price: Optional[int] = None
    plate: Optional[str] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    photos: Optional[List[str]] = None

class Vehicle(VehicleBase):
    id: int
    company_id: int
    
    model_config = ConfigDict(from_attributes=True)

class VehicleList(BaseModel):
    items: List[Vehicle]
    total: int
