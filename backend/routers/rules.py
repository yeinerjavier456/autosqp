from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
import models, schemas
from datetime import timedelta, datetime
import random
from zoneinfo import ZoneInfo
from dependencies import get_current_user, get_db

router = APIRouter(
    prefix="/rules",
    tags=["Automation Rules"]
)

BOGOTA_TZ = ZoneInfo("America/Bogota")

VALID_LEAD_STATUSES = {
    "new",
    "contacted",
    "in_process",
    "credit_study",
    "approvals",
    "reserved",
    "preparation",
    "lost",
    "sold",
}


def get_effective_role_name(user: models.User) -> str:
    role = getattr(user, "role", None)
    if not role:
        return ""
    return (getattr(role, "base_role_name", None) or getattr(role, "name", None) or "").strip()


def is_admin_user(user: Optional[models.User]) -> bool:
    if not user:
        return False
    role = getattr(user, "role", None)
    role_values = [
        getattr(role, "base_role_name", None),
        getattr(role, "name", None),
        getattr(role, "label", None),
    ]
    normalized = " ".join(str(value or "").strip().lower() for value in role_values)
    return (
        "super_admin" in normalized
        or "super admin" in normalized
        or "super administrador" in normalized
        or "admin" in normalized
        or "administrador" in normalized
    )


def ensure_rules_admin(current_user: models.User):
    if get_effective_role_name(current_user) not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Not authorized")


def validate_rule_payload(rule: schemas.AutomationRuleCreate):
    if rule.event_type != "time_in_status":
        raise HTTPException(status_code=400, detail="Tipo de evento inválido")
    if rule.condition_value not in VALID_LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de lead inválido")
    if rule.time_unit not in {"minutes", "hours", "days"}:
        raise HTTPException(status_code=400, detail="Unidad de tiempo inválida")
    if rule.time_value < 1:
        raise HTTPException(status_code=400, detail="El tiempo debe ser mayor a cero")
    if rule.recipient_type not in {"assigned_advisor", "all_admins", "specific_user"}:
        raise HTTPException(status_code=400, detail="Destinatario inválido")
    if rule.recipient_type == "specific_user" and not rule.specific_user_id:
        raise HTTPException(status_code=400, detail="Debes seleccionar un usuario")
    if rule.is_repeating and rule.repeat_interval < 1:
        raise HTTPException(status_code=400, detail="El intervalo de repetición debe ser mayor a cero")
    if rule.reassign_after_alerts_enabled:
        if rule.reassign_after_alerts_count < 1:
            raise HTTPException(status_code=400, detail="Debes indicar después de cuántas alertas se reasigna")
        if rule.reassign_after_alerts_count > 1 and not rule.is_repeating:
            raise HTTPException(status_code=400, detail="Para reasignar después de varias alertas debes activar la repetición")


def ensure_specific_user_scope(rule: schemas.AutomationRuleCreate, db: Session, current_user: models.User):
    if rule.recipient_type != "specific_user":
        return

    recipient = db.query(models.User).filter(models.User.id == rule.specific_user_id).first()
    if not recipient:
        raise HTTPException(status_code=400, detail="El usuario seleccionado no existe")
    if get_effective_role_name(current_user) != "super_admin" and recipient.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="No puedes asignar alertas a usuarios de otra empresa")


def is_advisor_user(user: models.User) -> bool:
    role = getattr(user, "role", None)
    role_text = " ".join([
        str(getattr(role, "base_role_name", "") or ""),
        str(getattr(role, "name", "") or ""),
        str(getattr(role, "label", "") or ""),
    ]).lower()
    return "asesor" in role_text or "vendedor" in role_text


def ensure_reassignment_user_scope(rule: schemas.AutomationRuleCreate, db: Session, current_user: models.User):
    if not rule.reassign_after_alerts_enabled or not rule.reassign_to_user_id:
        return

    target_user = db.query(models.User).join(models.Role, isouter=True).filter(
        models.User.id == rule.reassign_to_user_id
    ).first()
    if not target_user:
        raise HTTPException(status_code=400, detail="El usuario destino de reasignación no existe")
    if get_effective_role_name(current_user) != "super_admin" and target_user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="No puedes reasignar leads a usuarios de otra empresa")
    if not getattr(target_user, "is_active", True):
        raise HTTPException(status_code=400, detail="El usuario destino de reasignación está inactivo")
    if not is_advisor_user(target_user):
        raise HTTPException(status_code=400, detail="Solo puedes reasignar leads a asesores o vendedores")


