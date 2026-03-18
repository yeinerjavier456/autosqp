from datetime import timedelta
from typing import Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import auth_utils
import models
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


def _build_gmail_query(settings: models.IntegrationSettings, sender: Optional[str] = None) -> str:
    query_parts = []
    monitored_sender = (sender or settings.gmail_monitored_sender or "").strip()
    monitored_label = (settings.gmail_label or "").strip()

    if monitored_sender:
        query_parts.append(f"from:{monitored_sender}")
    if monitored_label:
        query_parts.append(f'label:"{monitored_label}"')

    return " ".join(query_parts).strip()


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
    max_results: int = Query(10, ge=1, le=25),
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

    list_response = requests.get(
        GMAIL_MESSAGES_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        params={
            "maxResults": max_results,
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
        detail_response = requests.get(
            GMAIL_MESSAGE_DETAIL_URL.format(message_id=message_id),
            headers={"Authorization": f"Bearer {access_token}"},
            params={
                "format": "metadata",
                "metadataHeaders": ["From", "Subject", "Date"],
            },
            timeout=20,
        )
        if not detail_response.ok:
            continue

        payload = detail_response.json()
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
        "gmail_label": settings.gmail_label,
        "gmail_enabled": bool(settings.gmail_enabled),
    }
