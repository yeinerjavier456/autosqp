"""Durable queue consumed by a separate systemd worker, never a web worker."""
import datetime as dt
import threading
import time
import uuid
import traceback

from sqlalchemy import or_, and_
import models
import company_backup as backups
from database import SessionLocal, Base
from db_work_lock import optional_work_lock

LEASE_SECONDS = 180


class CompanyWorkBusy(ValueError):
    pass


def log_error(context, error):
    """Keep driver codes and code locations, never SQL parameters or credentials."""
    original = getattr(error, 'orig', None)
    args = getattr(original, 'args', ())
    code = args[0] if args and isinstance(args[0], int) else None
    frames = ''.join(traceback.format_tb(error.__traceback__))
    print(f'{context}: {type(error).__name__}; database_code={code}\n{frames}', flush=True)


def serialize(job):
    return {name: getattr(job, name) for name in (
        'id', 'company_id', 'kind', 'state', 'backup_id', 'message', 'attempts',
        'created_at', 'started_at', 'finished_at', 'heartbeat_at',
    )}


def enqueue(db, company_id, kind, backup_id=None, actor=None):
    db.query(models.Company).filter(models.Company.id == company_id).with_for_update().first()
    active = db.query(models.CompanyBackupJob).filter(
        models.CompanyBackupJob.company_id == company_id,
        models.CompanyBackupJob.state.in_(['queued', 'running']),
    ).first()
    if active:
        # Repeated clicks/retries attach to the original operation.
        if active.kind == kind and active.backup_id == backup_id:
            db.commit()
            return active.id
        raise ValueError('Ya hay otra operación pendiente o en curso para esta empresa')
    job = models.CompanyBackupJob(id=uuid.uuid4().hex, company_id=company_id, kind=kind,
        backup_id=backup_id, requested_by=actor, state='queued', attempts=0,
        message='En cola. El proceso independiente del servidor iniciará la operación; puedes cambiar de pestaña.')
    db.add(job); db.commit(); db.refresh(job)
    return job.id


def claim(db, token, now=None):
    now = now or dt.datetime.utcnow()
    job = db.query(models.CompanyBackupJob).filter(or_(
        and_(models.CompanyBackupJob.state == 'queued', or_(models.CompanyBackupJob.lease_expires_at.is_(None), models.CompanyBackupJob.lease_expires_at <= now)),
        and_(models.CompanyBackupJob.state == 'running', models.CompanyBackupJob.kind == 'backup', models.CompanyBackupJob.lease_expires_at < now),
    )).order_by(models.CompanyBackupJob.created_at).with_for_update(skip_locked=True).first()
    if not job:
        db.rollback()
        return None
    job.state = 'running'
    job.worker_token = token
    job.attempts += 1
    job.started_at = job.started_at or now
    job.heartbeat_at = now
    job.lease_expires_at = now + dt.timedelta(seconds=LEASE_SECONDS)
    job.message = 'Creando copia en segundo plano. Puedes cerrar esta pestaña.' if job.kind == 'backup' else 'Restaurando la empresa en segundo plano.'
    job_id = job.id
    db.commit()
    return job_id


def heartbeat(job_id, token, stopped):
    while not stopped.wait(15):
        db = SessionLocal()
        try:
            now = dt.datetime.utcnow()
            changed = db.query(models.CompanyBackupJob).filter(
                models.CompanyBackupJob.id == job_id, models.CompanyBackupJob.worker_token == token,
                models.CompanyBackupJob.state == 'running',
            ).update({'heartbeat_at': now, 'lease_expires_at': now + dt.timedelta(seconds=LEASE_SECONDS)}, synchronize_session=False)
            db.commit()
            if not changed:
                return
        except Exception as error:
            db.rollback()
            log_error(f'Backup heartbeat {job_id}', error)
        finally:
            db.close()


def finish(job_id, token, state, message, backup_id=None):
    db = SessionLocal()
    try:
        values = dict(state=state, message=message[:1000], finished_at=dt.datetime.utcnow(), lease_expires_at=None)
        if backup_id:
            values['backup_id'] = backup_id
        db.query(models.CompanyBackupJob).filter(models.CompanyBackupJob.id == job_id,
            models.CompanyBackupJob.worker_token == token,
            models.CompanyBackupJob.state == 'running').update(values, synchronize_session=False)
        db.commit()
    finally:
        db.close()


