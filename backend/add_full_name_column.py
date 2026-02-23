from sqlalchemy import text
from database import engine

def add_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(150) NULL AFTER email;"))
            conn.commit()
            print("Columna 'full_name' añadida exitosamente a la tabla 'users'.")
        except Exception as e:
            if "Duplicate column name" in str(e):
                print("La columna 'full_name' ya existe. No se hicieron cambios.")
            else:
                print(f"Error al añadir columna: {e}")

if __name__ == "__main__":
    add_column()
