from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from database import get_db
import models, schemas
from dependencies import get_current_user

router = APIRouter(
    prefix="/credits",
    tags=["credits"]
)

@router.get("/", response_model=schemas.CreditApplicationList)
def read_credits(
    status: str = None,
    q: str = None,
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.CreditApplication).options(
        joinedload(models.CreditApplication.assigned_to)
    )
    
    # Filter by user company
    if current_user.company_id:
        query = query.filter(models.CreditApplication.company_id == current_user.company_id)
    
    # Filter by Advisor (Asesor) - Only see assigned leads/credits? 
    # Usually credits are handled by admins or specialized agents, but sticking to same logic as leads for now
    if current_user.role and current_user.role.name in ['asesor', 'vendedor']:
        query = query.filter(models.CreditApplication.assigned_to_id == current_user.id)
    
    if status:
        query = query.filter(models.CreditApplication.status == status)

    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.CreditApplication.client_name.ilike(search)) | 
            (models.CreditApplication.email.ilike(search)) | 
            (models.CreditApplication.phone.ilike(search)) |
            (models.CreditApplication.desired_vehicle.ilike(search))
        )
        
    total = query.count()
    credits = query.order_by(models.CreditApplication.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": credits, "total": total}

@router.post("/", response_model=schemas.CreditApplication)
def create_credit(
    credit: schemas.CreditApplicationCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Assign to current user's company if not provided
    company_id = credit.company_id or current_user.company_id
    
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required")
    
    credit_data = credit.dict(exclude={'company_id'})
    
    # If no assigned_to, maybe assign to self if creator is advisor?
    assigned_to_id = credit.assigned_to_id
    if not assigned_to_id and current_user.role.name in ['asesor', 'vendedor']:
        assigned_to_id = current_user.id
        
    db_credit = models.CreditApplication(
        **credit_data, 
        company_id=company_id, 
        assigned_to_id=assigned_to_id
    )
    db.add(db_credit)
    db.commit()
    db.refresh(db_credit)
    return db_credit

@router.put("/{credit_id}", response_model=schemas.CreditApplication)
def update_credit(
    credit_id: int, 
    credit_update: schemas.CreditApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    credit = db.query(models.CreditApplication).filter(models.CreditApplication.id == credit_id).first()
    if not credit:
        raise HTTPException(status_code=404, detail="Credit Application not found")
        
    if current_user.company_id and credit.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for field, value in credit_update.dict(exclude_unset=True).items():
        setattr(credit, field, value)
        
    db.commit()
    db.refresh(credit)
    return credit

@router.get("/stats")
def get_credit_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Simple stats for dashboard
    query = db.query(models.CreditApplication)
    if current_user.company_id:
        query = query.filter(models.CreditApplication.company_id == current_user.company_id)
        
    total = query.count()
    
    from sqlalchemy import func
    status_counts = db.query(models.CreditApplication.status, func.count(models.CreditApplication.status))\
        .filter(models.CreditApplication.company_id == current_user.company_id)\
        .group_by(models.CreditApplication.status).all()
        
    return {
        "total": total,
        "by_status": {s[0]: s[1] for s in status_counts}
    }