def run_claimed(job_id, token):
    stopped = threading.Event()
    thread = threading.Thread(target=heartbeat, args=(job_id, token, stopped), daemon=True)
    thread.start()
    db = SessionLocal()
    job = db.query(models.CompanyBackupJob).filter(models.CompanyBackupJob.id == job_id, models.CompanyBackupJob.worker_token == token).first()
    if not job:
        stopped.set(); thread.join(); db.close(); return
    company_id, kind, selected, actor = job.company_id, job.kind, job.backup_id, job.requested_by
    entered = False
    restore_started = False
    try:
        with backups.tenant_lock(company_id):
            entered = True
            company = db.query(models.Company).filter(models.Company.id == company_id).first()
            if not company or not company.backups_enabled:
                raise ValueError('Las copias están desactivadas para esta empresa')
            if kind == 'restore':
                with optional_work_lock(db.get_bind(), f'autosqp-rules-{company_id}') as acquired:
                    if not acquired:
                        raise CompanyWorkBusy('Esperando a que termine el lote de alertas de esta empresa.')
                    (backups.tenant_dir(company_id) / 'restoring').write_text(job_id, encoding='utf-8')
                    restore_started = True
                    db.query(models.Company).filter(models.Company.id == company_id).with_for_update().first()
                    rescue = backups.restore_archive(db, Base.metadata, company_id, selected, 'static')
                message = f'Restauración terminada. Copia preventiva: {rescue}. Inicia sesión nuevamente si es necesario.'
                result_id = selected
            else:
                # If the worker stopped after publishing the ZIP but before updating
                # the job, adopt that archive instead of creating a second one.
                item = next((item for item in backups.catalog(company_id)['items'] if item.get('job_id') == job_id), None)
                if not item:
                    backups.prune(company_id)
                    item = backups.create_archive(db, Base.metadata, company_id, 'static', reason='manual' if actor else 'daily', job_id=job_id)
                    db.commit()
                result_id = item['id']
                message = 'Copia terminada y disponible para descargar.' if item['verified'] else 'Copia terminada con archivos faltantes. Revisa el listado; no se permite restaurar una copia incompleta.'
            db.add(models.SystemLog(company_id=company_id, user_id=None, action='COMPANY_RESTORE' if kind == 'restore' else 'COMPANY_BACKUP', entity_type='Company', entity_id=company_id, details=f'Operación {job_id}, solicitada por usuario #{actor}'))
            db.commit()
            finish(job_id, token, 'complete', message, result_id)
    except Exception as error:
        db.rollback()
        if isinstance(error, CompanyWorkBusy) or (not entered and isinstance(error, ValueError) and str(error).startswith('Ya hay una copia')):
            # Another process (e.g. the daily backup) owns the file lock. Wait,
            # rather than marking a valid request as failed/restarted.
            db.query(models.CompanyBackupJob).filter(models.CompanyBackupJob.id == job_id, models.CompanyBackupJob.worker_token == token).update({
                'state': 'queued', 'message': str(error) if isinstance(error, CompanyWorkBusy) else 'Esperando a que termine otra copia de esta empresa.',
                'lease_expires_at': dt.datetime.utcnow() + dt.timedelta(seconds=30),
            }, synchronize_session=False)
            db.commit()
        else:
            log_error(f'Backup job {job_id} failed', error)
            finish(job_id, token, 'failed', str(error) if isinstance(error, ValueError) else 'La operación falló. Revisa el registro del proceso de copias antes de reintentar.')
    finally:
        stopped.set(); thread.join(); db.close()
        if restore_started:
            (backups.tenant_dir(company_id) / 'restoring').unlink(missing_ok=True)


def review_interrupted_restores():
    """Backups can retry automatically. Interrupted restores need review because
    files may have been partially replaced; never silently repeat a destructive job."""
    db = SessionLocal()
    try:
        jobs = db.query(models.CompanyBackupJob).filter(models.CompanyBackupJob.kind == 'restore',
            models.CompanyBackupJob.state == 'running', models.CompanyBackupJob.lease_expires_at < dt.datetime.utcnow()).all()
        for job in jobs:
            try:
                with backups.tenant_lock(job.company_id):
                    finish(job.id, job.worker_token, 'failed', 'La restauración quedó sin señal de actividad del proceso. Revisa la copia preventiva y vuelve a restaurar antes de habilitar el trabajo normal de la empresa.')
            except ValueError:
                continue
    finally:
        db.close()


def serve():
    token = uuid.uuid4().hex
    print('Worker independiente de copias iniciado', flush=True)
    while True:
        db = SessionLocal()
        try:
            review_interrupted_restores()
            job_id = claim(db, token)
            if job_id:
                run_claimed(job_id, token)
            else:
                time.sleep(3)
        except Exception as error:
            db.rollback()
            log_error('Backup worker', error)
            time.sleep(5)
        finally:
            db.close()
