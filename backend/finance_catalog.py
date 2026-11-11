import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
import models
from database import get_db
from dependencies import get_current_user, is_company_admin

CATEGORIES = [
    ('ingreso_venta', 'Ingresos por Venta'), ('costo_vehiculo', 'Costo de Vehículo (Compra)'),
    ('vehicle_purchase', 'Compra de Vehículo'), ('purchase_payment', 'Abono compra'),
    ('vehicle_separation', 'Separación del vehículo'), ('gasto_tramites', 'Gastos de Trámites y Alistamiento'),
    ('vehicle_expense', 'Gastos del Vehículo'), ('gasto_operativo', 'Gastos Operativos y Administrativos'),
    ('comisiones', 'Pago de Comisiones'), ('transferencia_cuentas', 'Transferencia entre cuentas'), ('otros', 'Otros Movimientos'),
]
CONCEPTS = [
    ('Venta de Vehiculo', 'ingreso_venta', 'income'), ('Compra de Vehiculo', 'costo_vehiculo', 'expense'),
    ('Abono compra', 'purchase_payment', 'expense'), ('Separación del vehículo', 'vehicle_separation', 'income'),
    *[(name, 'gasto_tramites', 'expense') for name in ['Traspaso / Tramites', 'Peritaje', 'Mantenimiento / Alistamiento', 'Lavado', 'Pago SOAT', 'Pago Impuestos']],
    ('Pago Comision', 'comisiones', 'expense'),
    *[(name, 'gasto_operativo', 'expense') for name in ['Pago Arriendo', 'Servicios Publicos', 'Pago Nomina', 'Publicidad']],
    ('Caja Menor', 'otros', 'expense'), ('Otros', 'otros', 'expense'),
]
router = APIRouter(prefix='/finance/catalog', tags=['finance catalog'])


class EntryInput(BaseModel):
    kind: str
    label: str = Field(min_length=1, max_length=180)
    category_code: str | None = None
    movement_type: str | None = None


def scoped(db, user):
    if not is_company_admin(user) or not user.company_id:
        raise HTTPException(403, 'Solo los administradores de la empresa pueden administrar el catálogo contable')
    return db.query(models.FinanceCatalogEntry).filter(models.FinanceCatalogEntry.company_id == user.company_id)


def seed(db, user):
    scoped(db, user)
    db.query(models.Company).filter(models.Company.id == user.company_id).with_for_update().first()
    if scoped(db, user).first():
        return
    for code, label in CATEGORIES:
        db.add(models.FinanceCatalogEntry(company_id=user.company_id, kind='category', code=code, label=label, is_active=True))
    for name, category, movement in CONCEPTS:
        db.add(models.FinanceCatalogEntry(company_id=user.company_id, kind='concept', code='concept_' + uuid.uuid4().hex, label=name, category_code=category, movement_type=movement, is_active=True))
    db.commit()


def serialize(entry):
    return dict(id=entry.id, kind=entry.kind, code=entry.code, label=entry.label,
        category_code=entry.category_code, movement_type=entry.movement_type, is_active=entry.is_active,
        protected=entry.code == 'transferencia_cuentas' or (entry.kind == 'concept' and entry.label == 'Otros'))


@router.get('')
def listing(db=Depends(get_db), user=Depends(get_current_user)):
    seed(db, user)
    return {'items': [serialize(entry) for entry in scoped(db, user).order_by(models.FinanceCatalogEntry.id).all()]}


@router.get('/options')
def form_options(db=Depends(get_db), user=Depends(get_current_user)):
    """Dropdown values, not the administrative configuration or inactive entries."""
    if not user.company_id:
        raise HTTPException(403, 'Debes tener una empresa asignada')
    entries = db.query(models.FinanceCatalogEntry).filter(
        models.FinanceCatalogEntry.company_id == user.company_id,
        models.FinanceCatalogEntry.is_active.is_(True),
    ).order_by(models.FinanceCatalogEntry.id).all()
    return {'items': [{key: value for key, value in serialize(entry).items() if key not in {'id', 'protected'}} for entry in entries]}


