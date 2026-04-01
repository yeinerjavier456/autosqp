from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload
from typing import Optional
import datetime
from database import get_db
import models, schemas
from dependencies import get_current_user
import os
import shutil
import uuid

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


def _credit_status_label(status_value: Optional[str]) -> str:
    return {
        models.CreditStatus.PENDING.value: "Solicitud recibida",
        models.CreditStatus.IN_REVIEW.value: "En estudio",
        models.CreditStatus.APPROVED.value: "Aprobado",
        models.CreditStatus.REJECTED.value: "No viable",
        models.CreditStatus.COMPLETED.value: "Finalizado",
    }.get(status_value or "", status_value or "Sin estado")


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

    orphan_credits = db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == company_id,
        models.CreditApplication.lead_id.is_(None)
    ).order_by(models.CreditApplication.created_at.desc()).all()

    if not credit_stage_leads and not orphan_credits:
        return {"processed": 0, "created": 0, "updated": 0, "created_leads": 0}

    lead_ids = [lead.id for lead in credit_stage_leads]
    existing_credits = db.query(models.CreditApplication).filter(
        models.CreditApplication.lead_id.in_(lead_ids)
    ).order_by(models.CreditApplication.created_at.desc()).all()

    latest_by_lead = {}
    for credit in existing_credits:
        latest_by_lead.setdefault(credit.lead_id, credit)

    changed = False
    created_count = 0
    updated_count = 0
    created_leads = 0
    for lead in credit_stage_leads:
        desired_vehicle = _get_credit_desired_vehicle(db, lead)
        auto_note = f"Generado automaticamente desde lead #{lead.id}."
        current_credit = latest_by_lead.get(lead.id)

        if current_credit:
            if current_credit.company_id != lead.company_id:
                current_credit.company_id = lead.company_id
                changed = True
                updated_count += 1
            if current_credit.assigned_to_id != lead.assigned_to_id:
                current_credit.assigned_to_id = lead.assigned_to_id
                changed = True
                updated_count += 1
            if (lead.name or current_credit.client_name) != current_credit.client_name:
                current_credit.client_name = lead.name or current_credit.client_name
                changed = True
                updated_count += 1
            normalized_phone = (lead.phone or "").strip()
            if normalized_phone and normalized_phone != current_credit.phone:
                current_credit.phone = normalized_phone
                changed = True
                updated_count += 1
            if lead.email != current_credit.email:
                current_credit.email = lead.email
                changed = True
                updated_count += 1
            if desired_vehicle and desired_vehicle != current_credit.desired_vehicle:
                current_credit.desired_vehicle = desired_vehicle
                changed = True
                updated_count += 1
            if current_credit.status not in VALID_CREDIT_STATUSES:
                current_credit.status = models.CreditStatus.PENDING.value
                changed = True
                updated_count += 1
            if not current_credit.notes:
                current_credit.notes = auto_note
                changed = True
                updated_count += 1
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
        created_count += 1

    for credit in orphan_credits:
        auto_message = (credit.notes or "").strip() or f"Solicitud de crédito creada desde créditos #{credit.id}."
        db_lead = models.Lead(
            source=models.LeadSource.OTHER.value,
            name=credit.client_name or f"Solicitud {credit.id}",
            email=credit.email,
            phone=credit.phone,
            status=models.LeadStatus.CREDIT_APPLICATION.value,
            message=auto_message[:1000],
            company_id=credit.company_id,
            assigned_to_id=credit.assigned_to_id,
            created_by_id=None,
            status_updated_at=datetime.datetime.utcnow(),
        )
        db.add(db_lead)
        db.flush()

        credit.lead_id = db_lead.id
        if db_lead.status != models.LeadStatus.CREDIT_APPLICATION.value:
            db_lead.status = models.LeadStatus.CREDIT_APPLICATION.value

        db.add(models.LeadHistory(
            lead_id=db_lead.id,
            user_id=None,
            previous_status="N/A",
            new_status=models.LeadStatus.CREDIT_APPLICATION.value,
            comment=f"Lead creado automaticamente desde solicitud de crédito #{credit.id}"
        ))
        db.add(models.LeadNote(
            lead_id=db_lead.id,
            user_id=None,
            content=f"Solicitud de crédito #{credit.id} sincronizada automáticamente al tablero de leads."
        ))
        changed = True
        created_leads += 1

    for credit in db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == company_id,
        models.CreditApplication.lead_id.isnot(None)
    ).all():
        linked_lead = db.query(models.Lead).filter(models.Lead.id == credit.lead_id).first()
        if not linked_lead:
            continue
        if linked_lead.status != models.LeadStatus.CREDIT_APPLICATION.value:
            linked_lead.status = models.LeadStatus.CREDIT_APPLICATION.value
            linked_lead.status_updated_at = datetime.datetime.utcnow()
            changed = True
            updated_count += 1
        if credit.assigned_to_id and linked_lead.assigned_to_id != credit.assigned_to_id:
            linked_lead.assigned_to_id = credit.assigned_to_id
            changed = True
            updated_count += 1

    if changed:
        db.commit()
    return {
        "processed": len(credit_stage_leads) + len(orphan_credits),
        "created": created_count,
        "updated": updated_count,
        "created_leads": created_leads,
    }


