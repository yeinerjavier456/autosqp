from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- Message Schemas ---
class MessageBase(BaseModel):
    conversation_id: int
    sender_type: str  # 'user' or 'lead'
    content: Optional[str] = None
    media_url: Optional[str] = None
    message_type: str = "text"

class MessageCreate(MessageBase):
    pass

class Message(MessageBase):
    id: int
    whatsapp_message_id: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        orm_mode = True

# --- Conversation Schemas ---
class LeadInfo(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    
    class Config:
        orm_mode = True

class ConversationBase(BaseModel):
    lead_id: Optional[int] = None
    company_id: int

class ConversationCreate(ConversationBase):
    pass

class Conversation(ConversationBase):
    id: int
    last_message_at: datetime
    lead: Optional[LeadInfo] = None
    external_user_id: Optional[str] = None
    # messages: List[Message] = []

    class Config:
        orm_mode = True

# --- Webhook Schemas (Simplified for what we need to process) ---
class WhatsAppWebhook(BaseModel):
    object: str
    entry: List[dict]
