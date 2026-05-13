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
import json

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


def _is_purchase_request_record(record: Optional[models.CreditApplication]) -> bool:
    if not record:
        return False
    notes_text = (getattr(record, "notes", None) or "").strip().lower()
    purchase_markers = (
        "[purchase_request]",
        "solicitud de compra",
        "compra",
        "busqueda de vehiculo",
        "búsqueda de vehiculo",
        "busqueda del vehiculo",
        "búsqueda del vehículo",
    )
    return any(marker in notes_text for marker in purchase_markers)

BOGOTA_TZ = datetime.timezone(datetime.timedelta(hours=-5))


def _get_effective_role_name(user: Optional[models.User]) -> str:
    if not user or not getattr(user, "role", None):
        return ""
    return getattr(user.role, "base_role_name", None) or getattr(user.role, "name", None) or ""


def _build_lead_board_link(user: Optional[models.User], lead_id: int) -> str:
    role_name = _get_effective_role_name(user)
    if role_name == "aliado":
        return f"/aliado/dashboard?leadId={lead_id}"
    return f"/admin/leads?leadId={lead_id}"


def _get_credit_notification_recipient_ids(lead: Optional[models.Lead], credit: models.CreditApplication) -> set[int]:
    recipient_ids: set[int] = set()
    if getattr(lead, "assigned_to_id", None):
        recipient_ids.add(int(lead.assigned_to_id))
    if getattr(credit, "assigned_to_id", None):
        recipient_ids.add(int(credit.assigned_to_id))
    for supervisor in getattr(lead, "supervisors", []) or []:
        supervisor_id = getattr(supervisor, "id", None)
        if supervisor_id is not None:
            recipient_ids.add(int(supervisor_id))
    return recipient_ids


def _create_credit_status_notifications(
    db: Session,
    lead: Optional[models.Lead],
    credit: models.CreditApplication,
    current_user: models.User,
    previous_status: str,
    next_status: str,
    status_note: str,
):
    if not lead:
        return

    recipient_ids = _get_credit_notification_recipient_ids(lead, credit)
    recipient_ids.discard(int(current_user.id))
    if not recipient_ids:
        return

    lead_name = lead.name or credit.client_name or f"Lead {lead.id}"
    previous_label = _credit_status_label(previous_status)
    next_label = _credit_status_label(next_status)
    actor_name = current_user.full_name or current_user.email or "Un usuario"
    message = f"{actor_name} cambió {lead_name} de {previous_label} a {next_label}."
    if status_note:
        message = f"{message} Nota: {status_note}"

    for recipient_id in recipient_ids:
        recipient_user = db.query(models.User).filter(models.User.id == recipient_id).first()
        db.add(models.Notification(
            user_id=recipient_id,
            title="Actualización de crédito",
            message=message,
            type="info",
            link=_build_lead_board_link(recipient_user, lead.id)
        ))


def _normalize_credit_desired_vehicle(value: Optional[str]) -> str:
    normalized = " ".join(str(value or "").split()).strip()
    return normalized or "Por definir"


def _is_credit_manager_role(role: Optional[models.Role]) -> bool:
    if not role:
        return False
    role_names = {
        (getattr(role, "base_role_name", None) or "").strip().lower(),
        (getattr(role, "name", None) or "").strip().lower(),
    }
    role_names.discard("")
    return bool(role_names.intersection({
        "gestion_creditos",
        "gestion creditos",
        "gestion de creditos",
        "gestor de creditos",
        "gestor creditos",
        "coordinador_creditos",
        "coordinador credito",
        "coordinador de credito",
        "coordinador de creditos",
    }))


def _can_manage_credit_requests(user: Optional[models.User]) -> bool:
    role = getattr(user, "role", None)
    base_role_name = (getattr(role, "base_role_name", None) or "").strip().lower().replace("_", " ")
    system_role_name = (getattr(role, "name", None) or "").strip().lower().replace("_", " ")
    effective_role_name = base_role_name or system_role_name
    if effective_role_name in {"admin", "super_admin"}:
        return True
    if _is_credit_manager_role(role):
        return True

    if not role:
        return False

    permissions_raw = getattr(role, "permissions_json", None)
    try:
        permissions = json.loads(permissions_raw) if permissions_raw else []
    except Exception:
        permissions = []

    if not isinstance(permissions, list):
        permissions = []

    read_only_roles = {"asesor", "vendedor", "asesor vendedor", "aliado", "aliado estrategico"}
    return "credits" in permissions and base_role_name not in read_only_roles


