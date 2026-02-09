from database import engine, SessionLocal, Base
from models import Role, User
from sqlalchemy import text

def migrate():
    print("Starting migration...")
    
    # 1. Create new tables (Roles)
    # This only works for tables that don't exist yet
    # Since we added 'leads' table in models.py, create_all will create it if missing.
    Base.metadata.create_all(bind=engine)
    print("Tables created (if missing).")

    with SessionLocal() as db:
        # 2. Seed Roles
        roles = [
            {"name": "super_admin", "label": "Super Admin Global"},
            {"name": "admin", "label": "Administrador"},
            {"name": "asesor", "label": "Asesor"},
            {"name": "user", "label": "Usuario"},
        ]
        
        role_map = {}
        for r in roles:
            db_role = db.query(Role).filter(Role.name == r["name"]).first()
            if not db_role:
                print(f"Creating role: {r['name']}")
                db_role = Role(name=r["name"], label=r["label"])
                db.add(db_role)
                db.commit()
                db.refresh(db_role)
            role_map[r["name"]] = db_role.id
        
        print("Roles seeded.")

        # 3. Add column role_id to users if not exists
        # SQLite specific check
        try:
            # Try to select the column. If it fails, it doesn't exist.
            db.execute(text("SELECT role_id FROM users LIMIT 1"))
            print("Column 'role_id' already exists in 'users'.")
        except Exception:
            print("Column 'role_id' missing in 'users'. Adding it...")
            try:
                # SQLite ALTER TABLE
                db.execute(text("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)"))
                db.commit()
                print("Column 'role_id' added.")
            except Exception as e:
                print(f"Error adding column: {e}")

        # 4. Migrate data (String role -> role_id)
        # We need to look at existing users and update their role_id based on the 'role' string column
        # Note: We must ensure 'role' column still exists or logic relies on it. 
        # The 'role' column is still in the DB even if deprecated in models.
        
        print("Migrating existing user roles...")
        try:
            users = db.query(User).all()
            for user in users:
                # Access the raw column value if mapped distinctively, but here User.role model is a relationship now...
                # Wait, in models.py User.role is now a relationship! 
                # Querying User.role will try to join.
                # Use raw SQL to get the old string value
                
                result = db.execute(text(f"SELECT role FROM users WHERE id = {user.id}")).scalar()
                old_role_str = result
                
                if old_role_str and old_role_str in role_map:
                    if user.role_id is None: # Only update if not already set
                        new_id = role_map[old_role_str]
                        print(f"Migrating User {user.email}: '{old_role_str}' -> ID {new_id}")
                        user.role_id = new_id
                        db.add(user)
            
            db.commit()
            print("User roles migrated.")
        except Exception as e:
            print(f"Error during data migration: {e}")

if __name__ == "__main__":
    migrate()
