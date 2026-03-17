import datetime
import json
import os
import random
import re
from typing import Any, Dict, Optional

import requests
from sqlalchemy.orm import Session

import models


DIRECT_CONTACT_NUMBER = "3227704222"
FACEBOOK_BOT_REPLY_WINDOW = datetime.timedelta(days=1)


def get_company_ai_settings(db: Session, company_id: Optional[int]) -> tuple[Optional[str], str]:
    model_name = "gpt-4o-mini"
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip() or None
    if company_id:
        settings = db.query(models.IntegrationSettings).filter(
            models.IntegrationSettings.company_id == company_id
        ).first()
        if settings:
            if settings.openai_api_key and settings.openai_api_key.strip():
                api_key = settings.openai_api_key.strip()
            if settings.gw_model:
                model_name = settings.gw_model
    return api_key, model_name


def get_company_chatbot_settings(db: Session, company_id: Optional[int]) -> tuple[str, int, int]:
    bot_name = "Jennifer Quimbayo"
    typing_min_ms = 7000
    typing_max_ms = 18000

    if company_id:
        settings = db.query(models.IntegrationSettings).filter(
            models.IntegrationSettings.company_id == company_id
        ).first()
        if settings:
            if settings.chatbot_bot_name and settings.chatbot_bot_name.strip():
                bot_name = settings.chatbot_bot_name.strip()
            if settings.chatbot_typing_min_ms is not None:
                typing_min_ms = int(settings.chatbot_typing_min_ms)
            if settings.chatbot_typing_max_ms is not None:
                typing_max_ms = int(settings.chatbot_typing_max_ms)

    typing_min_ms = max(0, typing_min_ms)
    typing_max_ms = max(typing_min_ms, typing_max_ms)
    return bot_name, typing_min_ms, typing_max_ms


def call_openai_chat(api_key: str, model_name: str, messages: list[Dict[str, str]]) -> str:
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "messages": messages,
            "temperature": 0.5,
        },
        timeout=45,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()


def call_openai_chat_with_fallback(
    primary_key: str,
    model_name: str,
    messages: list[Dict[str, str]],
    fallback_key: Optional[str],
) -> str:
    try:
        return call_openai_chat(primary_key, model_name, messages)
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        if status_code == 401 and fallback_key and fallback_key.strip() and fallback_key.strip() != primary_key.strip():
            return call_openai_chat(fallback_key.strip(), model_name, messages)
        raise


def extract_prospect_data_with_ai(api_key: str, model_name: str, full_conversation: str) -> Dict[str, Any]:
    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Extrae datos de prospecto de conversación de compra de autos. "
                        "Responde SOLO JSON con estas claves exactas: "
                        "name, phone, email, interested_vehicle, payment_type, down_payment_amount, "
                        "has_credit_report, report_entity, has_payment_agreement, occupation_type, "
                        "residence_city, monthly_income, is_ready_to_create_lead. "
                        "Si falta un dato usa null. "
                        "El correo es opcional y si el cliente no quiere compartirlo debe quedar en null. "
                        "is_ready_to_create_lead=true solo si hay name, phone, interested_vehicle, "
                        "payment_type, down_payment_amount, occupation_type, residence_city y monthly_income. "
                        "Si has_credit_report=true tambien deben venir report_entity y has_payment_agreement."
                    ),
                },
                {"role": "user", "content": full_conversation},
            ],
            "temperature": 0,
            "response_format": {"type": "json_object"},
        },
        timeout=45,
    )
    response.raise_for_status()
    data = response.json()
    return json.loads(data["choices"][0]["message"]["content"])


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    if len(digits) == 10:
        return f"+57{digits}"
    if len(digits) == 12 and digits.startswith("57"):
        return f"+{digits}"
    if len(digits) > 10:
        return f"+57{digits[-10:]}"
    return None


def phone_variants_for_lookup(phone: Optional[str]) -> list[str]:
    normalized = normalize_phone(phone)
    if not normalized:
        return []
    digits = re.sub(r"\D", "", normalized)
    variants = {normalized, digits}
    if digits.startswith("57") and len(digits) == 12:
        variants.add(digits[2:])
        variants.add(f"+{digits[2:]}")
    return list(variants)


def upsert_lead_process_detail(db: Session, lead_id: int, interested_vehicle: str):
    detail = db.query(models.LeadProcessDetail).filter(models.LeadProcessDetail.lead_id == lead_id).first()
    if detail:
        if interested_vehicle and detail.desired_vehicle != interested_vehicle:
            detail.has_vehicle = False
            detail.desired_vehicle = interested_vehicle
    else:
        detail = models.LeadProcessDetail(
            lead_id=lead_id,
            desired_vehicle=interested_vehicle or None,
            has_vehicle=False,
        )
        db.add(detail)
    db.commit()


