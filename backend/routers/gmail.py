import base64
import datetime
import html
import os
import re
import shutil
import uuid
from datetime import timedelta
from io import BytesIO
from typing import Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload

import auth_utils
import models
import schemas
from database import get_db
from dependencies import get_current_user, get_effective_role_name


router = APIRouter(
    prefix="/gmail",
    tags=["gmail"]
)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
GMAIL_MESSAGE_DETAIL_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}"
GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"


def _ensure_company_admin_access(current_user: models.User, company_id: int):
    role_name = get_effective_role_name(current_user)
    if role_name not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="No autorizado para configurar Gmail")
    if current_user.company_id and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="No autorizado para esta empresa")


def _get_or_create_settings(db: Session, company_id: int) -> models.IntegrationSettings:
    settings = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.company_id == company_id
    ).first()
    if not settings:
        settings = models.IntegrationSettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _build_oauth_state(company_id: int, user_id: int) -> str:
    return auth_utils.create_access_token(
        {
            "sub": f"gmail_oauth:{user_id}",
            "company_id": company_id,
            "user_id": user_id,
            "purpose": "gmail_oauth",
        },
        expires_delta=timedelta(minutes=20),
    )


def _decode_oauth_state(state: str) -> dict:
    try:
        payload = jwt.decode(state, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=400, detail="Estado OAuth invalido o vencido") from exc
    if payload.get("purpose") != "gmail_oauth":
        raise HTTPException(status_code=400, detail="Estado OAuth invalido")
    return payload


def _exchange_code_for_tokens(settings: models.IntegrationSettings, code: str) -> dict:
    if not settings.gmail_client_id or not settings.gmail_client_secret or not settings.gmail_redirect_uri:
        raise HTTPException(status_code=400, detail="Faltan credenciales Gmail en la configuracion")

    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "redirect_uri": settings.gmail_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=20,
    )
    if not response.ok:
        raise HTTPException(status_code=400, detail=response.text or "No se pudo completar OAuth con Google")
    return response.json()


def _refresh_access_token(settings: models.IntegrationSettings) -> str:
    if not settings.gmail_refresh_token:
        raise HTTPException(status_code=400, detail="No hay refresh token configurado para Gmail")
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        raise HTTPException(status_code=400, detail="Faltan credenciales OAuth de Gmail")

    response = requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "refresh_token": settings.gmail_refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=20,
    )
    if not response.ok:
        raise HTTPException(status_code=400, detail=response.text or "No se pudo refrescar el token de Gmail")

    access_token = response.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Google no devolvio access token")
    return access_token


def _extract_header(headers: list[dict], header_name: str) -> str:
    target = header_name.lower()
    for header in headers or []:
        if (header.get("name") or "").lower() == target:
            return header.get("value") or ""
    return ""