def get_reassignment_candidates(db: Session, company_id: int, excluded_user_id: Optional[int] = None) -> List[models.User]:
    users = db.query(models.User).join(models.Role, isouter=True).filter(
        models.User.company_id == company_id,
        models.User.is_active == True
    ).all()
    return [
        user for user in users
        if user.id != excluded_user_id and is_advisor_user(user)
    ]


def build_rule_alert_message(rule: models.AutomationRule, lead: models.Lead, alert_count_after_current_log: int) -> str:
    message = (
        f"El lead {lead.name} ha estado en '{lead.status}' "
        f"por más de {rule.time_value} {rule.time_unit}."
    )
    if getattr(rule, "reassign_after_alerts_enabled", False):
        threshold = int(getattr(rule, "reassign_after_alerts_count", 0) or 0)
        remaining_alerts = max(threshold - alert_count_after_current_log, 0)
        if remaining_alerts > 0:
            remaining_minutes = remaining_alerts * int(getattr(rule, "repeat_interval", 0) or 0)
            message += (
                f" El lead será reasignado automáticamente si no es atendido "
                f"en los próximos {remaining_minutes} minutos."
            )
        else:
            message += " El lead será reasignado automáticamente en este momento si no fue atendido."
    return message


def perform_rule_reassignment_if_needed(
    db: Session,
    rule: models.AutomationRule,
    lead: models.Lead,
    alert_count_after_current_log: int
):
    if not getattr(rule, "reassign_after_alerts_enabled", False):
        return
    threshold = int(getattr(rule, "reassign_after_alerts_count", 0) or 0)
    target_user_id = getattr(rule, "reassign_to_user_id", None)
    if threshold < 1 or alert_count_after_current_log < threshold:
        return
    current_assigned_to_id = getattr(lead, "assigned_to_id", None)
    if target_user_id and current_assigned_to_id == target_user_id:
        return

    if target_user_id:
        target_user = db.query(models.User).join(models.Role, isouter=True).filter(
            models.User.id == target_user_id,
            models.User.company_id == rule.company_id
        ).first()
    else:
        candidates = get_reassignment_candidates(db, rule.company_id, excluded_user_id=current_assigned_to_id)
        target_user = random.choice(candidates) if candidates else None
    if not target_user or not getattr(target_user, "is_active", True) or not is_advisor_user(target_user):
        return

    previous_assigned_to_id = lead.assigned_to_id
    lead.assigned_to_id = target_user.id
    db.add(models.LeadHistory(
        lead_id=lead.id,
        user_id=target_user.id,
        previous_status=lead.status,
        new_status=lead.status,
        comment=(
            f"[AUTO_ALERT] Lead reasignado automaticamente a {target_user.full_name or target_user.email} "
            f"por regla '{rule.name}' tras {alert_count_after_current_log} apariciones de alerta."
        )
    ))
    db.add(models.Notification(
        user_id=target_user.id,
        title="Lead reasignado automáticamente",
        message=f"Se te reasignó el lead {lead.name} por falta de atención en estado {lead.status}.",
        type="warning",
        link=f"/admin/leads?leadId={lead.id}"
    ))
    if previous_assigned_to_id and previous_assigned_to_id != target_user.id:
        previous_user = db.query(models.User).join(models.Role, isouter=True).filter(
            models.User.id == previous_assigned_to_id
        ).first()
        if is_admin_user(previous_user):
            return
        db.add(models.Notification(
            user_id=previous_assigned_to_id,
            title="Lead reasignado por alerta",
            message=f"El lead {lead.name} fue reasignado automáticamente por la regla {rule.name}.",
            type="info",
            link=f"/admin/leads?leadId={lead.id}"
        ))

def now_utc_naive_from_bogota() -> datetime:
    # Business timezone is always Bogota; DB stores naive UTC timestamps.
    return datetime.now(BOGOTA_TZ).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

# --- CRUD Operations ---