def is_inventory_request(message: str) -> bool:
    text = (message or "").strip().lower()
    triggers = [
        "que carros tenemos",
        "qué carros tenemos",
        "que autos tienen",
        "qué autos tienen",
        "que vehiculos tienen",
        "qué vehículos tienen",
        "carros disponibles",
        "autos disponibles",
        "vehiculos disponibles",
        "inventario",
    ]
    return any(trigger in text for trigger in triggers)


def build_inventory_response(db: Session, company_id: Optional[int]) -> str:
    query = db.query(models.Vehicle).filter(models.Vehicle.status == "available")
    if company_id:
        query = query.filter(models.Vehicle.company_id == company_id)
    vehicles = query.order_by(models.Vehicle.id.desc()).limit(5).all()

    if not vehicles:
        return (
            "En este momento no tengo vehículos disponibles para mostrarte en el chat. "
            "Puedes revisar el inventario completo aquí: https://autosqp.co/autos"
        )

    lines = ["Claro. Estos son 5 carros disponibles en este momento:"]
    for idx, vehicle in enumerate(vehicles, start=1):
        price = f"{vehicle.price:,}".replace(",", ".") if vehicle.price is not None else "N/A"
        lines.append(f"{idx}. {vehicle.make} {vehicle.model or ''} {vehicle.year} - COP {price}")
    lines.append("Puedes ver más opciones aquí: https://autosqp.co/autos")
    return "\n".join(lines)


def build_channel_system_prompt(bot_name: str) -> str:
    return (
        f"Eres {bot_name}, asesora comercial de AutosQP en Colombia. "
        "Habla en tono amigable, cercano y comercial. "
        "Nunca digas que eres un bot, IA o asistente automático. "
        "En tu primera respuesta de cada conversación debes presentarte exactamente como: "
        f"\"Hola, soy {bot_name}, asesora comercial de Autos QP\" y luego continuar con la asesoría. "
        "Si el cliente da nombre completo, dirígete solo por su primer nombre. "
        "Debes perfilar al cliente con preguntas claras, una por turno, en este orden: "
        "1) vehículo de interés, 2) nombre, 3) teléfono, 4) correo opcional, "
        "5) pago de contado o con crédito, 6) cuota inicial y monto, "
        "7) si tiene reportes en centrales de riesgo, "
        "8) si está reportado: con qué entidad y si tiene acuerdo de pago o paz y salvo, "
        "9) ocupación (empleado, independiente u otro), "
        "10) lugar de residencia, 11) ingresos mensuales. "
        "Si el cliente no desea dejar correo, continúa el proceso sin insistir. "
        f"Si te piden un número directo de contacto, comparte este: {DIRECT_CONTACT_NUMBER}. "
        "No inventes información ni cierres el perfilado hasta tener nombre y teléfono, y luego sigue pidiendo el resto de datos. "
        "Cuando el cliente pregunte por carros disponibles, consulta el inventario y comparte hasta 5 opciones con el enlace https://autosqp.co/autos."
    )


def find_or_create_channel_session(
    db: Session,
    company_id: int,
    source: str,
    external_user_id: str,
    recipient_id: Optional[str],
) -> tuple[models.ChannelChatSession, models.Conversation, bool, Optional[datetime.datetime]]:
    session = db.query(models.ChannelChatSession).filter(
        models.ChannelChatSession.company_id == company_id,
        models.ChannelChatSession.source == source,
        models.ChannelChatSession.external_user_id == external_user_id,
    ).first()
    existing_lead = db.query(models.Lead).filter(
        models.Lead.company_id == company_id,
        models.Lead.source == source,
        models.Lead.phone == external_user_id,
    ).first()
    is_new_contact = session is None and existing_lead is None
    previous_last_message_at = session.last_message_at if session else None

    if session and session.conversation_id:
        conversation = db.query(models.Conversation).filter(models.Conversation.id == session.conversation_id).first()
        if conversation:
            if recipient_id and session.recipient_id != recipient_id:
                session.recipient_id = recipient_id
            session.last_message_at = datetime.datetime.utcnow()
            db.commit()
            return session, conversation, False, previous_last_message_at

    conversation = models.Conversation(
        company_id=company_id,
        last_message_at=datetime.datetime.utcnow(),
        lead_id=session.lead_id if session and session.lead_id else None,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)

    if not session:
        session = models.ChannelChatSession(
            company_id=company_id,
            source=source,
            external_user_id=external_user_id,
            recipient_id=recipient_id,
            conversation_id=conversation.id,
            last_message_at=datetime.datetime.utcnow(),
        )
        db.add(session)
    else:
        session.recipient_id = recipient_id
        session.conversation_id = conversation.id
        session.last_message_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session, conversation, is_new_contact, previous_last_message_at


