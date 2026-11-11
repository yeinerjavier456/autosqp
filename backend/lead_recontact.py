"""Shared duplicate matching and owner alerts for repeat contact requests."""
import datetime
import re
import unicodedata
from sqlalchemy import or_
import models

REQUEST = '[RECONTACT_REQUEST]'
ACK = '[RECONTACT_ACK]'


def phone_key(value):
    digits = re.sub(r'\D', '', str(value or ''))
    return (digits[-10:] if len(digits) >= 10 else digits) if len(digits) >= 7 else ''


def name_key(value):
    text = unicodedata.normalize('NFKD', str(value or '').strip().lower())
    text = ' '.join(''.join(char for char in text if not unicodedata.combining(char)).split())
    return text if len(text) >= 4 and text not in {'pendiente', 'cliente', 'lead', 'nuevo lead', 'sin nombre', 'desconocido', 'no registra', 'prueba', 'test'} else ''


def find_existing_contact(db, company_id, name, phone):
    # Lock the company so concurrent channels cannot create the same lead twice.
    db.query(models.Company).filter(models.Company.id == company_id).with_for_update().first()
    key = phone_key(phone)
    fallback_name = name_key(name) if not key else ''
    if not key and not fallback_name:
        return None
    leads = db.query(models.Lead).filter(models.Lead.company_id == company_id, models.Lead.deleted_at.is_(None)).order_by(models.Lead.id.desc()).all()
    for lead in leads:
        if key and phone_key(lead.phone) == key:
            return lead
        if fallback_name and not phone_key(lead.phone) and name_key(lead.name) == fallback_name:
            return lead
    return None


def request_recontact(db, lead, source, actor_id=None):
    now = datetime.datetime.utcnow()
    recent = db.query(models.LeadHistory).filter(
        models.LeadHistory.lead_id == lead.id,
        models.LeadHistory.comment.like(f'{REQUEST}%'),
        models.LeadHistory.created_at >= now - datetime.timedelta(minutes=5),
    ).first()
    if recent:
        return False
    db.add(models.LeadHistory(lead_id=lead.id, user_id=actor_id, previous_status=lead.status,
        new_status=lead.status, comment=f'{REQUEST} Solicita ser contactado nuevamente. Canal: {source}', created_at=now))
    if lead.assigned_to_id:
        db.add(models.Notification(user_id=lead.assigned_to_id, title='Solicita ser contactado nuevamente',
            message=f'{lead.name or "El contacto"} volvió a solicitar atención. Revisa el lead existente #{lead.id}.',
            type='info', link=f'/admin/leads?leadId={lead.id}'))
    return True


def hydrate_recontact_alerts(db, leads):
    if not leads:
        return
    entries = db.query(models.LeadHistory).filter(
        models.LeadHistory.lead_id.in_([lead.id for lead in leads]),
        or_(models.LeadHistory.comment.like(f'{REQUEST}%'), models.LeadHistory.comment.like(f'{ACK}%')),
    ).order_by(models.LeadHistory.created_at.desc(), models.LeadHistory.id.desc()).all()
    latest = {}
    for entry in entries:
        latest.setdefault(entry.lead_id, entry)
    for lead in leads:
        entry = latest.get(lead.id)
        lead.recontact_requested = bool(entry and entry.comment.startswith(REQUEST))
        lead.recontact_requested_at = entry.created_at if lead.recontact_requested else None
