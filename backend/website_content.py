"""Validated tenant website content; no templates, HTML or executable snippets."""
import datetime as dt
from functools import lru_cache
import json
from io import BytesIO
from pathlib import Path
from typing import Dict, List
from urllib.parse import urlsplit, unquote

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
import models
import uuid


@lru_cache(maxsize=1)
def catalog():
    return json.loads((Path(__file__).resolve().parents[1] / 'public-site/content-defaults.json').read_text(encoding='utf-8'))


def safe_url(value, image=False):
    if not value:
        return value
    if any(ord(char) < 32 for char in value) or '\\' in value:
        raise ValueError('La URL contiene caracteres no permitidos')
    if value.startswith('/api/static/'):
        decoded = unquote(urlsplit(value).path)
        if any(part == '..' for part in decoded.split('/')) or any(ord(char) < 32 for char in decoded) or '\\' in decoded:
            raise ValueError('La ruta de imagen no está permitida')
        return value
    parsed = urlsplit(value)
    if parsed.scheme not in {'https', 'http'} or not parsed.hostname or parsed.username or parsed.password or any(ord(char) < 32 for char in value):
        raise ValueError('Usa una URL http/https válida o una imagen subida al servidor')
    return value


class WebsiteTestimonial(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=80, pattern=r'^[\w-]+$')
    name: str = Field(min_length=1, max_length=150)
    role: str = Field(default='', max_length=200)
    avatar: str = Field(default='', max_length=2000)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1, max_length=4000)
    vehiclePurchased: str = Field(default='', max_length=200)
    date: str = Field(default='', max_length=100)

    @model_validator(mode='after')
    def image_url(self):
        safe_url(self.avatar, image=True)
        return self


class WebsiteContentUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    revision: int = Field(ge=0)
    values: Dict[str, str] = Field(default_factory=dict)
    testimonials: List[WebsiteTestimonial] = Field(max_length=50)

    @model_validator(mode='after')
    def validate_fields(self):
        fields = {field['key']: field for field in catalog()['fields']}
        if len(self.values) > len(fields) or sum(len(value) for value in self.values.values()) > 500000:
            raise ValueError('El contenido supera el tamaño permitido')
        for key, value in self.values.items():
            if key not in fields or len(value) > 12000:
                raise ValueError('Uno de los campos no existe o supera el límite de texto')
            if fields[key]['kind'] == 'number' and value != '':
                if not value.isascii() or not value.isdigit() or int(value) > 1000000:
                    raise ValueError('Autos disponibles debe ser un número entero entre 0 y 1000000, o quedar vacío para usar el inventario')
            if fields[key]['kind'] in {'image', 'link'}:
                if fields[key]['kind'] == 'image' and not value.strip():
                    raise ValueError('Selecciona una imagen o restablece la imagen original')
                safe_url(value, image=fields[key]['kind'] == 'image')
        if len({item.id for item in self.testimonials}) != len(self.testimonials):
            raise ValueError('Los testimonios deben tener identificadores diferentes')
        return self


def ensure_global_editor(user):
    role = getattr(user, 'role', None)
    base = str(getattr(role, 'base_role_name', None) or getattr(role, 'name', '')).strip().lower()
    if base != 'super_admin':
        raise HTTPException(403, 'Solo un administrador global puede editar la página web de las empresas')


def read_content(db, company_id):
    if not db.query(models.Company.id).filter_by(id=company_id).first():
        raise HTTPException(404, 'Empresa no encontrada')
    row = db.get(models.CompanyWebsiteContent, company_id)
    content = row.website_content if row and isinstance(row.website_content, dict) else {}
    fields = {field['key'] for field in catalog()['fields']}
    return {'values': {key: value for key, value in (content.get('values') or {}).items() if key in fields and isinstance(value, str)},
        'testimonials': content.get('testimonials', catalog()['testimonials']),
        'revision': row.revision if row else 0, 'updated_at': row.updated_at if row else None}


def save_content(db, company_id, payload, actor_id):
    if not db.query(models.Company).filter_by(id=company_id).with_for_update().first():
        raise HTTPException(404, 'Empresa no encontrada')
    # Use a current/locking read, even if authentication already established an
    # older MySQL repeatable-read snapshot before waiting on the company lock.
    row = db.query(models.CompanyWebsiteContent).filter_by(company_id=company_id).with_for_update().first()
    if (row.revision if row else 0) != payload.revision:
        db.rollback()
        raise HTTPException(409, 'Otra persona modificó la página. Actualiza el contenido antes de guardar para no sobrescribir sus cambios.')
    if row is None:
        row = models.CompanyWebsiteContent(company_id=company_id)
        db.add(row)
    # Store only overrides; defaults stay versioned in the application.
    defaults = {field['key']: field['value'] for field in catalog()['fields']}
    row.website_content = {'values': {key: value for key, value in payload.values.items() if value != defaults[key]},
        'testimonials': [item.model_dump() for item in payload.testimonials]}
    row.revision = payload.revision + 1
    row.updated_at = dt.datetime.utcnow()
    row.updated_by_id = actor_id
    db.commit()
    return read_content(db, company_id)


def save_image(data, company_id, static_root='static'):
    from PIL import Image, ImageOps, UnidentifiedImageError
    if not data or len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, 'Selecciona una imagen PNG, JPG o WEBP de máximo 8 MB')
    try:
        with Image.open(BytesIO(data)) as original:
            if original.format not in {'PNG', 'JPEG', 'WEBP'} or original.width * original.height > 16000000:
                raise ValueError('Imagen no permitida o demasiado grande')
            image = ImageOps.exif_transpose(original).convert('RGBA')
            image.thumbnail((2400, 2400))
            directory = Path(static_root).resolve() / 'company-websites' / str(int(company_id))
            directory.mkdir(parents=True, exist_ok=True)
            filename = uuid.uuid4().hex + '.webp'
            image.save(directory / filename, format='WEBP', quality=90)
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, 'El archivo no es una imagen PNG, JPG o WEBP válida, o supera 16 megapíxeles')
    return {'url': f'/api/static/company-websites/{int(company_id)}/{filename}'}
