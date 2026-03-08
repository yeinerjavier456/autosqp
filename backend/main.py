from fastapi import FastAPI, Depends, HTTPException, status, Query, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, get_db
import models, schemas, auth_utils
from models import LeadNote, LeadFile # Explicitly for create_all to see them
from routers import whatsapp, credits, notifications, rules, vehicles, meta, tiktok # Import the new routers
from jose import JWTError, jwt
import datetime
import os
import traceback
import requests
import time
import re
import json
import random
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AutosQP API", description="API para gestión de compra venta de carros")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("CRITICAL ERROR IN REQUEST:", request.url, flush=True)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)}
    )

app.include_router(whatsapp.router) # Register the router
app.include_router(credits.router) # Register credits router
app.include_router(notifications.router)
app.include_router(rules.router)
app.include_router(vehicles.router)
app.include_router(meta.router)
app.include_router(tiktok.router)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://34.229.164.25:3000",
        "http://54.226.30.192:3000", # Old IP port
        "http://54.226.30.192", # Old Server IP
        "https://54.226.30.192", 
        "http://3.234.117.124:3000", # New Elastic IP port
        "http://3.234.117.124",      # New Elastic IP
        "https://3.234.117.124",     # New Elastic IP HTTPS
        "http://autosqp.co",         # Domain HTTP
        "https://autosqp.co",        # Domain HTTPS
        "http://www.autosqp.co",     # WWW Domain HTTP
        "https://www.autosqp.co",    # WWW Domain HTTPS
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
def ping():
    print("DEBUG: Ping called", flush=True)
    return {"message": "pong"}

from dependencies import get_current_user, oauth2_scheme

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth_utils.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth_utils.create_access_token(
        data={"sub": str(user.id), "role": user.role.name if user.role else "user"}
    )
    
    # Log the successful login
    log_action_to_db(db, user.id, "LOGIN", "Auth", user.id, "Usuario inició sesión exitosamente")
    
    return {"access_token": access_token, "token_type": "bearer"}

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
        print(f"Failed to log action: {e}", flush=True)
        db.rollback()

def is_inventory_editor(current_user: models.User) -> bool:
    role_name = current_user.role.name if current_user.role else ""
    return role_name in ["admin", "inventario"] or (role_name == "super_admin" and bool(current_user.company_id))

def is_company_admin_for_inventory(current_user: models.User) -> bool:
    role_name = current_user.role.name if current_user.role else ""
    return role_name == "admin" or (role_name == "super_admin" and bool(current_user.company_id))

def ensure_inventory_editor(current_user: models.User):
    if not is_inventory_editor(current_user):
        raise HTTPException(status_code=403, detail="Solo usuarios de inventario o administradores pueden crear/editar vehículos")

def ensure_inventory_admin_only(current_user: models.User):
    if not is_inventory_editor(current_user):
        raise HTTPException(status_code=403, detail="Solo usuarios de inventario o administradores pueden desactivar vehículos")

def enforce_ally_managed_status(
    db: Session,
    current_user: models.User,
    base_status: Optional[str],
    assigned_to_id: Optional[int] = None
) -> str:
    """
    Business rule:
    - If the actor is an 'aliado', the lead must be 'ally_managed'
    - If the lead is assigned to an 'aliado', the lead must be 'ally_managed'
    """
    if current_user.role and current_user.role.name == "aliado":
        return models.LeadStatus.ALLY_MANAGED.value

    if assigned_to_id:
        target_user = db.query(models.User).join(models.Role, isouter=True).filter(models.User.id == assigned_to_id).first()
        if target_user and target_user.role and target_user.role.name == "aliado":
            return models.LeadStatus.ALLY_MANAGED.value

    return base_status or models.LeadStatus.NEW.value



# --- USER ENDPOINTS ---

@app.get("/users/", response_model=schemas.UserList)
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    q: str = None, 
    role_id: int = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    today = datetime.datetime.utcnow()
    five_min_ago = today - datetime.timedelta(minutes=5)

    # Update current user last_active
    current_user.last_active = today
    db.commit()

    query = db.query(models.User)
    
    # If user belongs to a company, limit scope to that company specific users
    if current_user.company_id:
        query = query.filter(models.User.company_id == current_user.company_id)

    if q:
        query = query.filter(models.User.email.ilike(f"%{q}%"))
    
    if role_id:
        query = query.filter(models.User.role_id == role_id)
    
    total = query.count()
    users = query.offset(skip).limit(limit).all()

    # Compute is_online for each user
    for user in users:
        if user.last_active and user.last_active > five_min_ago:
            user.is_online = True
        else:
            user.is_online = False

    return {"items": users, "total": total}

@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    print(f"Creating user with payload: {user.dict()}") 
    
    # Verify role exists
    role_obj = db.query(models.Role).filter(models.Role.id == user.role_id).first()
    if not role_obj:
        raise HTTPException(status_code=400, detail="Invalid Role ID")

    # Check permissions and scope
    if current_user.company_id:
        user.company_id = current_user.company_id
        # Prevent creating Super Admins
        if role_obj.name == "super_admin":
             raise HTTPException(status_code=403, detail="Company admins cannot create Super Users")
    
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth_utils.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role_id=user.role_id, 
        company_id=user.company_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    log_action_to_db(db, current_user.id, "CREATE", "User", new_user.id, f"Usuario creado: {new_user.email} con Rol ID {new_user.role_id}")
    
    return new_user


# Keep this for backward compatibility or strict "me" endpoint
@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    print(f"Updating user {user_id} with: {user_update.dict()}") 
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_update.email:
        db_user.email = user_update.email
    if user_update.password:
        db_user.hashed_password = auth_utils.get_password_hash(user_update.password)
    if user_update.role_id is not None:
        print(f"Setting role_id to: {user_update.role_id}") 
        db_user.role_id = user_update.role_id
    if user_update.company_id is not None:
        db_user.company_id = user_update.company_id
    
    # Update new fields
    if user_update.full_name is not None:
        db_user.full_name = user_update.full_name
    if user_update.commission_percentage is not None:
        db_user.commission_percentage = user_update.commission_percentage
    if user_update.base_salary is not None:
        db_user.base_salary = user_update.base_salary
    if user_update.payment_dates is not None:
        db_user.payment_dates = user_update.payment_dates
        
    try:
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    log_action_to_db(db, current_user.id, "UPDATE", "User", db_user.id, f"Usuario modificado: {db_user.email}")
        
    return db_user

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Check if the executing user has permission (Admin or Super Admin)
    role_obj = db.query(models.Role).filter(models.Role.id == current_user.role_id).first()
    if not role_obj or role_obj.name not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar usuarios")
        
    # 2. Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    # 3. Find user
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    # 4. If current user is just 'admin', they can only delete users in their same company
    if role_obj.name == "admin":
        if db_user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="No puedes eliminar usuarios de otra empresa")
            
        # Prevent 'admin' from deleting a 'super_admin'
        target_role = db.query(models.Role).filter(models.Role.id == db_user.role_id).first()
        if target_role and target_role.name == "super_admin":
            raise HTTPException(status_code=403, detail="No puedes eliminar a un Súper Administrador")
            
    user_email_snapshot = db_user.email
            
    try:
        # 5. Remove relationships before deleting to avoid MySQL Integrity Error 1451
        db.query(models.LeadHistory).filter(models.LeadHistory.user_id == user_id).update({"user_id": None})
        db.query(models.Lead).filter(models.Lead.assigned_to_id == user_id).update({"assigned_to_id": None})
        db.query(models.Lead).filter(models.Lead.created_by_id == user_id).update({"created_by_id": None})
        db.query(models.Sale).filter(models.Sale.seller_id == user_id).update({"seller_id": None})
        
        db.delete(db_user)
        db.commit()
        
        log_action_to_db(db, current_user.id, "DELETE", "User", user_id, f"Usuario eliminado: {user_email_snapshot}")
        
        return {"status": "success", "message": "Usuario eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar el usuario porque tiene registros dependientes (ej: ventas o leads asigandos). {str(e)}")

