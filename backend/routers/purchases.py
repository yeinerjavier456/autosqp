from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from database import get_db
import models, schemas
from dependencies import get_current_user
import os
import shutil
import uuid
import json
import random
import datetime

router = APIRouter(
    prefix="/purchases",
    tags=["purchases"]
)


def _build_lead_board_link(target_user: Optional[models.User], lead_id: int) -> str:
    target_role_name = getattr(getattr(target_user, "role", None), "base_role_name", None) or getattr(getattr(target_user, "role", None), "name", None)
    base_path = "/aliado/dashboard" if target_role_name == "aliado" else "/admin/leads"
    return f"{base_path}?leadId={lead_id}"


def _normalize_role_text(value: Optional[str]) -> str:
    if not value:
        return ""
    normalized = str(value).strip().lower()
    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "Ã¡": "a",
        "Ã©": "e",
        "Ã­": "i",
        "Ã³": "o",
        "Ãº": "u",
        "_": " ",
        "-": " ",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return " ".join(normalized.split())


def _parse_role_permissions(role: Optional[models.Role]) -> list[str]:
    if not role or not getattr(role, "permissions_json", None):
        return []
    try:
        payload = json.loads(role.permissions_json)
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    return [str(item) for item in payload]


def _is_purchase_manager_role(role: Optional[models.Role]) -> bool:
    if not role:
        return False

    role_names = {
        _normalize_role_text(getattr(role, "name", None)),
        _normalize_role_text(getattr(role, "base_role_name", None)),
        _normalize_role_text(getattr(role, "label", None)),
    }
    role_names.discard("")

    explicit_purchase_role_names = {
        "compras",
        "gestor compras",
        "gestor de compras",
        "gestor compra",
        "gestor de compra",
        "comprador",
    }
    if role_names & explicit_purchase_role_names:
        return True

    return any("compra" in role_name for role_name in role_names)


def _get_purchase_manager_users(db: Session, company_id: int):
    candidates = db.query(models.User).join(models.Role, isouter=True).filter(
        models.User.company_id == company_id
    ).all()

    purchase_users = []
    purchase_enabled_users = []
    for user in candidates:
        role = getattr(user, "role", None)
        if not role:
            continue
        permissions = _parse_role_permissions(role)
        has_purchase_access = "purchase_board" in permissions or _is_purchase_manager_role(role)
        if not has_purchase_access:
            continue
        purchase_enabled_users.append(user)
        if _is_purchase_manager_role(role):
            purchase_users.append(user)

    return purchase_users or purchase_enabled_users


def _choose_purchase_manager(db: Session, company_id: int) -> Optional[models.User]:
    candidates = _get_purchase_manager_users(db, company_id)
    if not candidates:
        return None
    return random.choice(candidates)

VALID_PURCHASE_STATUSES = {
    models.CreditStatus.PENDING.value,
    models.CreditStatus.IN_REVIEW.value,
    models.CreditStatus.APPROVED.value,
    models.CreditStatus.REJECTED.value,
    models.CreditStatus.COMPLETED.value,
}


def _purchase_status_label(status_value: Optional[str]) -> str:
    return {
        models.CreditStatus.PENDING.value: "Solicitud recibida",
        models.CreditStatus.IN_REVIEW.value: "En búsqueda",
        models.CreditStatus.APPROVED.value: "Opciones encontradas",
        models.CreditStatus.REJECTED.value: "Sin resultado",
        models.CreditStatus.COMPLETED.value: "Cerrado",
    }.get(status_value or "", status_value or "Sin estado")


def _store_purchase_option_photos(files):
    os.makedirs("static/purchase-options", exist_ok=True)
    stored_paths = []
    for file in files:
        extension = file.filename.split(".")[-1]
        unique_filename = f"{uuid.uuid4()}.{extension}"
        file_path = f"static/purchase-options/{unique_filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        stored_paths.append(f"/{file_path}")
    return stored_paths


def _eligible_purchase_leads(db: Session, company_id: int):
    return db.query(models.Lead).options(
        joinedload(models.Lead.process_detail),
        joinedload(models.Lead.supervisors)
    ).filter(
        models.Lead.company_id == company_id,
        models.Lead.status == models.LeadStatus.INTERESTED.value,
        models.Lead.process_detail.has(models.LeadProcessDetail.has_vehicle == False),  # noqa: E712
        models.Lead.process_detail.has(models.LeadProcessDetail.desired_vehicle.isnot(None))
    ).all()


