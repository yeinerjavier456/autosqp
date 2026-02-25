import pandas as pd

try:
    df = pd.read_excel("INVENTARIO PAGINA WEB CRM.xlsx", header=1)
    
    total_rows = len(df)
    valid_rows = 0
    skipped_no_make = 0
    skipped_no_plate = 0
    
    for idx, row in df.iterrows():
        make_model = str(row.get("Marca & Modelo", ""))
        if pd.isna(make_model) or make_model.strip() == "nan" or make_model.strip() == "":
            skipped_no_make += 1
            continue
            
        plate = str(row.get("Placa:", "")).strip().upper()
        if not plate or plate == "NAN":
            skipped_no_plate += 1
            continue
            
        valid_rows += 1
        
    print(f"Total rows in DataFrame: {total_rows}")
    print(f"Skipped because no make/model: {skipped_no_make}")
    print(f"Skipped because no plate: {skipped_no_plate}")
    print(f"Valid rows considered for import: {valid_rows}")
    
    print("\nSample of rows skipped due to no plate but have make:")
    count = 0
    for idx, row in df.iterrows():
        make_model = str(row.get("Marca & Modelo", ""))
        if not (pd.isna(make_model) or make_model.strip() == "nan" or make_model.strip() == ""):
            plate = str(row.get("Placa:", "")).strip().upper()
            if not plate or plate == "NAN":
                print(f"Row {idx}: Make: {make_model}, Placa: {row.get('Placa:')}, Estado: {row.get('🚨🚨🚨🚨')}")
                count += 1
                if count >= 3:
                    break
except Exception as e:
    print(f"Error: {e}")