# --- SYSTEM LOGS ENDPOINTS ---

@app.get("/logs/", response_model=schemas.SystemLogList)
def read_system_logs(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all system logs.
    Restricted to Admins and Super Admins.
    """
    role_obj = db.query(models.Role).filter(models.Role.id == current_user.role_id).first()
    if not role_obj or role_obj.name not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver auditoría")

    query = db.query(models.SystemLog)
    
    total = query.count()
    items = query.order_by(models.SystemLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return {"items": items, "total": total}

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    companies_count = db.query(models.Company).count()
    users_count = db.query(models.User).count()
    return {"companies_count": companies_count, "users_count": users_count}

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API de AutosQP"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/companies/", response_model=schemas.Company)
def create_company(company: schemas.CompanyCreate, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.name == company.name).first()
    if db_company:
        raise HTTPException(status_code=400, detail="Company already registered")
    
    new_company = models.Company(
        name=company.name,
        logo_url=company.logo_url,
        primary_color=company.primary_color,
        secondary_color=company.secondary_color
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return new_company

@app.get("/companies/", response_model=schemas.CompanyList)
def read_companies(skip: int = 0, limit: int = 10, q: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Company)
    if q:
        query = query.filter(models.Company.name.ilike(f"%{q}%"))
    
    total = query.count()
    companies = query.offset(skip).limit(limit).all()
    return {"items": companies, "total": total}

@app.get("/companies/{company_id}", response_model=schemas.Company)
def read_company(company_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@app.put("/companies/{company_id}", response_model=schemas.Company)
def update_company(company_id: int, company_update: schemas.CompanyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db_company.name = company_update.name
    db_company.logo_url = company_update.logo_url
    db_company.primary_color = company_update.primary_color
    db_company.secondary_color = company_update.secondary_color
    
    try:
        db.commit()
        db.refresh(db_company)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return db_company

@app.get("/companies/{company_id}/integrations", response_model=schemas.IntegrationSettings)
def read_integration_settings(company_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check permissions
    if current_user.company_id and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to view these settings")
    
    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
    if not settings:
        # Create default empty settings if not exists
        settings = models.IntegrationSettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        
    return settings

@app.get("/roles/", response_model=list[schemas.Role])
def read_roles(db: Session = Depends(get_db)):
    return db.query(models.Role).all()

@app.put("/companies/{company_id}/integrations", response_model=schemas.IntegrationSettings)
def update_integration_settings(company_id: int, settings_update: schemas.IntegrationSettingsUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check permissions (only admins or super admins)
    role_name = current_user.role.name if current_user.role else "user"
    if role_name not in ["super_admin", "admin"]:
         raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.company_id and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify these settings")
        
    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
    if not settings:
        settings = models.IntegrationSettings(company_id=company_id)
        db.add(settings)
    
    # Update fields
    for field, value in settings_update.dict(exclude_unset=True).items():
        setattr(settings, field, value)
        
    try:
        db.commit()
        db.refresh(settings)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return settings
    return settings

# --- LEADS ENDPOINTS ---

@app.get("/leads", response_model=schemas.LeadList)
def read_leads(
    source: str = None, 
    status: str = None,
    q: str = None,
    skip: int = 0, 
    limit: int = 1000, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Lead).options(
        joinedload(models.Lead.assigned_to),
        joinedload(models.Lead.history),
        joinedload(models.Lead.conversation).joinedload(models.Conversation.messages),
        joinedload(models.Lead.notes),
        joinedload(models.Lead.files)
    )
    
    # Filter by user company
    if current_user.company_id:
        query = query.filter(models.Lead.company_id == current_user.company_id)
    
    # Filter by Advisor (Asesor) - Only see assigned leads
    if current_user.role and current_user.role.name in ['asesor', 'vendedor']:
        query = query.filter(models.Lead.assigned_to_id == current_user.id)
    
    # Filter by Aliado - Only see leads created by them OR assigned to them
    if current_user.role and current_user.role.name == 'aliado':
        from sqlalchemy import or_
        query = query.filter(
            or_(
                models.Lead.created_by_id == current_user.id,
                models.Lead.assigned_to_id == current_user.id
            )
        )

    if source:
        query = query.filter(models.Lead.source == source)
    
    if status:
        if status == models.LeadStatus.ALLY_MANAGED.value:
            aliado_role = db.query(models.Role).filter(models.Role.name == "aliado").first()
            if aliado_role:
                aliado_user_ids = db.query(models.User.id).filter(models.User.role_id == aliado_role.id)
                query = query.filter(
                    or_(
                        models.Lead.status == status,
                        models.Lead.assigned_to_id.in_(aliado_user_ids),
                        models.Lead.created_by_id.in_(aliado_user_ids)
                    )
                )
            else:
                query = query.filter(models.Lead.status == status)
        else:
            query = query.filter(models.Lead.status == status)

    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Lead.name.ilike(search)) | 
            (models.Lead.email.ilike(search)) | 
            (models.Lead.phone.ilike(search))
        )
        
    total = query.count()
    leads = query.order_by(models.Lead.id.desc()).offset(skip).limit(limit).all()

    # Ensure ally-managed leads are always represented with ally_managed status in board data
    creator_ids = list({lead.created_by_id for lead in leads if lead.created_by_id})
    creator_role_map = {}
    if creator_ids:
        creator_rows = db.query(models.User.id, models.Role.name).join(models.Role, isouter=True).filter(models.User.id.in_(creator_ids)).all()
        creator_role_map = {user_id: role_name for user_id, role_name in creator_rows}

    for lead in leads:
        assigned_is_aliado = bool(lead.assigned_to and lead.assigned_to.role and lead.assigned_to.role.name == "aliado")
        creator_is_aliado = creator_role_map.get(lead.created_by_id) == "aliado"
        if assigned_is_aliado or creator_is_aliado:
            lead.status = models.LeadStatus.ALLY_MANAGED.value

    return {"items": leads, "total": total}

@app.put("/leads/bulk-assign", status_code=200)
def bulk_assign_leads(
    payload: schemas.LeadBulkAssign, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify assigned_to user exists and is in same company
    target_user = db.query(models.User).filter(models.User.id == payload.assigned_to_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
        
    if current_user.company_id and target_user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Target user is in a different company")

    # Update leads
    # Verify these leads belong to the company
    leads_to_update = db.query(models.Lead).filter(
        models.Lead.id.in_(payload.lead_ids)
    )
    
    if current_user.company_id:
        leads_to_update = leads_to_update.filter(models.Lead.company_id == current_user.company_id)
    
    result = leads_to_update.update(
        {models.Lead.assigned_to_id: payload.assigned_to_id},
        synchronize_session=False
    )
    
    db.commit()
    return {"message": f"Successfully assigned {result} leads to user {target_user.email}"}


@app.post("/leads", response_model=schemas.Lead)
def create_lead(lead: schemas.LeadCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    import datetime
    import random
    
    # 1. Determine Company
    company_id = lead.company_id
    if not company_id:
        if current_user.company_id:
            company_id = current_user.company_id
        else:
             raise HTTPException(status_code=400, detail="Company ID required for assignment")

    # 2. Assignment Logic
    assigned_user_id = lead.assigned_to_id
    
    # Automatic Assignment if not provided
    if not assigned_user_id:
        # Find 'asesor' role id
        asesor_role = db.query(models.Role).filter(models.Role.name == "asesor").first()
        
        if asesor_role:
            # Find users in this company with 'asesor' role
            potential_agents = db.query(models.User).filter(
                models.User.company_id == company_id,
                models.User.role_id == asesor_role.id
            ).all()
            
            if potential_agents:
                chosen_agent = random.choice(potential_agents)
                assigned_user_id = chosen_agent.id
    
    effective_status = enforce_ally_managed_status(
        db=db,
        current_user=current_user,
        base_status=lead.status,
        assigned_to_id=assigned_user_id
    )

    new_lead = models.Lead(
        created_at=datetime.datetime.now(),
        source=lead.source,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        message=lead.message,
        status=effective_status,
        company_id=company_id,
        assigned_to_id=assigned_user_id,
        created_by_id=current_user.id
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead

import random

@app.get("/reports/stats", response_model=schemas.ReportsStats)
def get_reports_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        # Base query filtered by company
        query = db.query(models.Lead).options(joinedload(models.Lead.assigned_to))
        if current_user.company_id:
            query = query.filter(models.Lead.company_id == current_user.company_id)
        
        leads = query.all()
        total_leads = len(leads)
        
        # Calculate Stats
        leads_by_status = {}
        leads_by_source = {}
        leads_by_advisor = {}
        converted_count = 0
        
        for lead in leads:
            # Status
            status = lead.status or "unknown"
            leads_by_status[status] = leads_by_status.get(status, 0) + 1
            if status == "sold": # Changed from 'converted' to matches enum
                converted_count += 1
                
            # Source
            source = lead.source or "manual"
            leads_by_source[source] = leads_by_source.get(source, 0) + 1
            
            # Advisor
            advisor_name = "Sin Asignar"
            if lead.assigned_to:
                advisor_name = lead.assigned_to.email # Or name if available
            leads_by_advisor[advisor_name] = leads_by_advisor.get(advisor_name, 0) + 1

        conversion_rate = (converted_count / total_leads * 100) if total_leads > 0 else 0.0
        
        # Mock Data for requested charts
        brands = ["Toyota", "Chevrolet", "Mazda", "Renault", "Kia", "Ford"]
        fake_leads_by_brand = {b: random.randint(5, 50) for b in brands}
        
        models_list = ["Corolla", "Spark", "Mazda 3", "Duster", "Picanto", "Fiesta"]
        fake_leads_by_model = {m: random.randint(3, 30) for m in models_list}
        
        # Mock Response Time
        fake_avg_response_time = [random.randint(15, 60) for _ in range(7)]

        return {
            "total_leads": total_leads,
            "conversion_rate": round(conversion_rate, 2),
            "leads_by_status": leads_by_status,
            "leads_by_source": leads_by_source,
            "leads_by_advisor": leads_by_advisor,
            "leads_by_brand": fake_leads_by_brand,
            "leads_by_model": fake_leads_by_model,
            "avg_response_time": fake_avg_response_time
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- STATIC FILES & UPLOAD ---
from fastapi.staticfiles import StaticFiles
from fastapi import UploadFile, File, Form
import shutil
import os
import uuid

# Ensure static directory exists
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.post("/upload/")
async def upload_image(request: Request, file: UploadFile = File(...)):
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"static/{unique_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return URL (assuming localhost for now, hardcoded base likely needed for prod)
    # In a real scenario you might return full URL or relative path
    relative_url = f"/api/static/{unique_filename}"
    return {
        "url": f"{str(request.base_url).rstrip('/')}{relative_url}",
        "url_relative": relative_url
    }

@app.get("/internal-files/{storage_name}")
def get_internal_file(storage_name: str):
    safe_name = os.path.basename(storage_name)
    base_dir = os.path.abspath("static/internal_chat")
    file_path = os.path.abspath(os.path.join(base_dir, safe_name))

    if not file_path.startswith(base_dir):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path=file_path, filename=safe_name)

# --- BRANDS & MODELS ENDPOINTS ---

@app.get("/brands/", response_model=List[schemas.CarBrand])
def read_brands(db: Session = Depends(get_db)):
    return db.query(models.CarBrand).order_by(models.CarBrand.name).all()

@app.get("/brands/{brand_id}/models/", response_model=List[schemas.CarModel])
def read_models_by_brand(brand_id: int, db: Session = Depends(get_db)):
    return db.query(models.CarModel).filter(models.CarModel.brand_id == brand_id).order_by(models.CarModel.name).all()

def normalize_catalog_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned if cleaned else None

def catalog_key(value: Optional[str]) -> str:
    normalized = normalize_catalog_value(value) or ""
    return re.sub(r"[^a-z0-9]", "", normalized.lower())

def upsert_brand_model(db: Session, make: Optional[str], model: Optional[str]):
    make_name = normalize_catalog_value(make)
    model_name = normalize_catalog_value(model)
    if not make_name:
        return

    brand = db.query(models.CarBrand).filter(func.lower(models.CarBrand.name) == make_name.lower()).first()
    if not brand:
        brand = models.CarBrand(name=make_name)
        db.add(brand)
        db.flush()

    if model_name:
        existing_model = db.query(models.CarModel).filter(
            models.CarModel.brand_id == brand.id,
            func.lower(models.CarModel.name) == model_name.lower()
        ).first()
        if not existing_model:
            db.add(models.CarModel(name=model_name, brand_id=brand.id))

@app.get("/stats/advisor")
def read_advisor_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Only for advisors or company users
    if not current_user.company_id:
        return {"error": "Not an advisor"}
        
    # Leads Assigned High Level
    leads_query = db.query(models.Lead).filter(models.Lead.assigned_to_id == current_user.id)
    total_leads = leads_query.count()
    
    # Status Counts
    # Use sqlalchemy func for grouping
    from sqlalchemy import func
    status_counts = db.query(models.Lead.status, func.count(models.Lead.status))\
        .filter(models.Lead.assigned_to_id == current_user.id)\
        .group_by(models.Lead.status).all()
        
    stats_map = {s[0]: s[1] for s in status_counts}
    
    # Sold count (Lead status 'sold' OR Sales table)
    # We will trust Lead status 'sold' as per LeadsBoard logic
    leads_sold = stats_map.get('sold', 0)
    
    leads_new = stats_map.get('new', 0)
    
    # Conversion Rate
    conversion_rate = 0
    if total_leads > 0:
        conversion_rate = (leads_sold / total_leads) * 100
        
    return {
        "total_leads": total_leads,
        "leads_new": leads_new,
        "leads_sold": leads_sold,
        "conversion_rate": round(conversion_rate, 2),
        "response_time_min": 37, # Simulated as per mockup
        "status_distribution": stats_map
    }

@app.post("/seed/brands")
def seed_brands(db: Session = Depends(get_db)):
    # Data for common cars in Colombia
    data = {
        "Chevrolet": ["Spark", "Sail", "Onix", "Tracker", "Captiva", "Colorado", "Tahoe", "Joy", "Beat", "Equinox"],
        "Renault": ["Logan", "Sandero", "Stepway", "Duster", "Kwid", "Captur", "Koleos", "Alaskan", "Oroch", "Twingo"],
        "Mazda": ["Mazda 2", "Mazda 3", "Mazda 6", "CX-30", "CX-5", "CX-50", "CX-9", "CX-90", "MX-5"],
        "Kia": ["Picanto", "Rio", "Cerato", "Sportage", "Sorento", "Niro", "Stonic", "Soluto", "Eko Taxi"],
        "Toyota": ["Hilux", "Fortuner", "Corolla", "Prado", "Yaris", "Rav4", "Land Cruiser", "4Runner", "TXL"],
        "Nissan": ["Versa", "March", "Sentra", "Kicks", "Qashqai", "X-Trail", "Frontier", "Murano", "Patrol"],
        "Ford": ["Fiesta", "Focus", "Ecosport", "Escape", "Edge", "Explorer", "Ranger", "F-150", "Bronco"],
        "Volkswagen": ["Gol", "Voyage", "Polo", "Virtus", "T-Cross", "Nivus", "Amarok", "Jetta", "Tiguan"],
        "Hyundai": ["Grand i10", "Accent", "HB20", "Tucson", "Santa Fe", "Creta", "Elantra", "Venue", "Palisade"],
        "Suzuki": ["Swift", "Alto", "S-Presso", "Vitara", "Jimny", "Baleno", "Ertiga"],
        "Honda": ["Civic", "CR-V", "HR-V", "Pilot", "City", "WR-V"],
        "BMW": ["Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "X1", "X3", "X4", "X5"],
        "Mercedes-Benz": ["Clase A", "Clase C", "Clase E", "Clase GLA", "Clase GLC", "Clase GLE"],
        "Audi": ["A3", "A4", "Q2", "Q3", "Q5", "Q7", "Q8"]
    }

    count = 0
    for brand_name, models_list in data.items():
        # Check if brand exists
        brand = db.query(models.CarBrand).filter(models.CarBrand.name == brand_name).first()
        if not brand:
            brand = models.CarBrand(name=brand_name)
            db.add(brand)
            db.commit()
            db.refresh(brand)
        
        for model_name in models_list:
            # Check if model exists
            exists = db.query(models.CarModel).filter(
                models.CarModel.brand_id == brand.id,
                models.CarModel.name == model_name
            ).first()
            if not exists:
                new_model = models.CarModel(name=model_name, brand_id=brand.id)
                db.add(new_model)
                count += 1
    
    db.commit()
    return {"message": f"Seeded {count} new models successfully."}

@app.post("/seed/brands/from-vehicles")
def seed_brands_from_vehicles(db: Session = Depends(get_db)):
    rows = db.query(models.Vehicle.make, models.Vehicle.model).all()
    if not rows:
        return {
            "message": "No hay vehiculos para sincronizar.",
            "brands_created": 0,
            "models_created": 0
        }

    existing_brands = db.query(models.CarBrand).all()
    brands_by_key = {b.name.lower(): b for b in existing_brands if b.name}

    existing_models = db.query(models.CarModel).all()
    models_by_key = {
        (m.brand_id, m.name.lower()): m
        for m in existing_models
        if m.name and m.brand_id
    }

    brands_created = 0
    models_created = 0

    for make_raw, model_raw in rows:
        make_name = normalize_catalog_value(make_raw)
        model_name = normalize_catalog_value(model_raw)

        if not make_name:
            continue

        brand_key = make_name.lower()
        brand = brands_by_key.get(brand_key)
        if not brand:
            brand = models.CarBrand(name=make_name)
            db.add(brand)
            db.flush()
            brands_by_key[brand_key] = brand
            brands_created += 1

        if not model_name:
            continue

        model_key = (brand.id, model_name.lower())
        if model_key not in models_by_key:
            new_model = models.CarModel(name=model_name, brand_id=brand.id)
            db.add(new_model)
            db.flush()
            models_by_key[model_key] = new_model
            models_created += 1

    db.commit()
    return {
        "message": "Sincronizacion completada",
        "brands_created": brands_created,
        "models_created": models_created
    }

@app.post("/seed/brands/external")
def seed_brands_external(
    max_makes: int = Query(80, ge=1, le=250),
    max_models_per_make: int = Query(120, ge=1, le=500),
    include_models: bool = Query(True),
    only_common: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Pobla catalogo desde la API publica vPIC de NHTSA.
    Fuente:
    - https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json
    - https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/{make_id}?format=json
    """
    base_url = "https://vpic.nhtsa.dot.gov/api/vehicles"

    try:
        makes_resp = requests.get(f"{base_url}/GetAllMakes?format=json", timeout=30)
        makes_resp.raise_for_status()
        makes_data = makes_resp.json().get("Results", [])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo consultar catalogo externo: {str(exc)}")

    common_brands_colombia = {
        catalog_key("Chevrolet"),
        catalog_key("Renault"),
        catalog_key("Mazda"),
        catalog_key("Kia"),
        catalog_key("Toyota"),
        catalog_key("Nissan"),
        catalog_key("Ford"),
        catalog_key("Volkswagen"),
        catalog_key("Hyundai"),
        catalog_key("Suzuki"),
        catalog_key("Honda"),
        catalog_key("BMW"),
        catalog_key("Mercedes-Benz"),
        catalog_key("Audi"),
        catalog_key("Jeep"),
        catalog_key("Peugeot"),
        catalog_key("Citroen"),
        catalog_key("Seat"),
        catalog_key("Volvo"),
        catalog_key("Subaru"),
        catalog_key("Mitsubishi"),
        catalog_key("Fiat"),
        catalog_key("Chery"),
        catalog_key("Great Wall"),
        catalog_key("JAC"),
        catalog_key("BYD"),
        catalog_key("MG"),
        catalog_key("DFSK"),
    }

    if only_common:
        makes_data = [
            item for item in makes_data
            if catalog_key(item.get("Make_Name")) in common_brands_colombia
        ]

    if not makes_data:
        return {
            "message": "La fuente externa no devolvio marcas.",
            "brands_created": 0,
            "models_created": 0,
            "makes_processed": 0,
            "filter": "common_colombia" if only_common else "all"
        }

    # Marcas existentes por nombre normalizado
    existing_brands = db.query(models.CarBrand).all()
    brands_by_key = {b.name.lower(): b for b in existing_brands if b.name}

    # Modelos existentes por (brand_id, nombre normalizado)
    existing_models = db.query(models.CarModel).all()
    models_by_key = {
        (m.brand_id, m.name.lower()): m
        for m in existing_models
        if m.name and m.brand_id
    }

    brands_created = 0
    models_created = 0
    makes_processed = 0

    for raw_make in makes_data[:max_makes]:
        make_name = normalize_catalog_value(raw_make.get("Make_Name"))
        make_id = raw_make.get("Make_ID")
        if not make_name:
            continue

        make_key = make_name.lower()
        brand = brands_by_key.get(make_key)
        if not brand:
            brand = models.CarBrand(name=make_name)
            db.add(brand)
            db.flush()
            brands_by_key[make_key] = brand
            brands_created += 1

        makes_processed += 1

        if not include_models or not make_id:
            continue

        try:
            models_resp = requests.get(
                f"{base_url}/GetModelsForMakeId/{int(make_id)}?format=json",
                timeout=30
            )
            models_resp.raise_for_status()
            models_data = models_resp.json().get("Results", [])
        except Exception:
            # Si una marca falla, continuamos con las demas.
            continue

        for raw_model in models_data[:max_models_per_make]:
            model_name = normalize_catalog_value(raw_model.get("Model_Name"))
            if not model_name:
                continue

            model_key = (brand.id, model_name.lower())
            if model_key not in models_by_key:
                new_model = models.CarModel(name=model_name, brand_id=brand.id)
                db.add(new_model)
                db.flush()
                models_by_key[model_key] = new_model
                models_created += 1

        # Evita activar control de trafico del proveedor externo.
        time.sleep(0.05)

    db.commit()
    return {
        "message": "Catalogo externo sincronizado correctamente",
        "brands_created": brands_created,
        "models_created": models_created,
        "makes_processed": makes_processed,
        "filter": "common_colombia" if only_common else "all"
    }


# --- PUBLIC SALES CHATBOT ENDPOINTS ---

def get_public_company_id(db: Session, explicit_company_id: Optional[int] = None) -> Optional[int]:
    if explicit_company_id:
        company = db.query(models.Company).filter(models.Company.id == explicit_company_id).first()
        if company:
            return company.id
    env_company_id = os.getenv("PUBLIC_CHAT_COMPANY_ID")
    if env_company_id and env_company_id.isdigit():
        company = db.query(models.Company).filter(models.Company.id == int(env_company_id)).first()
        if company:
            return company.id
    company_with_ai = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.openai_api_key.isnot(None)
    ).order_by(models.IntegrationSettings.company_id.asc()).first()
    if company_with_ai and company_with_ai.company_id:
        return company_with_ai.company_id

    first_company = db.query(models.Company).order_by(models.Company.id.asc()).first()
    return first_company.id if first_company else None

