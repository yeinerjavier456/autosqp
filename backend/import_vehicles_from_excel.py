import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from getpass import getpass
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

def import_inventory():
    file_path = "INVENTARIO PAGINA WEB CRM.xlsx"
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found in the current directory.")
        return
        
    print(f"Leyendo archivo de Excel: {file_path}...")
    df = pd.read_excel(file_path, header=1)
    
    status_col = "🚨🚨🚨🚨"
    
    inserted = 0
    updated = 0
    errors = 0
    
    with engine.connect() as conn:
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
            year = int(row.get("Año:", 0)) if not pd.isna(row.get("Año:")) else 0
            price = int(row.get("PRECIO DE VENTA", 0)) if not pd.isna(row.get("PRECIO DE VENTA")) else 0
            purchase_price = int(row.get("PRECIO COMPRA :", 0)) if not pd.isna(row.get("PRECIO COMPRA :")) else None
            faseco = int(row.get("FASECO:", 0)) if not pd.isna(row.get("FASECO:")) else None
            mileage = int(row.get("Kilómetros:", 0)) if not pd.isna(row.get("Kilómetros:")) else 0
            
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
                # Check if vehicle exists
                check_query = text("SELECT id FROM vehicles WHERE plate = :plate")
                result = conn.execute(check_query, {"plate": plate}).fetchone()
                
                if result:
                    # Update
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
                    # Insert
                    # Ensure company_id is provided or nullable. In model company_id is Integer. Let's use 1 as default for the main company if required.
                    # Or left null if allowed.
                    insert_query = text("""
                        INSERT INTO vehicles (
                            make, year, color, fuel_type, transmission, engine, mileage, plate,
                            purchase_price, faseco, price, status, internal_code, location,
                            soat, tecno, company_id
                        ) VALUES (
                            :make, :year, :color, :fuel, :transmission, :engine, :mileage, :plate,
                            :purchase_price, :faseco, :price, :status, :internal_code, :location,
                            :soat, :tecno, 1
                        )
                    """)
                    conn.execute(insert_query, {
                        "make": make_model, "year": year, "color": color, "fuel": fuel,
                        "transmission": transmission, "engine": engine_str, "mileage": mileage, "plate": plate,
                        "purchase_price": purchase_price, "faseco": faseco,
                        "price": price, "status": status,
                        "internal_code": internal_code, "location": location,
                        "soat": soat, "tecno": tecno
                    })
                    inserted += 1
                conn.commit()
            except Exception as e:
                print(f"Error procesando placa {plate}: {e}")
                errors += 1
                conn.rollback()
                
    print("\n--- RESUMEN DE IMPORTACIÓN AUTOMÁTICA ---")
    print(f"Vehículos nuevos insertados: {inserted}")
    print(f"Vehículos existentes actualizados: {updated}")
    print(f"Errores: {errors}")

if __name__ == "__main__":
    print("Iniciando carga masiva desde Excel...")
    import_inventory()
    print("Operación completada.")
