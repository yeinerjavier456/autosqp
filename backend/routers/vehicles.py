from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import models, schemas
from database import get_db
import os
import shutil
from import_vehicles_from_excel import import_inventory

# Attempting to import log_action_to_db (will require circular import bypassing if done wrong, but from main is fine if deferred)
# Instead of direct import which might cause circular loops since main imports routers, we'll rewrite log_action_to_db directly or use it inline:

def log_action_to_db(db: Session, user_id: int, action: str, entity_type: str, entity_id: int, details: str = None, ip_address: str = None):
    try:
        new_log = models.SystemLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        print(f"Failed to log action in router: {e}", flush=True)
        db.rollback()

router = APIRouter(
    prefix="/vehicles",
    tags=["vehicles"]
)

def get_effective_role_name(role) -> str:
    if not role:
        return ""
    if isinstance(role, str):
        return role.strip().lower()

    effective_name = getattr(role, "base_role_name", None) or getattr(role, "name", None) or ""
    normalized_name = str(effective_name).strip().lower()
    if normalized_name:
        return normalized_name

    label = getattr(role, "label", None) or ""
    normalized_label = str(label).strip().lower()
    if normalized_label in ["administrador de empresa", "administrador"]:
        return "admin"
    return normalized_label

def is_inventory_editor(current_user: models.User) -> bool:
    role_name = get_effective_role_name(current_user.role)
    return role_name in ["admin", "inventario"] or (role_name == "super_admin" and bool(current_user.company_id))

def is_inventory_admin(current_user: models.User) -> bool:
    role_name = get_effective_role_name(current_user.role)
    return role_name == "admin" or (role_name == "super_admin" and bool(current_user.company_id))

def ensure_inventory_editor(current_user: models.User):
    if not is_inventory_editor(current_user):
        raise HTTPException(status_code=403, detail="Solo usuarios de inventario o administradores pueden crear/editar vehÃ­culos")

def ensure_inventory_admin(current_user: models.User):
    if not is_inventory_editor(current_user):
        raise HTTPException(status_code=403, detail="Solo usuarios de inventario o administradores pueden desactivar vehículos")