def store_conversation_message(
    db: Session,
    conversation: models.Conversation,
    sender_type: str,
    content: Optional[str],
    message_type: str = "text",
    media_url: Optional[str] = None,
    external_message_id: Optional[str] = None,
    status: str = "delivered",
    created_at: Optional[datetime.datetime] = None,
) -> tuple[models.Message, bool]:
    if external_message_id:
        existing = db.query(models.Message).filter(
            models.Message.whatsapp_message_id == external_message_id
        ).first()
        if existing:
            return existing, False

    message = models.Message(
        conversation_id=conversation.id,
        sender_type=sender_type,
        content=content,
        media_url=media_url,
        message_type=message_type or "text",
        whatsapp_message_id=external_message_id,
        status=status,
        created_at=created_at or datetime.datetime.utcnow(),
    )
    db.add(message)
    conversation.last_message_at = message.created_at
    db.commit()
    db.refresh(message)
    return message, True


def build_ai_history(db: Session, conversation_id: int, limit: int = 20) -> list[Dict[str, str]]:
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at.asc()).all()
    relevant_messages = messages[-limit:]
    history = []
    for message in relevant_messages:
        role = "user" if message.sender_type == "lead" else "assistant"
        content = (message.content or "").strip()
        if not content and message.media_url:
            content = f"El cliente envió un archivo de tipo {message.message_type}."
        if content:
            history.append({"role": role, "content": content})
    return history