@router.post("/", response_model=schemas.AutomationRule)
def create_rule(
    rule: schemas.AutomationRuleCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_rules_admin(current_user)
    validate_rule_payload(rule)
    ensure_specific_user_scope(rule, db, current_user)
    ensure_reassignment_user_scope(rule, db, current_user)
    
    # Force company_id from current user
    rule_data = rule.model_dump()
    new_rule = models.AutomationRule(**rule_data, company_id=current_user.company_id)
    
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule

@router.get("/", response_model=List[schemas.AutomationRule])
def get_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_rules_admin(current_user)
    
    # Filter by company
    if get_effective_role_name(current_user) == 'super_admin':
        return db.query(models.AutomationRule).all()
    else:
        return db.query(models.AutomationRule).filter(models.AutomationRule.company_id == current_user.company_id).all()


@router.post("/board-alerts")
def get_board_alerts(
    payload: dict = Body(default_factory=dict),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    company_id = current_user.company_id
    if not company_id:
        return []

    raw_lead_ids = payload.get("lead_ids") if isinstance(payload, dict) else []
    if not isinstance(raw_lead_ids, list):
        return []
    lead_ids = []
    for value in raw_lead_ids:
        try:
            lead_id = int(value)
        except (TypeError, ValueError):
            continue
        if lead_id > 0 and lead_id not in lead_ids:
            lead_ids.append(lead_id)
    if not lead_ids:
        return []

    lead_query = db.query(models.Lead).filter(
        models.Lead.company_id == company_id,
        models.Lead.deleted_at.is_(None),
        models.Lead.id.in_(lead_ids)
    )
    if get_effective_role_name(current_user) not in {"admin", "super_admin"}:
        lead_query = lead_query.filter(
            or_(
                models.Lead.assigned_to_id == current_user.id,
                models.Lead.supervisors.any(models.User.id == current_user.id)
            )
        )

    leads = lead_query.all()
    if not leads:
        return []

    rules = db.query(models.AutomationRule).filter(
        models.AutomationRule.company_id == company_id,
        models.AutomationRule.is_active == 1,
        models.AutomationRule.event_type == "time_in_status"
    ).all()
    if not rules:
        return []

    now = now_utc_naive_from_bogota()
    rules_by_status = {}
    for rule in rules:
        rules_by_status.setdefault(str(rule.condition_value or ""), []).append(rule)

    latest_log_rows = db.query(
        models.SentAlertLog.rule_id,
        models.SentAlertLog.lead_id,
        func.count(models.SentAlertLog.id).label("sent_count")
    ).filter(
        models.SentAlertLog.lead_id.in_([lead.id for lead in leads])
    ).group_by(models.SentAlertLog.rule_id, models.SentAlertLog.lead_id).all()
    sent_count_by_rule_lead = {
        (rule_id, lead_id): int(sent_count or 0)
        for rule_id, lead_id, sent_count in latest_log_rows
    }

    board_alerts = []
    for lead in leads:
        status_rules = rules_by_status.get(str(lead.status or ""))
        if not status_rules or not lead.status_updated_at:
            continue
        for rule in status_rules:
            if rule.time_unit == "minutes":
                delta = timedelta(minutes=rule.time_value)
            elif rule.time_unit == "hours":
                delta = timedelta(hours=rule.time_value)
            elif rule.time_unit == "days":
                delta = timedelta(days=rule.time_value)
            else:
                continue

            threshold_time = now - delta
            if lead.status_updated_at > threshold_time:
                continue

            sent_count = sent_count_by_rule_lead.get((rule.id, lead.id), 0)
            alert_count_after_current_log = sent_count + 1
            board_alerts.append({
                "lead_id": lead.id,
                "rule_id": rule.id,
                "rule_name": rule.name,
                "status": lead.status,
                "message": build_rule_alert_message(rule, lead, alert_count_after_current_log),
                "time_value": rule.time_value,
                "time_unit": rule.time_unit,
                "reassign_after_alerts_enabled": bool(getattr(rule, "reassign_after_alerts_enabled", False)),
            })
            break

    return board_alerts

@router.put("/{rule_id}", response_model=schemas.AutomationRule)
def update_rule(
    rule_id: int,
    rule_update: schemas.AutomationRuleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_rules_admin(current_user)
    validate_rule_payload(rule_update)
    ensure_specific_user_scope(rule_update, db, current_user)
    ensure_reassignment_user_scope(rule_update, db, current_user)
    
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if get_effective_role_name(current_user) != "super_admin" and db_rule.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for key, value in rule_update.model_dump().items():
        setattr(db_rule, key, value)
    
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.delete("/{rule_id}")
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_rules_admin(current_user)
    
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if get_effective_role_name(current_user) != "super_admin" and db_rule.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db.query(models.SentAlertLog).filter(models.SentAlertLog.rule_id == rule_id).delete(synchronize_session=False)

    db.delete(db_rule)
    db.commit()
    return {"message": "Rule deleted"}

# --- Logic Engine ---

def check_and_trigger_rules(db: Session):
    """
    Evaluates active rules against leads and generates notifications.
    """
    # optimization: fetch rules joined with company to check context if needed
    rules = db.query(models.AutomationRule).filter(models.AutomationRule.is_active == 1).all()
    
    for rule in rules:
        if rule.event_type == 'time_in_status':
            evaluate_time_in_status(db, rule)

def evaluate_time_in_status(db: Session, rule: models.AutomationRule):
    """
    Finds leads that have been in `rule.condition_value` status for longer than `rule.time_value`.
    """
    # Calculate threshold time
    now = now_utc_naive_from_bogota()
    delta = timedelta(minutes=0)
    if rule.time_unit == 'minutes':
        delta = timedelta(minutes=rule.time_value)
    elif rule.time_unit == 'hours':
        delta = timedelta(hours=rule.time_value)
    elif rule.time_unit == 'days':
        delta = timedelta(days=rule.time_value)
    
    threshold_time = now - delta
    
    # Query Leads
    # We look for leads in the statuses matching the rule AND matching the COMPANY
    # AND status_updated_at < threshold_time
    # AND NOT EXISTS in sent_log for this rule
    
    leads = db.query(models.Lead).filter(
        models.Lead.company_id == rule.company_id, # Must belong to same company
        models.Lead.status == rule.condition_value,
        models.Lead.status_updated_at <= threshold_time
    ).all()

    if not leads:
        return

    lead_ids = [lead.id for lead in leads]
    latest_log_rows = db.query(
        models.SentAlertLog.lead_id,
        func.max(models.SentAlertLog.sent_at).label("last_sent_at"),
        func.count(models.SentAlertLog.id).label("sent_count")
    ).filter(
        models.SentAlertLog.rule_id == rule.id,
        models.SentAlertLog.lead_id.in_(lead_ids)
    ).group_by(models.SentAlertLog.lead_id).all()
    last_sent_by_lead = {lead_id: last_sent_at for lead_id, last_sent_at, _ in latest_log_rows}
    sent_count_by_lead = {lead_id: int(sent_count or 0) for lead_id, _, sent_count in latest_log_rows}

    users_by_id = {
        user.id: user
        for user in db.query(models.User).join(models.Role, isouter=True).filter(
            models.User.company_id == rule.company_id
        ).all()
    }

    for lead in leads:
        last_sent_at = last_sent_by_lead.get(lead.id)
        
        if last_sent_at:
            if not rule.is_repeating:
                continue
            # If repeating, check interval
            time_since_last = now - last_sent_at
            if time_since_last < timedelta(minutes=rule.repeat_interval):
                continue
            
        # Determine Recipient
        recipient_id = None
        if rule.recipient_type == 'assigned_advisor':
            recipient_id = lead.assigned_to_id
        elif rule.recipient_type == 'specific_user':
            recipient_id = rule.specific_user_id
        
        # If 'all_admins', we might need to loop 
        recipients = []
        if rule.recipient_type == 'all_admins':
            recipients = []
        elif recipient_id:
            recipients = [recipient_id]
        recipients = [
            uid for uid in recipients
            if not is_admin_user(users_by_id.get(uid))
        ]
            
        alert_count_after_current_log = sent_count_by_lead.get(lead.id, 0) + 1
        notification_message = build_rule_alert_message(rule, lead, alert_count_after_current_log)

        # Send Notification
        for uid in recipients:
            notification = models.Notification(
                user_id=uid,
                title=f"Alerta: {rule.name}",
                message=notification_message,
                type="warning",
                link=f"/admin/leads?leadId={lead.id}"
            )
            db.add(notification)
        
        # Log it
        log = models.SentAlertLog(rule_id=rule.id, lead_id=lead.id)
        db.add(log)
        perform_rule_reassignment_if_needed(db, rule, lead, alert_count_after_current_log)
        
    db.commit()

import time

LAST_CHECK_TIME = 0
CHECK_INTERVAL = 60

@router.post("/run-checks")
def trigger_checks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Manual trigger or called by frontend polling to lazy-evaluate rules.
    Throttled globally to avoid locking the DB.
    """
    global LAST_CHECK_TIME
    current_time = time.time()
    
    # Solo ejecutar como maximo 1 vez por minuto
    if current_time - LAST_CHECK_TIME < CHECK_INTERVAL:
        return {"status": "skipped", "message": "Throttled to prevent DB locks"}
        
    LAST_CHECK_TIME = current_time
    
    try:
        check_and_trigger_rules(db)
    except Exception as e:
        # Reset on failure to allow retry
        LAST_CHECK_TIME = 0 
        raise e
        
    return {"status": "checked"}