def _normalize_text(value: Optional[str]) -> str:
    normalized = (value or "").lower().strip()
    normalized = re.sub(r"[^a-z0-9@.\s]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _decode_base64url(data: Optional[str]) -> bytes:
    if not data:
        return b""
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _strip_html(raw_html: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", raw_html or "")
    return html.unescape(re.sub(r"\s+", " ", without_tags)).strip()


def _collect_payload_parts(payload: Optional[dict]) -> list[dict]:
    if not payload:
        return []
    parts = [payload]
    for child in payload.get("parts") or []:
        parts.extend(_collect_payload_parts(child))
    return parts


def _extract_message_text(payload: Optional[dict]) -> str:
    texts = []
    for part in _collect_payload_parts(payload):
        mime_type = (part.get("mimeType") or "").lower()
        body_data = ((part.get("body") or {}).get("data")) or ""
        if not body_data:
            continue
        decoded = _decode_base64url(body_data)
        if mime_type == "text/plain":
            texts.append(decoded.decode("utf-8", errors="ignore"))
        elif mime_type == "text/html":
            texts.append(_strip_html(decoded.decode("utf-8", errors="ignore")))
    return "\n".join(texts).strip()


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    if not pdf_bytes:
        return ""
    try:
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            pages_text.append(page.extract_text() or "")
        return "\n".join(pages_text).strip()
    except Exception:
        return ""


def _download_attachment(access_token: str, message_id: str, attachment_id: str) -> bytes:
    response = requests.get(
        f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}/attachments/{attachment_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    if not response.ok:
        return b""
    return _decode_base64url(response.json().get("data"))


def _extract_attachments(access_token: str, message_payload: dict, message_id: str) -> list[dict]:
    attachments = []
    for part in _collect_payload_parts(message_payload):
        filename = (part.get("filename") or "").strip()
        body = part.get("body") or {}
        attachment_id = body.get("attachmentId")
        mime_type = (part.get("mimeType") or "").lower()
        if not filename or not attachment_id:
            continue
        content_bytes = _download_attachment(access_token, message_id, attachment_id)
        extracted_text = ""
        if mime_type == "application/pdf" or filename.lower().endswith(".pdf"):
            extracted_text = _extract_pdf_text(content_bytes)
        attachments.append({
            "file_name": filename,
            "mime_type": mime_type,
            "bytes": content_bytes,
            "text": extracted_text,
        })
    return attachments


def _credit_match_score(credit: models.CreditApplication, haystack: str) -> int:
    score = 0
    client_name = _normalize_text(getattr(credit, "client_name", None))
    phone = re.sub(r"\D+", "", getattr(credit, "phone", None) or "")
    email_value = _normalize_text(getattr(credit, "email", None))
    desired_vehicle = _normalize_text(getattr(credit, "desired_vehicle", None))

    if client_name and client_name in haystack:
        score += 8
    if phone and phone in re.sub(r"\D+", "", haystack):
        score += 6
    if email_value and email_value in haystack:
        score += 6
    if desired_vehicle and len(desired_vehicle) > 6 and desired_vehicle in haystack:
        score += 2
    return score


def _classify_credit_email_status(text: str, current_status: Optional[str]) -> Optional[str]:
    normalized = _normalize_text(text)
    if any(token in normalized for token in [
        "no viable",
        "rechazado",
        "rechazada",
        "negado",
        "negada",
        "no aprobado",
        "no aprobada",
    ]):
        return models.CreditStatus.REJECTED.value
    if any(token in normalized for token in [
        "cliente viable",
        "viable",
        "viabilidad",
        "preaprobado",
        "pre aprobada",
        "pre aprobado",
        "preaprobada",
        "aprobado",
        "aprobada",
        "aprobacion",
        "aprobación",
        "cupo de credito aprobado",
        "cupo aprobado",
        "viable para cupo",
    ]):
        return models.CreditStatus.APPROVED.value
    if any(token in normalized for token in [
        "se requiere documentacion",
        "requiere documentacion",
        "pendiente documentos",
        "faltan documentos",
        "debe firmar",
        "validar si es",
        "documentos pendientes",
    ]):
        return models.CreditStatus.IN_REVIEW.value
    return current_status


def _build_credit_email_summary(subject: str, from_value: str, body_text: str, attachment_texts: list[str]) -> str:
    source_text = "\n".join(part for part in [body_text, *attachment_texts] if part).strip()
    compact = re.sub(r"\s+", " ", source_text)
    compact = compact[:1800]
    return (
        f"Correo de entidad financiera recibido.\n"
        f"Asunto: {subject or 'Sin asunto'}\n"
        f"Remitente: {from_value or 'Sin remitente'}\n\n"
        f"{compact or 'Sin contenido legible en el correo o adjuntos.'}"
    ).strip()


def _build_credit_compact_note(from_value: str, body_text: str, snippet: str, attachment_texts: list[str]) -> str:
    source_text = body_text or snippet or ""
    if attachment_texts:
        source_text = f"{source_text}\nAdjuntos: {' '.join(attachment_texts)}".strip()
    compact = re.sub(r"\s+", " ", source_text).strip()[:1200]
    return f"[Gmail {from_value or 'Entidad'}] {compact or 'Sin texto visible'}".strip()


def _build_credit_quick_analysis(subject: Optional[str], summary: Optional[str]) -> tuple[str, str]:
    source = _normalize_text("\n".join(filter(None, [subject or "", summary or ""])))

    if any(token in source for token in [
        "preaprobado",
        "pre aprobado",
        "pre-aprobado",
        "preaprobada",
        "pre aprobada",
    ]):
        return (
            "preapproved",
            "El correo sugiere una preaprobacion o una viabilidad inicial. Conviene revisar condiciones y documentos pendientes antes de darlo por aprobado."
        )
    if any(token in source for token in [
        "carta de aprobacion",
        "carta aprobacion",
        "ratificacion de carta",
        "ratificacion carta",
        "ratificación de carta",
        "adjunto carta de aprobacion",
        "adjunto carta aprobacion",
        "prenda del cliente",
        "aprobacion y prenda",
        "cliente viable",
        "viable para cupo",
        "viable",
        "viabilidad",
        "aprobado",
        "aprobada",
        "aprobacion",
        "aprobación",
        "cupo de credito aprobado",
        "cupo aprobado",
    ]):
        return (
            "approved",
            "El correo indica que la solicitud parece viable o aprobada por la entidad financiera."
        )
    if any(token in source for token in [
        "no viable",
        "rechazado",
        "rechazada",
        "negado",
        "negada",
        "no aprobado",
        "no aprobada",
    ]):
        return (
            "rejected",
            "El correo indica que la solicitud fue rechazada o que el cliente no es viable para credito."
        )
    if any(token in source for token in [
        "se requiere documentacion",
        "requiere documentacion",
        "faltan documentos",
        "pendiente documentos",
        "debe firmar",
        "debe enviar",
        "validar si es soltero",
        "documentos pendientes",
        "pendiente de documentos",
    ]):
        return (
            "documents_required",
            "El correo no confirma aprobacion final; mas bien pide documentos o validaciones adicionales."
        )
    if any(token in source for token in ["en estudio", "en proceso", "en revision", "analisis"]):
        return (
            "in_review",
            "El correo parece indicar que la solicitud sigue en estudio o en revision."
        )
    return (
        "unknown",
        "No se detecto una conclusion clara de aprobacion, rechazo o requerimiento documental en este correo."
    )


def _save_email_attachment_to_lead(lead_id: int, file_name: str, content_bytes: bytes, mime_type: str, db: Session) -> Optional[models.LeadFile]:
    if not lead_id or not file_name or not content_bytes:
        return None
    os.makedirs("static/leads", exist_ok=True)
    extension = file_name.rsplit(".", 1)[-1] if "." in file_name else "bin"
    unique_filename = f"{uuid.uuid4()}.{extension}"
    file_path = os.path.join("static", "leads", unique_filename)
    with open(file_path, "wb") as output:
        output.write(content_bytes)

    db_file = models.LeadFile(
        lead_id=lead_id,
        user_id=None,
        file_name=file_name,
        file_path=f"/{file_path.replace(os.sep, '/')}",
        file_type=mime_type or "application/octet-stream",
    )
    db.add(db_file)
    return db_file


def _parse_monitored_senders(raw_value: Optional[str]) -> list[str]:
    if not raw_value:
        return []
    chunks = re.split(r"[\n,;]+", raw_value)
    normalized = []
    seen = set()
    for chunk in chunks:
        candidate = chunk.strip().lower()
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        normalized.append(candidate)
    return normalized


def _build_gmail_query(settings: models.IntegrationSettings, sender: Optional[str] = None) -> str:
    query_parts = []
    monitored_senders = _parse_monitored_senders(sender or settings.gmail_monitored_sender)
    monitored_label = (settings.gmail_label or "").strip()
    sync_days = max(1, int(getattr(settings, "gmail_sync_days", 7) or 7))

    if monitored_senders:
        sender_query = " OR ".join(f"from:{sender_value}" for sender_value in monitored_senders)
        query_parts.append(f"({sender_query})")
    if monitored_label:
        query_parts.append(f'label:"{monitored_label}"')
    query_parts.append(f"newer_than:{sync_days}d")

    return " ".join(query_parts).strip()


def _load_full_message(access_token: str, message_id: str) -> dict:
    detail_response = requests.get(
        GMAIL_MESSAGE_DETAIL_URL.format(message_id=message_id),
        headers={"Authorization": f"Bearer {access_token}"},
        params={"format": "full"},
        timeout=20,
    )
    if not detail_response.ok:
        raise HTTPException(status_code=400, detail=detail_response.text or "No se pudo leer el detalle del correo")
    return detail_response.json()


@router.get("/oauth/start")
def start_gmail_oauth(
    company_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_company_admin_access(current_user, company_id)
    settings = _get_or_create_settings(db, company_id)

    if not settings.gmail_client_id or not settings.gmail_redirect_uri:
        raise HTTPException(
            status_code=400,
            detail="Debes guardar antes el Client ID y Redirect URI de Gmail",
        )

    params = {
        "client_id": settings.gmail_client_id,
        "redirect_uri": settings.gmail_redirect_uri,
        "response_type": "code",
        "scope": GMAIL_SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": _build_oauth_state(company_id, current_user.id),
    }

    return {
        "authorization_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}",
        "scope": GMAIL_SCOPE,
    }


@router.get("/oauth/callback", response_class=HTMLResponse)
def gmail_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if error:
        return HTMLResponse(
            content=(
                "<html><body style='font-family:sans-serif;padding:24px'>"
                f"<h2>No se pudo conectar Gmail</h2><p>{error}</p>"
                "<p>Puedes cerrar esta ventana.</p></body></html>"
            ),
            status_code=400,
        )

    if not code or not state:
        raise HTTPException(status_code=400, detail="Faltan parametros del callback OAuth")

    payload = _decode_oauth_state(state)
    company_id = int(payload.get("company_id"))
    settings = _get_or_create_settings(db, company_id)
    token_payload = _exchange_code_for_tokens(settings, code)

    refresh_token = token_payload.get("refresh_token")
    if refresh_token:
        settings.gmail_refresh_token = refresh_token
    settings.gmail_enabled = True
    db.commit()

    return HTMLResponse(
        content="""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 24px; text-align: center;">
                <h2>Gmail conectado correctamente</h2>
                <p>Ya puedes volver a AutosQP y probar la lectura de correos.</p>
                <script>
                    try {
                        window.opener && window.opener.postMessage({ type: 'gmail-connected' }, '*');
                    } catch (e) {}
                    setTimeout(function () { window.close(); }, 1500);
                </script>
            </body>
        </html>
        """
    )


@router.get("/messages/preview")
def preview_gmail_messages(
    company_id: int = Query(...),
    max_results: Optional[int] = Query(None, ge=1, le=100),
    sender: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_company_admin_access(current_user, company_id)
    settings = _get_or_create_settings(db, company_id)
    if not settings.gmail_enabled:
        raise HTTPException(status_code=400, detail="Gmail no esta habilitado para esta empresa")

    access_token = _refresh_access_token(settings)
    query = _build_gmail_query(settings, sender=sender)
    effective_max_results = max(1, min(int(max_results or getattr(settings, "gmail_sync_max_results", 20) or 20), 100))

    list_response = requests.get(
        GMAIL_MESSAGES_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        params={
            "maxResults": effective_max_results,
            "q": query or None,
        },
        timeout=20,
    )
    if not list_response.ok:
        raise HTTPException(status_code=400, detail=list_response.text or "No se pudieron consultar correos")

    messages = list_response.json().get("messages") or []
    items = []
    for message in messages:
        message_id = message.get("id")
        if not message_id:
            continue
        payload = _load_full_message(access_token, message_id)
        headers = ((payload.get("payload") or {}).get("headers")) or []
        items.append({
            "id": payload.get("id"),
            "thread_id": payload.get("threadId"),
            "snippet": payload.get("snippet") or "",
            "from": _extract_header(headers, "From"),
            "subject": _extract_header(headers, "Subject"),
            "date": _extract_header(headers, "Date"),
        })

    return {
        "items": items,
        "query": query,
        "monitored_sender": settings.gmail_monitored_sender,
        "monitored_senders": _parse_monitored_senders(settings.gmail_monitored_sender),
        "gmail_label": settings.gmail_label,
        "gmail_enabled": bool(settings.gmail_enabled),
        "gmail_sync_days": int(getattr(settings, "gmail_sync_days", 7) or 7),
        "gmail_sync_max_results": effective_max_results,
    }


@router.post("/credits/analyze")
def analyze_credit_related_emails(
    company_id: int = Query(...),
    max_results: Optional[int] = Query(None, ge=1, le=100),
    force_reprocess: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_company_admin_access(current_user, company_id)
    settings = _get_or_create_settings(db, company_id)
    if not settings.gmail_enabled:
        raise HTTPException(status_code=400, detail="Gmail no esta habilitado para esta empresa")

    try:
        from routers.credits import sync_credit_applications_for_company
        sync_credit_applications_for_company(db, company_id)
    except Exception:
        pass

    access_token = _refresh_access_token(settings)
    query = _build_gmail_query(settings)
    effective_max_results = max(1, min(int(max_results or getattr(settings, "gmail_sync_max_results", 20) or 20), 100))

    list_response = requests.get(
        GMAIL_MESSAGES_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        params={
            "maxResults": effective_max_results,
            "q": query or None,
        },
        timeout=20,
    )
    if not list_response.ok:
        raise HTTPException(status_code=400, detail=list_response.text or "No se pudieron consultar correos")

    message_refs = list_response.json().get("messages") or []
    active_credits = db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == company_id
    ).order_by(models.CreditApplication.updated_at.desc()).all()

    processed = 0
    matched = 0
    skipped = 0
    created_notes = 0
    attached_files = 0
    updated_credits = 0
    notifications_sent = 0
    reprocessed = 0

    for message_ref in message_refs:
        message_id = message_ref.get("id")
        if not message_id:
            continue

        already_processed = db.query(models.GmailProcessedMessage).filter(
            models.GmailProcessedMessage.gmail_message_id == message_id
        ).first()
        if already_processed:
            if force_reprocess:
                reprocessed += 1
            else:
                skipped += 1
                continue

        payload = _load_full_message(access_token, message_id)
        message_payload = payload.get("payload") or {}
        headers = message_payload.get("headers") or []
        subject = _extract_header(headers, "Subject")
        from_value = _extract_header(headers, "From")
        date_value = _extract_header(headers, "Date")
        body_text = _extract_message_text(message_payload)
        attachments = _extract_attachments(access_token, message_payload, message_id)
        attachment_texts = [item.get("text") or "" for item in attachments if item.get("text")]
        combined_text = "\n".join(filter(None, [subject, body_text, *attachment_texts]))
        normalized_haystack = _normalize_text(combined_text)

        best_credit = None
        best_score = 0
        for credit in active_credits:
            score = _credit_match_score(credit, normalized_haystack)
            if score > best_score:
                best_score = score
                best_credit = credit

        processed += 1
        summary = _build_credit_email_summary(subject, from_value, body_text or (payload.get("snippet") or ""), attachment_texts)
        if not best_credit or best_score < 6 or not best_credit.lead_id:
            processed_record = already_processed or models.GmailProcessedMessage(
                company_id=company_id,
                gmail_message_id=message_id,
            )
            processed_record.gmail_thread_id = payload.get("threadId")
            processed_record.lead_id = getattr(best_credit, "lead_id", None)
            processed_record.credit_application_id = getattr(best_credit, "id", None)
            processed_record.sender = from_value
            processed_record.subject = subject
            processed_record.summary = (
                f"Sin match automatico o sin lead relacionado. Fecha: {date_value or 'Sin fecha'}\n\n{summary}"
            )[:2000]
            if not already_processed:
                db.add(processed_record)
            db.commit()
            continue

        matched += 1
        lead = db.query(models.Lead).filter(models.Lead.id == best_credit.lead_id).first() if best_credit.lead_id else None

        if not already_processed:
            db.add(models.LeadNote(
                lead_id=best_credit.lead_id,
                user_id=None,
                content=summary,
            ))
            created_notes += 1

            db.add(models.LeadHistory(
                lead_id=best_credit.lead_id,
                user_id=None,
                previous_status=lead.status if lead else models.LeadStatus.CREDIT_APPLICATION.value,
                new_status=lead.status if lead else models.LeadStatus.CREDIT_APPLICATION.value,
                comment=f"Correo de credito relacionado automaticamente desde Gmail: {subject or 'Sin asunto'}",
            ))

        stamped_note = _build_credit_compact_note(
            from_value=from_value,
            body_text=body_text,
            snippet=payload.get("snippet") or "",
            attachment_texts=attachment_texts,
        )
        if not already_processed:
            best_credit.notes = f"{best_credit.notes}\n{stamped_note}".strip() if best_credit.notes else stamped_note

        new_credit_status = _classify_credit_email_status("\n".join([body_text, *attachment_texts]), best_credit.status)
        if new_credit_status and new_credit_status != best_credit.status:
            best_credit.status = new_credit_status
            updated_credits += 1

        if not already_processed:
            for attachment in attachments:
                db_file = _save_email_attachment_to_lead(
                    lead_id=best_credit.lead_id,
                    file_name=attachment.get("file_name") or "adjunto",
                    content_bytes=attachment.get("bytes") or b"",
                    mime_type=attachment.get("mime_type") or "application/octet-stream",
                    db=db,
                )
                if db_file:
                    attached_files += 1

        if lead and lead.assigned_to_id and not already_processed:
            db.add(models.Notification(
                user_id=lead.assigned_to_id,
                title="Respuesta de entidad financiera",
                message=f"Se relaciono automaticamente un correo de credito para {lead.name or best_credit.client_name}.",
                type="info",
                link=f"/admin/credits?creditId={best_credit.id}"
            ))
            notifications_sent += 1

        processed_record = already_processed or models.GmailProcessedMessage(
            company_id=company_id,
            gmail_message_id=message_id,
        )
        processed_record.gmail_thread_id = payload.get("threadId")
        processed_record.lead_id = best_credit.lead_id
        processed_record.credit_application_id = best_credit.id
        processed_record.sender = from_value
        processed_record.subject = subject
        processed_record.summary = summary[:2000]
        if not already_processed:
            db.add(processed_record)
        db.commit()

    return {
        "processed": processed,
        "matched": matched,
        "skipped": skipped,
        "reprocessed": reprocessed,
        "created_notes": created_notes,
        "attached_files": attached_files,
        "updated_credits": updated_credits,
        "notifications_sent": notifications_sent,
        "query": query,
        "gmail_sync_days": int(getattr(settings, "gmail_sync_days", 7) or 7),
        "gmail_sync_max_results": effective_max_results,
        "force_reprocess": force_reprocess,
    }


@router.get("/credits/processed", response_model=schemas.GmailProcessedMessageList)
def list_processed_credit_emails(
    company_id: int = Query(...),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_company_admin_access(current_user, company_id)

    query = db.query(models.GmailProcessedMessage).options(
        joinedload(models.GmailProcessedMessage.lead),
        joinedload(models.GmailProcessedMessage.credit_application),
    ).filter(
        models.GmailProcessedMessage.company_id == company_id
    )

    if q:
        normalized_q = f"%{q.strip()}%"
        query = query.filter(
            (models.GmailProcessedMessage.sender.ilike(normalized_q)) |
            (models.GmailProcessedMessage.subject.ilike(normalized_q)) |
            (models.GmailProcessedMessage.summary.ilike(normalized_q))
        )

    total = query.count()
    rows = query.order_by(models.GmailProcessedMessage.processed_at.desc()).offset(skip).limit(limit).all()

    items = []
    for row in rows:
        quick_status, quick_analysis = _build_credit_quick_analysis(row.subject, row.summary)
        items.append({
            "id": row.id,
            "company_id": row.company_id,
            "gmail_message_id": row.gmail_message_id,
            "gmail_thread_id": row.gmail_thread_id,
            "lead_id": row.lead_id,
            "credit_application_id": row.credit_application_id,
            "sender": row.sender,
            "subject": row.subject,
            "summary": row.summary,
            "quick_status": quick_status,
            "quick_analysis": quick_analysis,
            "processed_at": row.processed_at,
            "lead_name": row.lead.name if row.lead else None,
            "credit_client_name": row.credit_application.client_name if row.credit_application else None,
        })

    return {"items": items, "total": total}