def _is_active_user(user: Optional[models.User]) -> bool:
    return bool(user and (getattr(user, "is_active", True) or getattr(user, "is_active", None) is None))


def _get_credit_assignee_id(db: Session, lead: Optional[models.Lead]) -> Optional[int]:
    if not lead:
        return None

    assigned_user = getattr(lead, "assigned_to", None)
    if assigned_user and _is_active_user(assigned_user) and _is_credit_manager_role(getattr(assigned_user, "role", None)):
        return assigned_user.id

    for supervisor in getattr(lead, "supervisors", []) or []:
        if _is_active_user(supervisor) and _is_credit_manager_role(getattr(supervisor, "role", None)):
            return supervisor.id

    credit_user = db.query(models.User).options(joinedload(models.User.role)).filter(
        models.User.company_id == lead.company_id
    ).all()
    for user in credit_user:
        if _is_active_user(user) and _is_credit_manager_role(getattr(user, "role", None)):
            return user.id

    return lead.assigned_to_id


def _is_credit_stage_lead(lead: Optional[models.Lead]) -> bool:
    return bool(lead and lead.status in {
        models.LeadStatus.CREDIT_STUDY.value,
        models.LeadStatus.APPROVALS.value,
        models.LeadStatus.RESERVED.value,
        models.LeadStatus.PREPARATION.value,
        models.LeadStatus.SOLD.value,
    })


def _is_credit_board_entry(credit: models.CreditApplication) -> bool:
    if _is_purchase_request_record(credit):
        return False
    if not credit.lead_id:
        return True
    return _is_credit_stage_lead(getattr(credit, "lead", None))


def _credit_status_label(status_value: Optional[str]) -> str:
    return {
        models.CreditStatus.PENDING.value: "Solicitud recibida",
        models.CreditStatus.IN_REVIEW.value: "En estudio",
        models.CreditStatus.APPROVED.value: "Aprobado",
        models.CreditStatus.REJECTED.value: "No viable",
        models.CreditStatus.COMPLETED.value: "Vendido",
    }.get(status_value or "", status_value or "Sin estado")


def _append_credit_status_note(existing_notes: str, status_value: str, note: str) -> str:
    clean_note = " ".join((note or "").split()).strip()
    if not clean_note:
        return existing_notes or ""

    timestamp = datetime.datetime.now(BOGOTA_TZ).strftime("%d/%m/%Y %I:%M %p")
    status_label = _credit_status_label(status_value)
    stamped_note = f"[{timestamp}] Cambio de estado a {status_label}: {clean_note}"
    return f"{(existing_notes or '').rstrip()}\n{stamped_note}".strip()


def _append_credit_approval_summary(existing_notes: str, approved_amount: int, approval_percentage: int, approved_down_payment: int) -> str:
    stamped_note = (
        f"Datos de aprobación: monto aprobado ${int(approved_amount):,}".replace(",", ".")
        + f" | porcentaje aprobado {int(approval_percentage)}%"
        + f" | cuota inicial ${int(approved_down_payment):,}".replace(",", ".")
    )
    return f"{(existing_notes or '').rstrip()}\n{stamped_note}".strip()


