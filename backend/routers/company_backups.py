import datetime
import hashlib
import json
import os
from pathlib import Path
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from jose import jwt, JWTError
from pydantic import BaseModel

import auth_utils
import company_backup as backups
import models
from database import get_db, SessionLocal, Base
from dependencies import get_current_user, get_effective_role_name, is_company_admin

router = APIRouter(prefix='/company-backups', tags=['company backups'])


class Enabled(BaseModel):
    enabled: bool


class Password(BaseModel):
    password: str


class Restore(BaseModel):
    backup_id: str
    confirmation: str
    password: str


def company_scope(company_id, user, db):
    if not is_company_admin(user) or (user.company_id != company_id and get_effective_role_name(user) != 'super_admin'):
        raise HTTPException(403, 'No tienes acceso a las copias de esta empresa')
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(404, 'Empresa no encontrada')
    return company


def marker(company):
    return hashlib.sha256(str(company.finance_password_hash or '').encode()).hexdigest()


def authorize(company_id, user, db, request):
    company = company_scope(company_id, user, db)
    if not company.backups_enabled:
        raise HTTPException(403, 'Las copias de esta empresa están desactivadas por el administrador global')
    try:
        payload = jwt.decode(request.headers.get('X-Backup-Access-Token', ''), auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
        if payload.get('type') != 'company_backup_access' or int(payload['sub']) != user.id or payload['company_id'] != company_id or payload['marker'] != marker(company):
            raise ValueError()
    except (JWTError, KeyError, TypeError, ValueError):
        raise HTTPException(403, 'Ingresa nuevamente la contraseña de Cuentas para consultar las copias')
    return company


@router.get('/{company_id}/settings')
def settings(company_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    company = company_scope(company_id, user, db)
    return {'enabled': bool(company.backups_enabled), 'password_configured': bool(company.finance_password_hash)}


@router.put('/{company_id}/settings')
def save_settings(company_id: int, payload: Enabled, db=Depends(get_db), user=Depends(get_current_user)):
    if get_effective_role_name(user) != 'super_admin':
        raise HTTPException(403, 'Solo el administrador global puede activar o desactivar las copias')
    company = company_scope(company_id, user, db)
    if payload.enabled and not company.finance_password_hash:
        raise HTTPException(400, 'Primero configura la contraseña de Cuentas de esta empresa')
    company.backups_enabled = payload.enabled
    db.add(models.SystemLog(company_id=company_id, user_id=user.id, action='BACKUP_SETTINGS', entity_type='Company', entity_id=company_id, details=f'Copias por empresa: {payload.enabled}'))
    db.commit()
    return {'enabled': payload.enabled}


@router.post('/{company_id}/unlock')
def unlock(company_id: int, payload: Password, db=Depends(get_db), user=Depends(get_current_user)):
    company = company_scope(company_id, user, db)
    if not company.backups_enabled:
        raise HTTPException(403, 'Copias desactivadas para esta empresa')
    if not company.finance_password_hash or not auth_utils.verify_password(payload.password, company.finance_password_hash):
        raise HTTPException(403, 'Contraseña de Cuentas incorrecta o no configurada')
    token = auth_utils.create_access_token(data={'sub': str(user.id), 'company_id': company_id, 'type': 'company_backup_access', 'marker': marker(company)}, expires_delta=datetime.timedelta(minutes=15))
    return {'access_token': token}


def write_job(path, payload):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload), encoding='utf-8')
    os.replace(temporary, path)


def run_job(company_id, job_id, kind, backup_id, actor):
    path = backups.tenant_dir(company_id) / f'job-{job_id}.json'
    result = {'id': job_id, 'kind': kind, 'state': 'running', 'owner_pid': os.getpid(), 'message': 'Procesando; no cierres esta ventana'}
    write_job(path, result)
    db = SessionLocal()
    try:
        with backups.tenant_lock(company_id):
            company = db.query(models.Company).filter(models.Company.id == company_id).first()
            if not company or not company.backups_enabled:
                raise ValueError('Las copias se desactivaron para esta empresa')
            if kind == 'restore':
                (backups.tenant_dir(company_id) / 'restoring').write_text(job_id, encoding='utf-8')
                db.query(models.Company).filter(models.Company.id == company_id).with_for_update().first()
                preventive = backups.restore_archive(db, Base.metadata, company_id, backup_id, 'static')
                result['message'] = f'Empresa restaurada. Copia preventiva: {preventive}. Vuelve a iniciar sesión si es necesario.'
            else:
                item = backups.create_archive(db, Base.metadata, company_id, 'static', reason='manual')
                db.commit()
                backups.prune(company_id)
                result['message'] = 'Copia de la empresa creada' if item['verified'] else 'Copia creada con archivos faltantes; revisa el listado antes de restaurar'
            db.add(models.SystemLog(company_id=company_id, user_id=None, action='COMPANY_RESTORE' if kind == 'restore' else 'COMPANY_BACKUP', entity_type='Company', entity_id=company_id, details=f'Operación {job_id}, solicitada por usuario #{actor}'))
            db.commit()
            result['state'] = 'complete'
    except Exception as error:
        db.rollback()
        detail = str(error) if isinstance(error, ValueError) else 'La operación no pudo completarse. Revisa el servicio y la copia preventiva antes de reintentar.'
        print(f'Company backup job {job_id} ({company_id}) failed: {type(error).__name__}', flush=True)
        result.update(state='failed', message=detail)
    finally:
        db.close()
        if kind == 'restore':
            (backups.tenant_dir(company_id) / 'restoring').unlink(missing_ok=True)
        write_job(path, result)
        (backups.tenant_dir(company_id) / 'active-job').unlink(missing_ok=True)


