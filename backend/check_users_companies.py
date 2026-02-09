from database import SessionLocal
from models import User

db = SessionLocal()
try:
    print("--- USER COMPANIES ---")
    users = db.query(User).all()
    for u in users:
        print(f"ID: {u.id}, Email: {u.email}, Company ID: {u.company_id}, Salary: {u.base_salary}")

finally:
    db.close()