def build_full_conversation_text(db: Session, conversation_id: int) -> str:
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation_id
    ).order_by(models.Message.created_at.asc()).all()
    lines = []
    for message in messages[-40:]:
        role = "user" if message.sender_type == "lead" else "assistant"
        content = (message.content or "").strip()
        if not content and message.media_url:
            content = f"[archivo:{message.message_type}]"
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def maybe_create_channel_lead(
    db: Session,
    chat_session: models.ChannelChatSession,
    conversation: models.Conversation,
    extracted_data: Dict[str, Any],
    source_label: str,
) -> Optional[int]:
    if chat_session.lead_id:
        return chat_session.lead_id

    name = (extracted_data.get("name") or "").strip()
    first_name = name.split(" ")[0] if name else ""
    phone = normalize_phone(extracted_data.get("phone"))
    email = (extracted_data.get("email") or "").strip() or None
    interested_vehicle = (extracted_data.get("interested_vehicle") or "").strip()
    payment_type = (extracted_data.get("payment_type") or "").strip().lower()
    down_payment_amount = extracted_data.get("down_payment_amount")
    has_credit_report = extracted_data.get("has_credit_report")
    report_entity = (extracted_data.get("report_entity") or "").strip()
    has_payment_agreement = extracted_data.get("has_payment_agreement")
    occupation_type = (extracted_data.get("occupation_type") or "").strip()
    residence_city = (extracted_data.get("residence_city") or "").strip()
    monthly_income = extracted_data.get("monthly_income")
    is_ready = bool(extracted_data.get("is_ready_to_create_lead"))

    required_core = all(
        [
            is_ready,
            name,
            first_name,
            phone,
            interested_vehicle,
            payment_type,
            down_payment_amount is not None,
            occupation_type,
            residence_city,
            monthly_income is not None,
        ]
    )
    if not required_core:
        return None

    if has_credit_report is True and not (report_entity and has_payment_agreement is not None):
        return None

    duplicate_window_days = int(os.getenv("PUBLIC_CHAT_DUPLICATE_WINDOW_DAYS", "30") or "30")
    recent_threshold = datetime.datetime.utcnow() - datetime.timedelta(days=duplicate_window_days)
    lookup_phones = phone_variants_for_lookup(phone)

    existing_lead = None
    if lookup_phones:
        existing_lead = db.query(models.Lead).filter(
            models.Lead.company_id == chat_session.company_id,
            models.Lead.phone.in_(lookup_phones),
            models.Lead.created_at >= recent_threshold,
        ).order_by(models.Lead.created_at.desc()).first()

    lead_message = (
        f"Interés detectado por chatbot {source_label}: {interested_vehicle} | "
        f"Pago: {payment_type} | Cuota inicial: {down_payment_amount} | "
        f"Ingresos: {monthly_income} | Ocupación: {occupation_type} | "
        f"Residencia: {residence_city} | Reportado: {has_credit_report} | "
        f"Entidad reporte: {report_entity or 'N/A'} | Acuerdo/Paz y salvo: {has_payment_agreement}"
    )

    if existing_lead:
        existing_lead.name = first_name or existing_lead.name
        existing_lead.phone = phone or existing_lead.phone
        existing_lead.email = email or existing_lead.email
        existing_lead.message = lead_message
        upsert_lead_process_detail(db, existing_lead.id, interested_vehicle)
        chat_session.lead_id = existing_lead.id
        conversation.lead_id = existing_lead.id
        db.commit()
        return existing_lead.id

    assigned_user_id = None
    advisors = db.query(models.User).join(models.Role).filter(
        models.User.company_id == chat_session.company_id,
        models.Role.name == "asesor",
    ).all()
    if advisors:
        assigned_user_id = random.choice(advisors).id

    new_lead = models.Lead(
        source=chat_session.source,
        name=first_name,
        phone=phone,
        email=email,
        message=lead_message,
        status=models.LeadStatus.NEW.value,
        company_id=chat_session.company_id,
        assigned_to_id=assigned_user_id,
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    upsert_lead_process_detail(db, new_lead.id, interested_vehicle)
    chat_session.lead_id = new_lead.id
    conversation.lead_id = new_lead.id
    db.commit()
    return new_lead.id


def process_channel_bot_message(
    db: Session,
    company_id: int,
    source: str,
    external_user_id: str,
    recipient_id: Optional[str],
    user_message: str,
    external_message_id: str,
    message_type: str = "text",
    media_url: Optional[str] = None,
    created_at: Optional[datetime.datetime] = None,
) -> Dict[str, Any]:
    chat_session, conversation, is_new_contact, previous_last_message_at = find_or_create_channel_session(
        db=db,
        company_id=company_id,
        source=source,
        external_user_id=external_user_id,
        recipient_id=recipient_id,
    )

    inbound_message, is_new_message = store_conversation_message(
        db=db,
        conversation=conversation,
        sender_type="lead",
        content=user_message,
        message_type=message_type,
        media_url=media_url,
        external_message_id=external_message_id,
        status="delivered",
        created_at=created_at,
    )

    if not is_new_message:
        return {
            "duplicate": True,
            "conversation": conversation,
            "chat_session": chat_session,
            "lead_id": chat_session.lead_id,
            "assistant_reply": None,
            "bot_name": get_company_chatbot_settings(db, company_id)[0],
        }

    api_key, model_name = get_company_ai_settings(db, company_id)
    env_fallback_key = (os.getenv("OPENAI_API_KEY") or "").strip() or None
    bot_name, _, _ = get_company_chatbot_settings(db, company_id)
    interaction_is_recent = (
        previous_last_message_at is not None
        and (datetime.datetime.utcnow() - previous_last_message_at) <= FACEBOOK_BOT_REPLY_WINDOW
    )
    should_auto_reply = source != "facebook" or is_new_contact or interaction_is_recent

    normalized_message = (user_message or "").strip()
    if not normalized_message and media_url:
        normalized_message = f"El cliente envió un archivo de tipo {message_type}."

    if not should_auto_reply:
        assistant_reply = None
    elif is_inventory_request(normalized_message):
        assistant_reply = build_inventory_response(db, company_id)
    elif api_key:
        system_prompt = build_channel_system_prompt(bot_name)
        chat_messages = [{"role": "system", "content": system_prompt}]
        chat_messages.extend(build_ai_history(db, conversation.id))
        try:
            assistant_reply = call_openai_chat_with_fallback(
                api_key,
                model_name,
                chat_messages,
                env_fallback_key,
            )
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 500
            if status_code == 401:
                assistant_reply = (
                    f"Hola, soy {bot_name}, asesora comercial de Autos QP. "
                    "En este momento tengo una novedad técnica, pero si quieres te ayudo por este medio "
                    f"o también puedes comunicarte al {DIRECT_CONTACT_NUMBER}."
                )
            else:
                raise
    else:
        assistant_reply = (
            f"Hola, soy {bot_name}, asesora comercial de Autos QP. "
            "Cuéntame qué carro estás buscando y te ayudo con el proceso."
        )

    lead_id = chat_session.lead_id
    if api_key and assistant_reply:
        full_text = build_full_conversation_text(db, conversation.id)
        if full_text:
            full_text = f"{full_text}\nassistant: {assistant_reply}"
        else:
            full_text = f"user: {normalized_message}\nassistant: {assistant_reply}"
        try:
            extraction_key = api_key
            if not extraction_key and env_fallback_key and env_fallback_key.strip():
                extraction_key = env_fallback_key.strip()
            extracted = extract_prospect_data_with_ai(extraction_key, model_name, full_text)
            lead_id = maybe_create_channel_lead(db, chat_session, conversation, extracted, source)
        except Exception:
            lead_id = chat_session.lead_id

    return {
        "duplicate": False,
        "conversation": conversation,
        "chat_session": chat_session,
        "lead_id": lead_id,
        "assistant_reply": assistant_reply,
        "bot_name": bot_name,
        "inbound_message_id": inbound_message.id,
        "is_new_contact": is_new_contact,
        "interaction_is_recent": interaction_is_recent,
        "should_auto_reply": should_auto_reply,
    }
