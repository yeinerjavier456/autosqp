import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import numbers

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found in environment.")
    exit(1)

engine = create_engine(DATABASE_URL)

status_map = {
    "VENDIDO": "sold",
    "DISPONIBLE": "available",
    "ALISTAMIENTO": "alistamiento",
    "RESERVADO": "reserved",
    "DESEMBOLSO": "desembolso"
}

def clean_excel_date(val):
    if pd.isna(val) or val == "----" or val == "-----" or str(val).strip() == "":
        return None
    if isinstance(val, numbers.Number):
        # Excel date (days since 1899-12-30)
        return pd.to_datetime(val, unit='D', origin='1899-12-30').strftime('%Y-%m-%d %H:%M:%S')
    try:
        return pd.to_datetime(val).strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return None

def clean_number(val):
    if pd.isna(val) or val == "" or str(val).strip() == "":
        return None
    try:
        # Check if it's already a number
        if isinstance(val, (int, float)):
            return int(val)
            
        # If string, remove $ , . and spaces
        cleaned = str(val).replace("$", "").replace(".", "").replace(",", "").replace(" ", "").strip()
        if not cleaned: 
            return None
            
        return int(float(cleaned))
    except Exception:
        return None

def import_inventory():
    file_path = "INVENTARIO PAGINA WEB CRM.xlsx"
    if not os.path.exists(file_path):
        # Maybe it's one directory up? (Running from backend)
        file_path = "../INVENTARIO PAGINA WEB CRM.xlsx"
        if not os.path.exists(file_path):
            print(f"Error: {file_path} not found.")
            return
        
    print(f"Leyendo archivo de Excel: {file_path}...")
    df = pd.read_excel(file_path, header=1)
    status_col = "🚨🚨🚨🚨"
    
    inserted = 0
    updated = 0
    errors = 0
    
    with engine.connect() as conn:
        # Determine the company ID dynamically! Important!
        company = conn.execute(text("SELECT id FROM companies LIMIT 1")).fetchone()
        if not company:
            print("❌ Error Fatal: No hay ninguna compañía (company) en la base de datos.")
            return
        default_company_id = company[0]
        print(f"Usando Company ID: {default_company_id} por defecto.")

        for idx, row in df.iterrows():
            make_model = str(row.get("Marca & Modelo", ""))
            if pd.isna(make_model) or make_model.strip() == "nan" or make_model.strip() == "":
                continue # Skip empty rows
                
            plate = str(row.get("Placa:", "")).strip().upper()
            if not plate or plate == "NAN":
                continue # Require plate
                
            # Status mapping
            raw_status = str(row.get(status_col, "DISPONIBLE")).strip().upper()
            status = status_map.get(raw_status, "available")
            
            # Extract basic data safely
            year = clean_number(row.get("Año:")) or 0
            price = clean_number(row.get("PRECIO DE VENTA")) or 0
            purchase_price = clean_number(row.get("PRECIO COMPRA :"))
            faseco = clean_number(row.get("FASECO:"))
            mileage = clean_number(row.get("Kilómetros:")) or 0
            
            # Extract strings safely
            color = str(row.get("Color:", "")).strip()[:50]
            fuel = str(row.get("Combustible:", "")).strip()[:50]
            transmission = str(row.get("Transmisión:", "")).strip()[:50]
            engine_str = str(row.get("Motor:", "")).strip()[:50]
            internal_code = str(row.get("Cod:", "")).strip()[:50]
            location = str(row.get("Ubicacion:", "")).strip()[:100]
            
            # Treat NaN string fields as None
            color = color if color != "nan" and color else None
            fuel = fuel if fuel != "nan" and fuel else None
            transmission = transmission if transmission != "nan" and transmission else None
            engine_str = engine_str if engine_str != "nan" and engine_str else None
            internal_code = internal_code if internal_code != "nan" and internal_code else None
            location = location if location != "nan" and location else None
            
            # Dates
            soat = clean_excel_date(row.get("Soat:"))
            tecno = clean_excel_date(row.get("Tecno:"))
            
            try:
                check_query = text("SELECT id FROM vehicles WHERE plate = :plate")
                result = conn.execute(check_query, {"plate": plate}).fetchone()
                
                if result:
                    update_query = text("""
                        UPDATE vehicles 
                        SET make = :make, year = :year, color = :color, fuel_type = :fuel,
                            transmission = :transmission, engine = :engine, mileage = :mileage,
                            purchase_price = :purchase_price, faseco = :faseco,
                            price = :price, status = :status,
                            internal_code = :internal_code, location = :location,
                            soat = :soat, tecno = :tecno
                        WHERE plate = :plate
                    """)
                    conn.execute(update_query, {
                        "make": make_model, "year": year, "color": color, "fuel": fuel,
                        "transmission": transmission, "engine": engine_str, "mileage": mileage,
                        "purchase_price": purchase_price, "faseco": faseco,
                        "price": price, "status": status,
                        "internal_code": internal_code, "location": location,
                        "soat": soat, "tecno": tecno, "plate": plate
                    })
                    updated += 1
                else:
                    insert_query = text("""
                        INSERT INTO vehicles (
                            make, year, color, fuel_type, transmission, engine, mileage, plate,
                            purchase_price, faseco, price, status, internal_code, location,
                            soat, tecno, company_id
                        ) VALUES (
                            :make, :year, :color, :fuel, :transmission, :engine, :mileage, :plate,
                            :purchase_price, :faseco, :price, :status, :internal_code, :location,
                            :soat, :tecno, :company_id
                        )
                    """)
                    conn.execute(insert_query, {
                        "make": make_model, "year": year, "color": color, "fuel": fuel,
                        "transmission": transmission, "engine": engine_str, "mileage": mileage, "plate": plate,
                        "purchase_price": purchase_price, "faseco": faseco,
                        "price": price, "status": status,
                        "internal_code": internal_code, "location": location,
                        "soat": soat, "tecno": tecno, "company_id": default_company_id
                    })
                    inserted += 1
                conn.commit()
            except Exception as e:
                print(f"❌ Error crítico procesando placa {plate}: {e}")
                errors += 1
                conn.rollback()
                
    print("\n--- 🚘 RESUMEN DE IMPORTACIÓN AUTOMÁTICA ---")
    print(f"Vehículos nuevos insertados: {inserted}")
    print(f"Vehículos existentes actualizados: {updated}")
    print(f"Registros fallidos: {errors}")

if __name__ == "__main__":
    print("Iniciando carga masiva desde Excel...")
    import_inventory()
    print("Operación completada.")

