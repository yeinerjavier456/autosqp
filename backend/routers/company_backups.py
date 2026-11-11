import datetime
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from jose import jwt, JWTError
from pydantic import BaseModel

import auth_utils
import company_backup as backups
import company_backup_jobs as jobs
import models
from database import get_db
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




@router.get('/{company_id}')
def listing(company_id: int, request: Request, db=Depends(get_db), user=Depends(get_current_user)):
    authorize(company_id, user, db, request)
    payload = backups.catalog(company_id)
    records = db.query(models.CompanyBackupJob).filter(models.CompanyBackupJob.company_id == company_id).order_by(models.CompanyBackupJob.created_at.desc()).limit(20).all()
    active = next((job for job in records if job.state in {'queued', 'running'}), None)
    payload['active_job'] = active.id if active else None
    payload['jobs'] = [jobs.serialize(job) for job in records]
    return payload


@router.post('/{company_id}/create', status_code=202)
def create(company_id: int, request: Request, db=Depends(get_db), user=Depends(get_current_user)):
    authorize(company_id, user, db, request)
    try:
        return {'job_id': jobs.enqueue(db, company_id, 'backup', actor=user.id)}
    except ValueError as error:
        raise HTTPException(409, str(error))


@router.post('/{company_id}/restore', status_code=202)
def restore(company_id: int, payload: Restore, request: Request, db=Depends(get_db), user=Depends(get_current_user)):
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
    try:
        return {'job_id': jobs.enqueue(db, company_id, 'restore', payload.backup_id, user.id)}
    except ValueError as error:
        raise HTTPException(409, str(error))


@router.get('/{company_id}/jobs/{job_id}')
def job_status(company_id: int, job_id: str, request: Request, db=Depends(get_db), user=Depends(get_current_user)):
    authorize(company_id, user, db, request)
    job = db.query(models.CompanyBackupJob).filter(models.CompanyBackupJob.id == job_id, models.CompanyBackupJob.company_id == company_id).first()
    if not job:
        raise HTTPException(404, 'Operación no encontrada en esta empresa')
    return jobs.serialize(job)


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