def get_company_ai_settings(db: Session, company_id: Optional[int]) -> tuple[Optional[str], str]:
    model_name = "gpt-4o-mini"
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip() or None
    if company_id:
        settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
        if settings:
            if settings.openai_api_key and settings.openai_api_key.strip():
                api_key = settings.openai_api_key.strip()
            if settings.gw_model:
                model_name = settings.gw_model
    return api_key, model_name

def call_openai_chat(api_key: str, model_name: str, messages: List[Dict[str, str]]) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.5
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, headers=headers, json=payload, timeout=45)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()

def call_openai_chat_with_fallback(
    primary_key: str,
    model_name: str,
    messages: List[Dict[str, str]],
    fallback_key: Optional[str]
) -> str:
    try:
        return call_openai_chat(primary_key, model_name, messages)
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        if status_code == 401 and fallback_key and fallback_key.strip() and fallback_key.strip() != primary_key.strip():
            return call_openai_chat(fallback_key.strip(), model_name, messages)
        raise

def extract_prospect_data_with_ai(api_key: str, model_name: str, full_conversation: str) -> Dict[str, Any]:
    extraction_messages = [
        {
            "role": "system",
            "content": (
                "Extrae datos de prospecto de conversación de compra de autos. "
                "Responde SOLO JSON con estas claves exactas: "
                "name, phone, email, interested_vehicle, is_ready_to_create_lead. "
                "Si falta un dato usa null. is_ready_to_create_lead=true solo si hay name, phone e interested_vehicle."
            )
        },
        {
            "role": "user",
            "content": full_conversation
        }
    ]
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model_name,
        "messages": extraction_messages,
        "temperature": 0,
        "response_format": {"type": "json_object"}
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, headers=headers, json=payload, timeout=45)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)

