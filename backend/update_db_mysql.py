from database import engine
from sqlalchemy import text

def update_db_mysql():
    try:
        with engine.connect() as conn:
            # Add updated_at column
            try:
                conn.execute(text("ALTER TABLE leads ADD COLUMN updated_at VARCHAR(50)"))
                print("Added updated_at column.")
            except Exception as e:
                print(f"updated_at might already exist: {e}")

            # Add assigned_to_id column
            try:
                conn.execute(text("ALTER TABLE leads ADD COLUMN assigned_to_id INTEGER"))
                conn.execute(text("ALTER TABLE leads ADD CONSTRAINT fk_leads_users FOREIGN KEY (assigned_to_id) REFERENCES users(id)"))
                print("Added assigned_to_id column.")
            except Exception as e:
                print(f"assigned_to_id might already exist: {e}")
            
            conn.commit()
            print("MySQL Database schema updated successfully.")
            
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    update_db_mysql()
