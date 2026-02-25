import traceback
from database import engine, Base
from models import LeadProcessDetail

def create_leads_process_table():
    print("Verificando y creando tabla de procesos de leads (lead_process_details)...")
    try:
        # Create specifically the new table without dropping others
        LeadProcessDetail.__table__.create(bind=engine, checkfirst=True)
        print("✅ Tabla lead_process_details lista en la base de datos.")
        
    except Exception as e:
        print("❌ Error al crear tabla de procesos de leads:")
        print(traceback.format_exc())

if __name__ == "__main__":
    create_leads_process_table()
