from fastapi import FastAPI, Depends, HTTPException, status, Query, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, get_db
import models, schemas, auth_utils
from routers import whatsapp, credits # Import the new router
from jose import JWTError, jwt
import datetime
import os
# We don't need to call create_all if we are using Alembic, but it's safe to keep for dev if Alembic isn't run
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AutosQP API", description="API para gestión de compra venta de carros")

app.include_router(whatsapp.router) # Register the router
app.include_router(credits.router) # Register credits router


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",

        "http://localhost:3000",
        "http://34.229.164.25:3000",
        "http://54.226.30.192:3000", # New IP
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
    return {"access_token": access_token, "token_type": "bearer"}



# --- USER ENDPOINTS ---

@app.get("/users/", response_model=schemas.UserList)
def read_users(
    skip: int = 0, 
    limit: int = 20, 
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
        hashed_password=hashed_password,
        role_id=user.role_id, 
        company_id=user.company_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
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
        
    return db_user



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
    limit: int = 50, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Lead).options(
        joinedload(models.Lead.assigned_to),
        joinedload(models.Lead.history),
        joinedload(models.Lead.conversation).joinedload(models.Conversation.messages)
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
    
    new_lead = models.Lead(
        created_at=datetime.datetime.now(),
        source=lead.source,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        message=lead.message,
        status=lead.status,
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
from fastapi import UploadFile, File
import shutil
import os
import uuid

# Ensure static directory exists
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.post("/upload/")
async def upload_image(file: UploadFile = File(...)):
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"static/{unique_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return URL (assuming localhost for now, hardcoded base likely needed for prod)
    # In a real scenario you might return full URL or relative path
    return {"url": f"http://localhost:8000/static/{unique_filename}"}

# --- BRANDS & MODELS ENDPOINTS ---

@app.get("/brands/", response_model=List[schemas.CarBrand])
def read_brands(db: Session = Depends(get_db)):
    return db.query(models.CarBrand).order_by(models.CarBrand.name).all()

@app.get("/brands/{brand_id}/models/", response_model=List[schemas.CarModel])
def read_models_by_brand(brand_id: int, db: Session = Depends(get_db)):
    return db.query(models.CarModel).filter(models.CarModel.brand_id == brand_id).order_by(models.CarModel.name).all()

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

    db_lead = models.Lead(
        **lead_data, 
        company_id=company_id, 
        assigned_to_id=assigned_to_id,
        created_by_id=current_user.id # Track who created it
    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
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
    
    # Check for status change OR comment to log history
    # If status changes, or if there's a comment (even without status change), we log it.
    has_status_change = lead_update.status and lead_update.status != lead.status
    has_comment = lead_update.comment and len(lead_update.comment.strip()) > 0
    
    if has_status_change or has_comment:
        new_history = models.LeadHistory(
            lead_id=lead.id,
            user_id=current_user.id,
            previous_status=lead.status,
            new_status=lead_update.status if lead_update.status else lead.status,
            comment=lead_update.comment
        )
        db.add(new_history)
        
    for field, value in lead_update.dict(exclude_unset=True).items():
        if field == 'comment':
            continue # Skip comment field as it's not on Lead model
        setattr(lead, field, value)
        
    db.commit()
    db.refresh(lead)
    return lead

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
        
    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Vehicle.make.ilike(search)) |
            (models.Vehicle.model.ilike(search)) |
            (models.Vehicle.plate.ilike(search))
        )

    if status:
        query = query.filter(models.Vehicle.status == status)
        
        # RESTRICTION: Advisor can only see SOLD vehicles if THEY sold them
        # We assume 'sold' status implies a Sale record exists (handled in update_vehicle)
        if status == 'sold' and current_user.role and current_user.role.name in ['asesor', 'vendedor']:
            query = query.join(models.Sale, models.Sale.vehicle_id == models.Vehicle.id)\
                         .filter(models.Sale.seller_id == current_user.id)
        
    total = query.count()
    vehicles = query.order_by(models.Vehicle.id.desc()).offset(skip).limit(limit).all()
    return {"items": vehicles, "total": total}

@app.post("/vehicles/", response_model=schemas.Vehicle)
def create_vehicle(
    vehicle: schemas.VehicleCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.company_id and vehicle.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Cannot create vehicle for another company")
        
    # Default to user's company if not provided and user has one
    if not vehicle.company_id and current_user.company_id:
        vehicle.company_id = current_user.company_id
        
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
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
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
        
    db.commit()
    db.refresh(vehicle)
    return vehicle

@app.delete("/vehicles/{vehicle_id}", response_model=dict)
def delete_vehicle(
    vehicle_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if current_user.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.delete(vehicle)
    db.commit()
    return {"status": "success", "message": "Vehicle deleted"}

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