from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
import models, schemas
from dependencies import get_current_user

router = APIRouter(
    prefix="/credits",
    tags=["credits"]
)

VALID_CREDIT_STATUSES = {
    models.CreditStatus.PENDING.value,
    models.CreditStatus.IN_REVIEW.value,
    models.CreditStatus.APPROVED.value,
    models.CreditStatus.REJECTED.value,
    models.CreditStatus.COMPLETED.value,
}


def _get_credit_desired_vehicle(db: Session, lead: models.Lead) -> str:
    detail = db.query(models.LeadProcessDetail).filter(
        models.LeadProcessDetail.lead_id == lead.id
    ).first()

    desired_vehicle = ""
    if detail:
        if detail.vehicle_id:
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == detail.vehicle_id).first()
            if vehicle:
                desired_vehicle = " ".join(
                    part for part in [vehicle.make, vehicle.model, str(vehicle.year or "")] if part
                ).strip()
        if not desired_vehicle:
            desired_vehicle = (detail.desired_vehicle or "").strip()

    if not desired_vehicle:
        desired_vehicle = (lead.message or "").strip() or "Por definir"

    return desired_vehicle


def sync_credit_applications_for_company(db: Session, company_id: int):
    credit_stage_leads = db.query(models.Lead).filter(
        models.Lead.company_id == company_id,
        models.Lead.status == models.LeadStatus.CREDIT_APPLICATION.value
    ).all()

    if not credit_stage_leads:
        return

    lead_ids = [lead.id for lead in credit_stage_leads]
    existing_credits = db.query(models.CreditApplication).filter(
        models.CreditApplication.lead_id.in_(lead_ids)
    ).order_by(models.CreditApplication.created_at.desc()).all()

    latest_by_lead = {}
    for credit in existing_credits:
        latest_by_lead.setdefault(credit.lead_id, credit)

    changed = False
    for lead in credit_stage_leads:
        desired_vehicle = _get_credit_desired_vehicle(db, lead)
        auto_note = f"Generado automaticamente desde lead #{lead.id}."
        current_credit = latest_by_lead.get(lead.id)

        if current_credit:
            if current_credit.company_id != lead.company_id:
                current_credit.company_id = lead.company_id
                changed = True
            if current_credit.assigned_to_id != lead.assigned_to_id:
                current_credit.assigned_to_id = lead.assigned_to_id
                changed = True
            if (lead.name or current_credit.client_name) != current_credit.client_name:
                current_credit.client_name = lead.name or current_credit.client_name
                changed = True
            normalized_phone = (lead.phone or "").strip()
            if normalized_phone and normalized_phone != current_credit.phone:
                current_credit.phone = normalized_phone
                changed = True
            if lead.email != current_credit.email:
                current_credit.email = lead.email
                changed = True
            if desired_vehicle and desired_vehicle != current_credit.desired_vehicle:
                current_credit.desired_vehicle = desired_vehicle
                changed = True
            if current_credit.status not in VALID_CREDIT_STATUSES:
                current_credit.status = models.CreditStatus.PENDING.value
                changed = True
            if not current_credit.notes:
                current_credit.notes = auto_note
                changed = True
            continue

        db.add(models.CreditApplication(
            lead_id=lead.id,
            client_name=lead.name or f"Lead {lead.id}",
            phone=(lead.phone or "").strip() or f"lead-{lead.id}",
            email=lead.email,
            desired_vehicle=desired_vehicle,
            monthly_income=0,
            other_income=0,
            occupation="employee",
            application_mode="individual",
            down_payment=0,
            status=models.CreditStatus.PENDING.value,
            notes=auto_note,
            company_id=lead.company_id,
            assigned_to_id=lead.assigned_to_id
        ))
        changed = True

    if changed:
        db.commit()

@router.get("/", response_model=schemas.CreditApplicationList)
def read_credits(
    status: str = None,
    q: str = None,
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    effective_role_name = getattr(getattr(current_user, "role", None), "base_role_name", None) or getattr(getattr(current_user, "role", None), "name", None)
    if current_user.company_id:
        sync_credit_applications_for_company(db, current_user.company_id)

    query = db.query(models.CreditApplication).options(
        joinedload(models.CreditApplication.assigned_to)
    )
    
    # Filter by user company
    if current_user.company_id:
        query = query.filter(
            or_(
                models.CreditApplication.company_id == current_user.company_id,
                models.CreditApplication.lead.has(models.Lead.company_id == current_user.company_id)
            )
        )
    
    # Filter by Advisor (Asesor) - Only see assigned leads/credits?
    if effective_role_name in ['asesor', 'vendedor', 'aliado', 'coordinador']:
        query = query.filter(
            or_(
                models.CreditApplication.assigned_to_id == current_user.id,
                models.CreditApplication.lead.has(
                    models.Lead.supervisors.any(models.User.id == current_user.id)
                )
            )
        )
    
    if status:
        query = query.filter(models.CreditApplication.status == status)

    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.CreditApplication.client_name.ilike(search)) | 
            (models.CreditApplication.email.ilike(search)) | 
            (models.CreditApplication.phone.ilike(search)) |
            (models.CreditApplication.desired_vehicle.ilike(search))
        )
        
    total = query.count()
    credits = query.order_by(models.CreditApplication.created_at.desc()).offset(skip).limit(limit).all()
    for credit in credits:
        if credit.status not in VALID_CREDIT_STATUSES:
            credit.status = models.CreditStatus.PENDING.value
    return {"items": credits, "total": total}

@router.post("/", response_model=schemas.CreditApplication)
def create_credit(
    credit: schemas.CreditApplicationCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Assign to current user's company if not provided
    company_id = credit.company_id or current_user.company_id
    
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required")
    
    credit_data = credit.dict(exclude={'company_id'})
    
    # If no assigned_to, maybe assign to self if creator is advisor?
    assigned_to_id = credit.assigned_to_id
    if not assigned_to_id and current_user.role.name in ['asesor', 'vendedor']:
        assigned_to_id = current_user.id
        
    db_credit = models.CreditApplication(
        **credit_data, 
        company_id=company_id, 
        assigned_to_id=assigned_to_id
    )
    db.add(db_credit)
    db.commit()
    db.refresh(db_credit)
    return db_credit

@router.put("/{credit_id}", response_model=schemas.CreditApplication)
def update_credit(
    credit_id: int, 
    credit_update: schemas.CreditApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    credit = db.query(models.CreditApplication).filter(models.CreditApplication.id == credit_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="Credit Application not found")
        
    if current_user.company_id and credit.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for field, value in credit_update.dict(exclude_unset=True).items():
        setattr(credit, field, value)
        
    db.commit()
    db.refresh(credit)
    return credit

@router.get("/stats")
def get_credit_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Simple stats for dashboard
    query = db.query(models.CreditApplication)
    if current_user.company_id:
        query = query.filter(models.CreditApplication.company_id == current_user.company_id)
        
    total = query.count()
    
    from sqlalchemy import func
    status_counts = db.query(models.CreditApplication.status, func.count(models.CreditApplication.status))\
        .filter(models.CreditApplication.company_id == current_user.company_id)\
        .group_by(models.CreditApplication.status).all()
        
    return {
        "total": total,
        "by_status": {s[0]: s[1] for s in status_counts}
    }
