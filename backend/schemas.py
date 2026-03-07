from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional, Any, Dict
from datetime import datetime
import enum

# --- ENUMS ---

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
    ALLY_MANAGED = "ally_managed"

class VehicleStatus(str, enum.Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    SOLD = "sold"

class SaleStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

# --- BASE SCHEMAS ---

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role_id: int
    company_id: Optional[int] = None
    commission_percentage: Optional[float] = 0.0
    base_salary: Optional[int] = None
    payment_dates: Optional[str] = None

class UserCreate(UserBase):
    password: str

class RoleBase(BaseModel):
    name: str
    label: str

class Role(RoleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    company_id: Optional[int] = None
    commission_percentage: Optional[float] = None
    base_salary: Optional[int] = None
    payment_dates: Optional[str] = None

class User(UserBase):
    id: int
    created_at: Optional[datetime] = None
    role: Optional[Role] = None
    last_active: Optional[datetime] = None
    is_online: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)

class UserList(BaseModel):
    items: List[User]
    total: int

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- COMPANY ---

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

class CompanyList(BaseModel):
    items: List[Company]
    items: List[Company]
    total: int

# --- NOTIFICATIONS & REMINDERS ---

class NotificationBase(BaseModel):
    title: str
    message: str
    type: str = "info"
    link: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: int

class Notification(NotificationBase):
    id: int
    user_id: int
    is_read: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LeadReminderBase(BaseModel):
    lead_id: int
    reminder_date: datetime
    note: str

class LeadReminderCreate(LeadReminderBase):
    pass

class LeadReminder(LeadReminderBase):
    id: int
    user_id: int
    is_completed: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AutomationRuleBase(BaseModel):
    name: str
    event_type: str
    condition_value: str
    time_value: int
    time_unit: str
    recipient_type: str
    specific_user_id: Optional[int] = None
    is_repeating: bool = False
    repeat_interval: int = 0
    is_active: int = 1

class AutomationRuleCreate(AutomationRuleBase):
    pass

class AutomationRule(AutomationRuleBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

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

# --- MESSAGES & CONVERSATIONS ---

class MessageBase(BaseModel):
    content: Optional[str] = None
    sender_type: str # user, lead
    media_url: Optional[str] = None
    message_type: str = "text"

class MessageCreate(MessageBase):
    conversation_id: int

class Message(MessageBase):
    id: int
    created_at: datetime
    status: str
    
    model_config = ConfigDict(from_attributes=True)

class ConversationBase(BaseModel):
    lead_id: int
    company_id: int

class Conversation(ConversationBase):
    id: int
    last_message_at: datetime
    messages: List[Message] = []
    
    model_config = ConfigDict(from_attributes=True)

# --- LEADS ---

class LeadHistoryBase(BaseModel):
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    comment: Optional[str] = None

class LeadHistory(LeadHistoryBase):
    id: int
    created_at: datetime
    user_id: Optional[int] = None
    user: Optional[User] = None
    
    model_config = ConfigDict(from_attributes=True)

class LeadProcessDetailBase(BaseModel):
    has_vehicle: bool = False
    vehicle_id: Optional[int] = None
    desired_vehicle: Optional[str] = None
    business_sheet_url: Optional[str] = None

class LeadProcessDetailCreate(LeadProcessDetailBase):
    pass

class LeadProcessDetail(LeadProcessDetailBase):
    id: int
    lead_id: int
    created_at: datetime
    updated_at: datetime
    business_sheet_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class LeadNoteBase(BaseModel):
    content: str

class LeadNoteCreate(LeadNoteBase):
    pass

class LeadNote(LeadNoteBase):
    id: int
    lead_id: int
    user_id: Optional[int] = None
    created_at: datetime
    user: Optional[User] = None
    
    model_config = ConfigDict(from_attributes=True)

class LeadFileBase(BaseModel):
    file_name: str
    file_type: Optional[str] = None

class LeadFileCreate(LeadFileBase):
    pass

class LeadFile(LeadFileBase):
    id: int
    lead_id: int
    user_id: Optional[int] = None
    file_path: str
    created_at: datetime
    user: Optional[User] = None
    
    model_config = ConfigDict(from_attributes=True)

class LeadBase(BaseModel):
    source: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = LeadStatus.NEW
    message: Optional[str] = None
    company_id: Optional[int] = None
    assigned_to_id: Optional[int] = None

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    assigned_to_id: Optional[int] = None
    comment: Optional[str] = None # Virtual field for history
    process_detail: Optional[LeadProcessDetailCreate] = None # Para recibir los detalles de proceso
    
class LeadBulkAssign(BaseModel):
    lead_ids: List[int]
    assigned_to_id: int

class Lead(LeadBase):
    id: int
    created_at: datetime
    created_by_id: Optional[int] = None
    assigned_to: Optional[User] = None
    history: List[LeadHistory] = []
    conversation: Optional[Conversation] = None
    process_detail: Optional[LeadProcessDetail] = None
    notes: List[LeadNote] = []
    files: List[LeadFile] = []
    
    model_config = ConfigDict(from_attributes=True)

class LeadList(BaseModel):
    items: List[Lead]
    total: int

# --- VEHICLES ---

class VehicleBase(BaseModel):
    make: str
    model: Optional[str] = None
    year: int
    price: int
    purchase_price: Optional[int] = None
    faseco: Optional[int] = None
    plate: str
    mileage: Optional[int] = 0
    color: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    engine: Optional[str] = None
    soat: Optional[datetime] = None
    tecno: Optional[datetime] = None
    internal_code: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = VehicleStatus.AVAILABLE
    photos: Optional[List[str]] = []
    company_id: Optional[int] = None

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    price: Optional[int] = None
    purchase_price: Optional[int] = None
    faseco: Optional[int] = None
    plate: Optional[str] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    engine: Optional[str] = None
    soat: Optional[datetime] = None
    tecno: Optional[datetime] = None
    internal_code: Optional[str] = None
    location: Optional[str] = None
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

class CarBrandBase(BaseModel):
    name: str
    logo_url: Optional[str] = None

class CarBrand(CarBrandBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class CarModelBase(BaseModel):
    name: str

class CarModel(CarModelBase):
    id: int
    brand_id: int
    model_config = ConfigDict(from_attributes=True)

# --- SALES ---

class SaleBase(BaseModel):
    vehicle_id: int
    lead_id: Optional[int] = None
    seller_id: Optional[int] = None # Optional override by admin
    sale_price: int
    
class SaleCreate(SaleBase):
    pass

class Sale(SaleBase):
    id: int
    company_id: int
    status: str
    commission_percentage: float
    commission_amount: int
    net_revenue: int
    sale_date: datetime
    approved_by_id: Optional[int] = None
    
    vehicle: Optional[Vehicle] = None
    lea: Optional[Lead] = None # Typo fixed
    lead: Optional[Lead] = None
    seller: Optional[User] = None
    
    model_config = ConfigDict(from_attributes=True)

class SaleList(BaseModel):
    items: List[Sale]
    total: int

# --- STATS ---

class DashboardStats(BaseModel):
    companies_count: int
    users_count: int

class ReportsStats(BaseModel):
    total_leads: int
    conversion_rate: float
    leads_by_status: Dict[str, int]
    leads_by_source: Dict[str, int]
    leads_by_advisor: Dict[str, int]
    leads_by_brand: Dict[str, int]
    leads_by_model: Dict[str, int]
    avg_response_time: List[int]

# --- CREDITS ---

class CreditApplicationBase(BaseModel):
    client_name: str
    phone: str
    email: Optional[str] = None
    desired_vehicle: str
    monthly_income: Optional[int] = 0
    other_income: Optional[int] = 0
    occupation: str 
    application_mode: Optional[str] = "individual"
    down_payment: Optional[int] = 0
    notes: Optional[str] = None
    status: Optional[str] = "pending"

class CreditApplicationCreate(CreditApplicationBase):
    company_id: Optional[int] = None
    assigned_to_id: Optional[int] = None

class CreditApplicationUpdate(BaseModel):
    client_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    desired_vehicle: Optional[str] = None
    monthly_income: Optional[int] = None
    other_income: Optional[int] = None
    occupation: Optional[str] = None
    application_mode: Optional[str] = None
    down_payment: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[int] = None

class CreditApplication(CreditApplicationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    company_id: int
    assigned_to_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)

class CreditApplicationList(BaseModel):
    items: List[CreditApplication]
    total: int

# --- INTERNAL CHAT ---

class InternalMessageBase(BaseModel):
    content: str
    recipient_id: Optional[int] = None

class InternalMessageCreate(InternalMessageBase):
    pass

class InternalMessage(InternalMessageBase):
    id: int
    company_id: int
    sender_id: int
    created_at: datetime
    sender: Optional[User] = None 
    recipient: Optional[User] = None 

    model_config = ConfigDict(from_attributes=True)

class PublicChatSessionCreate(BaseModel):
    source_page: Optional[str] = "/autos"
    company_id: Optional[int] = None

class PublicChatSession(BaseModel):
    session_token: str
    company_id: Optional[int] = None
    lead_id: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PublicChatMessageCreate(BaseModel):
    session_token: str
    message: str
    vehicle_id: Optional[int] = None
    source_page: Optional[str] = None

class PublicChatMessageItem(BaseModel):
    role: str
    content: str
    created_at: Optional[datetime] = None

class PublicChatMessageResponse(BaseModel):
    session_token: str
    reply: str
    lead_created: bool = False
    lead_id: Optional[int] = None
    messages: List[PublicChatMessageItem] = []

class SystemLogBase(BaseModel):
    user_id: Optional[int] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None

class SystemLog(SystemLogBase):
    id: int
    created_at: datetime
    user: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)

class SystemLogList(BaseModel):
    items: List[SystemLog]
    total: int