def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    if len(digits) == 10:
        return f"+57{digits}"
    if len(digits) == 12 and digits.startswith("57"):
        return f"+{digits}"
    if len(digits) > 10:
        return f"+57{digits[-10:]}"
    return None

def phone_variants_for_lookup(phone: Optional[str]) -> List[str]:
    normalized = normalize_phone(phone)
    if not normalized:
        return []
    digits = re.sub(r"\D", "", normalized)
    variants = {normalized, digits}
    if digits.startswith("57") and len(digits) == 12:
        variants.add(digits[2:])
        variants.add(f"+{digits[2:]}")
    return list(variants)

def upsert_lead_process_detail(db: Session, lead_id: int, interested_vehicle: str):
    detail = db.query(models.LeadProcessDetail).filter(models.LeadProcessDetail.lead_id == lead_id).first()
    if detail:
        if interested_vehicle and detail.desired_vehicle != interested_vehicle:
            detail.has_vehicle = False
            detail.desired_vehicle = interested_vehicle
    else:
        db.add(models.LeadProcessDetail(
            lead_id=lead_id,
            has_vehicle=False,
            desired_vehicle=interested_vehicle
        ))

def maybe_create_public_chat_lead(
    db: Session,
    session: models.PublicChatSession,
    extracted_data: Dict[str, Any]
) -> Optional[int]:
    if session.lead_id:
        return session.lead_id

    name = (extracted_data.get("name") or "").strip()
    phone = normalize_phone(extracted_data.get("phone"))
    email = (extracted_data.get("email") or "").strip() or None
    interested_vehicle = (extracted_data.get("interested_vehicle") or "").strip()
    is_ready = bool(extracted_data.get("is_ready_to_create_lead"))

    if not (is_ready and name and phone and interested_vehicle):
        return None

    lookup_phones = phone_variants_for_lookup(phone)
    duplicate_window_days = int(os.getenv("PUBLIC_CHAT_DUPLICATE_WINDOW_DAYS", "30") or "30")
    recent_threshold = datetime.datetime.utcnow() - datetime.timedelta(days=duplicate_window_days)

    existing_lead = None
    if lookup_phones:
        existing_lead = db.query(models.Lead).filter(
            models.Lead.company_id == session.company_id,
            models.Lead.phone.in_(lookup_phones),
            models.Lead.created_at >= recent_threshold
        ).order_by(models.Lead.created_at.desc()).first()

    if existing_lead:
        existing_lead.message = f"Interes detectado por chatbot web: {interested_vehicle}"
        upsert_lead_process_detail(db, existing_lead.id, interested_vehicle)
        session.lead_id = existing_lead.id
        db.commit()
        return existing_lead.id

    assigned_user_id = None
    if session.company_id:
        advisors = db.query(models.User).join(models.Role).filter(
            models.User.company_id == session.company_id,
            models.Role.name.in_(["asesor", "vendedor"])
        ).all()
        if advisors:
            assigned_user_id = random.choice(advisors).id

    lead_message = f"Interes detectado por chatbot web: {interested_vehicle}"
    new_lead = models.Lead(
        source=models.LeadSource.WEB.value,
        name=name,
        phone=phone,
        email=email,
        message=lead_message,
        status=models.LeadStatus.NEW.value,
        company_id=session.company_id,
        assigned_to_id=assigned_user_id
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    upsert_lead_process_detail(db, new_lead.id, interested_vehicle)
    session.lead_id = new_lead.id
    db.commit()
    return new_lead.id

@app.post("/public-chat/session", response_model=schemas.PublicChatSession)
def create_public_chat_session(payload: schemas.PublicChatSessionCreate, db: Session = Depends(get_db)):
    company_id = get_public_company_id(db, payload.company_id)
    session_token = str(uuid.uuid4())
    session = models.PublicChatSession(
        session_token=session_token,
        company_id=company_id,
        source_page=payload.source_page or "/autos",
        status="active"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@app.get("/public-chat/{session_token}/messages", response_model=List[schemas.PublicChatMessageItem])
def get_public_chat_messages(session_token: str, db: Session = Depends(get_db)):
    session = db.query(models.PublicChatSession).filter(models.PublicChatSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.asc()).all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]

@app.post("/public-chat/message", response_model=schemas.PublicChatMessageResponse)
def public_chat_message(payload: schemas.PublicChatMessageCreate, db: Session = Depends(get_db)):
    user_message = (payload.message or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    session = db.query(models.PublicChatSession).filter(
        models.PublicChatSession.session_token == payload.session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if payload.source_page:
        session.source_page = payload.source_page

    api_key, model_name = get_company_ai_settings(db, session.company_id)
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key no configurada")
    env_fallback_key = (os.getenv("OPENAI_API_KEY") or "").strip() or None

    db.add(models.PublicChatMessage(session_id=session.id, role="user", content=user_message))
    db.commit()

    history = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.asc()).all()

    vehicle_hint = ""
    if payload.vehicle_id:
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == payload.vehicle_id).first()
        if vehicle:
            vehicle_hint = (
                f"Vehículo que está viendo el cliente: {vehicle.make} {vehicle.model} {vehicle.year}, "
                f"precio {vehicle.price} COP."
            )

    system_prompt = (
        "Eres un asesor de ventas de autos de AutosQP en Colombia. "
        "Habla natural, amable y breve. Tu objetivo es: 1) entender qué carro busca el cliente, "
        "2) recoger nombre completo y teléfono de contacto (email opcional), 3) confirmar interés. "
        "No inventes datos. Si faltan datos, pídelos con preguntas claras y una por turno. "
        f"{vehicle_hint}"
    )

    chat_messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-20:]:
        if msg.role in ["user", "assistant"]:
            chat_messages.append({"role": msg.role, "content": msg.content})

    try:
        assistant_reply = call_openai_chat_with_fallback(api_key, model_name, chat_messages, env_fallback_key)
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 500
        if status_code == 401:
            raise HTTPException(status_code=400, detail="OpenAI API key inválida o expirada para el chatbot público")
        raise HTTPException(status_code=500, detail=f"Error consultando OpenAI: {str(exc)}")
    db.add(models.PublicChatMessage(session_id=session.id, role="assistant", content=assistant_reply))
    db.commit()

    full_text = "\n".join([f"{m.role}: {m.content}" for m in history[-30:]] + [f"assistant: {assistant_reply}"])
    lead_created = False
    lead_id = session.lead_id
    try:
        extraction_key = api_key
        if env_fallback_key and env_fallback_key.strip():
            extraction_key = env_fallback_key if api_key != env_fallback_key else api_key
        extracted = extract_prospect_data_with_ai(extraction_key, model_name, full_text)
        lead_id = maybe_create_public_chat_lead(db, session, extracted)
        lead_created = bool(lead_id and not session.lead_id is None)
    except Exception:
        # Extraction failure should not break chat response.
        lead_created = False

    latest_messages = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.asc()).all()

    return {
        "session_token": session.session_token,
        "reply": assistant_reply,
        "lead_created": bool(session.lead_id),
        "lead_id": session.lead_id,
        "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in latest_messages]
    }