def _infer_credit_status_from_lead_trace(db: Session, lead_id: int) -> Optional[str]:
    trace_rows: list[tuple[datetime.datetime, str]] = []

    for history in db.query(models.LeadHistory).filter(
        models.LeadHistory.lead_id == lead_id
    ).order_by(models.LeadHistory.created_at.desc()).limit(50).all():
        trace_rows.append((history.created_at or datetime.datetime.min, str(history.comment or "")))

    for note in db.query(models.LeadNote).filter(
        models.LeadNote.lead_id == lead_id
    ).order_by(models.LeadNote.created_at.desc()).limit(50).all():
        trace_rows.append((note.created_at or datetime.datetime.min, str(note.content or "")))

    for _, raw_text in sorted(trace_rows, key=lambda row: row[0], reverse=True):
        text = raw_text.lower()
        if "solicitud de compra" in text or "compra cancelada" in text or "busqueda de vehiculo" in text or "búsqueda de vehículo" in text:
            continue
        if "solicitud de crédito actualizada" in text or "nota en créditos" in text or "resumen para ventas" in text or "datos de aprobación" in text:
            if "aprobado" in text or "viable" in text:
                return models.CreditStatus.APPROVED.value
            if "no viable" in text or "rechazado" in text:
                return models.CreditStatus.REJECTED.value
            if "en estudio" in text:
                return models.CreditStatus.IN_REVIEW.value
            if "solicitud recibida" in text:
                return models.CreditStatus.PENDING.value

    return None


def _build_sales_credit_summary(credit: models.CreditApplication, approved_amount: int, approval_percentage: int, approved_down_payment: int) -> str:
    vehicle_label = (credit.desired_vehicle or "Por definir").strip()
    return (
        "Resumen para ventas: "
        f"vehículo {vehicle_label} | "
        f"monto aprobado ${int(approved_amount):,}".replace(",", ".")
        + f" | porcentaje aprobado {int(approval_percentage)}%"
        + f" | cuota inicial mínima ${int(approved_down_payment):,}".replace(",", ".")
    )


def _calculate_minimum_down_payment(approved_amount: int, approval_percentage: int) -> int:
    safe_approved_amount = int(approved_amount or 0)
    safe_approval_percentage = int(approval_percentage or 0)
    if safe_approved_amount <= 0 or safe_approval_percentage <= 0 or safe_approval_percentage > 100:
        return 0

    return max(0, round(safe_approved_amount * ((100 - safe_approval_percentage) / 100)))


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

    return _normalize_credit_desired_vehicle(desired_vehicle)