def _sync_purchase_requests_for_company(db: Session, company_id: int):
    leads = _eligible_purchase_leads(db, company_id)
    if not leads:
        return {"processed": 0, "created": 0, "updated": 0}

    compras_users = _get_purchase_manager_users(db, company_id)
    assigned_purchase_user = _choose_purchase_manager(db, company_id)
    assigned_compras_id = assigned_purchase_user.id if assigned_purchase_user else None

    processed = 0
    created = 0
    updated = 0
    changed = False

    for lead in leads:
        desired_vehicle = ((lead.process_detail.desired_vehicle if lead.process_detail else "") or "").strip()
        if not desired_vehicle:
            continue

        processed += 1
        safe_phone = (lead.phone or "").strip() or f"lead-{lead.id}"
        auto_note = f"Generado automaticamente desde lead #{lead.id} en estado En proceso para busqueda de vehiculo."

        purchase_request = db.query(models.CreditApplication).filter(
            models.CreditApplication.company_id == company_id,
            (
                (models.CreditApplication.lead_id == lead.id) |
                (
                    (models.CreditApplication.lead_id.is_(None)) &
                    (models.CreditApplication.phone == safe_phone) &
                    (models.CreditApplication.desired_vehicle == desired_vehicle)
                )
            )
        ).order_by(models.CreditApplication.created_at.desc()).first()

        if purchase_request:
            if purchase_request.lead_id != lead.id:
                purchase_request.lead_id = lead.id
                changed = True
                updated += 1
            if purchase_request.client_name != (lead.name or purchase_request.client_name):
                purchase_request.client_name = lead.name or purchase_request.client_name
                changed = True
                updated += 1
            if purchase_request.email != lead.email:
                purchase_request.email = lead.email
                changed = True
                updated += 1
            if purchase_request.desired_vehicle != desired_vehicle:
                purchase_request.desired_vehicle = desired_vehicle
                changed = True
                updated += 1
            if purchase_request.company_id != lead.company_id:
                purchase_request.company_id = lead.company_id
                changed = True
                updated += 1
            if assigned_compras_id and purchase_request.assigned_to_id != assigned_compras_id:
                purchase_request.assigned_to_id = assigned_compras_id
                changed = True
                updated += 1
            if not purchase_request.notes:
                purchase_request.notes = auto_note
                changed = True
                updated += 1
            if purchase_request.status not in VALID_PURCHASE_STATUSES:
                purchase_request.status = models.CreditStatus.PENDING.value
                changed = True
                updated += 1
            continue

        db.add(models.CreditApplication(
            lead_id=lead.id,
            client_name=lead.name or f"Lead {lead.id}",
            phone=safe_phone,
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
            assigned_to_id=assigned_compras_id
        ))
        changed = True
        created += 1

    if changed:
        db.commit()
    return {"processed": processed, "created": created, "updated": updated}


def _build_purchase_feed(
    db: Session,
    current_user: models.User,
    status: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
):
    if not current_user.company_id:
        return {"items": [], "total": 0}

    _sync_purchase_requests_for_company(db, current_user.company_id)
    eligible_leads = _eligible_purchase_leads(db, current_user.company_id)
    eligible_lead_ids = [lead.id for lead in eligible_leads]

    if not eligible_lead_ids:
        return {"items": [], "total": 0}

    purchases = db.query(models.CreditApplication).options(
        joinedload(models.CreditApplication.assigned_to)
    ).filter(
        models.CreditApplication.company_id == current_user.company_id,
        models.CreditApplication.lead_id.in_(eligible_lead_ids)
    ).order_by(models.CreditApplication.created_at.desc()).all()

    role_name = getattr(getattr(current_user, "role", None), "base_role_name", None) or getattr(getattr(current_user, "role", None), "name", None)
    if role_name in ["asesor", "vendedor", "aliado"]:
        supervised_lead_ids = {
            lead_id for (lead_id,) in db.query(models.Lead.id).filter(
                models.Lead.supervisors.any(models.User.id == current_user.id)
            ).all()
        }
        purchases = [
            item for item in purchases
            if item.assigned_to_id == current_user.id or item.lead_id in supervised_lead_ids
        ]

    if status:
        purchases = [item for item in purchases if item.status == status]

    if q:
        normalized_q = q.lower()
        purchases = [
            item for item in purchases
            if normalized_q in (item.client_name or "").lower()
            or normalized_q in (item.email or "").lower()
            or normalized_q in (item.phone or "").lower()
            or normalized_q in (item.desired_vehicle or "").lower()
        ]

    purchases.sort(key=lambda item: item.created_at or 0, reverse=True)
    total = len(purchases)
    purchases = purchases[skip:skip + limit]
    for item in purchases:
        if item.status not in VALID_PURCHASE_STATUSES:
            item.status = models.CreditStatus.PENDING.value
    return {"items": purchases, "total": total}


