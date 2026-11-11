"""Route anonymous website inquiries using tenant-scoped CRM workflows."""
import datetime as dt
import random
import unicodedata

from fastapi import HTTPException
from sqlalchemy.orm import joinedload
import models
import lead_assignment
from lead_recontact import find_existing_contact, request_recontact

SUBJECTS = {'Comprar vehículo', 'Vender mi vehículo', 'Financiamiento', 'Reactivación Financiera', 'Seguros', 'Garantía opcional', 'Otro', 'Suscripción al boletín'}


def destination(subject):
    return {'Vender mi vehículo': 'purchases', 'Reactivación Financiera': 'financial_solutions',
        'Suscripción al boletín': 'newsletter'}.get(subject, 'leads')


def is_reactivation(role):
    values = ' '.join(str(getattr(role, field, '') or '') for field in ['name', 'base_role_name', 'label'])
    normalized = ''.join(c for c in unicodedata.normalize('NFKD', values.lower()) if not unicodedata.combining(c))
    return 'reactiv' in normalized


def register_inquiry(db, company, payload, capacity_check=None):
    target = destination(payload.subject)
    if target == 'newsletter':
        return target
    marker = f'[WEBSITE_CONTACT:{payload.request_id}]'
    # This note is committed with the contact record and CRM entity, not with the
    # SMTP result. Retries of failed emails cannot create a second CRM request.
    recorded = db.query(models.LeadNote.id).join(models.Lead, models.LeadNote.lead_id == models.Lead.id).filter(
        models.Lead.company_id == company.id, models.LeadNote.content.startswith(marker)).first()
    if recorded:
        return target
    lead = find_existing_contact(db, company.id, payload.name, payload.phone)
    users = db.query(models.User).options(joinedload(models.User.role)).filter(
        models.User.company_id == company.id, models.User.is_active == True).all()
    assignee = None
    if target == 'financial_solutions':
        candidates = [user for user in users if is_reactivation(user.role)]
        if not candidates:
            raise HTTPException(503, 'No hay un responsable activo de Reactivación Financiera disponible. Intenta más tarde o comunícate con nosotros.')
        assignee = random.choice(candidates)
        if lead and lead.status == 'sold':
            raise HTTPException(409, 'El contacto tiene una venta cerrada. Solicita al equipo la apertura de un caso de reactivación sin modificar esa venta.')
    elif target == 'purchases':
        from routers.purchases import _choose_purchase_manager
        assignee = _choose_purchase_manager(db, company.id)
    else:
        assignee = lead_assignment.choose_auto_assign_user(db, company.id)

    text = f'{payload.subject}: {payload.message}\n\nNombre: {payload.name}\nTeléfono: {payload.phone}\nCorreo: {payload.email or "No registrado"}'
    created = lead is None
    if created:
        if capacity_check:
            capacity_check(db, company.id)
        lead = models.Lead(company_id=company.id, name=payload.name, phone=payload.phone,
            email=str(payload.email or '') or None, source='web', status='new',
            message=text[:1000], assigned_to_id=assignee.id if assignee else None,
            created_at=dt.datetime.utcnow(), status_updated_at=dt.datetime.utcnow())
        db.add(lead)
        db.flush()
        db.add(models.LeadHistory(lead_id=lead.id, user_id=None, previous_status=None, new_status='new',
            comment=f'Solicitud recibida desde la web: {payload.subject}'))
    else:
        request_recontact(db, lead, f'formulario web: {payload.subject}')
        if target == 'financial_solutions' and (lead.status == 'lost' or not is_reactivation(getattr(lead.assigned_to, 'role', None))):
            previous_status = lead.status
            lead.status = 'new'
            lead.status_updated_at = dt.datetime.utcnow()
            lead.assigned_to_id = assignee.id
            db.query(models.LeadSupervisor).filter_by(lead_id=lead.id).delete(synchronize_session=False)
            db.add(models.LeadHistory(lead_id=lead.id, user_id=None, previous_status=previous_status, new_status='new',
                comment='Trasladado a Soluciones Financieras por solicitud expresa desde la web. Se conserva el historial anterior.'))
        elif target == 'leads' and is_reactivation(getattr(lead.assigned_to, 'role', None)):
            previous_status = lead.status
            lead.status = 'new'
            lead.status_updated_at = dt.datetime.utcnow()
            lead.assigned_to_id = assignee.id if assignee else None
            db.query(models.LeadSupervisor).filter_by(lead_id=lead.id).delete(synchronize_session=False)
            db.add(models.LeadHistory(lead_id=lead.id, user_id=None, previous_status=previous_status, new_status='new',
                comment=f'Trasladado al tablero comercial por una nueva solicitud web de {payload.subject}. Se conserva el historial anterior.'))

    db.add(models.LeadNote(lead_id=lead.id, user_id=None, content=f'{marker}\n{text}'))
    notify_user_id = lead.assigned_to_id
    link = f'/admin/leads?leadId={lead.id}'
    if target == 'purchases':
        vehicle = ' '.join(str(value) for value in [payload.vehicle_make, payload.vehicle_model, payload.vehicle_year] if value)
        purchase = models.CreditApplication(company_id=company.id, lead_id=lead.id, client_name=payload.name,
            phone=payload.phone, email=str(payload.email or '') or None,
            desired_vehicle=vehicle or 'Vehículo ofrecido por el cliente; ver información de contacto',
            status='pending', assigned_to_id=assignee.id if assignee else None,
            purchase_vehicle_name=payload.vehicle_make or None, purchase_vehicle_model=payload.vehicle_model or None,
            purchase_vehicle_year=payload.vehicle_year, purchase_vehicle_plate=payload.vehicle_plate or None,
            purchase_vehicle_mileage=payload.vehicle_mileage,
            notes=f'[PURCHASE_REQUEST] {marker}\nOferta de venta recibida desde la web.\n{text}')
        db.add(purchase)
        db.flush()
        notify_user_id = purchase.assigned_to_id
        link = '/admin/purchases'
    elif target == 'financial_solutions':
        link = f'/aliado/dashboard?leadId={lead.id}'
    if notify_user_id:
        db.add(models.Notification(user_id=notify_user_id, title='Nueva solicitud desde la web',
            message=f'{payload.name}: {payload.subject}. Revisa la información registrada en el CRM.',
            type='info', link=link))
    return target
