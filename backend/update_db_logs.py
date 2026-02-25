from database import engine, Base
from models import SystemLog
import traceback

def create_logs_table():
    print("Verificando y creando tabla de logs de sistema (system_logs)...")
    try:
        # Create specifically the new table without dropping others
        SystemLog.__table__.create(bind=engine, checkfirst=True)
        print("✅ Tabla system_logs lista en la base de datos.")
        
    except Exception as e:
        print("❌ Error al crear tabla de logs:")
        print(traceback.format_exc())

if __name__ == "__main__":
    create_logs_table()
