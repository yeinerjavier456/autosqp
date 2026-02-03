from database import SessionLocal
from models import User

db = SessionLocal()
try:
    print("--- USER SALARIES ---")
    users = db.query(User).all()
    total_payroll = 0
    for u in users:
        salary = u.base_salary
        if salary is None:
            salary_display = "None"
            salary_val = 0
        else:
            salary_display = salary
            salary_val = salary
            
        total_payroll += salary_val
        print(f"ID: {u.id}, Email: {u.email}, Base Salary: {salary_display}")
    
    print(f"\nTotal Payroll Calculated: {total_payroll}")

finally:
    db.close()
