
# --- INTERNAL CHAT ENDPOINTS ---

@app.get("/internal-messages", response_model=List[schemas.InternalMessage])
def get_internal_messages(
    date: str = Query(None), # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Filter by company
    query = db.query(models.InternalMessage).filter(models.InternalMessage.company_id == current_user.company_id)
    
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
    db_message = models.InternalMessage(
        content=message.content,
        company_id=current_user.company_id,
        sender_id=current_user.id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message