@router.get("/", response_model=schemas.CreditApplicationList)
def read_purchases(
    status: str = None,
    q: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return _build_purchase_feed(db, current_user, status=status, q=q, skip=skip, limit=limit)


@router.post("/sync")
def sync_purchase_board(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")

    result = _sync_purchase_requests_for_company(db, current_user.company_id)
    feed = _build_purchase_feed(db, current_user, skip=0, limit=500)
    return {
        "message": "Solicitudes de compra resincronizadas correctamente",
        **result,
        "items": feed["items"],
        "total": feed["total"],
    }


@router.put("/{purchase_id}", response_model=schemas.CreditApplication)
def update_purchase(
    purchase_id: int,
    purchase_update: schemas.CreditApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    purchase = db.query(models.CreditApplication).filter(models.CreditApplication.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    if current_user.company_id and purchase.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    previous_status = purchase.status
    previous_notes = purchase.notes or ""
    for field, value in purchase_update.dict(exclude_unset=True).items():
        setattr(purchase, field, value)

    db.commit()
    db.refresh(purchase)

    if purchase.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == purchase.lead_id).first()
        if lead:
            updates = []
            if previous_status != purchase.status:
                status_message = f"Busqueda de vehiculo actualizada: {_purchase_status_label(previous_status)} -> {_purchase_status_label(purchase.status)}"
                updates.append(status_message)
                db.add(models.LeadHistory(
                    lead_id=lead.id,
                    user_id=current_user.id,
                    previous_status=lead.status,
                    new_status=lead.status,
                    comment=status_message
                ))
            if purchase.notes and purchase.notes.strip() != previous_notes.strip():
                updates.append(f"Nota en compras actualizada: {purchase.notes.strip()}")
            for message in updates:
                db.add(models.LeadNote(
                    lead_id=lead.id,
                    user_id=current_user.id,
                    content=message
                ))
            if updates:
                db.commit()

    return purchase


@router.post("/{purchase_id}/notes")
def add_purchase_note(
    purchase_id: int,
    note: schemas.CreditNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    purchase = db.query(models.CreditApplication).filter(models.CreditApplication.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    if current_user.company_id and purchase.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    content = (note.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note content is required")

    stamped_note = f"[{current_user.full_name or current_user.email}] {content}"
    purchase.notes = f"{purchase.notes}\n{stamped_note}".strip() if purchase.notes else stamped_note
    db.add(purchase)

    lead_note = None
    if purchase.lead_id:
        lead_note = models.LeadNote(
            lead_id=purchase.lead_id,
            user_id=current_user.id,
            content=f"Nota desde compras: {content}"
        )
        db.add(lead_note)
        db.add(models.LeadHistory(
            lead_id=purchase.lead_id,
            user_id=current_user.id,
            previous_status=models.LeadStatus.INTERESTED.value,
            new_status=models.LeadStatus.INTERESTED.value,
            comment=f"Se agregó nota en busqueda de vehiculo: {content}"
        ))

    db.commit()
    db.refresh(purchase)
    if lead_note:
        db.refresh(lead_note)

    return {"purchase": purchase, "lead_note": lead_note}


@router.post("/{purchase_id}/files", response_model=schemas.LeadFile)
async def upload_purchase_file(
    purchase_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    purchase = db.query(models.CreditApplication).filter(models.CreditApplication.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    if current_user.company_id and purchase.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not purchase.lead_id:
        raise HTTPException(status_code=400, detail="Purchase request has no related lead")

    os.makedirs("static/leads", exist_ok=True)
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"static/leads/{unique_filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    db_file = models.LeadFile(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        file_name=file.filename,
        file_path=f"/{file_path}",
        file_type=file.content_type
    )
    db.add(db_file)
    db.add(models.LeadNote(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        content=f"Documento agregado desde compras: {file.filename}"
    ))
    db.add(models.LeadHistory(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        previous_status=models.LeadStatus.INTERESTED.value,
        new_status=models.LeadStatus.INTERESTED.value,
        comment=f"Documento adjuntado en busqueda de vehiculo: {file.filename}"
    ))
    db.commit()
    db.refresh(db_file)
    return db_file


@router.get("/{purchase_id}/options", response_model=list[schemas.PurchaseOption])
def get_purchase_options(
    purchase_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    purchase = db.query(models.CreditApplication).filter(models.CreditApplication.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if current_user.company_id and purchase.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not purchase.lead_id:
        return []
    return db.query(models.PurchaseOption).options(
        joinedload(models.PurchaseOption.user),
        joinedload(models.PurchaseOption.decision_user)
    ).filter(
        models.PurchaseOption.lead_id == purchase.lead_id
    ).order_by(models.PurchaseOption.created_at.desc()).all()


@router.post("/{purchase_id}/options", response_model=schemas.PurchaseOption)
async def create_purchase_option(
    purchase_id: int,
    title: str,
    description: str = "",
    photos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    purchase = db.query(models.CreditApplication).filter(models.CreditApplication.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase request not found")
    if current_user.company_id and purchase.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if not purchase.lead_id:
        raise HTTPException(status_code=400, detail="Purchase request has no related lead")
    if len(photos) < 3:
        raise HTTPException(status_code=400, detail="Debes adjuntar minimo 3 fotos por opcion")

    photo_paths = _store_purchase_option_photos(photos)
    option = models.PurchaseOption(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        title=title.strip(),
        description=(description or "").strip() or None,
        photos=photo_paths
    )
    db.add(option)
    db.add(models.LeadNote(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        content=f"Opción de vehículo agregada desde compras: {title.strip()}"
    ))
    db.add(models.LeadHistory(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        previous_status=models.LeadStatus.INTERESTED.value,
        new_status=models.LeadStatus.INTERESTED.value,
        comment=f"Se agregó opción de compra: {title.strip()}"
    ))
    lead = db.query(models.Lead).options(
        joinedload(models.Lead.assigned_to),
        joinedload(models.Lead.supervisors).joinedload(models.User.role)
    ).filter(models.Lead.id == purchase.lead_id).first()
    notified_user_ids = set()
    notification_targets = []
    if lead and lead.assigned_to_id and lead.assigned_to:
        notification_targets.append(lead.assigned_to)
    if lead and lead.supervisors:
        notification_targets.extend(list(lead.supervisors))

    for target_user in notification_targets:
        if not target_user or target_user.id in notified_user_ids or target_user.id == current_user.id:
            continue
        notified_user_ids.add(target_user.id)
        db.add(models.Notification(
            user_id=target_user.id,
            title="Nuevas opciones de vehículo",
            message=f"Se agregaron opciones para mostrar al lead {lead.name if lead else purchase.client_name}.",
            type="info",
            link=_build_lead_board_link(target_user, purchase.lead_id)
        ))
    db.commit()
    db.refresh(option)
    return option


@router.put("/options/{option_id}/decision", response_model=schemas.PurchaseOption)
def update_purchase_option_decision(
    option_id: int,
    decision_payload: schemas.PurchaseOptionDecisionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    option = db.query(models.PurchaseOption).options(
        joinedload(models.PurchaseOption.lead),
        joinedload(models.PurchaseOption.user),
        joinedload(models.PurchaseOption.decision_user)
    ).filter(models.PurchaseOption.id == option_id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Purchase option not found")

    lead = option.lead
    if current_user.company_id and (not lead or lead.company_id != current_user.company_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    decision_status = (decision_payload.decision_status or "").strip().lower()
    if decision_status not in {"accepted", "rejected"}:
        raise HTTPException(status_code=400, detail="Decision status must be accepted or rejected")

    decision_note = (decision_payload.decision_note or "").strip()
    if not decision_note:
        raise HTTPException(status_code=400, detail="Debes indicar una nota para aceptar o rechazar la opcion")

    option.decision_status = decision_status
    option.decision_note = decision_note
    option.decision_user_id = current_user.id
    option.decision_at = datetime.datetime.utcnow()

    action_label = "aceptó" if decision_status == "accepted" else "rechazó"
    option_label = option.title or "opción sin título"
    db.add(models.LeadNote(
        lead_id=option.lead_id,
        user_id=current_user.id,
        content=f"Se {action_label} la opción '{option_label}'. Nota: {decision_note}"
    ))
    db.add(models.LeadHistory(
        lead_id=option.lead_id,
        user_id=current_user.id,
        previous_status=models.LeadStatus.INTERESTED.value,
        new_status=models.LeadStatus.INTERESTED.value,
        comment=f"Se {action_label} la opción '{option_label}'. Nota: {decision_note}"
    ))

    if lead and lead.assigned_to_id and lead.assigned_to_id != current_user.id:
        target_user = db.query(models.User).options(joinedload(models.User.role)).filter(
            models.User.id == lead.assigned_to_id
        ).first()
        db.add(models.Notification(
            user_id=lead.assigned_to_id,
            title="Respuesta sobre opción de vehículo",
            message=f"Se {action_label} una opción para el lead {lead.name or 'sin nombre'}.",
            type="info",
            link=_build_lead_board_link(target_user, lead.id)
        ))

    db.commit()
    db.refresh(option)
    return option
