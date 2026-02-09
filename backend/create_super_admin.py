from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.orm import Session
from database import SessionLocal
import models
from auth_utils import get_password_hash
import sys

def create_super_admin():
    db = SessionLocal()
    try:
        print("Iniciando gestión de Super Admin...")

        # 1. Asegurar rol super_admin
        sa_role = db.query(models.Role).filter(models.Role.name == "super_admin").first()
        if not sa_role:
            print("Creando rol 'super_admin'...")
            sa_role = models.Role(name="super_admin", label="Super Admin Global")
            db.add(sa_role)
            db.commit()
            db.refresh(sa_role)
        else:
            print("Rol 'super_admin' ya existe.")

        # 2. Asegurar empresa 'AutosQP Admin'
        admin_company = db.query(models.Company).filter(models.Company.name == "AutosQP Admin").first()
        if not admin_company:
            print("Creando empresa 'AutosQP Admin'...")
            admin_company = models.Company(
                name="AutosQP Admin",
                primary_color="#0f172a",
                secondary_color="#3b82f6"
            )
            db.add(admin_company)
            db.commit()
            db.refresh(admin_company)
        else:
            print("Empresa 'AutosQP Admin' ya existe.")

        # 3. Crear o Actualizar Usuario
        email = "admin@autosqp.com"
        password = "admin123" 
        
        user = db.query(models.User).filter(models.User.email == email).first()
        
        if user:
            print(f"El usuario {email} ya existe.")
            # Opcional: Actualizar contraseña y rol para asegurar acceso
            print("Actualizando contraseña y asegurando rol/empresa...")
            user.hashed_password = get_password_hash(password)
            user.role_id = sa_role.id
            user.company_id = admin_company.id
            db.commit()
            print("Usuario actualizado correctamente.")
        else:
            print(f"Creando usuario {email}...")
            new_user = models.User(
                email=email,
                hashed_password=get_password_hash(password),
                role_id=sa_role.id,
                company_id=admin_company.id,
                commission_percentage=0,
                base_salary=0
            )
            db.add(new_user)
            db.commit()
            print(f"Usuario creado exitosamente.")

        print("-" * 30)
        print("CREDENCIALES DE SUPER ADMIN:")
        print(f"Email: {email}")
        print(f"Contraseña: {password}")
        print("-" * 30)

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_super_admin()
