import sqlite3

def update_db():
    try:
        conn = sqlite3.connect('autosqp.db')
        cursor = conn.cursor()
        
        # Add updated_at column
        try:
            cursor.execute("ALTER TABLE leads ADD COLUMN updated_at VARCHAR(50)")
            print("Added updated_at column.")
        except sqlite3.OperationalError as e:
            print(f"updated_at might already exist: {e}")

        # Add assigned_to_id column
        try:
            cursor.execute("ALTER TABLE leads ADD COLUMN assigned_to_id INTEGER REFERENCES users(id)")
            print("Added assigned_to_id column.")
        except sqlite3.OperationalError as e:
            print(f"assigned_to_id might already exist: {e}")

        conn.commit()
        conn.close()
        print("Database schema updated successfully.")
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    update_db()
