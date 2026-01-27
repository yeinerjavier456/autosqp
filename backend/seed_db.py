from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from auth_utils import get_password_hash
import sys

def seed_super_admin():
    db = SessionLocal()
    try:
        # Check if Super Admin company exists (system default)
        admin_company = db.query(models.Company).filter(models.Company.name == "AutosQP Admin").first()
        if not admin_company:
            print("Creating 'AutosQP Admin' company...")
            admin_company = models.Company(
                name="AutosQP Admin",
                primary_color="#0f172a", # Slate-900
                secondary_color="#3b82f6" # Blue-500
            )
            db.add(admin_company)
            db.commit()
            db.refresh(admin_company)

        # Check if Super Admin user exists
        admin_email = "admin@autosqp.com"
        user = db.query(models.User).filter(models.User.email == admin_email).first()
        if not user:
            print(f"Creating Super Admin user ({admin_email})...")
            new_user = models.User(
                email=admin_email,
                hashed_password=get_password_hash("admin123"),
                role=models.UserRole.SUPER_ADMIN,
                company_id=admin_company.id
            )
            db.add(new_user)
            db.commit()
            print("Super Admin created successfully!")
            print("Email: admin@autosqp.com")
            print("Pass: admin123")
        else:
            print("Super Admin user already exists.")
            
    except Exception as e:
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_super_admin()
