from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from database import get_db
import models
import datetime
import json
import os
import random

router = APIRouter(
    prefix="/tiktok",
    tags=["tiktok"]
)


def get_verify_token() -> str:
    return os.getenv("TIKTOK_VERIFY_TOKEN", "autosqp_tiktok_secret")


def normalize_value(value):
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned if cleaned else None


def extract_field_map(lead_item: dict) -> dict:
    result = {}
    for field in lead_item.get("fields", []) or []:
        key = normalize_value(field.get("name"))
        val = field.get("value")
        if key:
            result[key.lower()] = val
    return result


def resolve_company_id(db: Session, payload: dict, pixel_id: str = None) -> int:
    if pixel_id:
        by_pixel = db.query(models.IntegrationSettings).filter(
            models.IntegrationSettings.tiktok_pixel_id == pixel_id
        ).first()
        if by_pixel and by_pixel.company_id:
            return by_pixel.company_id

    settings = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.tiktok_access_token.isnot(None)
    ).all()
    if len(settings) == 1:
        return settings[0].company_id

    company = db.query(models.Company).order_by(models.Company.id.asc()).first()
    if not company:
        raise HTTPException(status_code=400, detail="No hay compañias para asignar leads de TikTok")
    return company.id


def find_or_create_lead(
    db: Session,
    company_id: int,
    external_id: str,
    name: str,
    phone: str,
    email: str
):
    lead = None
    if phone:
        lead = db.query(models.Lead).filter(
            models.Lead.company_id == company_id,
            models.Lead.source == "tiktok",
            models.Lead.phone == phone
        ).first()

    if not lead and email:
        lead = db.query(models.Lead).filter(
            models.Lead.company_id == company_id,
            models.Lead.source == "tiktok",
            models.Lead.email == email
        ).first()

    if not lead and external_id:
        placeholder_phone = f"tt_{external_id}"
        lead = db.query(models.Lead).filter(
            models.Lead.company_id == company_id,
            models.Lead.source == "tiktok",
            models.Lead.phone == placeholder_phone
        ).first()

    if lead:
        return lead

    assigned_user_id = None
    potential_agents = db.query(models.User).join(models.Role).filter(
        models.User.company_id == company_id,
        models.Role.name.in_(["asesor", "vendedor"])
    ).all()
    if potential_agents:
        assigned_user_id = random.choice(potential_agents).id

    lead = models.Lead(
        name=name or "Lead TikTok",
        phone=phone or (f"tt_{external_id}" if external_id else None),
        email=email,
        source="tiktok",
        status="new",
        company_id=company_id,
        assigned_to_id=assigned_user_id
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params

    # Generic verification compatibility:
    # - TikTok style: challenge / challenge_code
    # - Meta style: hub.mode / hub.verify_token / hub.challenge
    token = params.get("verify_token") or params.get("token") or params.get("hub.verify_token")
    challenge = params.get("challenge") or params.get("challenge_code") or params.get("hub.challenge")
    mode = params.get("hub.mode")

    verify_token = get_verify_token()
    if token:
        if token != verify_token:
            raise HTTPException(status_code=403, detail="Verification failed")
        if challenge:
            return PlainTextResponse(content=challenge, status_code=200)
        return {"status": "verified"}

    if mode:
        if mode == "subscribe" and params.get("hub.verify_token") == verify_token:
            return PlainTextResponse(content=challenge or "", status_code=200)
        raise HTTPException(status_code=403, detail="Verification failed")

    return {"status": "ok"}


@router.post("/webhook")
async def receive_tiktok_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Recibe eventos de TikTok y crea/actualiza leads de source=tiktok.
    Soporta payloads con listas en `leads`, `data` o evento único.
    """
    try:
        payload = await request.json()
        print("TIKTOK_WEBHOOK_PAYLOAD:", json.dumps(payload, indent=2))

        candidate_lists = []
        if isinstance(payload.get("leads"), list):
            candidate_lists.append(payload.get("leads"))
        if isinstance(payload.get("data"), list):
            candidate_lists.append(payload.get("data"))

        items = []
        for arr in candidate_lists:
            items.extend(arr)

        if not items and isinstance(payload, dict):
            items = [payload]

        processed = 0
        for item in items:
            if not isinstance(item, dict):
                continue

            fields = extract_field_map(item)
            external_id = normalize_value(item.get("lead_id") or item.get("id") or item.get("event_id"))
            name = normalize_value(
                item.get("name")
                or item.get("full_name")
                or fields.get("name")
                or fields.get("full_name")
            )
            phone = normalize_value(
                item.get("phone")
                or item.get("phone_number")
                or fields.get("phone")
                or fields.get("phone_number")
                or fields.get("telefono")
            )
            email = normalize_value(item.get("email") or fields.get("email"))
            message = normalize_value(
                item.get("message")
                or item.get("description")
                or fields.get("message")
                or fields.get("mensaje")
                or fields.get("comments")
            )
            pixel_id = normalize_value(item.get("pixel_id") or payload.get("pixel_id"))
            company_id = resolve_company_id(db, payload, pixel_id)

            lead = find_or_create_lead(db, company_id, external_id, name, phone, email)

            conversation = db.query(models.Conversation).filter(
                models.Conversation.lead_id == lead.id
            ).first()
            if not conversation:
                conversation = models.Conversation(
                    lead_id=lead.id,
                    company_id=lead.company_id,
                    last_message_at=datetime.datetime.utcnow()
                )
                db.add(conversation)
                db.commit()
                db.refresh(conversation)

            msg_key = external_id or f"tt_{lead.id}_{int(datetime.datetime.utcnow().timestamp())}"
            existing_msg = db.query(models.Message).filter(
                models.Message.whatsapp_message_id == msg_key
            ).first()
            if not existing_msg:
                db.add(models.Message(
                    conversation_id=conversation.id,
                    sender_type="lead",
                    content=message or "Nuevo lead de TikTok",
                    message_type="text",
                    status="delivered",
                    whatsapp_message_id=msg_key
                ))
                conversation.last_message_at = datetime.datetime.utcnow()
                db.commit()

            processed += 1

        return {"status": "processed", "items": processed}
    except Exception as exc:
        print(f"Error processing TikTok webhook: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

