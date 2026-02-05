from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Lead, User

DATABASE_URL = "mysql+pymysql://root:root@localhost:3306/autosqp"

try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    # Find the lead
    lead = db.query(Lead).filter(Lead.phone == "573005555555").first()
    if lead:
        # Find a user to assign (e.g. vendedor1 or first available)
        # We saw User 2 is Vendedor1 in previous output
        user = db.query(User).filter(User.id == 2).first()
        if user:
            lead.assigned_to_id = user.id
            db.commit()
            print(f"Assigned Lead {lead.id} ({lead.name}) to User {user.email}")
        else:
            print("User 2 not found, trying any user with company 1")
            user = db.query(User).filter(User.company_id == 1).first()
            if user:
                lead.assigned_to_id = user.id
                db.commit()
                print(f"Assigned Lead {lead.id} to {user.email}")
    else:
        print("Lead not found")

except Exception as e:
    print(f"Error: {e}")
