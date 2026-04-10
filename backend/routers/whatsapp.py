
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models, schemas_whatsapp, auth_utils
from typing import List, Optional
import os
import json
import datetime
import requests
from bot_integration import process_channel_bot_message, store_conversation_message
from dependencies import get_current_user

router = APIRouter(
    prefix="/whatsapp",
    tags=["whatsapp"]
)


def get_verify_token() -> str:
    return os.getenv("WHATSAPP_VERIFY_TOKEN", "autosqp_webhook_secret")


def resolve_company_id(db: Session, phone_number_id: Optional[str], from_number: str) -> int:
    existing_session = db.query(models.ChannelChatSession).filter(
        models.ChannelChatSession.source == "whatsapp",
        models.ChannelChatSession.external_user_id == from_number
    ).first()
    if existing_session and existing_session.company_id:
        return existing_session.company_id

    existing_lead = db.query(models.Lead).filter(
        models.Lead.source == "whatsapp",
        models.Lead.phone.in_([from_number, f"+{from_number}", f"+57{from_number[-10:]}"])
    ).order_by(models.Lead.created_at.desc()).first()
    if existing_lead and existing_lead.company_id:
        return existing_lead.company_id

    if phone_number_id:
        settings = db.query(models.IntegrationSettings).filter(
            models.IntegrationSettings.whatsapp_phone_number_id == phone_number_id
        ).first()
        if settings and settings.company_id:
            return settings.company_id

    configured = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.whatsapp_api_key.isnot(None)
    ).all()
    if len(configured) == 1:
        return configured[0].company_id

    company = db.query(models.Company).order_by(models.Company.id.asc()).first()
    if not company:
        raise HTTPException(status_code=400, detail="No hay compañias registradas para asignar mensajes de WhatsApp")
    return company.id


def send_whatsapp_text_reply(
    db: Session,
    company_id: int,
    to_number: str,
    content: str
) -> tuple[Optional[str], str]:
    settings = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.company_id == company_id
    ).first()

    token = settings.whatsapp_api_key if settings and settings.whatsapp_api_key else os.getenv("WHATSAPP")
    phone_number_id = settings.whatsapp_phone_number_id if settings and settings.whatsapp_phone_number_id else os.getenv("WHATSAPP_PHONE_ID")

    if not token or not phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp no está configurado completamente")

    response = requests.post(
        f"https://graph.facebook.com/v17.0/{phone_number_id}/messages",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json={
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {"body": content}
        },
        timeout=45
    )
    resp_data = response.json()
    if response.status_code not in [200, 201]:
        raise HTTPException(status_code=400, detail=resp_data.get("error", {}).get("message", "WhatsApp API Error"))

    return resp_data.get("messages", [{}])[0].get("id"), "sent"

