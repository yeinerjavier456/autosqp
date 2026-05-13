from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
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

PURCHASE_STATUS_RECEIVED = models.CreditStatus.PENDING.value
PURCHASE_STATUS_SEARCH = models.CreditStatus.IN_REVIEW.value
PURCHASE_STATUS_OPTIONS = models.CreditStatus.APPROVED.value
PURCHASE_STATUS_REJECTED = models.CreditStatus.REJECTED.value
PURCHASE_STATUS_CLOSED = models.CreditStatus.COMPLETED.value
PURCHASE_STATUS_PURCHASE_PROCESS = "purchase_process"
PURCHASE_STATUS_CAR_PURCHASED = "car_purchased"
PURCHASE_EXPENSE_TYPES = {
    "traspaso",
    "peritaje",
    "llantas",
    "alistamiento",
    "kit de carretera",
    "arreglos",
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


def _can_manage_purchase_board(current_user: models.User) -> bool:
    role = getattr(current_user, "role", None)
    role_name = getattr(role, "base_role_name", None) or getattr(role, "name", None) or ""
    permissions = _parse_role_permissions(role)
    return role_name in {"admin", "super_admin"} or "purchase_board" in permissions or _is_purchase_manager_role(role)

VALID_PURCHASE_STATUSES = {
    PURCHASE_STATUS_RECEIVED,
    PURCHASE_STATUS_SEARCH,
    PURCHASE_STATUS_OPTIONS,
    PURCHASE_STATUS_REJECTED,
    PURCHASE_STATUS_CLOSED,
    PURCHASE_STATUS_PURCHASE_PROCESS,
    PURCHASE_STATUS_CAR_PURCHASED,
}


def _build_purchase_action_note(current_user: models.User, content: str) -> str:
    actor = current_user.full_name or current_user.email or "Sistema"
    return f"[{actor}] {content}".strip()


def _format_currency(value: Optional[int]) -> str:
    if value is None:
        return "$0"
    return f"${int(value):,}".replace(",", ".")


def _normalize_purchase_expenses(expenses_payload) -> list[dict]:
    if not expenses_payload:
        return []

    normalized_expenses = []
    for expense in expenses_payload:
        if hasattr(expense, "model_dump"):
            exp_dict = expense.model_dump()
        elif hasattr(expense, "dict"):
            exp_dict = expense.dict()
        elif isinstance(expense, dict):
            exp_dict = expense
        else:
            exp_dict = vars(expense) if hasattr(expense, "__dict__") else {}

        expense_type = str(exp_dict.get("expense_type") or "").strip()
        if not expense_type:
            raise HTTPException(status_code=400, detail="El tipo de gasto no puede estar vacío")

        amount = exp_dict.get("amount")
        if amount is None:
            raise HTTPException(status_code=400, detail=f"Debes indicar el valor para el gasto {expense_type}")

        try:
            normalized_amount = int(amount)
        except Exception:
            raise HTTPException(status_code=400, detail=f"El valor del gasto {expense_type} no es válido")

        if normalized_amount < 0:
            raise HTTPException(status_code=400, detail=f"El valor del gasto {expense_type} no puede ser negativo")

        normalized_expenses.append({
            "expense_type": expense_type,
            "amount": normalized_amount,
            "notes": str(exp_dict.get("notes") or "").strip() or None,
        })

    return normalized_expenses


def _build_car_purchased_note(purchase: models.CreditApplication) -> str:
    summary_items = []
    for item in (purchase.purchase_expenses or []):
        if not item: continue
        i_dict = item.model_dump() if hasattr(item, "model_dump") else item.dict() if hasattr(item, "dict") else item if isinstance(item, dict) else vars(item)
        summary_items.append(f"{str(i_dict.get('expense_type', '')).capitalize()}: {_format_currency(i_dict.get('amount', 0))}")
    expense_summary = ", ".join(summary_items) or "Sin gastos registrados"

    vehicle_bits = [
        purchase.purchase_vehicle_name,
        purchase.purchase_vehicle_model,
        str(purchase.purchase_vehicle_year or "").strip() or None,
        purchase.purchase_vehicle_plate,
    ]
    vehicle_label = " ".join(str(part).strip() for part in vehicle_bits if part).strip() or purchase.desired_vehicle or "Vehículo sin definir"

    detail_parts = [
        f"Carro comprado registrado: {vehicle_label}",
        f"Valor compra: {_format_currency(purchase.purchase_price)}",
        f"Valor venta: {_format_currency(purchase.purchase_sale_price)}",
        f"Gastos: {expense_summary}",
    ]
    if purchase.purchase_vehicle_mileage is not None:
        detail_parts.append(f"Kilometraje: {purchase.purchase_vehicle_mileage}")
    if purchase.purchase_vehicle_location:
        detail_parts.append(f"Ubicación: {purchase.purchase_vehicle_location}")

    return " | ".join(detail_parts)


def _is_purchase_board_entry(purchase: models.CreditApplication) -> bool:
    if not _is_purchase_request_record(purchase):
        return False
    lead = getattr(purchase, "lead", None)
    if not lead:
        return True

    if getattr(purchase, "status", None) in {PURCHASE_STATUS_CAR_PURCHASED, PURCHASE_STATUS_CLOSED, PURCHASE_STATUS_REJECTED}:
        return True

    detail = getattr(lead, "process_detail", None)
    desired_vehicle = ((getattr(detail, "desired_vehicle", None) or "").strip() if detail else "")
    has_vehicle = getattr(detail, "has_vehicle", None) if detail else None
    return bool(
        lead.status in {
            models.LeadStatus.RESERVED.value,
            models.LeadStatus.PREPARATION.value,
            models.LeadStatus.SOLD.value,
        }
        and has_vehicle is False
        and desired_vehicle
    )


def _purchase_status_label(status_value: Optional[str]) -> str:
    return {
        PURCHASE_STATUS_RECEIVED: "Solicitud recibida",
        PURCHASE_STATUS_SEARCH: "En búsqueda",
        PURCHASE_STATUS_OPTIONS: "Opciones encontradas",
        PURCHASE_STATUS_PURCHASE_PROCESS: "Proceso de compra",
        PURCHASE_STATUS_CAR_PURCHASED: "Carro comprado",
        PURCHASE_STATUS_REJECTED: "Sin resultado",
        PURCHASE_STATUS_CLOSED: "Cerrado",
    }.get(status_value or "", status_value or "Sin estado")


def _resolve_lead_status_for_history(lead: Optional[models.Lead], fallback: str = models.LeadStatus.RESERVED.value) -> str:
    status_value = getattr(lead, "status", None)
    return status_value or fallback


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


def _refresh_purchase_status_from_options(db: Session, purchase: Optional[models.CreditApplication]):
    if not purchase or not purchase.lead_id:
        return

    options = db.query(models.PurchaseOption).filter(
        models.PurchaseOption.lead_id == purchase.lead_id
    ).all()
    if not options:
        return

    statuses = [(option.decision_status or "pending").lower() for option in options]
    if any(status == "accepted" for status in statuses):
        purchase.status = PURCHASE_STATUS_PURCHASE_PROCESS
        return
    if all(status == "rejected" for status in statuses):
        purchase.status = PURCHASE_STATUS_REJECTED
        return
    purchase.status = PURCHASE_STATUS_OPTIONS


def _eligible_purchase_leads(db: Session, company_id: int):
    return db.query(models.Lead).options(
        joinedload(models.Lead.process_detail),
        joinedload(models.Lead.supervisors)
    ).filter(
        models.Lead.company_id == company_id,
        models.Lead.status.in_([
            models.LeadStatus.RESERVED.value,
            models.LeadStatus.PREPARATION.value,
            models.LeadStatus.SOLD.value,
        ]),
        models.Lead.process_detail.has(models.LeadProcessDetail.has_vehicle == False),  # noqa: E712
        models.Lead.process_detail.has(models.LeadProcessDetail.desired_vehicle.isnot(None))
    ).all()


def _get_linked_credit_request(db: Session, lead: Optional[models.Lead]) -> Optional[models.CreditApplication]:
    if not lead:
        return None

    credit_candidates = db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == lead.company_id,
        models.CreditApplication.lead_id == lead.id
    ).order_by(
        models.CreditApplication.updated_at.desc(),
        models.CreditApplication.created_at.desc()
    ).all()

    return next(
        (record for record in credit_candidates if not _is_purchase_request_record(record)),
        None
    )


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

        credit_request = _get_linked_credit_request(db, lead)
        approved_amount = getattr(credit_request, "approved_amount", None)
        approval_percentage = getattr(credit_request, "approval_percentage", None)
        approved_down_payment = getattr(credit_request, "approved_down_payment", None)

        processed += 1
        safe_phone = (lead.phone or "").strip() or f"lead-{lead.id}"
        auto_note = f"[PURCHASE_REQUEST] Generado automaticamente desde lead #{lead.id} en estado {lead.status} para busqueda de vehiculo."

        purchase_candidates = db.query(models.CreditApplication).filter(
            models.CreditApplication.company_id == company_id,
            (
                (models.CreditApplication.lead_id == lead.id) |
                (
                    (models.CreditApplication.lead_id.is_(None)) &
                    (models.CreditApplication.phone == safe_phone) &
                    (models.CreditApplication.desired_vehicle == desired_vehicle)
                )
            )
        ).order_by(
            models.CreditApplication.updated_at.desc(),
            models.CreditApplication.created_at.desc()
        ).all()
        purchase_request = next((record for record in purchase_candidates if _is_purchase_request_record(record)), None)

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
            if purchase_request.approved_amount != approved_amount:
                purchase_request.approved_amount = approved_amount
                changed = True
                updated += 1
            if purchase_request.approval_percentage != approval_percentage:
                purchase_request.approval_percentage = approval_percentage
                changed = True
                updated += 1
            if purchase_request.approved_down_payment != approved_down_payment:
                purchase_request.approved_down_payment = approved_down_payment
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
            approved_amount=approved_amount,
            approval_percentage=approval_percentage,
            approved_down_payment=approved_down_payment,
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
    purchases = db.query(models.CreditApplication).options(
        joinedload(models.CreditApplication.assigned_to),
        joinedload(models.CreditApplication.lead).joinedload(models.Lead.process_detail)
    ).filter(
        models.CreditApplication.company_id == current_user.company_id
    ).order_by(models.CreditApplication.created_at.desc()).all()
    purchases = [item for item in purchases if _is_purchase_board_entry(item)]

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


