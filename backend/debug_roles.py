from database import SessionLocal
from models import Role, User

db = SessionLocal()
try:
    print("--- ROLES ---")
    roles = db.query(Role).all()
    for r in roles:
        print(f"ID: {r.id}, Name: '{r.name}', Label: '{r.label}'")
        
    print("\n--- USERS ---")
    users = db.query(User).all()
    for u in users:
        r_name = u.role.name if u.role else "None"
        print(f"ID: {u.id}, Email: {u.email}, Role ID: {u.role_id}, Role Name: '{r_name}'")

finally:
    db.close()
