from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from auth_utils import get_password_hash
import sys

def seed_super_admin():
    db = SessionLocal()
    try:
        # 1. Seed Roles
        roles = [
            {"name": "super_admin", "label": "Súper Admin Global"},
            {"name": "admin", "label": "Administrador de Empresa"},
            {"name": "asesor", "label": "Asesor / Vendedor"},
            {"name": "user", "label": "Usuario Básico"}
        ]
        
        for r in roles:
            existing = db.query(models.Role).filter(models.Role.name == r["name"]).first()
            if not existing:
                print(f"Creating role: {r['name']}")
                new_role = models.Role(name=r["name"], label=r["label"])
                db.add(new_role)
        db.commit()

        # 2. Check/Create Super Admin Company
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

        # 3. Check/Create Super Admin User
        admin_email = "admin@autosqp.com"
        user = db.query(models.User).filter(models.User.email == admin_email).first()
        
        # Get Super Admin Role ID
        sa_role = db.query(models.Role).filter(models.Role.name == "super_admin").first()
        
        if not user:
            print(f"Creating Super Admin user ({admin_email})...")
            new_user = models.User(
                email=admin_email,
                hashed_password=get_password_hash("admin123"),
                role_id=sa_role.id,
                company_id=admin_company.id,
                commission_percentage=0 # Super Admin typically doesn't sell, but field is required/defaulted
            )
            db.add(new_user)
            db.commit()
            print("Super Admin created successfully!")
            print("Email: admin@autosqp.com")
            print("Pass: admin123")
        else:
            print("Super Admin user already exists. Updating Role ID if needed...")
            if user.role_id != sa_role.id:
                user.role_id = sa_role.id
                db.commit()
                print("Updated Super Admin role_id.")
            
    except Exception as e:
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_super_admin()
