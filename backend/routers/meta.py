from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user
import models, schemas_whatsapp
import datetime
import json
import os
from typing import List, Optional

router = APIRouter(
    prefix="/meta",
    tags=["meta"]
)


def get_verify_token() -> str:
    return os.getenv("META_VERIFY_TOKEN", "autosqp_meta_secret")


def get_target_company_id(db: Session, current_user: models.User, company_id: Optional[int] = None) -> int:
    """
    Resolve company scope:
    - Company users: always their own company.
    - Global super admin: may pass company_id; otherwise first company.
    """
    if current_user.company_id:
        return current_user.company_id

    if company_id:
        company = db.query(models.Company).filter(models.Company.id == company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Compania no encontrada")
        return company.id

    first_company = db.query(models.Company).order_by(models.Company.id.asc()).first()
    if not first_company:
        raise HTTPException(status_code=400, detail="No hay companias registradas")
    return first_company.id


def resolve_company_id(db: Session, sender_id: str, recipient_id: str, source: str) -> int:
    # 1) Reuse company from existing lead for this sender/source.
    existing_lead = db.query(models.Lead).filter(
        models.Lead.phone == sender_id,
        models.Lead.source == source
    ).first()
    if existing_lead and existing_lead.company_id:
        return existing_lead.company_id

    # 2) If recipient id matches a configured integration value, use that company.
    # NOTE: This reuses facebook_pixel_id as recipient-id mapping fallback.
    if recipient_id:
        by_pixel = db.query(models.IntegrationSettings).filter(
            models.IntegrationSettings.facebook_pixel_id == recipient_id
        ).first()
        if by_pixel and by_pixel.company_id:
            return by_pixel.company_id

    # 3) If only one company has Meta token configured, use it.
    token_integrations = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.facebook_access_token.isnot(None)
    ).all()
    if len(token_integrations) == 1:
        return token_integrations[0].company_id

    # 4) Fallback to first company.
    company = db.query(models.Company).order_by(models.Company.id.asc()).first()
    if not company:
        raise HTTPException(status_code=400, detail="No hay companias registradas para asignar leads de Meta")
    return company.id


@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Verificacion del Webhook requerido por Meta (Facebook/Instagram).
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    verify_token = get_verify_token()

    if mode and token:
        if mode == "subscribe" and token == verify_token:
            print("META_WEBHOOK_VERIFIED")
            return PlainTextResponse(content=challenge or "", status_code=200)
        raise HTTPException(status_code=403, detail="Verification failed")

    return {"status": "ok"}


@router.post("/webhook")
async def receive_meta_message(request: Request, db: Session = Depends(get_db)):
    """
    Recepcion de mensajes desde Facebook Messenger o Instagram Direct.
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
            # Instagram can also send changes payloads depending on subscription.
            changes = ent.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                for msg in value.get("messages", []):
                    messaging_events.append({
                        "sender": {"id": msg.get("from")},
                        "recipient": {"id": value.get("id")},
                        "message": {
                            "mid": msg.get("id"),
                            "text": msg.get("text", {}).get("body", "") if isinstance(msg.get("text"), dict) else msg.get("text", ""),
                            "attachments": msg.get("attachments", []),
                            "is_echo": False
                        }
                    })

            for event in messaging_events:
                if "message" not in event:
                    continue

                sender_id = event.get("sender", {}).get("id")
                recipient_id = event.get("recipient", {}).get("id")
                if not sender_id:
                    continue

                message_data = event.get("message", {})
                if message_data.get("is_echo"):
                    continue

                content = message_data.get("text", "")
                msg_id = message_data.get("mid")
                if not msg_id:
                    continue

                media_url = None
                attachments = message_data.get("attachments", [])
                msg_type = "text"
                if attachments:
                    att = attachments[0]
                    msg_type = att.get("type", "image")
                    media_url = att.get("payload", {}).get("url")

                lead_source = "facebook" if object_type == "page" else "instagram"
                company_id = resolve_company_id(db, sender_id, recipient_id, lead_source)

                lead = db.query(models.Lead).filter(
                    models.Lead.phone == sender_id,
                    models.Lead.source == lead_source,
                    models.Lead.company_id == company_id
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
                        name=f"Usuario de {lead_source.capitalize()}",
                        phone=sender_id,
                        email=f"{sender_id}@{lead_source}.com",
                        source=lead_source,
                        status="new",
                        company_id=company_id,
                        assigned_to_id=assigned_user_id,
                        message=content or None
                    )
                    db.add(lead)
                    db.commit()
                    db.refresh(lead)
                    print(f"Nuevo Lead creado desde {lead_source}: {lead.id}")

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

                existing_msg = db.query(models.Message).filter(models.Message.whatsapp_message_id == msg_id).first()
                if not existing_msg:
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
                    conversation.last_message_at = datetime.datetime.utcnow()
                    db.commit()

        return {"status": "processed"}

    except Exception as e:
        print(f"Error processing Meta webhook: {e}")
        return {"status": "error", "detail": str(e)}


# --- API ENDPOINTS FOR FRONTEND ---

@router.get("/conversations", response_model=List[schemas_whatsapp.Conversation])
def get_conversations(
    source: str = "facebook",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Returns conversations linked to leads of a specific source (facebook/instagram)."""
    query = db.query(models.Conversation).join(models.Lead).filter(models.Lead.source == source)
    if current_user.company_id:
        query = query.filter(models.Conversation.company_id == current_user.company_id)
    return query.order_by(models.Conversation.last_message_at.desc()).all()


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
    conversation = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if not conversation or not conversation.lead:
        raise HTTPException(status_code=404, detail="Conversation or Lead not found")
    if current_user.company_id and conversation.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="No autorizado para esta conversacion")

    lead_id_psid = conversation.lead.phone  # Stored PSID/IGSID here

    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == conversation.company_id).first()
    lead_source = (conversation.lead.source or "").lower()

    token = None
    if settings:
        if lead_source == "instagram":
            token = settings.instagram_access_token
        else:
            token = settings.facebook_access_token

    if not token:
        token = os.getenv("META_ACCESS_TOKEN")

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
        whatsapp_message_id=meta_msg_id  # Reusing field for Meta ID
    )
    db.add(new_msg)

    conversation.last_message_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(new_msg)

    return new_msg