def queue(company_id, tasks, kind, backup_id, actor):
    directory = backups.tenant_dir(company_id)
    job_id = uuid.uuid4().hex
    try:
        descriptor = os.open(directory / 'active-job', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise HTTPException(409, 'Ya hay una operación en curso para esta empresa. Si el servicio se reinició, solicita al administrador revisar active-job')
    with os.fdopen(descriptor, 'w') as handle:
        handle.write(job_id)
    write_job(directory / f'job-{job_id}.json', {'id': job_id, 'kind': kind, 'state': 'queued', 'owner_pid': os.getpid(), 'message': 'Operación en cola'})
    tasks.add_task(run_job, company_id, job_id, kind, backup_id, actor)
    return {'job_id': job_id}


@router.get('/{company_id}')
def listing(company_id: int, request: Request, db=Depends(get_db), user=Depends(get_current_user)):
    authorize(company_id, user, db, request)
    payload = backups.catalog(company_id)
    active = backups.tenant_dir(company_id) / 'active-job'
    payload['active_job'] = active.read_text().strip() if active.is_file() else None
    return payload


@router.post('/{company_id}/create', status_code=202)
def create(company_id: int, request: Request, tasks: BackgroundTasks, db=Depends(get_db), user=Depends(get_current_user)):
    authorize(company_id, user, db, request)
    return queue(company_id, tasks, 'backup', None, user.id)


@router.post('/{company_id}/restore', status_code=202)
def restore(company_id: int, payload: Restore, request: Request, tasks: BackgroundTasks, db=Depends(get_db), user=Depends(get_current_user)):
    company = authorize(company_id, user, db, request)
    if payload.confirmation != 'RESTAURAR EMPRESA' or not auth_utils.verify_password(payload.password, company.finance_password_hash):
        raise HTTPException(403, 'Confirma RESTAURAR EMPRESA e ingresa la contraseña de Cuentas')
    try:
        backups.archive_path(company_id, payload.backup_id)
        item = next((item for item in backups.catalog(company_id)['items'] if item['id'] == payload.backup_id), None)
        if not item or not item['verified']:
            raise ValueError('La copia está incompleta y no puede restaurarse')
    except ValueError as error:
        raise HTTPException(400, str(error))
    return queue(company_id, tasks, 'restore', payload.backup_id, user.id)


@router.get('/{company_id}/jobs/{job_id}')
def job_status(company_id: int, job_id: str, request: Request, db=Depends(get_db), user=Depends(get_current_user)):
    authorize(company_id, user, db, request)
    if not re_job_id(job_id):
        raise HTTPException(404, 'Operación no encontrada')
    path = backups.tenant_dir(company_id) / f'job-{job_id}.json'
    if not path.is_file():
        raise HTTPException(404, 'Operación no encontrada')
    payload = json.loads(path.read_text(encoding='utf-8'))
    if payload.get('state') in {'queued', 'running'}:
        try:
            os.kill(int(payload['owner_pid']), 0)
        except ProcessLookupError:
            payload.update(state='failed', message='El servicio se reinició durante la operación. Revisa la copia preventiva antes de repetir la restauración.')
            write_job(path, payload)
            (backups.tenant_dir(company_id) / 'active-job').unlink(missing_ok=True)
            (backups.tenant_dir(company_id) / 'restoring').unlink(missing_ok=True)
    return payload


def re_job_id(value):
    import re
    return bool(re.fullmatch('[a-f0-9]{32}', value))


@router.post('/{company_id}/{backup_id}/download-link')
def download_link(company_id: int, backup_id: str, request: Request, db=Depends(get_db), user=Depends(get_current_user)):
    company = authorize(company_id, user, db, request)
    try:
        backups.archive_path(company_id, backup_id)
    except ValueError as error:
        raise HTTPException(404, str(error))
    token = auth_utils.create_access_token(data={'sub': str(user.id), 'company_id': company_id, 'backup_id': backup_id, 'type': 'backup_download', 'marker': marker(company)}, expires_delta=datetime.timedelta(minutes=2))
    return {'url': f'/api/company-backups/download/file?ticket={token}'}


@router.get('/download/file')
def download(ticket: str, db=Depends(get_db)):
    try:
        payload = jwt.decode(ticket, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
        if payload['type'] != 'backup_download':
            raise ValueError()
        user = db.query(models.User).filter(models.User.id == int(payload['sub'])).first()
        if not user or not user.is_active:
            raise ValueError()
        company = company_scope(int(payload['company_id']), user, db)
        if not company.backups_enabled or payload['marker'] != marker(company):
            raise ValueError()
        path = backups.archive_path(company.id, payload['backup_id'])
    except (JWTError, ValueError, KeyError, TypeError):
        raise HTTPException(403, 'Enlace de descarga vencido o inválido')
    return FileResponse(path, media_type='application/zip', filename=f'empresa-{company.id}-{path.name}')