def validate(db, user, payload, exclude_id=None):
    label = payload.label.strip()
    if not label or payload.kind not in {'category', 'concept'}:
        raise HTTPException(400, 'Indica un tipo y nombre válidos')
    duplicate = scoped(db, user).filter(models.FinanceCatalogEntry.kind == payload.kind,
        func.lower(models.FinanceCatalogEntry.label) == label.lower(), models.FinanceCatalogEntry.is_active.is_(True))
    if exclude_id:
        duplicate = duplicate.filter(models.FinanceCatalogEntry.id != exclude_id)
    if duplicate.first():
        raise HTTPException(409, 'Ya existe una opción activa con ese nombre')
    if payload.kind == 'concept':
        category = scoped(db, user).filter(models.FinanceCatalogEntry.kind == 'category', models.FinanceCatalogEntry.code == payload.category_code, models.FinanceCatalogEntry.is_active.is_(True)).first()
        if not category or payload.movement_type not in {'income', 'expense'}:
            raise HTTPException(400, 'Selecciona una categoría activa y el tipo de movimiento')
        if category.code == 'transferencia_cuentas':
            raise HTTPException(400, 'Las transferencias se registran desde Cuentas para generar ambos movimientos')
    return label


@router.post('')
def create(payload: EntryInput, db=Depends(get_db), user=Depends(get_current_user)):
    seed(db, user)
    db.query(models.Company).filter(models.Company.id == user.company_id).with_for_update().first()
    label = validate(db, user, payload)
    entry = models.FinanceCatalogEntry(company_id=user.company_id, kind=payload.kind,
        code=('cat_' if payload.kind == 'category' else 'concept_') + uuid.uuid4().hex,
        label=label, category_code=payload.category_code if payload.kind == 'concept' else None,
        movement_type=payload.movement_type if payload.kind == 'concept' else None, is_active=True)
    db.add(entry)
    db.commit(); db.refresh(entry)
    return serialize(entry)


@router.put('/{entry_id}')
def update(entry_id: int, payload: EntryInput, db=Depends(get_db), user=Depends(get_current_user)):
    scoped(db, user)
    db.query(models.Company).filter(models.Company.id == user.company_id).with_for_update().first()
    entry = scoped(db, user).filter(models.FinanceCatalogEntry.id == entry_id, models.FinanceCatalogEntry.is_active.is_(True)).first()
    if not entry:
        raise HTTPException(404, 'Opción no encontrada en esta empresa')
    if entry.kind != payload.kind:
        raise HTTPException(400, 'El tipo de opción no puede cambiarse')
    if entry.kind == 'concept' and entry.label == 'Otros' and payload.label.strip() != 'Otros':
        raise HTTPException(400, 'Otros es una opción técnica para conceptos libres y conserva su nombre')
    entry.label = validate(db, user, payload, entry.id)
    if entry.kind == 'concept':
        entry.category_code = payload.category_code
        entry.movement_type = payload.movement_type
    db.commit(); db.refresh(entry)
    return serialize(entry)


@router.delete('/{entry_id}')
def remove(entry_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    scoped(db, user)
    db.query(models.Company).filter(models.Company.id == user.company_id).with_for_update().first()
    entry = scoped(db, user).filter(models.FinanceCatalogEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, 'Opción no encontrada en esta empresa')
    if serialize(entry)['protected']:
        raise HTTPException(400, 'Esta opción técnica es necesaria para registrar movimientos y no se puede eliminar')
    if entry.kind == 'category' and scoped(db, user).filter(models.FinanceCatalogEntry.kind == 'concept', models.FinanceCatalogEntry.category_code == entry.code, models.FinanceCatalogEntry.is_active.is_(True)).first():
        raise HTTPException(400, 'Primero cambia la categoría de los conceptos que la utilizan')
    entry.is_active = False
    db.commit()
    return {'message': 'Opción retirada de los formularios. Los movimientos existentes se conservan.'}


def category_label(db, company_id, code):
    cache = db.info.setdefault('finance_category_labels', {})
    if company_id not in cache:
        cache[company_id] = {entry.code: entry.label for entry in db.query(models.FinanceCatalogEntry).filter(models.FinanceCatalogEntry.company_id == company_id, models.FinanceCatalogEntry.kind == 'category').all()}
    return cache[company_id].get(code)