@router.get("/by-lead/{lead_id}", response_model=Optional[schemas.CreditApplication])
def read_purchase_by_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).options(
        joinedload(models.Lead.process_detail),
        joinedload(models.Lead.supervisors)
    ).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    purchase_candidates = db.query(models.CreditApplication).options(
        joinedload(models.CreditApplication.assigned_to),
        joinedload(models.CreditApplication.lead).joinedload(models.Lead.process_detail),
        joinedload(models.CreditApplication.lead).joinedload(models.Lead.supervisors)
    ).filter(
        models.CreditApplication.lead_id == lead_id
    ).order_by(
        models.CreditApplication.updated_at.desc(),
        models.CreditApplication.created_at.desc()
    ).all()
    purchase = next((record for record in purchase_candidates if _is_purchase_request_record(record)), None)

    if not purchase or not _is_purchase_board_entry(purchase):
        return None

    role_name = _normalize_role_text(
        getattr(getattr(current_user, "role", None), "base_role_name", None)
        or getattr(getattr(current_user, "role", None), "name", None)
    )
    lead_supervisor_ids = {supervisor.id for supervisor in (lead.supervisors or []) if supervisor and supervisor.id}
    lead_assigned_to_id = getattr(lead, "assigned_to_id", None)
    if role_name not in ["admin", "super admin"]:
        if (
            purchase.assigned_to_id != current_user.id
            and current_user.id not in lead_supervisor_ids
            and lead_assigned_to_id != current_user.id
        ):
            raise HTTPException(status_code=403, detail="Not authorized")

    return purchase


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