@router.get("/public", response_model=List[schemas.Vehicle])
def get_public_vehicles(
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    mileage_min: Optional[int] = None,
    mileage_max: Optional[int] = None,
    color: Optional[str] = None,
    company_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Public endpoint to fetch available vehicles.
    No authentication required.
    """
    query = db.query(models.Vehicle).filter(
        or_(
            models.Vehicle.status == "available",
            models.Vehicle.status == "sold"
        )
    ).order_by(models.Vehicle.status.asc()) # 'available' comes before 'sold' alphabetically

    if company_id:
        query = query.filter(models.Vehicle.company_id == company_id)

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                models.Vehicle.make.ilike(search),
                models.Vehicle.model.ilike(search),
                models.Vehicle.description.ilike(search)
            )
        )

    if make:
        query = query.filter(models.Vehicle.make.ilike(f"%{make}%"))
    
    if model:
        query = query.filter(models.Vehicle.model.ilike(f"%{model}%"))

    if year_from:
        query = query.filter(models.Vehicle.year >= year_from)
    
    if year_to:
        query = query.filter(models.Vehicle.year <= year_to)

    if price_min:
        query = query.filter(models.Vehicle.price >= price_min)
    
    if price_max:
        query = query.filter(models.Vehicle.price <= price_max)

    if mileage_min:
        query = query.filter(models.Vehicle.mileage >= mileage_min)

    if mileage_max:
        query = query.filter(models.Vehicle.mileage <= mileage_max)
    
    if color:
        query = query.filter(models.Vehicle.color.ilike(f"%{color}%"))

    return query.order_by(models.Vehicle.created_at.desc() if hasattr(models.Vehicle, 'created_at') else models.Vehicle.id.desc()).offset(skip).limit(limit).all()

@router.get("/public/{vehicle_id}", response_model=schemas.Vehicle)
def get_public_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    """
    Public endpoint to fetch a single vehicle details.
    No authentication required.
    """
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id, models.Vehicle.status == "available").first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found or not available")
    return vehicle

@router.get("/makes", response_model=List[str])
def get_available_makes(db: Session = Depends(get_db)):
    """
    Get list of unique makes from available vehicles
    """
    makes = db.query(models.Vehicle.make).filter(models.Vehicle.status == "available").distinct().all()
    return [m[0] for m in makes if m[0]]

# --- CRUD Endpoints (Protected) ---
from dependencies import get_current_user

@router.post("/", response_model=schemas.Vehicle)
def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Create a new vehicle.
    Requires authentication.
    """
    ensure_inventory_editor(current_user)
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User has no company assigned")

    db_vehicle = models.Vehicle(**vehicle.dict())
    db_vehicle.company_id = current_user.company_id # Assign to user's company
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    
    # Log Action
    log_action_to_db(db, current_user.id, "CREATE", "Vehicle", db_vehicle.id, f"VehÃ­culo creado: {db_vehicle.make} {db_vehicle.model} ({db_vehicle.plate})")
    
    return db_vehicle

@router.get("/", response_model=schemas.VehicleList)
def read_vehicles(
    skip: int = 0, 
    limit: int = 100, 
    q: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all vehicles (internal/admin view).
    Could filter by company.
    """
    query = db.query(models.Vehicle)
    if current_user.company_id:
        query = query.filter(models.Vehicle.company_id == current_user.company_id)
    query = query.filter(models.Vehicle.status != "inactive")
    
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                models.Vehicle.make.ilike(search),
                models.Vehicle.model.ilike(search),
                models.Vehicle.plate.ilike(search)
            )
        )

    effective_status = status if is_inventory_editor(current_user) else "available"
    if effective_status:
        query = query.filter(models.Vehicle.status == effective_status)

    total = query.count()
    items = query.order_by(models.Vehicle.id.desc()).offset(skip).limit(limit).all()
    
    return {"items": items, "total": total}

@router.post("/upload")
def upload_vehicles_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Sube un archivo Excel y lanza el script de importaciÃ³n masiva.
    """
    ensure_inventory_editor(current_user)
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="El usuario no tiene una compaÃ±Ã­a asociada")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="El archivo debe ser un Excel (.xlsx o .xls)")

    # Save temp file
    temp_file_path = f"temp_upload_{file.filename}"
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Ejecutar el importador pasando la ruta temporal y el id de firma
        results = import_inventory(file_path=temp_file_path, default_company_id=current_user.company_id)
        
        if "error" in results:
            raise HTTPException(status_code=500, detail=results["error"])
            
        log_action_to_db(db, current_user.id, "IMPORT_EXCEL", "Vehicle", None, f"Importados correctamente mediante Excel")
            
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno durante la importaciÃ³n: {str(e)}")
    finally:
        # Clean up temp file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except:
                pass

@router.get("/{vehicle_id}", response_model=schemas.Vehicle)
def read_vehicle(vehicle_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Get a specific vehicle by ID.
    """
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle or vehicle.status == "inactive":
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Check permission (optional, depending on requirements)
    if current_user.company_id and vehicle.company_id != current_user.company_id:
        # maybe allow reading but not editing? Or just block
        pass 
        
    return vehicle

@router.put("/{vehicle_id}", response_model=schemas.Vehicle)
def update_vehicle(vehicle_id: int, vehicle_update: schemas.VehicleUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Update a vehicle.
    """
    ensure_inventory_editor(current_user)

    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not db_vehicle or db_vehicle.status == "inactive":
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if current_user.company_id and db_vehicle.company_id != current_user.company_id:
         raise HTTPException(status_code=403, detail="Not authorized to update this vehicle")

    update_data = vehicle_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_vehicle, key, value)

    db.commit()
    db.refresh(db_vehicle)
    
    log_action_to_db(db, current_user.id, "UPDATE", "Vehicle", db_vehicle.id, f"VehÃ­culo modificado: {db_vehicle.make} {db_vehicle.model}")
    
    return db_vehicle

@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Delete a vehicle.
    """
    ensure_inventory_admin(current_user)

    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    if current_user.company_id and db_vehicle.company_id != current_user.company_id:
         raise HTTPException(status_code=403, detail="Not authorized to deactivate this vehicle")

    vehicle_plate = db_vehicle.plate
    db_vehicle.status = "inactive"
    db.commit()
    
    log_action_to_db(db, current_user.id, "DEACTIVATE", "Vehicle", vehicle_id, f"Vehículo desactivado: placa {vehicle_plate}")
    
    return {"message": "Vehicle deactivated successfully"}


