import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import Role, UserRole

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("No DATABASE_URL found.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def update_roles():
    print("Checking roles...")
    
    # Check Aliado
    aliado = db.query(Role).filter(Role.name == "aliado").first()
    if not aliado:
        print("Creating 'aliado' role...")
        new_role = Role(name="aliado", label="Aliado Comercial")
        db.add(new_role)
        db.commit()
        print("Role 'aliado' created.")
    else:
        print("Role 'aliado' already exists.")

    # List all roles
    roles = db.query(Role).all()
    print("\nCurrent Roles in DB:")
    for r in roles:
        print(f"- {r.name}: {r.label}")

if __name__ == "__main__":
    try:
        update_roles()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()
