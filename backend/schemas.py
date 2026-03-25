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
    CREDIT_APPLICATION = "credit_application"
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
    label: str
    name: Optional[str] = None
    permissions: List[str] = []
    menu_order: List[str] = []
    auto_assign_leads: Optional[bool] = False
    assignable_role_ids: List[int] = []
    company_id: Optional[int] = None
    is_system: Optional[bool] = False
    base_role_name: Optional[str] = None

class RoleCreate(BaseModel):
    label: str
    permissions: List[str] = []
    menu_order: List[str] = []
    auto_assign_leads: Optional[bool] = False
    assignable_role_ids: List[int] = []

class RoleUpdate(BaseModel):
    label: Optional[str] = None
    permissions: Optional[List[str]] = None
    menu_order: Optional[List[str]] = None
    auto_assign_leads: Optional[bool] = None
    assignable_role_ids: Optional[List[int]] = None

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
    chatbot_bot_name: Optional[str] = "Jennifer Quimbayo"
    chatbot_typing_min_ms: Optional[int] = 7000
    chatbot_typing_max_ms: Optional[int] = 18000
    gmail_enabled: Optional[bool] = False
    gmail_client_id: Optional[str] = None
    gmail_client_secret: Optional[str] = None
    gmail_redirect_uri: Optional[str] = None
    gmail_refresh_token: Optional[str] = None
    gmail_monitored_sender: Optional[str] = None
    gmail_label: Optional[str] = None
    gmail_sync_days: Optional[int] = 7
    gmail_sync_max_results: Optional[int] = 20

class IntegrationSettingsUpdate(IntegrationSettingsBase):
    pass

class IntegrationSettings(IntegrationSettingsBase):
    id: int
    company_id: int
    model_config = ConfigDict(from_attributes=True)


class GmailProcessedMessageItem(BaseModel):
    id: int
    company_id: int
    gmail_message_id: str
    gmail_thread_id: Optional[str] = None
    lead_id: Optional[int] = None
    credit_application_id: Optional[int] = None
    sender: Optional[str] = None
    subject: Optional[str] = None
    summary: Optional[str] = None
    quick_status: Optional[str] = None
    quick_analysis: Optional[str] = None
    processed_at: datetime
    lead_name: Optional[str] = None
    credit_client_name: Optional[str] = None


class GmailProcessedMessageList(BaseModel):
    items: List[GmailProcessedMessageItem]
    total: int

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

class LeadFileDeleteRequest(BaseModel):
    reason: str

class PurchaseOptionBase(BaseModel):
    title: str
    description: Optional[str] = None

class PurchaseOption(PurchaseOptionBase):
    id: int
    lead_id: int
    user_id: Optional[int] = None
    photos: List[str] = []
    decision_status: Optional[str] = "pending"
    decision_note: Optional[str] = None
    decision_user_id: Optional[int] = None
    decision_at: Optional[datetime] = None
    created_at: datetime
    user: Optional[User] = None
    decision_user: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseOptionDecisionUpdate(BaseModel):
    decision_status: str
    decision_note: str

class LeadBase(BaseModel):
    source: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = LeadStatus.NEW
    message: Optional[str] = None
    company_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    supervisor_ids: List[int] = []
    has_unread_reply: Optional[int] = 0
    last_reply_at: Optional[datetime] = None

class LeadCreate(LeadBase):
    pass

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    assigned_to_id: Optional[int] = None
    supervisor_ids: Optional[List[int]] = None
    comment: Optional[str] = None # Virtual field for history
    process_detail: Optional[LeadProcessDetailCreate] = None # Para recibir los detalles de proceso

class LeadDeleteRequest(BaseModel):
    reason: str
    
class LeadBulkAssign(BaseModel):
    lead_ids: List[int]
    assigned_to_id: int

class Lead(LeadBase):
    id: int
    created_at: datetime
    created_by_id: Optional[int] = None
    deleted_at: Optional[datetime] = None
    deleted_reason: Optional[str] = None
    deleted_by_id: Optional[int] = None
    assigned_to: Optional[User] = None
    deleted_by: Optional[User] = None
    supervisors: List[User] = []
    credit_application_id: Optional[int] = None
    credit_application_status: Optional[str] = None
    credit_application_updated_at: Optional[datetime] = None
    history: List[LeadHistory] = []
    conversation: Optional[Conversation] = None
    process_detail: Optional[LeadProcessDetail] = None
    notes: List[LeadNote] = []
    files: List[LeadFile] = []
    purchase_options: List[PurchaseOption] = []
    
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


class PaymentReceiptBase(BaseModel):
    sale_id: Optional[int] = None
    concept: Optional[str] = None
    movement_type: Optional[str] = "income"
    receipt_number: Optional[str] = None
    payment_date: Optional[datetime] = None
    amount: int
    category: Optional[str] = "sale_payment"
    notes: Optional[str] = None


class PaymentReceiptCreate(PaymentReceiptBase):
    pass


class PaymentReceipt(PaymentReceiptBase):
    id: int
    company_id: int
    user_id: int
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    file_type: Optional[str] = None
    created_at: datetime
    sale: Optional[Sale] = None
    user: Optional[User] = None

    model_config = ConfigDict(from_attributes=True)


class PaymentReceiptList(BaseModel):
    items: List[PaymentReceipt]
    total: int

# --- STATS ---

class DashboardStats(BaseModel):
    companies_count: int
    users_count: int

class RoleDashboardStats(BaseModel):
    total_leads: int
    leads_new: int
    leads_sold: int
    ally_total: int
    conversion_rate: float
    response_time_min: int
    active_pipeline_count: int
    unread_replies_count: int
    status_distribution: Dict[str, int]
    ally_status_distribution: Dict[str, int]
    recent_leads_by_day: Dict[str, int]
    credit_total: int
    credit_status_distribution: Dict[str, int]
    purchase_total: int
    purchase_status_distribution: Dict[str, int]
    purchase_option_decision_distribution: Dict[str, int]
    sales_total: int
    sales_approved: int
    sales_pending: int
    sales_status_distribution: Dict[str, int]
    inventory_total: int
    inventory_status_distribution: Dict[str, int]

class ReportsStats(BaseModel):
    total_leads: int
    conversion_rate: float
    active_pipeline_count: int
    unread_replies_count: int
    ally_board_count: int
    credit_applications_count: int
    purchase_requests_count: int
    available_inventory_count: int
    approved_sales_count: int
    pending_sales_count: int
    leads_by_status: Dict[str, int]
    leads_by_source: Dict[str, int]
    leads_by_advisor: Dict[str, int]
    recent_leads_by_day: Dict[str, int]
    unread_replies_by_source: Dict[str, int]
    assignment_split: Dict[str, int]
    ally_status_split: Dict[str, int]
    credit_status_split: Dict[str, int]
    purchase_status_split: Dict[str, int]
    purchase_option_decision_split: Dict[str, int]
    vehicle_status_split: Dict[str, int]
    sales_status_split: Dict[str, int]

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
    lead_id: Optional[int] = None

class ManualPurchaseRequestCreate(BaseModel):
    client_name: str
    phone: str
    email: Optional[str] = None
    desired_vehicle: str
    notes: Optional[str] = None

class CreditApplicationUpdate(BaseModel):
    lead_id: Optional[int] = None
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

class CreditNoteCreate(BaseModel):
    content: str

class CreditApplication(CreditApplicationBase):
    id: int
    lead_id: Optional[int] = None
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

class PublicChatInactiveCheck(BaseModel):
    session_token: str

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
