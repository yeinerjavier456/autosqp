from database import SessionLocal, engine
from sqlalchemy import inspect

try:
    print("--- Leads Table Info ---")
    inspector = inspect(engine)
    columns = inspector.get_columns('leads')
    for col in columns:
        print(f"Name: {col['name']}, Type: {col['type']}, Nullable: {col['nullable']}")
except Exception as e:
    print(f"Error: {e}")
