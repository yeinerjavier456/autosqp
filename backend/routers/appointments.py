from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import datetime

import models
import schemas
from dependencies import get_current_user, get_db, ensure_can_modify_lead


router = APIRouter(
    prefix="/appointments",
    tags=["appointments"]
)


def can_view_all_appointments(user: Optional[models.User]) -> bool:
    role = getattr(user, "role", None)
    role_name = (
        getattr(role, "base_role_name", None)
        or getattr(role, "name", None)
        or getattr(user, "role", None)
        or ""
    )
    return str(role_name).strip().lower() in {"admin", "super_admin"}


@router.post("/leads/{lead_id}", response_model=schemas.LeadAppointment)
def create_lead_appointment(
    lead_id: int,
    appointment: schemas.LeadAppointmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    ensure_can_modify_lead(current_user, lead)

    db_appointment = models.LeadAppointment(
        user_id=current_user.id,
        lead_id=lead_id,
        appointment_date=appointment.appointment_date,
        title=(appointment.title or "").strip() or None,
        note=(appointment.note or "").strip() or None,
        status="scheduled",
        is_notified=0,
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment


@router.get("/leads/{lead_id}", response_model=List[schemas.LeadAppointment])
def get_lead_appointments(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    appointments_query = db.query(models.LeadAppointment).options(
        joinedload(models.LeadAppointment.lead),
        joinedload(models.LeadAppointment.user)
    ).filter(
        models.LeadAppointment.lead_id == lead_id
    )

    if not can_view_all_appointments(current_user):
        appointments_query = appointments_query.filter(models.LeadAppointment.user_id == current_user.id)

    appointments = appointments_query.order_by(models.LeadAppointment.appointment_date.asc()).all()
    return appointments


@router.get("/", response_model=List[schemas.LeadAppointment])
def get_company_appointments(
    start: Optional[datetime.datetime] = Query(default=None),
    end: Optional[datetime.datetime] = Query(default=None),
    view_mode: Optional[str] = Query(default="all"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.LeadAppointment).options(
        joinedload(models.LeadAppointment.lead),
        joinedload(models.LeadAppointment.user)
    ).join(models.Lead, models.Lead.id == models.LeadAppointment.lead_id)

    if current_user.company_id:
        query = query.filter(models.Lead.company_id == current_user.company_id)

    if not can_view_all_appointments(current_user) or view_mode == "me":
        query = query.filter(models.LeadAppointment.user_id == current_user.id)

    if start:
        query = query.filter(models.LeadAppointment.appointment_date >= start)
    if end:
        query = query.filter(models.LeadAppointment.appointment_date <= end)

    appointments = query.order_by(models.LeadAppointment.appointment_date.asc()).all()
    return appointments
