from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, get_db
import models, schemas, auth_utils
from jose import JWTError, jwt

# We don't need to call create_all if we are using Alembic, but it's safe to keep for dev if Alembic isn't run
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="AutosQP API", description="API para gestión de compra venta de carros")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Update with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).options(
        joinedload(models.User.role),
        joinedload(models.User.company)
    ).filter(models.User.id == user_id).first()
    
    if user is None:
        raise credentials_exception
    return user

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

    return db_company

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

@app.get("/leads/", response_model=schemas.LeadList)
def read_leads(
    source: str = None, 
    status: str = None,
    q: str = None,
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Lead)
    
    # Filter by user company
    if current_user.company_id:
        query = query.filter(models.Lead.company_id == current_user.company_id)
    
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


@app.post("/leads/", response_model=schemas.Lead)
def create_lead(lead: schemas.LeadCreate, db: Session = Depends(get_db)):
    import datetime
    import random
    
    # 1. Determine Company (simplified logic: assumes payload has company_id)
    if not lead.company_id:
         raise HTTPException(status_code=400, detail="Company ID required for assignment")

    # 2. Auto-Assign to 'asesor'
    # Find 'asesor' role id
    asesor_role = db.query(models.Role).filter(models.Role.name == "asesor").first()
    assigned_user_id = None
    
    if asesor_role:
        # Find users in this company with 'asesor' role
        potential_agents = db.query(models.User).filter(
            models.User.company_id == lead.company_id,
            models.User.role_id == asesor_role.id
        ).all()
        
        if potential_agents:
            # Pick one randomly (Round Robin implies state, random is stateless and fair enough for now)
            chosen_agent = random.choice(potential_agents)
            assigned_user_id = chosen_agent.id
            print(f"Lead automatically assigned to: {chosen_agent.email}")
    
    new_lead = models.Lead(
        created_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        updated_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        source=lead.source,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        message=lead.message,
        status=lead.status,
        company_id=lead.company_id,
        assigned_to_id=assigned_user_id
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return new_lead

@app.get("/reports/stats", response_model=schemas.ReportsStats)
def get_reports_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Base query filtered by company
    query = db.query(models.Lead)
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
        if status == "converted":
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
    
    # Mock Data for requested charts (Brands, Models, Time)
    import random
    brands = ["Toyota", "Chevrolet", "Mazda", "Renault", "Kia", "Ford"]
    fake_leads_by_brand = {b: random.randint(5, 50) for b in brands}
    
    models_list = ["Corolla", "Spark", "Mazda 3", "Duster", "Picanto", "Fiesta"]
    fake_leads_by_model = {m: random.randint(3, 30) for m in models_list}
    
    # Mock Response Time (e.g. average minutes per day for last 7 days)
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

# --- VEHICLES ENDPOINTS ---

@app.get("/vehicles/", response_model=schemas.VehicleList)
def read_vehicles(
    q: str = None,
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
        
    total = query.count()
    vehicles = query.offset(skip).limit(limit).all()
    return {"items": vehicles, "total": total}

@app.post("/vehicles/", response_model=schemas.Vehicle)
def create_vehicle(
    vehicle: schemas.VehicleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Determine company
    company_id = vehicle.company_id
    if not company_id:
        # Fallback to user's company
        company_id = current_user.company_id
        
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required")
        
    if current_user.company_id and current_user.company_id != company_id:
         raise HTTPException(status_code=403, detail="Cannot create vehicle for another company")

    new_vehicle = models.Vehicle(
        make=vehicle.make,
        model=vehicle.model,
        year=vehicle.year,
        price=vehicle.price,
        plate=vehicle.plate,
        mileage=vehicle.mileage,
        color=vehicle.color,
        description=vehicle.description,
        status=vehicle.status,
        photos=vehicle.photos or [],
        company_id=company_id
    )
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle

@app.get("/vehicles/{vehicle_id}", response_model=schemas.Vehicle)
def read_vehicle(vehicle_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if current_user.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return vehicle

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
        
    # Update fields
    for field, value in vehicle_update.dict(exclude_unset=True).items():
        setattr(vehicle, field, value)
        
    db.commit()
    db.refresh(vehicle)
    return vehicle