# --- LEADS ENDPOINTS ---


# Remove duplicate read_leads


@app.post("/leads", response_model=schemas.Lead)
def create_lead(
    lead: schemas.LeadCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Assign to current user's company if not provided
    company_id = lead.company_id or current_user.company_id
    
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required for assignment")
    
    # Exclude company_id because we pass it manually
    lead_data = lead.dict(exclude={'company_id'})
    
    # Manual Assignment by Aliado/Admin
    assigned_to_id = lead.assigned_to_id
    
    # Automatic Assignment Logic (Fallback if not manually assigned)
    if not assigned_to_id:
        import random
        available_advisors = db.query(models.User).join(models.Role).filter(
            models.User.company_id == company_id,
            models.Role.name.in_(['asesor', 'vendedor'])
        ).all()
        
        if available_advisors:
            selected_advisor = random.choice(available_advisors)
            assigned_to_id = selected_advisor.id
    
    # Verify the manually assigned user belongs to the company
    elif assigned_to_id:
        target_user = db.query(models.User).filter(models.User.id == assigned_to_id).first()
        if not target_user or target_user.company_id != company_id:
             raise HTTPException(status_code=400, detail="Invalid assigned user (not in company)")

    lead_data["status"] = enforce_ally_managed_status(
        db=db,
        current_user=current_user,
        base_status=lead_data.get("status"),
        assigned_to_id=assigned_to_id
    )

    db_lead = models.Lead(
        **lead_data, 
        company_id=company_id, 
        assigned_to_id=assigned_to_id,
        created_by_id=current_user.id # Track who created it
    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    
    log_action_to_db(db, current_user.id, "CREATE", "Lead", db_lead.id, f"Lead creado: {db_lead.name} ({db_lead.email or db_lead.phone})")
    
    
    # Create Notification for assigned user
    if db_lead.assigned_to_id:
        notification = models.Notification(
            user_id=db_lead.assigned_to_id,
            title="Nuevo Lead Asignado",
            message=f"Se te ha asignado un nuevo lead: {db_lead.name}",
            type="info",
            link=f"/leads/{db_lead.id}"
        )
        db.add(notification)
        db.commit()
        
    return db_lead

@app.put("/leads/{lead_id}", response_model=schemas.Lead)
def update_lead(
    lead_id: int, 
    lead_update: schemas.LeadUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    payload_update = lead_update.dict(exclude={'comment', 'process_detail'}, exclude_unset=True)
    target_assigned_to_id = payload_update.get('assigned_to_id', lead.assigned_to_id)
    effective_status = enforce_ally_managed_status(
        db=db,
        current_user=current_user,
        base_status=payload_update.get('status', lead.status),
        assigned_to_id=target_assigned_to_id
    )
    if payload_update.get('status') is not None or payload_update.get('assigned_to_id') is not None:
        payload_update['status'] = effective_status

    # Check for status change OR comment to log history
    # If status changes, or if there's a comment (even without status change), we log it.
    has_status_change = effective_status != lead.status
    has_comment = lead_update.comment and len(lead_update.comment.strip()) > 0
    
    if has_status_change or has_comment:
        if has_status_change:
            lead.status_updated_at = datetime.datetime.utcnow()
            
        new_history = models.LeadHistory(
            lead_id=lead.id,
            user_id=current_user.id,
            previous_status=lead.status,
            new_status=effective_status,
            comment=lead_update.comment
        )
        db.add(new_history)
        
    process_detail_data = lead_update.process_detail
    
    for field, value in payload_update.items():
        setattr(lead, field, value)
        
    # Handle Process Detail Upsert
    if process_detail_data:
        existing_detail = db.query(models.LeadProcessDetail).filter(models.LeadProcessDetail.lead_id == lead.id).first()
        if existing_detail:
            for k, v in process_detail_data.dict().items():
                setattr(existing_detail, k, v)
        else:
            new_detail = models.LeadProcessDetail(
                lead_id=lead.id,
                **process_detail_data.dict()
            )
            db.add(new_detail)
        
    db.commit()
    db.refresh(lead)
    
    log_action_to_db(db, current_user.id, "UPDATE", "Lead", lead.id, f"Lead modificado: {lead.name} a estado {lead.status}")
    
    return lead

# --- LEAD NOTES AND FILES ENDPOINTS ---

@app.post("/leads/{lead_id}/notes", response_model=schemas.LeadNote)
def create_lead_note(
    lead_id: int, 
    note: schemas.LeadNoteCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_note = models.LeadNote(
        lead_id=lead_id,
        user_id=current_user.id,
        content=note.content
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    
    log_action_to_db(db, current_user.id, "CREATE", "LeadNote", db_note.id, f"Nota agregada al lead {lead.name}")
    
    return db_note

@app.post("/leads/{lead_id}/files", response_model=schemas.LeadFile)
async def upload_lead_file(
    lead_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    import os
    import uuid
    import shutil
    
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    os.makedirs("static/leads", exist_ok=True)
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"static/leads/{unique_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db_file = models.LeadFile(
        lead_id=lead_id,
        user_id=current_user.id,
        file_name=file.filename,
        file_path=f"/{file_path}",
        file_type=file.content_type
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    log_action_to_db(db, current_user.id, "CREATE", "LeadFile", db_file.id, f"Archivo adjuntado al lead {lead.name}")
    
    return db_file

@app.get("/leads/{lead_id}/messages")
def get_lead_messages(
    lead_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # Retrieve the lead first to check company scope
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Get the conversation for this lead
    conversation = db.query(models.Conversation).filter(models.Conversation.lead_id == lead_id).first()
    if not conversation:
        return [] # No messages yet
        
    # Get messages associated with this conversation
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation.id
    ).order_by(models.Message.created_at.desc()).all()
    
    return messages

@app.post("/webhooks/leads/{source}")
def receive_webhook_lead(
    source: str, 
    data: dict
):
    """
    Mock endpoint to receive leads from external sources (Webhooks).
    Payload expected: { "name": "...", "phone": "...", "message": "..." }
    In a real scenario, you'd map Facebook/WhatsApp payloads here.
    """
    # Simple mapping for demonstration
    name = data.get("name", "Unknown Lead")
    phone = data.get("phone") or data.get("from") # FB often uses 'from'
    email = data.get("email")
    message = data.get("message") or data.get("text")
    
    # Default to first company found if no ID logic (For demo purposes)
    # In prod, you'd map the webhook token/ID to a specific company
    company = db.query(models.Company).first()
    company_id = company.id if company else None

    # Create Lead
    new_lead = models.Lead(
        name=name,
        phone=phone,
        email=email,
        message=message,
        source=source, # facebook, whatsapp, etc
        company_id=company_id,
        status="new"
    )
    db.add(new_lead)
    db.commit()
    return {"status": "received", "lead_id": new_lead.id}

# --- VEHICLES ENDPOINTS ---

@app.get("/vehicles/makes")
def get_public_makes(db: Session = Depends(get_db)):
    # Returns distinct makes from available vehicles
    makes = db.query(models.Vehicle.make).filter(models.Vehicle.status == 'available').distinct().all()
    return [m[0] for m in makes if m[0]]

@app.get("/vehicles/public")
def get_public_vehicles(
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
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(models.Vehicle).filter(models.Vehicle.status == 'available')
    
    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Vehicle.make.ilike(search)) |
            (models.Vehicle.model.ilike(search)) |
            (models.Vehicle.plate.ilike(search))
        )
    if make:
        query = query.filter(models.Vehicle.make.ilike(f"%{make}%"))
    if model:
        query = query.filter(models.Vehicle.model.ilike(f"%{model}%"))
    if color:
        query = query.filter(models.Vehicle.color.ilike(f"%{color}%"))
    if year_from is not None:
        query = query.filter(models.Vehicle.year >= year_from)
    if year_to is not None:
        query = query.filter(models.Vehicle.year <= year_to)
    if price_min is not None:
        query = query.filter(models.Vehicle.price >= price_min)
    if price_max is not None:
        query = query.filter(models.Vehicle.price <= price_max)
    if mileage_min is not None:
        query = query.filter(models.Vehicle.mileage >= mileage_min)
    if mileage_max is not None:
        query = query.filter(models.Vehicle.mileage <= mileage_max)
        
    vehicles = query.order_by(models.Vehicle.id.desc()).limit(limit).all()
    # Serialize to dict to match expected frontend structure if needed, or rely on FastAPI's response_model
    return vehicles

@app.get("/vehicles/", response_model=schemas.VehicleList)
def read_vehicles(
    q: str = None,
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Vehicle)
    
    # Filter by Company
    if current_user.company_id:
        query = query.filter(models.Vehicle.company_id == current_user.company_id)
    query = query.filter(models.Vehicle.status != "inactive")
        
    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Vehicle.make.ilike(search)) |
            (models.Vehicle.model.ilike(search)) |
            (models.Vehicle.plate.ilike(search))
        )

    effective_status = status if is_inventory_editor(current_user) else "available"
    if effective_status:
        query = query.filter(models.Vehicle.status == effective_status)
        
    total = query.count()
    vehicles = query.order_by(models.Vehicle.id.desc()).offset(skip).limit(limit).all()
    return {"items": vehicles, "total": total}

@app.post("/vehicles/", response_model=schemas.Vehicle)
def create_vehicle(
    vehicle: schemas.VehicleCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_inventory_editor(current_user)

    if current_user.company_id and vehicle.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Cannot create vehicle for another company")
        
    # Default to user's company if not provided and user has one
    if not vehicle.company_id and current_user.company_id:
        vehicle.company_id = current_user.company_id

    upsert_brand_model(db, vehicle.make, vehicle.model)
        
    db_vehicle = models.Vehicle(**vehicle.dict())
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@app.put("/vehicles/{vehicle_id}", response_model=schemas.Vehicle)
def update_vehicle(
    vehicle_id: int, 
    vehicle_update: schemas.VehicleUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_inventory_editor(current_user)

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle or vehicle.status == "inactive":
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if current_user.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if status is changing to 'sold'
    if vehicle_update.status == 'sold' and vehicle.status != 'sold':
        # Create a Sale record automatically to track who sold it
        # Check if sale already exists
        existing_sale = db.query(models.Sale).filter(models.Sale.vehicle_id == vehicle.id).first()
        if not existing_sale:
            new_sale = models.Sale(
                vehicle_id=vehicle.id,
                seller_id=current_user.id,
                company_id=current_user.company_id,
                sale_price=vehicle.price, # Default to listing price
                status=models.SaleStatus.APPROVED,
                commission_percentage=current_user.commission_percentage or 0,
                commission_amount=int(vehicle.price * (current_user.commission_percentage or 0) / 100),
                net_revenue=vehicle.price - int(vehicle.price * (current_user.commission_percentage or 0) / 100),
                sale_date=datetime.datetime.utcnow()
            )
            db.add(new_sale)
            # db.commit() will happen below
        
    for field, value in vehicle_update.dict(exclude_unset=True).items():
        setattr(vehicle, field, value)

    target_make = vehicle_update.make if vehicle_update.make is not None else vehicle.make
    target_model = vehicle_update.model if vehicle_update.model is not None else vehicle.model
    upsert_brand_model(db, target_make, target_model)
        
    db.commit()
    db.refresh(vehicle)
    return vehicle

@app.delete("/vehicles/{vehicle_id}", response_model=dict)
def delete_vehicle(
    vehicle_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_inventory_admin_only(current_user)

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle or vehicle.status == "inactive":
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if current_user.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    vehicle.status = "inactive"
    db.commit()
    return {"status": "success", "message": "Vehicle deactivated"}

# --- SALES & COMMISSION ENDPOINTS ---

@app.post("/sales/", response_model=schemas.Sale)
def create_sale(
    sale: schemas.SaleCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # 1. Verify Vehicle
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == sale.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if vehicle.status == "sold":
        raise HTTPException(status_code=400, detail="Vehicle is already sold")
    
    # 2. Get Seller 
    # Logic: Admin can assign a specific seller (e.g. the lead's owner). Default is current user.
    seller = current_user
    
    # Check if admin is overriding seller
    if sale.seller_id:
        # Verify permissions: Only Admin/SuperAdmin can override seller
        if current_user.role.name in ["admin", "super_admin"]:
             target_seller = db.query(models.User).filter(models.User.id == sale.seller_id).first()
             if target_seller:
                 # Verify company match
                 if current_user.company_id and target_seller.company_id != current_user.company_id:
                     raise HTTPException(status_code=400, detail="Target seller is in different company")
                 seller = target_seller
             else:
                 raise HTTPException(status_code=404, detail="Target seller not found")
        else:
             # Regular user tried to override - ignore or error? 
             # Let's ignore it to be safe and enforce 'me', or raise error
             pass 
    
    # 3. Calculate Commission
    # Snapshot at time of creation, though approval locks it
    commission_pct = seller.commission_percentage or 0.0
    commission_amount = (sale.sale_price * commission_pct) / 100
    net_revenue = sale.sale_price - commission_amount
    
    # 4. Create Sale Record
    new_sale = models.Sale(
        vehicle_id=sale.vehicle_id,
        lead_id=sale.lead_id,
        seller_id=seller.id,
        company_id=seller.company_id,
        sale_price=sale.sale_price,
        commission_percentage=commission_pct,
        commission_amount=commission_amount,
        net_revenue=net_revenue,
        status="pending"
    )
    
    db.add(new_sale)
    
    # 5. Lock Vehicle (Reserve it until approved)
    vehicle.status = "reserved"
    
    # 6. Update Lead Status if provided
    if sale.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == sale.lead_id).first()
        if lead:
            lead.status = "sold"  # Mark as sold on frontend triggers this, so sync it back
            
    db.commit()
    db.refresh(new_sale)
    return new_sale

@app.get("/sales/", response_model=schemas.SaleList)
def read_sales(
    status: str = None, # Optional status
    month: int = None,
    year: int = None,
    q: str = None, # Search query
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Sale).options(
        joinedload(models.Sale.vehicle),
        joinedload(models.Sale.lead),
        joinedload(models.Sale.seller)
    )
    
    # Permission Logic
    if current_user.role.name in ["admin", "super_admin"]:
        # Admin sees all company sales
        if current_user.company_id:
            query = query.filter(models.Sale.company_id == current_user.company_id)
    else:
        # Advisors/Others sees only THEIR sales
        query = query.filter(models.Sale.seller_id == current_user.id)
        
    # Filters
    if status:
        query = query.filter(models.Sale.status == status)
        
    if month and year:
        # Filter by specific month/year
        # Note: SQLite/Postgres specific might vary, using Generic extract or range
        # Easier to construct a date range for the month
        import calendar
        _, last_day = calendar.monthrange(year, month)
        start_date = datetime.datetime(year, month, 1)
        end_date = datetime.datetime(year, month, last_day, 23, 59, 59)
        query = query.filter(models.Sale.sale_date >= start_date, models.Sale.sale_date <= end_date)
        
    if q:
        search = f"%{q}%"
        query = query.join(models.Vehicle).filter(
            (models.Vehicle.make.ilike(search)) |
            (models.Vehicle.model.ilike(search)) |
            (models.Vehicle.plate.ilike(search))
        )
        
    total = query.count()
    sales = query.order_by(models.Sale.sale_date.desc()).offset(skip).limit(limit).all()
    return {"items": sales, "total": total}

@app.put("/sales/{sale_id}/approve", response_model=schemas.Sale)
def approve_sale(
    sale_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Only Admin or Super Admin
    if current_user.role.name not in ["admin", "super_admin"]:
         raise HTTPException(status_code=403, detail="Only admins can approve sales")
         
    sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
        
    if sale.status == "approved":
        raise HTTPException(status_code=400, detail="Sale already approved")
        
    # Finalize
    sale.status = "approved"
    sale.approved_by_id = current_user.id
    sale.sale_date = datetime.datetime.utcnow()
    
    # Mark Vehicle as Sold
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == sale.vehicle_id).first()
    if vehicle:
        vehicle.status = "sold"
        
    db.commit()
    db.refresh(sale)
    return sale

@app.get("/finance/stats")
def get_finance_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Only Admin/Super Admin
    if current_user.role.name not in ["admin", "super_admin"]:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    # 1. Total Stats (All time)
    query = db.query(models.Sale).filter(models.Sale.status == "approved")
    if current_user.company_id:
        query = query.filter(models.Sale.company_id == current_user.company_id)
    sales = query.all()
    
    total_revenue = sum(s.net_revenue for s in sales)
    total_commissions = sum(s.commission_amount for s in sales)
    total_sales_count = len(sales)
    
    # 2. Pending Count
    pending_query = db.query(models.Sale).filter(models.Sale.status == "pending")
    if current_user.company_id:
        pending_query = pending_query.filter(models.Sale.company_id == current_user.company_id)
    pending_count = pending_query.count()

    # 3. Monthly Stats (Current Month)
    now = datetime.datetime.utcnow()
    current_month_sales = [s for s in sales if s.sale_date and s.sale_date.month == now.month and s.sale_date.year == now.year]
    
    monthly_revenue = sum(s.net_revenue for s in current_month_sales)
    monthly_commissions = sum(s.commission_amount for s in current_month_sales)

    # 4. Payroll Expenses (Sum of base_salary of all users)
    # Filter by company if needed
    user_query = db.query(models.User)
    if current_user.company_id:
        user_query = user_query.filter(models.User.company_id == current_user.company_id)
    
    users = user_query.all()
    payroll_expenses = sum(u.base_salary or 0 for u in users)
    
    return {
        "total_revenue": total_revenue,
        "total_commissions": total_commissions,
        "total_sales_count": total_sales_count,
        "pending_sales_count": pending_count,
        "monthly_revenue": monthly_revenue, 
        "monthly_commissions": monthly_commissions,
        "payroll_expenses": payroll_expenses
    }

# --- INTERNAL CHAT ENDPOINTS ---

@app.get("/internal-messages", response_model=List[schemas.InternalMessage])
def get_internal_messages(
    date: str = Query(None), # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Filter by company
    query = db.query(models.InternalMessage).filter(models.InternalMessage.company_id == current_user.company_id)
    
    # Filter Permissions: 
    # Show message IF:
    # 1. recipient_id is NULL (Broadcast)
    # 2. recipient_id == current_user.id (Received DM)
    # 3. sender_id == current_user.id (Sent DM)
    from sqlalchemy import or_
    query = query.filter(
        or_(
            models.InternalMessage.recipient_id == None,
            models.InternalMessage.recipient_id == current_user.id,
            models.InternalMessage.sender_id == current_user.id
        )
    )
    
    if date:
        try:
            date_obj = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            # Filter by date range (start of day to end of day)
            start_of_day = datetime.datetime.combine(date_obj, datetime.time.min)
            end_of_day = datetime.datetime.combine(date_obj, datetime.time.max)
            query = query.filter(models.InternalMessage.created_at >= start_of_day, models.InternalMessage.created_at <= end_of_day)
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        # Default to today
        today = datetime.datetime.utcnow().date()
        start_of_day = datetime.datetime.combine(today, datetime.time.min)
        query = query.filter(models.InternalMessage.created_at >= start_of_day)
        
    return query.order_by(models.InternalMessage.created_at.asc()).all()

@app.post("/internal-messages", response_model=schemas.InternalMessage)
def create_internal_message(
    message: schemas.InternalMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify recipient strictly if provided
    recipient_id = message.recipient_id
    if recipient_id:
        recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        if recipient.company_id != current_user.company_id:
             raise HTTPException(status_code=403, detail="Cannot message users from other companies")

    db_message = models.InternalMessage(
        content=message.content,
        company_id=current_user.company_id,
        sender_id=current_user.id,
        recipient_id=recipient_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

@app.post("/internal-messages/upload", response_model=schemas.InternalMessage)
async def upload_internal_message_file(
    request: Request,
    file: UploadFile = File(...),
    recipient_id: Optional[int] = Form(None),
    content: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if recipient_id:
        recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        if recipient.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Cannot message users from other companies")

    os.makedirs("static/internal_chat", exist_ok=True)

    safe_name = os.path.basename(file.filename or "archivo")
    ext = safe_name.split(".")[-1] if "." in safe_name else "bin"
    unique_name = f"{uuid.uuid4()}.{ext}"
    rel_path = f"static/internal_chat/{unique_name}"

    with open(rel_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    rel_path_web = rel_path.replace("\\", "/")
    relative_url = f"/api/{rel_path_web}"
    file_url = f"{str(request.base_url).rstrip('/')}{relative_url}"
    payload = {
        "type": "file",
        "file_name": safe_name,
        "storage_name": unique_name,
        "file_url": file_url,
        "file_url_relative": relative_url,
        "file_path": rel_path_web,
        "file_type": file.content_type or "application/octet-stream",
        "file_size": os.path.getsize(rel_path),
        "text": content.strip() if content else ""
    }

    db_message = models.InternalMessage(
        content=f"__FILE__{json.dumps(payload, ensure_ascii=False)}",
        company_id=current_user.company_id,
        sender_id=current_user.id,
        recipient_id=recipient_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