# --- WEBHOOK VERIFICATION (GET) ---
@router.get("/webhook", include_in_schema=False, response_class=PlainTextResponse)
async def verify_webhook_raw(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    VERIFY_TOKEN = get_verify_token()
    
    if mode and token:
        if mode == "subscribe" and token == VERIFY_TOKEN:
            print("WEBHOOK_VERIFIED")
            return challenge or ""
        else:
             raise HTTPException(status_code=403, detail="Verification failed")
    
    raise HTTPException(status_code=400, detail="Missing webhook verification params")

# --- WEBHOOK EVENTS (POST) ---
@router.post("/webhook")
async def receive_whatsapp_message(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        print("WA_WEBHOOK_PAYLOAD:", json.dumps(data, indent=2))

        processed = 0
        for entry in data.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                contacts = value.get("contacts", [])
                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id")
                messages = value.get("messages", [])

                for msg_data in messages:
                    from_number = msg_data.get("from")
                    msg_type = msg_data.get("type")
                    msg_id = msg_data.get("id")
                    if not from_number or not msg_id:
                        continue

                    timestamp = msg_data.get("timestamp")
                    created_at = None
                    if timestamp:
                        try:
                            created_at = datetime.datetime.utcfromtimestamp(int(timestamp))
                        except Exception:
                            created_at = None

                    content = ""
                    media_url = None
                    if msg_type == "text":
                        content = msg_data.get("text", {}).get("body", "")
                    elif msg_type == "image":
                        content = msg_data.get("image", {}).get("caption", "")
                        media_url = msg_data.get("image", {}).get("id")
                    elif msg_type == "document":
                        content = msg_data.get("document", {}).get("caption", "")
                        media_url = msg_data.get("document", {}).get("id")
                    elif msg_type == "audio":
                        media_url = msg_data.get("audio", {}).get("id")
                    elif msg_type == "video":
                        content = msg_data.get("video", {}).get("caption", "")
                        media_url = msg_data.get("video", {}).get("id")

                    if not content:
                        content = f"El cliente envió un archivo de tipo {msg_type}."

                    company_id = resolve_company_id(db, phone_number_id, from_number)
                    result = process_channel_bot_message(
                        db=db,
                        company_id=company_id,
                        source="whatsapp",
                        external_user_id=from_number,
                        recipient_id=phone_number_id,
                        user_message=content,
                        external_message_id=msg_id,
                        message_type=msg_type or "text",
                        media_url=media_url,
                        created_at=created_at,
                    )

                    if result.get("duplicate") or not result.get("assistant_reply"):
                        continue

                    outbound_status = "failed"
                    outbound_id = None
                    try:
                        outbound_id, outbound_status = send_whatsapp_text_reply(
                            db=db,
                            company_id=company_id,
                            to_number=from_number,
                            content=result["assistant_reply"],
                        )
                    except Exception as send_exc:
                        print(f"Error sending WhatsApp bot reply: {send_exc}")

                    store_conversation_message(
                        db=db,
                        conversation=result["conversation"],
                        sender_type="user",
                        content=result["assistant_reply"],
                        message_type="text",
                        external_message_id=outbound_id,
                        status=outbound_status,
                    )
                    processed += 1

        return {"status": "processed", "messages": processed}
        
    except Exception as e:
        print(f"Error processing webhook: {e}")
        return {"status": "error", "detail": str(e)}

# --- API ENDPOINTS FOR FRONTEND ---

@router.get("/conversations", response_model=List[schemas_whatsapp.Conversation])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    session_query = db.query(models.ChannelChatSession).options(
        joinedload(models.ChannelChatSession.conversation).joinedload(models.Conversation.lead)
    ).filter(
        models.ChannelChatSession.source == "whatsapp",
        models.ChannelChatSession.conversation_id.isnot(None)
    )
    if current_user.company_id:
        session_query = session_query.filter(models.ChannelChatSession.company_id == current_user.company_id)

    chat_sessions = session_query.order_by(models.ChannelChatSession.last_message_at.desc()).all()
    conversations = []
    for chat_session in chat_sessions:
        conversation = chat_session.conversation
        if not conversation:
            continue
        conversations.append({
            "id": conversation.id,
            "lead_id": conversation.lead_id,
            "company_id": conversation.company_id,
            "last_message_at": conversation.last_message_at,
            "lead": conversation.lead,
            "external_user_id": chat_session.external_user_id,
        })
    return conversations

@router.get("/conversations/{conversation_id}/messages", response_model=List[schemas_whatsapp.Message])
def get_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.company_id and conversation.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="No autorizado para esta conversacion")
    return db.query(models.Message).filter(models.Message.conversation_id == conversation_id).order_by(models.Message.created_at.asc()).all()

@router.post("/conversations/{conversation_id}/send")
def send_message(
    conversation_id: int,
    message: schemas_whatsapp.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    conversation = db.query(models.Conversation).options(
        joinedload(models.Conversation.lead)
    ).filter(models.Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.company_id and conversation.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="No autorizado para esta conversacion")

    chat_session = db.query(models.ChannelChatSession).filter(
        models.ChannelChatSession.source == "whatsapp",
        models.ChannelChatSession.conversation_id == conversation_id
    ).first()
    lead_phone = conversation.lead.phone if conversation.lead and conversation.lead.phone else (chat_session.external_user_id if chat_session else None)
    if not lead_phone:
        raise HTTPException(status_code=404, detail="Conversation recipient not found")
    
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
