
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from database import get_db
import models, schemas_whatsapp, auth_utils
from typing import List, Optional
import os
import json
import datetime

router = APIRouter(
    prefix="/whatsapp",
    tags=["whatsapp"]
)

# --- WEBHOOK VERIFICATION (GET) ---
@router.get("/webhook")
def verify_webhook(mode: str = None, token: str = None, challenge: str = None, 
                  # hub.verify_token in query params
                  ):
    # The parameters come as hub.mode, hub.verify_token, hub.challenge
    # But usually frameworks handle params. Let's inspect request directly or use alias if needed.
    # Actually FastAPI handles query params nicely.
    # Meta sends: hub.mode, hub.verify_token, hub.challenge
    
    # We'll use a hardcoded verify token for now or load from env/db
    VERIFY_TOKEN = "autosqp_webhook_secret" 
    
    # NOTE: FastAPI parameter aliasing needed because of dot notation
    pass 
    # Proper verification below using Request to be safe with query params
    
@router.get("/webhook", include_in_schema=False)
async def verify_webhook_raw(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    VERIFY_TOKEN = "autosqp_webhook_secret" # In prod, load from DB/Env
    
    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            print("WEBHOOK_VERIFIED")
            return int(challenge)
        else:
             raise HTTPException(status_code=403, detail="Verification failed")
    
    return {"status": "ok"}

# --- WEBHOOK EVENTS (POST) ---
@router.post("/webhook")
async def receive_whatsapp_message(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        print("WA_WEBHOOK_PAYLOAD:", json.dumps(data, indent=2))
        
        entry = data.get("entry", [])
        if not entry:
            return {"status": "no entry"}
            
        changes = entry[0].get("changes", [])
        if not changes:
            return {"status": "no changes"}
            
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        contacts = value.get("contacts", [])
        
        if not messages:
             return {"status": "no messages"}
             
        # Process first message for now
        msg_data = messages[0]
        from_number = msg_data.get("from") # e.g. "573001234567"
        msg_type = msg_data.get("type")
        msg_id = msg_data.get("id")
        timestamp = msg_data.get("timestamp")
        
        # Get Content
        content = ""
        media_url = None
        
        if msg_type == "text":
            content = msg_data.get("text", {}).get("body", "")
        elif msg_type == "image":
            content = msg_data.get("image", {}).get("caption", "")
            # media_id = msg_data.get("image", {}).get("id")
            # In real app, fetch media URL using media_id + Access Token
            media_url = "https://via.placeholder.com/150" # Placeholder for now
            
        # 1. FIND OR CREATE LEAD
        # Find lead by phone (fuzzy match needed in real world, strict here)
        lead = db.query(models.Lead).filter(models.Lead.phone == from_number).first()
        
        company_id = 1 # Default company for now, or derive from waba_id if multi-tenant
        
        if not lead:
            # Create new Lead
            contact_name = from_number
            if contacts:
                contact_name = contacts[0].get("profile", {}).get("name", from_number)
                
            # Auto-Assign Logic (copied from main.py)
            import random
            
            assigned_user_id = None
            asesor_role = db.query(models.Role).filter(models.Role.name.in_(["asesor", "vendedor"])).first()
            # Note: This finds *any* role matching. Ideally we find the specific ID. 
            # Better: JOIN User and Role to find candidates directly.
            
            potential_agents = db.query(models.User).join(models.Role).filter(
                models.User.company_id == company_id,
                models.Role.name.in_(["asesor", "vendedor"])
            ).all()

            if potential_agents:
                chosen_agent = random.choice(potential_agents)
                assigned_user_id = chosen_agent.id
                print(f"WhatsApp Lead automatically assigned to: {chosen_agent.email}")

            lead = models.Lead(
                name=contact_name,
                phone=from_number,
                source="whatsapp",
                status="new",
                company_id=company_id,
                assigned_to_id=assigned_user_id
            )
            db.add(lead)
            db.commit()
            db.refresh(lead)
            print(f"New Lead created from WhatsApp: {lead.id}")
            
        # 2. FIND OR CREATE CONVERSATION
        conversation = db.query(models.Conversation).filter(models.Conversation.lead_id == lead.id).first()
        if not conversation:
            conversation = models.Conversation(
                lead_id=lead.id,
                company_id=lead.company_id,
                last_message_at=datetime.datetime.utcnow()
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            
        # 3. SAVE MESSAGE
        new_msg = models.Message(
            conversation_id=conversation.id,
            sender_type="lead",
            content=content,
            media_url=media_url,
            message_type=msg_type,
            whatsapp_message_id=msg_id,
            status="delivered"
        )
        db.add(new_msg)
        
        # Update conversation timestamp
        conversation.last_message_at = datetime.datetime.utcnow()
        
        db.commit()
        
        return {"status": "processed"}
        
    except Exception as e:
        print(f"Error processing webhook: {e}")
        return {"status": "error", "detail": str(e)}

# --- API ENDPOINTS FOR FRONTEND ---

@router.get("/conversations", response_model=List[schemas_whatsapp.Conversation])
def get_conversations(db: Session = Depends(get_db)):
    # In real app, verify user company
    return db.query(models.Conversation).order_by(models.Conversation.last_message_at.desc()).all()

@router.get("/conversations/{conversation_id}/messages", response_model=List[schemas_whatsapp.Message])
def get_messages(conversation_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.conversation_id == conversation_id).order_by(models.Message.created_at.asc()).all()

@router.post("/conversations/{conversation_id}/send")
def send_message(conversation_id: int, message: schemas_whatsapp.MessageCreate, db: Session = Depends(get_db)):
    # 1. Get Conversation and Lead
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation or not conversation.lead:
        raise HTTPException(status_code=404, detail="Conversation or Lead not found")
        
    lead_phone = conversation.lead.phone
    
    # 2. Get Credentials (DB or Env)
    # Priority: DB Settings -> Env
    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == conversation.company_id).first()
    
    token = settings.whatsapp_api_key if settings and settings.whatsapp_api_key else os.getenv("WHATSAPP")
    # phone_number_id = settings.whatsapp_phone_number_id if settings and settings.whatsapp_phone_number_id else os.getenv("WHATSAPP_PHONE_ID")
    phone_number_id = settings.whatsapp_phone_number_id if settings and settings.whatsapp_phone_number_id else os.getenv("WHATSAPP_PHONE_ID")
    
    # If we have token but no phone ID, we can't send easily without hardcoding/fetching. 
    # For now, let's assume user enters it in UI or we use a placeholder that will fail with a clear error.
    
    if not token:
        raise HTTPException(status_code=400, detail="WhatsApp Token not configured")

    # 3. Call WhatsApp API
    url = f"https://graph.facebook.com/v17.0/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": lead_phone,
        "type": "text",
        "text": {"body": message.content}
    }
    
    whatsapp_msg_id = None
    msg_status = "failed"
    
    try:
        import requests
        response = requests.post(url, json=payload, headers=headers)
        resp_data = response.json()
        
        if response.status_code in [200, 201]:
            msg_status = "sent"
            whatsapp_msg_id = resp_data.get("messages", [{}])[0].get("id")
        else:
            print(f"WhatsApp API Error: {resp_data}")
            # If mocking/testing without real phone ID
            if "OAuthException" in str(resp_data):
                 msg_status = "failed"
            else:
                 msg_status = "failed"
                 
    except Exception as e:
        print(f"Error sending to WhatsApp: {e}")
        msg_status = "failed"

    # 4. Save to DB
    new_msg = models.Message(
        conversation_id=conversation_id,
        sender_type="user",
        content=message.content,
        message_type="text",
        status=msg_status,
        whatsapp_message_id=whatsapp_msg_id
    )
    db.add(new_msg)
    
    # Update conversation
    conversation.last_message_at = datetime.datetime.utcnow()
         
    db.commit()
    db.refresh(new_msg)
    
    return new_msg
