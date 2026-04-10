
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas, database
from dependencies import get_current_user, get_db, ensure_can_modify_lead
import datetime
import os
from zoneinfo import ZoneInfo
from routers.rules import check_and_trigger_rules

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"]
)

BOGOTA_TZ = ZoneInfo("America/Bogota")
RULES_CHECK_INTERVAL_SECONDS = int(os.getenv("RULES_CHECK_INTERVAL_SECONDS", "45"))
LAST_RULES_CHECK_BY_COMPANY: dict[int, datetime.datetime] = {}

def maybe_run_automation_rules(db: Session, company_id: Optional[int]):
    if not company_id:
        return

    now_local = datetime.datetime.now(BOGOTA_TZ)
    last_run = LAST_RULES_CHECK_BY_COMPANY.get(company_id)
    if last_run and (now_local - last_run).total_seconds() < RULES_CHECK_INTERVAL_SECONDS:
        return

    check_and_trigger_rules(db)
    LAST_RULES_CHECK_BY_COMPANY[company_id] = now_local

@router.get("/", response_model=List[schemas.Notification])
def get_notifications(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        maybe_run_automation_rules(db, current_user.company_id)
    except Exception as exc:
        print(f"Notification rules check failed: {exc}")

    # Lazy check for reminders
    try:
        check_due_reminders(db, current_user.id)
    except Exception as exc:
        print(f"Notification reminder check failed: {exc}")

    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).offset(skip).limit(limit).all()
    
    return notifications

@router.post("/read/{notification_id}")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notification = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.is_read = 1
    db.commit()
    return {"message": "Notification marked as read"}

@router.post("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == 0
    ).update({"is_read": 1})
    db.commit()
    return {"message": "All notifications marked as read"}

# --- LEAD REMINDERS ---

@router.post("/leads/{lead_id}/reminders", response_model=schemas.LeadReminder)
def create_lead_reminder(
    lead_id: int,
    reminder: schemas.LeadReminderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify lead exists
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
         raise HTTPException(status_code=404, detail="Lead not found")
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    ensure_can_modify_lead(current_user, lead)

    db_reminder = models.LeadReminder(
        user_id=current_user.id,
        lead_id=lead_id,
        reminder_date=reminder.reminder_date,
        note=reminder.note
    )
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@router.get("/leads/{lead_id}/reminders", response_model=List[schemas.LeadReminder])
def get_lead_reminders(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    reminders = db.query(models.LeadReminder).filter(
        models.LeadReminder.lead_id == lead_id,
        models.LeadReminder.user_id == current_user.id
    ).order_by(models.LeadReminder.reminder_date.asc()).all()
    return reminders

def check_due_reminders(db: Session, user_id: int):
    """
    Checks for due reminders for this user that haven't been completed yet.
    Creates a notification and marks reminder as completed.
    """
    now = datetime.datetime.utcnow()
    
    due_reminders = db.query(models.LeadReminder).filter(
        models.LeadReminder.user_id == user_id,
        models.LeadReminder.is_completed == 0,
        models.LeadReminder.reminder_date <= now
    ).all()
    
    for reminder in due_reminders:
        # Create Notification
        lead_name = reminder.lead.name if reminder.lead else "Lead Desconocido"
        notification = models.Notification(
            user_id=user_id,
            title="Recordatorio de Lead",
            message=f"Recordatorio para {lead_name}: {reminder.note}",
            type="warning",
            link=f"/admin/leads?leadId={reminder.lead_id}"
        )
        db.add(notification)
        
        # Mark reminder as completed
        reminder.is_completed = 1
        
    if due_reminders:
        db.commit()
