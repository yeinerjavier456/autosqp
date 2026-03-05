import os
import sys
from sqlalchemy import create_engine, text
from database import DATABASE_URL
import traceback

def alterar_tabla_business_sheet():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    try:
        with engine.begin() as conn:
            # Añadir columna a lead_process_details (Ignoramos error si ya existe)
            try:
                conn.execute(text("ALTER TABLE lead_process_details ADD COLUMN business_sheet_url VARCHAR(500) NULL;"))
                print("✅ Columna 'business_sheet_url' añadida con éxito.")
            except Exception as e:
                # Comprobar si es Duplicate column name (1060 MySQL, e error general sqlite)
                if 'Duplicate column name' in str(e) or 'duplicate column name' in str(e):
                    print("⚠️ La columna 'business_sheet_url' ya existe, omitiendo.")
                else:
                    raise e
                    
        print("✅ Operación completada satisfactoriamente.")
        
    except Exception as e:
        print(f"❌ Error al alterar la tabla: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    alterar_tabla_business_sheet()
