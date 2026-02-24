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

@router.post("/sync-historical")
def sync_historical_messages(source: str = "facebook", db: Session = Depends(get_db)):
    """ 
    Trae los mensajes pasados desde Meta Graph API y los guarda en la BD.
    Se asume que la compañía es la default (1) por ahora, o buscar por Token.
    """
    company_id = 1
    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
    
    token = None
    if source == "instagram":
        token = settings.instagram_access_token
    elif source == "facebook":
        token = settings.facebook_access_token
        
    # Global fallback if not configured in DB (for dev purposes)
    if not token:
        token = os.getenv("META_ACCESS_TOKEN")
        
    if not token:
        raise HTTPException(status_code=400, detail=f"No hay token configurado para {source}")

    import requests
    from datetime import datetime as dt
    
    # Platform parameter 'platform=instagram' is required to fetch IG messages.
    base_url = f"https://graph.facebook.com/v18.0/me/conversations"
    params = {
        "fields": "id,updated_time,participants,messages.limit(50){id,message,created_time,from,to,attachments}",
        "access_token": token,
        "limit": 50,
        "platform": "instagram" if source == "instagram" else "messenger"
    }
    
    try:
        synced_count = 0
        new_leads_count = 0
        
        has_next = True
        while has_next and new_leads_count < 1000: # Soft stop at 1000 leads to prevent infinite loop memory issues
            response = requests.get(base_url, params=params)
            data = response.json()
            
            if response.status_code != 200 or "error" in data:
                error_msg = data.get("error", {}).get("message", "Error from Meta API")
                raise HTTPException(status_code=400, detail=error_msg)
                
            conversations_data = data.get("data", [])
            if not conversations_data:
                break
                
            for conv in conversations_data:
                participants = conv.get("participants", {}).get("data", [])
                if not participants:
                    continue
                
                # Identificar al cliente (el que NO es la Page)
                # Como no sabemos siempre el Page ID, asumiremos que si son 2, el que no mandó el último msg o simplemente agarramos el primero que tenga email/nombre raro
                client = None
                for p in participants:
                    # Often the page name is known or we just pick the one that sent a message
                    client = p
                
                if len(participants) == 2:
                    # We assume the Page is one of them. For simplicity, we create lead with the participant info.
                    client = participants[0] # Very naive approach, usually we exclude the Page ID.
                    # In Graph API, usually Participants[0] is the user, Participants[1] is the Page.
                
                sender_id = client.get("id")
                sender_name = client.get("name", "Usuario Desconocido")
            
                # Buscar o crear Lead
                lead = db.query(models.Lead).filter(
                    models.Lead.phone == sender_id, 
                    models.Lead.source == source
                ).first()
            
                if not lead:
                    import random
                    assigned_user_id = None
                    potential_agents = db.query(models.User).join(models.Role).filter(
                        models.User.company_id == company_id,
                        models.Role.name.in_(["asesor", "vendedor"])
                    ).all()

                    if potential_agents:
                        assigned_user_id = random.choice(potential_agents).id

                    lead = models.Lead(
                        name=sender_name,
                        phone=sender_id,
                        source=source,
                        status="new",
                        company_id=company_id,
                        assigned_to_id=assigned_user_id
                    )
                    db.add(lead)
                    db.commit()
                    db.refresh(lead)
                    new_leads_count += 1
                
                # Buscar o crear Conversación
                conversation = db.query(models.Conversation).filter(models.Conversation.lead_id == lead.id).first()
                if not conversation:
                    conversation = models.Conversation(
                        lead_id=lead.id,
                        company_id=company_id,
                        last_message_at=datetime.datetime.utcnow()
                    )
                    db.add(conversation)
                    db.commit()
                    db.refresh(conversation)
                
                # Procesar mensajes de esta conversación
                messages_data = conv.get("messages", {}).get("data", [])
                for msg in reversed(messages_data): # From oldest to newest
                    meta_msg_id = msg.get("id")
                
                    # Check if exists
                    existing_msg = db.query(models.Message).filter(models.Message.whatsapp_message_id == meta_msg_id).first()
                    if existing_msg:
                        continue # Already synced
                    
                    content = msg.get("message", "")
                    created_time_str = msg.get("created_time")
                
                    # Meta API returns ISO 8601 like: 2024-02-22T10:00:00+0000
                    if created_time_str:
                        try:
                            # Python 3.11+ supports ISO format directly, but we can clean it up just in case
                            clean_time_str = created_time_str.replace('+0000', '+00:00')
                            created_time = dt.fromisoformat(clean_time_str).replace(tzinfo=None)
                        except ValueError:
                            created_time = datetime.datetime.utcnow()
                    else:
                        created_time = datetime.datetime.utcnow()
                
                    msg_from_id = msg.get("from", {}).get("id")
                
                    # Determine sender
                    sender_type = "lead" if msg_from_id == sender_id else "user"
                
                    new_msg = models.Message(
                        conversation_id=conversation.id,
                        sender_type=sender_type,
                        content=content,
                        message_type="text",
                        status="delivered",
                        whatsapp_message_id=meta_msg_id,
                        created_at=created_time
                    )
                    db.add(new_msg)
                    synced_count += 1
                
                # Update last action
                updated_time_str = conv.get("updated_time")
                if updated_time_str:
                    try:
                        clean_upd_time = updated_time_str.replace('+0000', '+00:00')
                        conversation.last_message_at = dt.fromisoformat(clean_upd_time).replace(tzinfo=None)
                    except ValueError:
                       conversation.last_message_at = datetime.datetime.utcnow()
                else:
                    conversation.last_message_at = datetime.datetime.utcnow()
            
            db.commit()
            
            # Meta Pagination: extract from 'next' URL to preserve our custom params safely
            paging = data.get("paging", {})
            next_url = paging.get("next")
            if next_url:
                import urllib.parse as urlparse
                from urllib.parse import parse_qs
                parsed = urlparse.urlparse(next_url)
                qs = parse_qs(parsed.query)
                
                # Forward any new pagination keys from Meta into our next request parameters
                for key, val in qs.items():
                    if key not in ["access_token", "limit", "platform", "fields"]:
                        params[key] = val[0]
            else:
                has_next = False
            
        return {"status": "success", "synced_messages": synced_count, "new_leads": new_leads_count}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error syncing Meta: {e}")
        raise HTTPException(status_code=500, detail=str(e))

