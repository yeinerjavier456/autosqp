from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models, schemas_whatsapp
import datetime
import json
import os
from typing import List

router = APIRouter(
    prefix="/meta",
    tags=["meta"]
)

VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "autosqp_meta_secret")

@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Verificación del Webhook requerido por Meta (Facebook/Instagram).
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            print("META_WEBHOOK_VERIFIED")
            return int(challenge)
        else:
            raise HTTPException(status_code=403, detail="Verification failed")
    
    return {"status": "ok"}


@router.post("/webhook")
async def receive_meta_message(request: Request, db: Session = Depends(get_db)):
    """
    Recepción de mensajes desde Facebook Messenger o Instagram Direct.
    """
    try:
        data = await request.json()
        print("META_WEBHOOK_PAYLOAD:", json.dumps(data, indent=2))
        
        object_type = data.get("object")
        # 'page' for Facebook Messenger, 'instagram' for Instagram
        
        if object_type not in ["page", "instagram"]:
            return {"status": "ignored"}
            
        entry = data.get("entry", [])
        if not entry:
            return {"status": "no entry"}
            
        for ent in entry:
            messaging_events = ent.get("messaging", [])
            for event in messaging_events:
                # We only care about user messages
                if "message" not in event:
                    continue
                    
                sender_id = event.get("sender", {}).get("id") # PSID or IGSID
                recipient_id = event.get("recipient", {}).get("id") # Page ID or IG Acc ID
                
                message_data = event.get("message", {})
                if message_data.get("is_echo"):
                    continue # Ignore messages sent by the page itself
                    
                content = message_data.get("text", "")
                msg_id = message_data.get("mid")
                
                # Check for attachments (images/videos)
                media_url = None
                attachments = message_data.get("attachments", [])
                msg_type = "text"
                if attachments:
                    att = attachments[0]
                    msg_type = att.get("type", "image") # image, video, audio
                    media_url = att.get("payload", {}).get("url")
                    
                # Determine source
                lead_source = "facebook" if object_type == "page" else "instagram"
                
                # 1. FIND OR CREATE LEAD
                # Using 'phone' field to temporarily store PSID/IGSID since it's the unique sender identifier used by Meta
                lead = db.query(models.Lead).filter(
                    models.Lead.phone == sender_id, 
                    models.Lead.source == lead_source
                ).first()
                
                company_id = 1 # Default company (could be mapped by Page ID in the future)
                
                if not lead:
                    import random
                    # Try to auto-assign
                    assigned_user_id = None
                    potential_agents = db.query(models.User).join(models.Role).filter(
                        models.User.company_id == company_id,
                        models.Role.name.in_(["asesor", "vendedor"])
                    ).all()

                    if potential_agents:
                        assigned_user_id = random.choice(potential_agents).id

                    lead = models.Lead(
                        name=f"Usuario de {lead_source.capitalize()}",
                        phone=sender_id, # PSID
                        email=f"{sender_id}@{lead_source}.com", # Placeholder
                        source=lead_source,
                        status="new",
                        company_id=company_id,
                        assigned_to_id=assigned_user_id
                    )
                    db.add(lead)
                    db.commit()
                    db.refresh(lead)
                    print(f"Nuevo Lead creado desde {lead_source}: {lead.id}")
                    
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
                # Check if message already exists (Meta sometimes retries)
                existing_msg = db.query(models.Message).filter(models.Message.whatsapp_message_id == msg_id).first()
                if not existing_msg:
                    new_msg = models.Message(
                        conversation_id=conversation.id,
                        sender_type="lead",
                        content=content,
                        media_url=media_url,
                        message_type=msg_type,
                        whatsapp_message_id=msg_id, # reusing this field for MID
                        status="delivered"
                    )
                    db.add(new_msg)
                    
                    conversation.last_message_at = datetime.datetime.utcnow()
                    db.commit()

        return {"status": "processed"}
        
    except Exception as e:
        print(f"Error processing Meta webhook: {e}")
        return {"status": "error", "detail": str(e)}

# --- API ENDPOINTS FOR FRONTEND ---

@router.get("/conversations", response_model=List[schemas_whatsapp.Conversation])
def get_conversations(source: str = "facebook", db: Session = Depends(get_db)):
    """ Returns conversations linked to leads of a specific source (facebook/instagram) """
    return db.query(models.Conversation).join(models.Lead).filter(models.Lead.source == source).order_by(models.Conversation.last_message_at.desc()).all()

@router.get("/conversations/{conversation_id}/messages", response_model=List[schemas_whatsapp.Message])
def get_messages(conversation_id: int, db: Session = Depends(get_db)):
    return db.query(models.Message).filter(models.Message.conversation_id == conversation_id).order_by(models.Message.created_at.asc()).all()

@router.post("/conversations/{conversation_id}/send")
def send_message(conversation_id: int, message: schemas_whatsapp.MessageCreate, db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation or not conversation.lead:
        raise HTTPException(status_code=404, detail="Conversation or Lead not found")
        
    lead_id_psid = conversation.lead.phone # Stored PSID/IGSID here
    
    # Retrieve Unified Meta Token
    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == conversation.company_id).first()
    token = settings.facebook_access_token if settings and settings.facebook_access_token else os.getenv("META_ACCESS_TOKEN")
    
    if not token:
        raise HTTPException(status_code=400, detail="Meta Access Token no configurado en Integraciones.")

    # Call Meta Graph API
    url = "https://graph.facebook.com/v18.0/me/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "recipient": {"id": lead_id_psid},
        "message": {"text": message.content}
    }
    
    msg_status = "failed"
    meta_msg_id = None
    
    try:
        import requests
        response = requests.post(url, json=payload, headers=headers)
        resp_data = response.json()
        
        if response.status_code in [200, 201]:
            msg_status = "sent"
            meta_msg_id = resp_data.get("message_id")
        else:
            print(f"Meta API Error: {resp_data}")
            
    except Exception as e:
        print(f"Error enviando a Meta: {e}")

    new_msg = models.Message(
        conversation_id=conversation_id,
        sender_type="user",
        content=message.content,
        message_type="text",
        status=msg_status,
        whatsapp_message_id=meta_msg_id # Reusing to store Meta ID
    )
    db.add(new_msg)
    
    conversation.last_message_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(new_msg)
    
    return new_msg

