import pandas as pd
import json

try:
    df = pd.read_excel("INVENTARIO PAGINA WEB CRM.xlsx", header=1)
    
    status_col = "🚨🚨🚨🚨"
    unique_statuses = df[status_col].dropna().unique().tolist()
    
    res = {
        "unique_statuses": unique_statuses,
        "sample": df.head(3).to_dict(orient="records")
    }

    with open("excel_info.json", "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2, default=str)
        
    print("Done")

except Exception as e:
    print("Error:", e)