def sync_credit_applications_for_company(db: Session, company_id: int):
    credit_stage_leads = db.query(models.Lead).filter(
        models.Lead.company_id == company_id,
        models.Lead.status.in_([
            models.LeadStatus.CREDIT_STUDY.value,
            models.LeadStatus.APPROVALS.value,
            models.LeadStatus.RESERVED.value,
            models.LeadStatus.PREPARATION.value,
            models.LeadStatus.SOLD.value,
        ])
    ).all()

    orphan_credit_candidates = db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == company_id,
        models.CreditApplication.lead_id.is_(None)
    ).order_by(models.CreditApplication.created_at.desc()).all()
    orphan_credits = [credit for credit in orphan_credit_candidates if not _is_purchase_request_record(credit)]

    if not credit_stage_leads and not orphan_credits:
        return {"processed": 0, "created": 0, "updated": 0, "created_leads": 0}

    lead_ids = [lead.id for lead in credit_stage_leads]
    existing_credit_candidates = db.query(models.CreditApplication).filter(
        models.CreditApplication.lead_id.in_(lead_ids)
    ).order_by(models.CreditApplication.created_at.desc()).all()
    existing_credits = [credit for credit in existing_credit_candidates if not _is_purchase_request_record(credit)]

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
        credit_assignee_id = _get_credit_assignee_id(db, lead)
        inferred_credit_status = _infer_credit_status_from_lead_trace(db, lead.id)

        if current_credit:
            if current_credit.status == models.CreditStatus.APPROVED.value and lead.status == models.LeadStatus.CREDIT_STUDY.value:
                lead.status = models.LeadStatus.APPROVALS.value
                lead.status_updated_at = datetime.datetime.utcnow()
                changed = True
                updated_count += 1
            if current_credit.company_id != lead.company_id:
                current_credit.company_id = lead.company_id
                changed = True
                updated_count += 1
            if current_credit.assigned_to_id != credit_assignee_id:
                current_credit.assigned_to_id = credit_assignee_id
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
            expected_status = current_credit.status
            if lead.status == models.LeadStatus.SOLD.value:
                expected_status = models.CreditStatus.COMPLETED.value
            elif inferred_credit_status and lead.status in {
                models.LeadStatus.CREDIT_STUDY.value,
                models.LeadStatus.APPROVALS.value,
                models.LeadStatus.RESERVED.value,
                models.LeadStatus.PREPARATION.value,
            }:
                expected_status = inferred_credit_status
            if expected_status != current_credit.status:
                current_credit.status = expected_status
                changed = True
                updated_count += 1
            if not current_credit.notes:
                current_credit.notes = auto_note
                changed = True
                updated_count += 1
            continue

        if lead.status != models.LeadStatus.CREDIT_STUDY.value and not inferred_credit_status:
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
            status=(
                models.CreditStatus.COMPLETED.value
                if lead.status == models.LeadStatus.SOLD.value
                else (inferred_credit_status or models.CreditStatus.PENDING.value)
            ),
            notes=auto_note,
            company_id=lead.company_id,
            assigned_to_id=credit_assignee_id
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
            status=models.LeadStatus.CREDIT_STUDY.value,
            message=auto_message[:1000],
            company_id=credit.company_id,
            assigned_to_id=credit.assigned_to_id,
            created_by_id=None,
            status_updated_at=datetime.datetime.utcnow(),
        )
        db.add(db_lead)
        db.flush()

        credit.lead_id = db_lead.id
        if db_lead.status != models.LeadStatus.CREDIT_STUDY.value:
            db_lead.status = models.LeadStatus.CREDIT_STUDY.value

        db.add(models.LeadHistory(
            lead_id=db_lead.id,
            user_id=None,
            previous_status="N/A",
            new_status=models.LeadStatus.CREDIT_STUDY.value,
            comment=f"Lead creado automaticamente desde solicitud de crédito #{credit.id}"
        ))
        db.add(models.LeadNote(
            lead_id=db_lead.id,
            user_id=None,
            content=f"Solicitud de crédito #{credit.id} sincronizada automáticamente al tablero de leads."
        ))
        changed = True
        created_leads += 1

    # Important:
    # the credit board should reflect the lead flow, not override it.
    # If a linked credit application already exists, we keep the relationship,
    # but we do not push the lead back to credit stage or steal ownership from
    # the person who is actively managing the lead on the board.
    for credit in db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == company_id,
        models.CreditApplication.lead_id.isnot(None)
    ).all():
        if _is_purchase_request_record(credit):
            continue
        linked_lead = db.query(models.Lead).filter(models.Lead.id == credit.lead_id).first()
        if not linked_lead:
            continue

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
    supervised_lead_ids = set()
    if current_user.company_id:
        sync_credit_applications_for_company(db, current_user.company_id)
        credit_stage_lead_ids = [
            lead_id for (lead_id,) in db.query(models.Lead.id).filter(
                models.Lead.company_id == current_user.company_id,
                models.Lead.status.in_([
                    models.LeadStatus.CREDIT_STUDY.value,
                    models.LeadStatus.APPROVALS.value,
                    models.LeadStatus.RESERVED.value,
                    models.LeadStatus.PREPARATION.value,
                    models.LeadStatus.SOLD.value,
                ])
            ).all()
        ]
        supervised_lead_ids = {
            lead_id for (lead_id,) in db.query(models.Lead.id).filter(
                models.Lead.company_id == current_user.company_id,
                models.Lead.supervisors.any(models.User.id == current_user.id)
            ).all()
        }

    credits = []
    if current_user.company_id:
        company_credit_rows = db.query(models.CreditApplication).options(
            joinedload(models.CreditApplication.assigned_to),
            joinedload(models.CreditApplication.lead).joinedload(models.Lead.supervisors)
        ).filter(
            models.CreditApplication.company_id == current_user.company_id
        ).order_by(models.CreditApplication.created_at.desc()).all()

        linked_credit_rows = []
        if credit_stage_lead_ids:
            linked_credit_rows = db.query(models.CreditApplication).options(
                joinedload(models.CreditApplication.assigned_to),
                joinedload(models.CreditApplication.lead).joinedload(models.Lead.supervisors)
            ).filter(
                models.CreditApplication.lead_id.in_(credit_stage_lead_ids)
            ).order_by(models.CreditApplication.created_at.desc()).all()

        merged_by_id = {}
        for credit in [*linked_credit_rows, *company_credit_rows]:
            if _is_purchase_request_record(credit):
                continue
            merged_by_id[credit.id] = credit
        credits = [credit for credit in merged_by_id.values() if _is_credit_board_entry(credit)]
    else:
        credits = db.query(models.CreditApplication).options(
            joinedload(models.CreditApplication.assigned_to),
            joinedload(models.CreditApplication.lead).joinedload(models.Lead.supervisors)
        ).order_by(models.CreditApplication.created_at.desc()).all()
        credits = [credit for credit in credits if _is_credit_board_entry(credit)]

    if effective_role_name not in ['admin', 'super_admin']:
        credits = [
            credit for credit in credits
            if (
                credit.assigned_to_id == current_user.id
                or getattr(credit, "lead_id", None) in supervised_lead_ids
                or getattr(getattr(credit, "lead", None), "assigned_to_id", None) == current_user.id
            )
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
    if not _can_manage_credit_requests(current_user):
        raise HTTPException(
            status_code=403,
            detail="Solo gestión de créditos o administradores pueden modificar solicitudes de crédito"
        )

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


@router.get("/by-lead/{lead_id}", response_model=Optional[schemas.CreditApplication])
def read_credit_by_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).options(
        joinedload(models.Lead.supervisors)
    ).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if lead.company_id:
        sync_credit_applications_for_company(db, lead.company_id)

    credit_candidates = db.query(models.CreditApplication).options(
        joinedload(models.CreditApplication.assigned_to),
        joinedload(models.CreditApplication.lead).joinedload(models.Lead.supervisors)
    ).filter(
        models.CreditApplication.lead_id == lead_id
    ).order_by(
        models.CreditApplication.updated_at.desc(),
        models.CreditApplication.created_at.desc()
    ).all()
    credit = next((record for record in credit_candidates if not _is_purchase_request_record(record)), None)

    if not credit:
        return None

    effective_role_name = getattr(getattr(current_user, "role", None), "base_role_name", None) or getattr(getattr(current_user, "role", None), "name", None)
    lead_supervisor_ids = {supervisor.id for supervisor in (lead.supervisors or []) if supervisor and supervisor.id}
    lead_assigned_to_id = getattr(lead, "assigned_to_id", None)
    if effective_role_name not in ['admin', 'super_admin']:
        if (
            credit.assigned_to_id != current_user.id
            and current_user.id not in lead_supervisor_ids
            and lead_assigned_to_id != current_user.id
        ):
            raise HTTPException(status_code=403, detail="Not authorized")

    return credit

