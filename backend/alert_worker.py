"""One bounded alert batch per turn, independent of HTTP and browser polling."""
import datetime as dt
import os
from pathlib import Path
import time

from sqlalchemy import text
import models
from database import engine, SessionLocal
from routers.rules import process_rule_batch
from company_backup_jobs import log_error


def company_is_restoring(db, company_id):
    root = Path(os.getenv('AUTOSQP_COMPANY_BACKUP_ROOT', '/var/lib/autosqp-company-backups'))
    if (root / str(company_id) / 'restoring').exists():
        return True
    return db.query(models.CompanyBackupJob.id).filter(
        models.CompanyBackupJob.company_id == company_id,
        models.CompanyBackupJob.kind == 'restore',
        models.CompanyBackupJob.state == 'running',
    ).first() is not None


def serve():
    models.AlertRuleProgress.__table__.create(engine, checkfirst=True)
    cursor = 0
    print('Proceso de alertas iniciado: lotes de 100, avance persistente.', flush=True)
    while True:
        db = SessionLocal()
        rule_id = company_id = None
        try:
            if engine.dialect.name == 'mysql':
                db.execute(text('SET SESSION innodb_lock_wait_timeout=3'))
                db.execute(text('SET SESSION MAX_EXECUTION_TIME=5000'))
            row = db.query(models.AutomationRule.id, models.AutomationRule.company_id).filter(
                models.AutomationRule.is_active == 1,
                models.AutomationRule.event_type == 'time_in_status',
                models.AutomationRule.id > cursor,
            ).order_by(models.AutomationRule.id).first()
            if row is None:
                cursor = 0
                db.rollback()
                time.sleep(2)
                continue
            rule_id, company_id = row
            cursor = rule_id
            if company_is_restoring(db, company_id):
                db.rollback()
                continue
            processed = process_rule_batch(db, rule_id, company_id)
            if processed:
                progress = db.get(models.AlertRuleProgress, rule_id)
                print(f'Alert batch company={company_id} rule={rule_id} rows={processed} last_id={progress.last_lead_id}', flush=True)
        except Exception as error:
            db.rollback()
            log_error(f'Alert rule {rule_id}, company {company_id}', error)
            if rule_id and company_id:
                try:
                    progress = db.get(models.AlertRuleProgress, rule_id)
                    if progress is None:
                        progress = models.AlertRuleProgress(rule_id=rule_id, company_id=company_id)
                        db.add(progress)
                    progress.next_run_at = dt.datetime.utcnow() + dt.timedelta(seconds=60)
                    db.commit()
                except Exception as failure:
                    db.rollback()
                    log_error('Alert backoff', failure)
            time.sleep(2)
        finally:
            db.close()
        time.sleep(0.25)
