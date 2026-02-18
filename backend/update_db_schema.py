
import sqlite3
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    if db_path.startswith("./"):
        db_path = db_path[2:]
    
    print(f"Connecting to database at: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "last_active" not in columns:
            print("Adding last_active column to users table...")
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN last_active TIMESTAMP")
                conn.commit()
                print("Column added successfully.")
            except Exception as e:
                print(f"Error adding column: {e}")
        else:
            print("Column last_active already exists.")
            
        conn.close()
        print("Database update check complete.")
    except Exception as e:
        print(f"Error connecting to database: {e}")
else:
    print(f"Skipping SQLite update, URL is not sqlite or not found: {DATABASE_URL}")
