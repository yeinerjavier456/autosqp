import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found in environment.")
    exit(1)

engine = create_engine(DATABASE_URL)

new_columns = [
    ("purchase_price", "INT"),
    ("faseco", "INT"),
    ("fuel_type", "VARCHAR(50)"),
    ("transmission", "VARCHAR(50)"),
    ("engine", "VARCHAR(50)"),
    ("soat", "DATETIME"),
    ("tecno", "DATETIME"),
    ("internal_code", "VARCHAR(50)"),
    ("location", "VARCHAR(100)")
]

def add_columns():
    with engine.connect() as conn:
        for col_name, col_type in new_columns:
            try:
                print(f"Adding column '{col_name}'...")
                conn.execute(text(f"ALTER TABLE vehicles ADD COLUMN {col_name} {col_type};"))
                conn.commit()
                print(f"Success: '{col_name}' added.")
            except Exception as e:
                # Column might already exist
                print(f"Skipped '{col_name}': {e}")
                
        # Modify existing columns
        try:
            print("Making model column nullable...")
            conn.execute(text("ALTER TABLE vehicles MODIFY COLUMN model VARCHAR(100) NULL;"))
            conn.commit()
            print("Success: 'model' is now nullable.")
        except Exception as e:
            print(f"Skipped modifying 'model': {e}")

if __name__ == "__main__":
    print(f"Connecting to database: {DATABASE_URL}")
    add_columns()
    print("Database schema update finished for Vehicles table.")
