"""Public website services: explicit inventory fields and tenant SMTP contact."""
import datetime as dt
from email.message import EmailMessage
from email.utils import getaddresses
import hashlib
import ipaddress
import os
import re
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator
from sqlalchemy.exc import IntegrityError
import models
from website_intake import SUBJECTS, destination, register_inquiry
from lead_recontact import phone_key


class ContactMessage(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    request_id: str = Field(pattern=r'^[a-zA-Z0-9-]{16,36}$')
    name: str = Field(min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone: str = Field(default='', max_length=40)
    subject: str = Field(min_length=2, max_length=120)
    message: str = Field(min_length=5, max_length=5000)
    website: str = Field(default='', max_length=250)  # Honeypot, never rendered to users.
    vehicle_make: str = Field(default='', max_length=100)
    vehicle_model: str = Field(default='', max_length=100)
    vehicle_year: Optional[int] = Field(default=None, ge=1900, le=2200)
    vehicle_mileage: Optional[int] = Field(default=None, ge=0)
    vehicle_plate: str = Field(default='', max_length=30)

    @model_validator(mode='after')
    def validate_inquiry(self):
        if self.subject not in SUBJECTS:
            raise ValueError('Selecciona un motivo de contacto válido')
        if self.subject == 'Suscripción al boletín':
            if not self.email:
                raise ValueError('El correo es obligatorio para suscribirse')
        elif not phone_key(self.phone):
            raise ValueError('Ingresa un número de teléfono válido')
        if self.email and len(str(self.email)) > 100:
            raise ValueError('El correo no puede superar 100 caracteres')
        return self


def client_ip(request):
    peer = request.client.host if request.client else 'unknown'
    if peer in {'127.0.0.1', '::1'}:
        forwarded = request.headers.get('x-real-ip') or request.headers.get('x-forwarded-for', '').split(',')[0]
        try:
            return str(ipaddress.ip_address(forwarded.strip()))
        except ValueError:
            pass
    return peer


def inventory_page(db, company, before_id: Optional[int] = None):
    if not company:
        raise HTTPException(404, 'Este dominio no tiene una empresa configurada')
    query = db.query(models.Vehicle).filter(models.Vehicle.company_id == company.id, models.Vehicle.status == 'available')
    if before_id is not None:
        query = query.filter(models.Vehicle.id < before_id)
    rows = query.order_by(models.Vehicle.id.desc()).limit(101).all()
    items = [public_vehicle(row) for row in rows[:100]]
    return {'items': items, 'next_cursor': rows[99].id if len(rows) > 100 else None}


def public_vehicle(vehicle):
    photos = vehicle.photos if isinstance(vehicle.photos, list) else []
    images = []
    for photo in photos:
        if not isinstance(photo, str):
            continue
        if photo.startswith(('https://', 'http://', '/api/static/', '/static/')):
            images.append('/api' + photo if photo.startswith('/static/') else photo)
    if not images:
        images = ['data:image/svg+xml,' + '%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="480"%3E%3Crect width="100%25" height="100%25" fill="%2314181d"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif"%3EFotograf%C3%ADa no disponible%3C/text%3E%3C/svg%3E']
    transmission = str(vehicle.transmission or '')
    if 'auto' in transmission.lower():
        transmission = 'Automático'
    elif any(value in transmission.lower() for value in ['mec', 'manual']):
        transmission = 'Mecánico'
    plate = re.findall(r'\d', vehicle.plate or '')
    fuel = str(vehicle.fuel_type or '').strip()
    fuel_key = fuel.casefold().replace('é', 'e').replace('í', 'i')
    fuel = {'gasolina': 'Gasolina', 'diesel': 'Diésel', 'electrico': 'Eléctrico', 'hibrido': 'Híbrido'}.get(fuel_key, fuel)
    # No purchase costs, full plates, internal codes or financial fields.
    return dict(id=str(vehicle.id), make=vehicle.make or '', model=vehicle.model or '', version='',
        year=vehicle.year, price=vehicle.price, mileage=vehicle.mileage,
        transmission=transmission or 'Consultar', fuel=fuel or 'Consultar',
        bodyType='', images=images, description=vehicle.description or '',
        hasOptionalWarranty=bool(vehicle.year and dt.datetime.now(ZoneInfo('America/Bogota')).year - vehicle.year < 10),
        specs=dict(engine=vehicle.engine or 'Consultar', doors='Consultar', traction='Consultar',
            plateEnding=plate[-1] if plate else 'Consultar',
            soatValidUntil=vehicle.soat.strftime('%d/%m/%Y') if vehicle.soat else 'Consultar',
            technoValidUntil=vehicle.tecno.strftime('%d/%m/%Y') if vehicle.tecno else 'Consultar',
            color=vehicle.color or 'Consultar', city=vehicle.location or 'Consultar'))


def submit_contact(db, company, payload, ip, smtp_loader, deliver, capacity_check=None):
    if not company:
        raise HTTPException(404, 'Este dominio no tiene una empresa configurada')
    if payload.website:
        return {'sent': True}
    db.query(models.Company).filter_by(id=company.id).with_for_update().first()
    record = db.query(models.PublicWebsiteContact).filter_by(company_id=company.id, request_id=payload.request_id).with_for_update().first()
    if record:
        if any(getattr(record, field) != str(getattr(payload, field) or '').strip() for field in ['name', 'email', 'phone', 'subject', 'message']):
            raise HTTPException(409, 'El identificador pertenece a otro mensaje. Recarga el formulario antes de continuar.')
        if record.state == 'sent':
            db.rollback()
            return {'sent': True, 'received': True, 'destination': destination(payload.subject)}
        if record.state == 'pending':
            db.rollback()
            raise HTTPException(409, 'El mensaje está en proceso. Espera la respuesta antes de volver a enviarlo.')
        if record.attempts >= 3:
            raise HTTPException(429, 'Se alcanzó el límite de intentos. Contacta a nuestro asesor virtual.')
        record.attempts += 1
        record.state = 'pending'
    else:
        ip_hash = hashlib.sha256((os.getenv('SECRET_KEY', '') + ':' + ip).encode()).hexdigest()
        count = db.query(models.PublicWebsiteContact.id).filter(
            models.PublicWebsiteContact.company_id == company.id, models.PublicWebsiteContact.ip_hash == ip_hash,
            models.PublicWebsiteContact.created_at >= dt.datetime.utcnow() - dt.timedelta(hours=1)).count()
        if count >= 5:
            raise HTTPException(429, 'Has enviado varios mensajes. Espera antes de enviar otro o utiliza nuestro asesor virtual.')
        record = models.PublicWebsiteContact(company_id=company.id, request_id=payload.request_id,
            name=payload.name.strip(), phone=payload.phone.strip(), email=str(payload.email or ''),
            subject=payload.subject.strip(), message=payload.message.strip(), ip_hash=ip_hash)
        db.add(record)
    try:
        target = register_inquiry(db, company, payload, capacity_check)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Este mensaje ya se está procesando')
    except Exception:
        db.rollback()
        raise
    try:
        settings = smtp_loader(db, company)
        integration = db.query(models.IntegrationSettings).filter_by(company_id=company.id).first()
        configured = getattr(integration, 'smtp_always_recipients', '') or ''
        recipients = [email for _, email in getaddresses([configured.replace(';', ',')]) if re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+', email)]
        recipients = list(dict.fromkeys(recipients)) or [settings['sender']]
        message = EmailMessage()
        message['From'] = settings['sender']
        message['To'] = ', '.join(recipients)
        if record.email:
            message['Reply-To'] = record.email
        message['Subject'] = f"Contacto web — {company.name}: " + re.sub(r'[\r\n]+', ' ', record.subject)
        message.set_content(f'Nombre: {record.name}\nTeléfono: {record.phone}\nCorreo: {record.email}\nMotivo: {record.subject}\n\n{record.message}')
        deliver(message, settings)
    except Exception as error:
        record.state = 'failed'
        db.commit()
        print(f'Website contact {record.id}: {type(error).__name__}', flush=True)
        if target != 'newsletter':
            return {'received': True, 'sent': False, 'destination': target}
        raise HTTPException(503, 'No pudimos enviar el correo. Intenta nuevamente o habla con nuestro asesor virtual.')
    record.state = 'sent'
    db.commit()
    return {'sent': True, 'received': True, 'destination': target}
