from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import models, schemas
from datetime import timedelta, datetime
from zoneinfo import ZoneInfo
from dependencies import get_current_user, get_db

router = APIRouter(
    prefix="/rules",
    tags=["Automation Rules"]
)

BOGOTA_TZ = ZoneInfo("America/Bogota")

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
    if current_user.role.name not in ['admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
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
    if current_user.role.name not in ['admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Filter by company
    if current_user.role.name == 'super_admin':
        return db.query(models.AutomationRule).all()
    else:
        return db.query(models.AutomationRule).filter(models.AutomationRule.company_id == current_user.company_id).all()

@router.put("/{rule_id}", response_model=schemas.AutomationRule)
def update_rule(
    rule_id: int,
    rule_update: schemas.AutomationRuleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role.name not in ['admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
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
    if current_user.role.name not in ['admin', 'super_admin']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
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
        func.max(models.SentAlertLog.sent_at).label("last_sent_at")
    ).filter(
        models.SentAlertLog.rule_id == rule.id,
        models.SentAlertLog.lead_id.in_(lead_ids)
    ).group_by(models.SentAlertLog.lead_id).all()
    last_sent_by_lead = {lead_id: last_sent_at for lead_id, last_sent_at in latest_log_rows}

    admin_recipient_ids = []
    if rule.recipient_type == 'all_admins':
        admins = db.query(models.User).join(models.Role).filter(
            models.User.company_id == rule.company_id,
            models.Role.name.in_(['admin', 'super_admin'])
        ).all()
        admin_recipient_ids = [u.id for u in admins]

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
            recipients = admin_recipient_ids
        elif recipient_id:
            recipients = [recipient_id]
            
        # Send Notification
        for uid in recipients:
            notification = models.Notification(
                user_id=uid,
                title=f"Alerta: {rule.name}",
                message=f"El lead {lead.name} ha estado en '{lead.status}' por más de {rule.time_value} {rule.time_unit}.",
                type="warning",
                link=f"/admin/leads?leadId={lead.id}"
            )
            db.add(notification)
        
        # Log it
        log = models.SentAlertLog(rule_id=rule.id, lead_id=lead.id)
        db.add(log)
        
    db.commit()

@router.post("/run-checks")
def trigger_checks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Manual trigger or called by frontend polling to lazy-evaluate rules.
    """
    check_and_trigger_rules(db)
    return {"status": "checked"}
