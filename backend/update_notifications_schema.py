
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
        
        # Check for notifications table
        try:
            result = connection.execute(text("SHOW TABLES LIKE 'notifications'"))
            if result.fetchone():
                print("Table 'notifications' already exists.")
            else:
                print("Creating 'notifications' table...")
                connection.execute(text("""
                    CREATE TABLE notifications (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT,
                        title VARCHAR(100),
                        message VARCHAR(500),
                        type VARCHAR(20) DEFAULT 'info',
                        is_read INT DEFAULT 0,
                        link VARCHAR(200),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                """))
                print("Table 'notifications' created.")
        except Exception as e:
            print(f"Error creating notifications table: {e}")

        # Check for lead_reminders table
        try:
            result = connection.execute(text("SHOW TABLES LIKE 'lead_reminders'"))
            if result.fetchone():
                print("Table 'lead_reminders' already exists.")
            else:
                print("Creating 'lead_reminders' table...")
                connection.execute(text("""
                    CREATE TABLE lead_reminders (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT,
                        lead_id INT,
                        reminder_date DATETIME,
                        note VARCHAR(500),
                        is_completed INT DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (lead_id) REFERENCES leads(id)
                    )
                """))
                print("Table 'lead_reminders' created.")
        except Exception as e:
            print(f"Error creating lead_reminders table: {e}")

    print("Database update complete.")

except Exception as e:
    print(f"Error executing script: {e}")
