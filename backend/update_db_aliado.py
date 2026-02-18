import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Add parent directory to path to find config if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("Error: DATABASE_URL not found in environment variables")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

def upgrade():
    with engine.connect() as connection:
        # Check if column exists
        result = connection.execute(text("SHOW COLUMNS FROM leads LIKE 'created_by_id'"))
        if result.fetchone():
            print("Column 'created_by_id' already exists in 'leads' table.")
        else:
            print("Adding 'created_by_id' column to 'leads' table...")
            connection.execute(text("ALTER TABLE leads ADD COLUMN created_by_id INT NULL"))
            connection.execute(text("ALTER TABLE leads ADD CONSTRAINT fk_leads_created_by FOREIGN KEY (created_by_id) REFERENCES users(id)"))
            print("Column added successfully.")
            
        print("Migration complete.")

if __name__ == "__main__":
    try:
        upgrade()
    except Exception as e:
        print(f"Error during migration: {e}")