@router.post("/sync-historical")
def sync_historical_messages(
    source: str = "facebook",
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Trae mensajes pasados desde Meta Graph API y los guarda en la BD.
    Se ejecuta por empresa autenticada (o company_id para super admin global).
    """
    target_company_id = get_target_company_id(db, current_user, company_id)

    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == target_company_id).first()

    token = None
    if settings:
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

    base_url = "https://graph.facebook.com/v18.0/me/conversations"
    params = {
        "fields": "id,updated_time,participants,messages.limit(50){id,message,created_time,from,to,attachments}",
        "access_token": token,
        "limit": 50,
        "platform": "instagram" if source == "instagram" else "messenger"
    }

    try:
        synced_count = 0
        new_leads_count = 0

        own_account_id = None
        try:
            me_resp = requests.get(
                "https://graph.facebook.com/v18.0/me",
                params={"fields": "id,name", "access_token": token}
            )
            me_data = me_resp.json()
            if me_resp.status_code == 200 and me_data.get("id"):
                own_account_id = str(me_data.get("id"))
        except Exception:
            own_account_id = None

        has_next = True
        while has_next and new_leads_count < 1000:
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

                client = None
                if own_account_id:
                    for p in participants:
                        pid = str(p.get("id", ""))
                        if pid and pid != own_account_id:
                            client = p
                            break

                if not client:
                    # Fallback if owner id is unavailable
                    client = participants[0]

                sender_id = client.get("id")
                sender_name = client.get("name", "Usuario Desconocido")
                if not sender_id:
                    continue

                lead = db.query(models.Lead).filter(
                    models.Lead.phone == sender_id,
                    models.Lead.source == source,
                    models.Lead.company_id == target_company_id
                ).first()

                if not lead:
                    import random
                    assigned_user_id = None
                    potential_agents = db.query(models.User).join(models.Role).filter(
                        models.User.company_id == target_company_id,
                        models.Role.name.in_(["asesor", "vendedor"])
                    ).all()

                    if potential_agents:
                        assigned_user_id = random.choice(potential_agents).id

                    lead = models.Lead(
                        name=sender_name,
                        phone=sender_id,
                        source=source,
                        status="new",
                        company_id=target_company_id,
                        assigned_to_id=assigned_user_id
                    )
                    db.add(lead)
                    db.commit()
                    db.refresh(lead)
                    new_leads_count += 1

                conversation = db.query(models.Conversation).filter(models.Conversation.lead_id == lead.id).first()
                if not conversation:
                    conversation = models.Conversation(
                        lead_id=lead.id,
                        company_id=target_company_id,
                        last_message_at=datetime.datetime.utcnow()
                    )
                    db.add(conversation)
                    db.commit()
                    db.refresh(conversation)

                messages_data = conv.get("messages", {}).get("data", [])
                for msg in reversed(messages_data):
                    meta_msg_id = msg.get("id")
                    if not meta_msg_id:
                        continue

                    existing_msg = db.query(models.Message).filter(models.Message.whatsapp_message_id == meta_msg_id).first()
                    if existing_msg:
                        continue

                    content = msg.get("message", "")
                    created_time_str = msg.get("created_time")

                    if created_time_str:
                        try:
                            clean_time_str = created_time_str.replace('+0000', '+00:00')
                            created_time = dt.fromisoformat(clean_time_str).replace(tzinfo=None)
                        except ValueError:
                            created_time = datetime.datetime.utcnow()
                    else:
                        created_time = datetime.datetime.utcnow()

                    msg_from_id = msg.get("from", {}).get("id")
                    sender_type = "lead" if str(msg_from_id) == str(sender_id) else "user"

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

            paging = data.get("paging", {})
            next_url = paging.get("next")
            if next_url:
                import urllib.parse as urlparse
                from urllib.parse import parse_qs
                parsed = urlparse.urlparse(next_url)
                qs = parse_qs(parsed.query)

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

