
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
from bot_integration import (
    process_channel_bot_message,
    store_conversation_message,
    normalize_phone,
    phone_variants_for_lookup,
)
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


def get_whatsapp_credentials(db: Session, company_id: int) -> tuple[str, str]:
    settings = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.company_id == company_id
    ).first()

    token = settings.whatsapp_api_key if settings and settings.whatsapp_api_key else os.getenv("WHATSAPP")
    phone_number_id = settings.whatsapp_phone_number_id if settings and settings.whatsapp_phone_number_id else os.getenv("WHATSAPP_PHONE_ID")

    if not token or not phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp no está configurado completamente")

    return token, phone_number_id


def send_whatsapp_payload(token: str, phone_number_id: str, payload: dict) -> str:
    response = requests.post(
        f"https://graph.facebook.com/v17.0/{phone_number_id}/messages",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        json=payload,
        timeout=45
    )
    resp_data = response.json()
    if response.status_code not in [200, 201]:
        raise HTTPException(
            status_code=400,
            detail=resp_data.get("error", {}).get("message", "WhatsApp API Error")
        )
    return resp_data.get("messages", [{}])[0].get("id")


def normalize_media_url(raw_url: Optional[str], request: Request) -> Optional[str]:
    if not raw_url:
        return None

    raw = str(raw_url).strip()
    if not raw:
        return None

    origin = request.headers.get("origin")
    if not origin:
        origin = f"{request.url.scheme}://{request.headers.get('host')}"

    if raw.startswith("data:") or raw.startswith("blob:"):
        return None

    if raw.startswith("http://localhost") or raw.startswith("http://127.0.0.1"):
        path = raw.split("/", 3)[-1] if "/" in raw else raw
        raw = f"/{path}" if not str(path).startswith("/") else str(path)

    if raw.startswith("http://") or raw.startswith("https://"):
        if "/api/api/static/" in raw:
            return raw.replace("/api/api/static/", "/api/static/")
        if "/static/" in raw and "/api/static/" not in raw:
            return raw.replace("/static/", "/api/static/")
        return raw

    if raw.startswith("/api/"):
        return f"{origin}{raw.replace('/api/api/static/', '/api/static/')}"
    if raw.startswith("api/"):
        normalized = f"/{raw}".replace("/api/api/static/", "/api/static/")
        return f"{origin}{normalized}"
    if raw.startswith("/static/"):
        return f"{origin}/api{raw}"
    if raw.startswith("static/"):
        return f"{origin}/api/{raw}"
    if not "/" in raw:
        return f"{origin}/api/static/{raw}"

    return f"{origin}{raw if raw.startswith('/') else f'/{raw}'}"


def build_public_vehicle_url(vehicle_id: int, request: Request) -> str:
    origin = request.headers.get("origin")
    if not origin:
        origin = f"{request.url.scheme}://{request.headers.get('host')}"
    return f"{origin}/crm/autos/{vehicle_id}"


def build_vehicle_share_message(vehicle: models.Vehicle, request: Request, custom_message: Optional[str] = None) -> str:
    masked_plate = f"***{str(vehicle.plate).strip()[-3:].upper()}" if vehicle.plate else "No especificada"
    price_text = f"${vehicle.price:,.0f}".replace(",", ".") if vehicle.price else "$0"
    mileage_text = f"{int(vehicle.mileage):,} km".replace(",", ".") if vehicle.mileage else "No especificado"

    lines = []
    if custom_message and custom_message.strip():
        lines.extend([custom_message.strip(), ""])
    else:
        lines.extend(["Hola, te comparto este vehículo disponible en AutosQP:", ""])

    lines.extend([
        f"*{(vehicle.make or '').strip()} {(vehicle.model or '').strip()}*".strip(),
        f"Precio: {price_text}",
        f"Año: {vehicle.year or 'No especificado'}",
        f"Kilometraje: {mileage_text}",
        f"Color: {vehicle.color or 'No especificado'}",
        f"Placa: {masked_plate}",
    ])

    if vehicle.description:
        lines.extend(["", "Descripción:", vehicle.description.strip()])

    lines.extend(["", f"Ficha web: {build_public_vehicle_url(vehicle.id, request)}"])
    return "\n".join(lines)