def _build_credit_feed(
    db: Session,
    current_user: models.User,
    status: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    effective_role_name = getattr(getattr(current_user, "role", None), "base_role_name", None) or getattr(getattr(current_user, "role", None), "name", None)
    credit_stage_lead_ids = []
    if current_user.company_id:
        sync_credit_applications_for_company(db, current_user.company_id)
        credit_stage_lead_ids = [
            lead_id for (lead_id,) in db.query(models.Lead.id).filter(
                models.Lead.company_id == current_user.company_id,
                models.Lead.status == models.LeadStatus.CREDIT_APPLICATION.value
            ).all()
        ]

    credits = []
    if current_user.company_id:
        company_credit_rows = db.query(models.CreditApplication).options(
            joinedload(models.CreditApplication.assigned_to)
        ).filter(
            models.CreditApplication.company_id == current_user.company_id
        ).order_by(models.CreditApplication.created_at.desc()).all()

        linked_credit_rows = []
        if credit_stage_lead_ids:
            linked_credit_rows = db.query(models.CreditApplication).options(
                joinedload(models.CreditApplication.assigned_to)
            ).filter(
                models.CreditApplication.lead_id.in_(credit_stage_lead_ids)
            ).order_by(models.CreditApplication.created_at.desc()).all()

        merged_by_id = {}
        for credit in [*linked_credit_rows, *company_credit_rows]:
            merged_by_id[credit.id] = credit
        credits = list(merged_by_id.values())
    else:
        credits = db.query(models.CreditApplication).options(
            joinedload(models.CreditApplication.assigned_to)
        ).order_by(models.CreditApplication.created_at.desc()).all()

    if effective_role_name in ['asesor', 'vendedor', 'aliado']:
        supervised_lead_ids = {
            lead_id for (lead_id,) in db.query(models.Lead.id).filter(
                models.Lead.supervisors.any(models.User.id == current_user.id)
            ).all()
        }
        credits = [
            credit for credit in credits
            if credit.assigned_to_id == current_user.id or (credit.lead_id in supervised_lead_ids)
        ]

    if status:
        credits = [credit for credit in credits if credit.status == status]

    if q:
        normalized_q = q.lower()
        credits = [
            credit for credit in credits
            if normalized_q in (credit.client_name or "").lower()
            or normalized_q in (credit.email or "").lower()
            or normalized_q in (credit.phone or "").lower()
            or normalized_q in (credit.desired_vehicle or "").lower()
        ]

    credits.sort(key=lambda credit: credit.created_at or 0, reverse=True)
    total = len(credits)
    credits = credits[skip:skip + limit]
    for credit in credits:
        if credit.status not in VALID_CREDIT_STATUSES:
            credit.status = models.CreditStatus.PENDING.value
    return {"items": credits, "total": total}


@router.post("/sync", status_code=200)
def sync_credit_board(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    result = sync_credit_applications_for_company(db, current_user.company_id)
    feed = _build_credit_feed(db, current_user, skip=0, limit=500)
    return {
        "message": "Solicitudes de credito resincronizadas correctamente",
        **result,
        "items": feed["items"],
        "total": feed["total"],
    }

@router.get("/", response_model=schemas.CreditApplicationList)
def read_credits(
    status: str = None,
    q: str = None,
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    return _build_credit_feed(
        db=db,
        current_user=current_user,
        status=status,
        q=q,
        skip=skip,
        limit=limit,
    )

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
        
    linked_lead_id = credit.lead_id
    if not linked_lead_id:
        auto_message = (credit.notes or "").strip() or f"Solicitud de crédito creada desde créditos."
        db_lead = models.Lead(
            source=models.LeadSource.OTHER.value,
            name=credit.client_name,
            email=credit.email,
            phone=credit.phone,
            status=models.LeadStatus.CREDIT_APPLICATION.value,
            message=auto_message[:1000],
            company_id=company_id,
            assigned_to_id=assigned_to_id,
            created_by_id=current_user.id,
            status_updated_at=datetime.datetime.utcnow(),
        )
        db.add(db_lead)
        db.flush()
        linked_lead_id = db_lead.id
        db.add(models.LeadHistory(
            lead_id=db_lead.id,
            user_id=current_user.id,
            previous_status="N/A",
            new_status=models.LeadStatus.CREDIT_APPLICATION.value,
            comment="Lead creado automáticamente desde nueva solicitud de crédito"
        ))

    db_credit = models.CreditApplication(
        **credit_data, 
        company_id=company_id, 
        assigned_to_id=assigned_to_id,
        lead_id=linked_lead_id
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
    
    previous_status = credit.status
    previous_notes = credit.notes or ""

    for field, value in credit_update.dict(exclude_unset=True).items():
        setattr(credit, field, value)

    db.commit()
    db.refresh(credit)

    if credit.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == credit.lead_id).first()
        if lead:
            lead_updates = []
            if previous_status != credit.status:
                status_message = f"Solicitud de crédito actualizada: {_credit_status_label(previous_status)} -> {_credit_status_label(credit.status)}"
                lead_updates.append(status_message)
                db.add(models.LeadHistory(
                    lead_id=lead.id,
                    user_id=current_user.id,
                    previous_status=lead.status,
                    new_status=lead.status,
                    comment=status_message
                ))

            if credit.notes and (credit.notes or "").strip() != previous_notes.strip():
                lead_updates.append(f"Nota en créditos actualizada: {credit.notes.strip()}")

            for message in lead_updates:
                db.add(models.LeadNote(
                    lead_id=lead.id,
                    user_id=current_user.id,
                    content=message
                ))

            if lead_updates:
                db.commit()

    return credit

@router.post("/{credit_id}/notes")
def add_credit_note(
    credit_id: int,
    note: schemas.CreditNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    credit = db.query(models.CreditApplication).filter(models.CreditApplication.id == credit_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="Credit Application not found")

    if current_user.company_id and credit.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    content = (note.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note content is required")

    stamped_note = f"[{current_user.full_name or current_user.email}] {content}"
    credit.notes = f"{credit.notes}\n{stamped_note}".strip() if credit.notes else stamped_note
    db.add(credit)

    lead_note = None
    if credit.lead_id:
        lead_note = models.LeadNote(
            lead_id=credit.lead_id,
            user_id=current_user.id,
            content=f"Nota desde solicitudes de crédito: {content}"
        )
        db.add(lead_note)
        db.add(models.LeadHistory(
            lead_id=credit.lead_id,
            user_id=current_user.id,
            previous_status=models.LeadStatus.CREDIT_APPLICATION.value,
            new_status=models.LeadStatus.CREDIT_APPLICATION.value,
            comment=f"Se agregó nota en solicitud de crédito: {content}"
        ))

    db.commit()
    db.refresh(credit)
    if lead_note:
        db.refresh(lead_note)
        lead_note = db.query(models.LeadNote).options(
            joinedload(models.LeadNote.user)
        ).filter(
            models.LeadNote.id == lead_note.id
        ).first()

    return {"credit": credit, "lead_note": lead_note}

@router.post("/{credit_id}/files", response_model=schemas.LeadFile)
async def upload_credit_file(
    credit_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    credit = db.query(models.CreditApplication).filter(models.CreditApplication.id == credit_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="Credit Application not found")

    if current_user.company_id and credit.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not credit.lead_id:
        raise HTTPException(status_code=400, detail="Credit application has no related lead")

    os.makedirs("static/leads", exist_ok=True)
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"static/leads/{unique_filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_file = models.LeadFile(
        lead_id=credit.lead_id,
        user_id=current_user.id,
        file_name=file.filename,
        file_path=f"/{file_path}",
        file_type=file.content_type
    )
    db.add(db_file)
    db.add(models.LeadNote(
        lead_id=credit.lead_id,
        user_id=current_user.id,
        content=f"Documento agregado desde solicitudes de crédito: {file.filename}"
    ))
    db.add(models.LeadHistory(
        lead_id=credit.lead_id,
        user_id=current_user.id,
        previous_status=models.LeadStatus.CREDIT_APPLICATION.value,
        new_status=models.LeadStatus.CREDIT_APPLICATION.value,
        comment=f"Documento adjuntado en solicitud de crédito: {file.filename}"
    ))
    db.commit()
    db.refresh(db_file)
    return db_file

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
