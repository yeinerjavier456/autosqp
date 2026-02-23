import sys
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from auth_utils import get_password_hash

def ensure_role(db: Session, role_name: str, label: str):
    role = db.query(models.Role).filter(models.Role.name == role_name).first()
    if not role:
        role = models.Role(name=role_name, label=label)
        db.add(role)
        db.commit()
        db.refresh(role)
    return role.id

def create_user_if_not_exists(db: Session, email: str, name: str, role_id: int):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        print(f"Creado nuevo usuario: {name} ({email})")
        new_user = models.User(
            email=email,
            full_name=name,
            hashed_password=get_password_hash("autosqp123"), # default setup password
            role_id=role_id,
            company_id=None # Defaulting to global admin level for now
        )
        db.add(new_user)
        db.commit()
    else:
        print(f"Ignorado, el correo {email} ya existe. Actualizando nombre...")
        user.full_name = name
        user.role_id = role_id
        db.commit()

def seed_users():
    db = SessionLocal()
    try:
        print("Iniciando creación de usuarios solicitados...")
        
        # 1. Aseguramos que los roles existen y obtenemos sus IDs
        role_asesor = ensure_role(db, "asesor", "Asesor / Vendedor")
        role_admin = ensure_role(db, "admin", "Administrador de Empresa")
        role_compras = ensure_role(db, "compras", "Gestor de Compras")
        role_aliado = ensure_role(db, "aliado", "Aliado Estratégico")

        # --- VENTAS (Asesores) ---
        create_user_if_not_exists(db, "alexandra.gonzales@autosqp.com", "María Alexandra Gonzáles Rodríguez", role_asesor)
        create_user_if_not_exists(db, "cesar.cruz@autosqp.com", "Cesar David Cruz Orjuela", role_asesor)
        # Nota: Jennifer está en ambos (Venta y Admin), le dejaremos la cuenta maestra de Admin debajo.
        create_user_if_not_exists(db, "vendedor.4@autosqp.com", "Vendedor 4", role_asesor)

        # --- ADMINISTRADORES ---
        create_user_if_not_exists(db, "diego.plazas@autosqp.com", "Diego Alejandro Plazas Patiño", role_admin)
        create_user_if_not_exists(db, "jennifer.quimbayo@autosqp.com", "Jennifer Quimbayo Sánchez", role_admin)
        create_user_if_not_exists(db, "sandra.diaz@autosqp.com", "Sandra Viviana Díaz Pineda", role_admin)

        # --- COMPRAS ---
        create_user_if_not_exists(db, "santiago.lugo@autosqp.com", "David Santiago Lugo Sánchez", role_compras)
        create_user_if_not_exists(db, "owen.castro@autosqp.com", "Owen Santiago Castro Plazas", role_compras)

        # --- ALIADOS AUTOFINANCIERA ---
        create_user_if_not_exists(db, "charly@autofinanciera.com", "Charly", role_aliado)
        create_user_if_not_exists(db, "adriana@autofinanciera.com", "Adriana", role_aliado)

        # --- ALIADOS FINANCIAKARS ---
        create_user_if_not_exists(db, "usuario.1@financiakars.com", "Usuario 1", role_aliado)
        
        print("\n¡Todos los usuarios han sido creados correctamente!")
        print("La contraseña temporal para todos es: autosqp123")

    except Exception as e:
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