def find_or_create_outbound_session(
    db: Session,
    company_id: int,
    to_number: str,
    phone_number_id: str,
):
    normalized_number = normalize_phone(to_number)
    variants = phone_variants_for_lookup(normalized_number) or [to_number]

    session = db.query(models.ChannelChatSession).filter(
        models.ChannelChatSession.company_id == company_id,
        models.ChannelChatSession.source == "whatsapp",
        models.ChannelChatSession.external_user_id.in_(variants)
    ).first()

    lead = db.query(models.Lead).filter(
        models.Lead.company_id == company_id,
        models.Lead.phone.in_(variants)
    ).order_by(models.Lead.created_at.desc()).first()

    now = datetime.datetime.utcnow()

    if session and session.conversation_id:
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == session.conversation_id
        ).first()
        if conversation:
            if lead and conversation.lead_id != lead.id:
                conversation.lead_id = lead.id
            if lead and session.lead_id != lead.id:
                session.lead_id = lead.id
            session.recipient_id = phone_number_id
            session.last_message_at = now
            conversation.last_message_at = now
            db.commit()
            return session, conversation

    conversation = models.Conversation(
        company_id=company_id,
        lead_id=lead.id if lead else None,
        last_message_at=now,
    )
    db.add(conversation)
    db.flush()

    if not session:
        session = models.ChannelChatSession(
            company_id=company_id,
            source="whatsapp",
            external_user_id=normalized_number or to_number,
            recipient_id=phone_number_id,
            lead_id=lead.id if lead else None,
            conversation_id=conversation.id,
            last_message_at=now,
        )
        db.add(session)
    else:
        session.recipient_id = phone_number_id
        session.lead_id = lead.id if lead else session.lead_id
        session.conversation_id = conversation.id
        session.last_message_at = now

    db.commit()
    db.refresh(session)
    db.refresh(conversation)
    return session, conversation

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


@router.post("/send-vehicle", response_model=schemas_whatsapp.VehicleShareResponse)
def send_vehicle_to_whatsapp(
    payload: schemas_whatsapp.VehicleShareRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene compañía asignada")

    normalized_number = normalize_phone(payload.to_number)
    if not normalized_number:
        raise HTTPException(status_code=400, detail="Debes ingresar un número de WhatsApp válido")

    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.id == payload.vehicle_id,
        models.Vehicle.company_id == current_user.company_id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")

    token, phone_number_id = get_whatsapp_credentials(db, current_user.company_id)
    _, conversation = find_or_create_outbound_session(
        db=db,
        company_id=current_user.company_id,
        to_number=normalized_number,
        phone_number_id=phone_number_id,
    )

    message_body = build_vehicle_share_message(vehicle, request, payload.custom_message)
    text_message_id = send_whatsapp_payload(
        token,
        phone_number_id,
        {
            "messaging_product": "whatsapp",
            "to": normalized_number.replace("+", ""),
            "type": "text",
            "text": {"body": message_body},
        }
    )
    store_conversation_message(
        db=db,
        conversation=conversation,
        sender_type="user",
        content=message_body,
        message_type="text",
        external_message_id=text_message_id,
        status="sent",
    )

    image_message_ids: List[str] = []
    photo_list = vehicle.photos if isinstance(vehicle.photos, list) else []
    for photo in photo_list:
        media_url = normalize_media_url(photo, request)
        if not media_url:
            continue

        image_message_id = send_whatsapp_payload(
            token,
            phone_number_id,
            {
                "messaging_product": "whatsapp",
                "to": normalized_number.replace("+", ""),
                "type": "image",
                "image": {"link": media_url},
            }
        )
        image_message_ids.append(image_message_id)
        store_conversation_message(
            db=db,
            conversation=conversation,
            sender_type="user",
            content=f"Foto de {(vehicle.make or '').strip()} {(vehicle.model or '').strip()}".strip(),
            message_type="image",
            media_url=media_url,
            external_message_id=image_message_id,
            status="sent",
        )

    conversation.last_message_at = datetime.datetime.utcnow()
    db.commit()

    return schemas_whatsapp.VehicleShareResponse(
        to_number=normalized_number,
        sent_messages=1 + len(image_message_ids),
        text_message_id=text_message_id,
        image_message_ids=image_message_ids,
    )
