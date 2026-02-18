
import os
import sqlalchemy
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

print(f"Connecting to database: {DATABASE_URL}")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        # Check if column exists
        try:
            result = connection.execute(text("SHOW COLUMNS FROM users LIKE 'last_active'"))
            if result.fetchone():
                print("Column 'last_active' already exists.")
            else:
                print("Adding 'last_active' column to users table...")
                connection.execute(text("ALTER TABLE users ADD COLUMN last_active DATETIME NULL"))
                connection.commit()
                print("Column added successfully.")
        except Exception as e:
            print(f"Error checking/adding column: {e}")

    print("Database update complete.")

except Exception as e:
    print(f"Error executing script: {e}")