@router.post("/", response_model=schemas.CreditApplication)
def create_credit(
    credit: schemas.CreditApplicationCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not _can_manage_credit_requests(current_user):
        raise HTTPException(
            status_code=403,
            detail="Solo gestión de créditos o administradores pueden modificar solicitudes de crédito"
        )

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
            status=models.LeadStatus.CREDIT_STUDY.value,
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
            new_status=models.LeadStatus.CREDIT_STUDY.value,
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
    if not _can_manage_credit_requests(current_user):
        raise HTTPException(
            status_code=403,
            detail="Solo gestión de créditos o administradores pueden modificar solicitudes de crédito"
        )

    credit = db.query(models.CreditApplication).filter(models.CreditApplication.id == credit_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="Credit Application not found")
        
    if current_user.company_id and credit.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    previous_status = credit.status
    previous_notes = credit.notes or ""
    update_data = credit_update.dict(exclude_unset=True)
    status_note = (update_data.pop("status_note", None) or "").strip()
    requested_status = update_data.get("status", credit.status)
    approved_amount = update_data.get("approved_amount", credit.approved_amount)
    approval_percentage = update_data.get("approval_percentage", credit.approval_percentage)
    approved_down_payment = update_data.get("approved_down_payment", credit.approved_down_payment)

    if requested_status != previous_status and len(status_note) < 4:
        raise HTTPException(status_code=400, detail="Debes escribir una nota para cambiar el estado de la solicitud")

    if requested_status == models.CreditStatus.APPROVED.value:
        if approved_amount is None or int(approved_amount) <= 0:
            raise HTTPException(status_code=400, detail="Debes indicar el monto aprobado")
        if approval_percentage is None or int(approval_percentage) <= 0:
            raise HTTPException(status_code=400, detail="Debes indicar el porcentaje de aprobación")
        if int(approval_percentage) > 100:
            raise HTTPException(status_code=400, detail="El porcentaje financiado no puede ser mayor a 100")
        minimum_down_payment = _calculate_minimum_down_payment(int(approved_amount), int(approval_percentage))
        approved_down_payment = minimum_down_payment
        update_data["approved_down_payment"] = minimum_down_payment

    for field, value in update_data.items():
        setattr(credit, field, value)

    if requested_status != previous_status:
        credit.notes = _append_credit_status_note(credit.notes or "", requested_status, status_note)
    if requested_status == models.CreditStatus.APPROVED.value:
        credit.notes = _append_credit_approval_summary(
            credit.notes or "",
            int(approved_amount or 0),
            int(approval_percentage or 0),
            int(approved_down_payment or 0),
        )

    db.commit()
    db.refresh(credit)

    if credit.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == credit.lead_id).first()
        if lead:
            lead_updates = []
            lead_previous_status = lead.status
            lead_new_status = lead.status
            sales_credit_summary = None
            lead_status_changed = False

            if requested_status == models.CreditStatus.APPROVED.value and lead.status != models.LeadStatus.APPROVALS.value:
                lead.status = models.LeadStatus.APPROVALS.value
                lead.status_updated_at = datetime.datetime.utcnow()
                lead_new_status = lead.status
                lead_status_changed = True

            if previous_status != credit.status:
                status_message = f"Solicitud de crédito actualizada: {_credit_status_label(previous_status)} -> {_credit_status_label(credit.status)}"
                if status_note:
                    status_message = f"{status_message} | Nota: {status_note}"
                if requested_status == models.CreditStatus.APPROVED.value:
                    sales_credit_summary = _build_sales_credit_summary(
                        credit,
                        int(approved_amount or 0),
                        int(approval_percentage or 0),
                        int(approved_down_payment or 0),
                    )
                    status_message = (
                        f"{status_message} | Monto aprobado: ${int(approved_amount or 0):,}".replace(",", ".")
                        + f" | Porcentaje aprobado: {int(approval_percentage or 0)}%"
                        + f" | Cuota inicial: ${int(approved_down_payment or 0):,}".replace(",", ".")
                    )
                lead_updates.append(status_message)
                db.add(models.LeadHistory(
                    lead_id=lead.id,
                    user_id=current_user.id,
                    previous_status=lead_previous_status,
                    new_status=lead_new_status,
                    comment=status_message
                ))
                _create_credit_status_notifications(
                    db=db,
                    lead=lead,
                    credit=credit,
                    current_user=current_user,
                    previous_status=previous_status,
                    next_status=credit.status,
                    status_note=status_note,
                )

            if credit.notes and (credit.notes or "").strip() != previous_notes.strip():
                lead_updates.append(f"Nota en créditos actualizada: {credit.notes.strip()}")
            if sales_credit_summary:
                lead_updates.append(sales_credit_summary)

            for message in lead_updates:
                db.add(models.LeadNote(
                    lead_id=lead.id,
                    user_id=current_user.id,
                    content=message
                ))

            if lead_updates or lead_status_changed:
                db.commit()
                if requested_status == models.CreditStatus.APPROVED.value and lead.company_id:
                    from routers import purchases
                    purchases._sync_purchase_requests_for_company(db, lead.company_id)
                    db.commit()

    return credit

@router.post("/{credit_id}/notes")
def add_credit_note(
    credit_id: int,
    note: schemas.CreditNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not _can_manage_credit_requests(current_user):
        raise HTTPException(
            status_code=403,
            detail="Solo gestión de créditos o administradores pueden modificar solicitudes de crédito"
        )

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
            previous_status=models.LeadStatus.CREDIT_STUDY.value,
            new_status=models.LeadStatus.CREDIT_STUDY.value,
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
    if not _can_manage_credit_requests(current_user):
        raise HTTPException(
            status_code=403,
            detail="Solo gestión de créditos o administradores pueden modificar solicitudes de crédito"
        )

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
        previous_status=models.LeadStatus.CREDIT_STUDY.value,
        new_status=models.LeadStatus.CREDIT_STUDY.value,
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