@router.post("/manual", response_model=schemas.CreditApplication)
def create_manual_purchase_request(
    payload: schemas.ManualPurchaseRequestCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="Company ID required")
    if not _can_manage_purchase_board(current_user):
        raise HTTPException(status_code=403, detail="No tienes permisos para crear solicitudes de compra")

    client_name = (payload.client_name or "").strip()
    phone = (payload.phone or "").strip()
    email = (payload.email or "").strip() or None
    desired_vehicle = (payload.desired_vehicle or "").strip()
    notes = (payload.notes or "").strip()

    if not client_name:
        raise HTTPException(status_code=400, detail="Debes indicar el nombre del cliente")
    if not phone:
        raise HTTPException(status_code=400, detail="Debes indicar el telefono del cliente")
    if not desired_vehicle:
        raise HTTPException(status_code=400, detail="Debes indicar el vehiculo que se esta buscando")

    lead = models.Lead(
        name=client_name,
        email=email,
        phone=phone,
        source="other",
        status=models.LeadStatus.RESERVED.value,
        message=notes or f"Solicitud manual de compra para buscar: {desired_vehicle}",
        company_id=current_user.company_id,
        assigned_to_id=current_user.id,
        created_by_id=current_user.id,
        created_at=datetime.datetime.utcnow()
    )
    db.add(lead)
    db.flush()

    db.add(models.LeadProcessDetail(
        lead_id=lead.id,
        has_vehicle=False,
        desired_vehicle=desired_vehicle
    ))
    db.add(models.LeadHistory(
        lead_id=lead.id,
        user_id=current_user.id,
        previous_status=None,
        new_status=models.LeadStatus.RESERVED.value,
        comment=notes or f"Solicitud manual creada desde compras. Vehiculo buscado: {desired_vehicle}"
    ))
    if notes:
        db.add(models.LeadNote(
            lead_id=lead.id,
            user_id=current_user.id,
            content=f"Nota inicial desde compras: {notes}"
        ))

    purchase = models.CreditApplication(
        lead_id=lead.id,
        client_name=client_name,
        phone=phone,
        email=email,
        desired_vehicle=desired_vehicle,
        monthly_income=0,
        other_income=0,
        occupation="employee",
        application_mode="individual",
        down_payment=0,
        status=models.CreditStatus.PENDING.value,
        notes=f"[PURCHASE_REQUEST] {(notes or f'Solicitud manual creada desde compras para buscar: {desired_vehicle}').strip()}",
        company_id=current_user.company_id,
        assigned_to_id=current_user.id
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


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
    requested_status = (purchase_update.status or "").strip().lower() if purchase_update.status is not None else None
    status_note = (purchase_update.status_note or "").strip()

    if requested_status and requested_status not in VALID_PURCHASE_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de compra no válido")

    if requested_status == PURCHASE_STATUS_REJECTED and not status_note:
        raise HTTPException(status_code=400, detail="Debes indicar el motivo para cancelar la solicitud")

    if previous_status == PURCHASE_STATUS_RECEIVED and requested_status == PURCHASE_STATUS_OPTIONS:
        raise HTTPException(status_code=400, detail="La primera solicitud no puede pasar directo a opciones encontradas. Debes aceptarla primero.")

    purchase_expenses_payload = purchase_update.purchase_expenses
    normalized_purchase_expenses = None
    if purchase_expenses_payload is not None:
        normalized_purchase_expenses = _normalize_purchase_expenses(purchase_expenses_payload)

    if requested_status == PURCHASE_STATUS_CAR_PURCHASED:
        required_purchase_fields = {
            "purchase_vehicle_name": purchase_update.purchase_vehicle_name,
            "purchase_vehicle_model": purchase_update.purchase_vehicle_model,
            "purchase_vehicle_year": purchase_update.purchase_vehicle_year,
            "purchase_price": purchase_update.purchase_price,
            "purchase_sale_price": purchase_update.purchase_sale_price,
        }
        missing_purchase_fields = [label for label, value in required_purchase_fields.items() if value in (None, "")]
        if missing_purchase_fields:
            raise HTTPException(status_code=400, detail="Debes completar los datos del carro, valor de compra y valor de venta para marcarlo como carro comprado")

    reservation_amount_payload = purchase_update.reservation_amount
    credit_used_amount_payload = purchase_update.credit_used_amount
    reservation_payment_method_payload = (purchase_update.reservation_payment_method or "").strip().lower() if purchase_update.reservation_payment_method is not None else None

    for field, value in purchase_update.dict(exclude_unset=True).items():
        if field == "status_note":
            continue
        if field in {"reservation_amount", "credit_used_amount", "reservation_payment_method"}:
            continue
        if field == "purchase_expenses":
            continue
        setattr(purchase, field, value)
    if normalized_purchase_expenses is not None:
        purchase.purchase_expenses = normalized_purchase_expenses

    if requested_status == PURCHASE_STATUS_SEARCH and previous_status == PURCHASE_STATUS_RECEIVED:
        acceptance_note = _build_purchase_action_note(
            current_user,
            "Solicitud de compra aceptada y enviada a búsqueda."
        )
        purchase.notes = f"{purchase.notes}\n{acceptance_note}".strip() if purchase.notes else acceptance_note
    elif requested_status == PURCHASE_STATUS_REJECTED and status_note:
        rejection_note = _build_purchase_action_note(
            current_user,
            f"Solicitud de compra cancelada. Motivo: {status_note}"
        )
        purchase.notes = f"{purchase.notes}\n{rejection_note}".strip() if purchase.notes else rejection_note
    elif requested_status == PURCHASE_STATUS_RECEIVED and previous_status == PURCHASE_STATUS_REJECTED:
        reassigned_manager = _choose_purchase_manager(db, purchase.company_id)
        if reassigned_manager:
            purchase.assigned_to_id = reassigned_manager.id
        reopen_note_content = status_note or "Solicitud reenviada a compras para una nueva búsqueda."
        reopen_note = _build_purchase_action_note(
            current_user,
            reopen_note_content
        )
        purchase.notes = f"{purchase.notes}\n{reopen_note}".strip() if purchase.notes else reopen_note
    elif requested_status == PURCHASE_STATUS_CAR_PURCHASED:
        purchased_note = _build_purchase_action_note(current_user, _build_car_purchased_note(purchase))
        purchase.notes = f"{purchase.notes}\n{purchased_note}".strip() if purchase.notes else purchased_note

    db.commit()
    db.refresh(purchase)

    if purchase.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == purchase.lead_id).first()
        if lead:
            lead_previous_status = lead.status
            detail = db.query(models.LeadProcessDetail).filter(
                models.LeadProcessDetail.lead_id == lead.id
            ).first()
            if detail:
                if purchase_update.desired_vehicle is not None:
                    detail.desired_vehicle = (purchase_update.desired_vehicle or "").strip() or detail.desired_vehicle
                if reservation_amount_payload is not None:
                    detail.reservation_amount = reservation_amount_payload
                if credit_used_amount_payload is not None:
                    detail.credit_used_amount = credit_used_amount_payload
                if reservation_payment_method_payload is not None:
                    detail.reservation_payment_method = reservation_payment_method_payload
                if requested_status == PURCHASE_STATUS_RECEIVED and previous_status == PURCHASE_STATUS_REJECTED:
                    detail.has_vehicle = False
                elif requested_status == PURCHASE_STATUS_CAR_PURCHASED:
                    detail.has_vehicle = True
                    if not detail.vehicle_id:
                        import datetime
                        # Create new vehicle
                        new_vehicle = models.Vehicle(
                            make=purchase_update.purchase_vehicle_name or "Desconocido",
                            model=purchase_update.purchase_vehicle_model,
                            year=purchase_update.purchase_vehicle_year or datetime.datetime.utcnow().year,
                            price=purchase_update.purchase_sale_price or 0,
                            purchase_price=purchase_update.purchase_price or 0,
                            plate=purchase_update.purchase_vehicle_plate,
                            mileage=purchase_update.purchase_vehicle_mileage,
                            location=purchase_update.purchase_vehicle_location,
                            status=models.VehicleStatus.RESERVED.value,
                            company_id=purchase.company_id
                        )
                        db.add(new_vehicle)
                        db.flush()
                        
                        detail.vehicle_id = new_vehicle.id
                        
                        # Create Pending Sale record for finances
                        sold_price = int(purchase_update.purchase_sale_price or 0)
                        seller_user = lead.assigned_to
                        commission_pct = seller_user.commission_percentage if seller_user and seller_user.commission_percentage else 0
                        commission_amount = int(sold_price * (commission_pct / 100))
                        car_cost = int(new_vehicle.purchase_price or 0)
                        expenses_cost = 0
                        for expense in normalized_purchase_expenses or []:
                            expenses_cost += int(expense.get('amount') or 0)
                        net_revenue = sold_price - commission_amount - car_cost - expenses_cost

                        new_sale = models.Sale(
                            vehicle_id=new_vehicle.id,
                            seller_id=seller_user.id if seller_user else None,
                            seller_type="internal",
                            company_id=purchase.company_id,
                            lead_id=lead.id,
                            sale_price=sold_price,
                            status=models.SaleStatus.PENDING.value,
                            commission_percentage=commission_pct,
                            commission_amount=commission_amount,
                            net_revenue=net_revenue,
                            sale_date=datetime.datetime.utcnow()
                        )
                        db.add(new_sale)
                        db.flush()

                        if new_vehicle.purchase_price and new_vehicle.purchase_price > 0:
                            db.add(models.PaymentReceipt(
                                company_id=purchase.company_id,
                                sale_id=new_sale.id,
                                user_id=current_user.id,
                                concept=f"Compra de vehículo {new_vehicle.make} {new_vehicle.model} - {new_vehicle.plate or 'Sin placa'}",
                                movement_type="expense",
                                amount=new_vehicle.purchase_price,
                                category="vehicle_purchase",
                                payment_date=datetime.datetime.utcnow()
                            ))
                        
                        for expense in normalized_purchase_expenses or []:
                            expense_type = expense.get('expense_type', 'otro')
                            amount = expense.get('amount', 0)
                            if amount > 0:
                                db.add(models.PaymentReceipt(
                                    company_id=purchase.company_id,
                                    sale_id=new_sale.id,
                                    user_id=current_user.id,
                                    concept=f"Gasto de compra: {expense_type}",
                                    movement_type="expense",
                                    amount=amount,
                                    category="vehicle_expense",
                                    notes=expense.get('notes'),
                                    payment_date=datetime.datetime.utcnow()
                                ))
            updates = []
            if previous_status != purchase.status:
                status_message = f"Busqueda de vehiculo actualizada: {_purchase_status_label(previous_status)} -> {_purchase_status_label(purchase.status)}"
                if purchase.status == PURCHASE_STATUS_REJECTED and status_note:
                    status_message = f"Solicitud de compra rechazada. Motivo: {status_note}"
                elif purchase.status == PURCHASE_STATUS_SEARCH and previous_status == PURCHASE_STATUS_RECEIVED:
                    status_message = "Solicitud de compra aceptada. Se inicia búsqueda de vehículo."
                elif purchase.status == PURCHASE_STATUS_RECEIVED and previous_status == PURCHASE_STATUS_REJECTED:
                    status_message = "Solicitud de compra reenviada a compras para nueva búsqueda."
                elif purchase.status == PURCHASE_STATUS_PURCHASE_PROCESS:
                    status_message = "Opción aceptada. La solicitud pasó a proceso de compra."
                elif purchase.status == PURCHASE_STATUS_CAR_PURCHASED:
                    status_message = (
                        f"{_build_car_purchased_note(purchase)}. "
                        "Vehículo asignado en inventario y venta registrada en finanzas."
                    )
                updates.append(status_message)
                db.add(models.LeadHistory(
                    lead_id=lead.id,
                    user_id=current_user.id,
                    previous_status=lead_previous_status,
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
        lead = db.query(models.Lead).filter(models.Lead.id == purchase.lead_id).first()
        lead_status_value = _resolve_lead_status_for_history(lead)
        lead_note = models.LeadNote(
            lead_id=purchase.lead_id,
            user_id=current_user.id,
            content=f"Nota desde compras: {content}"
        )
        db.add(lead_note)
        db.add(models.LeadHistory(
            lead_id=purchase.lead_id,
            user_id=current_user.id,
            previous_status=lead_status_value,
            new_status=lead_status_value,
            comment=f"Se agregó nota en busqueda de vehiculo: {content}"
        ))

    db.commit()
    db.refresh(purchase)
    if lead_note:
        db.refresh(lead_note)
        lead_note = db.query(models.LeadNote).options(
            joinedload(models.LeadNote.user)
        ).filter(
            models.LeadNote.id == lead_note.id
        ).first()

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
        previous_status=_resolve_lead_status_for_history(getattr(purchase, "lead", None)),
        new_status=_resolve_lead_status_for_history(getattr(purchase, "lead", None)),
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
    title: str = Form(...),
    description: str = Form(""),
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

    lead = db.query(models.Lead).options(
        joinedload(models.Lead.assigned_to),
        joinedload(models.Lead.supervisors).joinedload(models.User.role)
    ).filter(models.Lead.id == purchase.lead_id).first()

    photo_paths = _store_purchase_option_photos(photos)
    option = models.PurchaseOption(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        title=title.strip(),
        description=(description or "").strip() or None,
        photos=photo_paths
    )
    db.add(option)
    purchase.status = PURCHASE_STATUS_OPTIONS
    db.add(models.LeadNote(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        content=f"Opción de vehículo agregada desde compras: {title.strip()}"
    ))
    db.add(models.LeadHistory(
        lead_id=purchase.lead_id,
        user_id=current_user.id,
        previous_status=_resolve_lead_status_for_history(lead),
        new_status=_resolve_lead_status_for_history(lead),
        comment=f"Se agregó opción de compra: {title.strip()}"
    ))
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
    purchase = db.query(models.CreditApplication).filter(
        models.CreditApplication.lead_id == option.lead_id
    ).order_by(models.CreditApplication.created_at.desc()).first()

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
        previous_status=_resolve_lead_status_for_history(lead),
        new_status=_resolve_lead_status_for_history(lead),
        comment=f"Se {action_label} la opción '{option_label}'. Nota: {decision_note}"
    ))

    if purchase:
        stamped_note = f"[{current_user.full_name or current_user.email}] Se {action_label} la opción '{option_label}'. Nota: {decision_note}"
        purchase.notes = f"{purchase.notes}\n{stamped_note}".strip() if purchase.notes else stamped_note
        _refresh_purchase_status_from_options(db, purchase)

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
