from database import engine
from sqlalchemy import text

def add_column():
    print("Attempting to add recipient_id column to internal_messages table...")
    with engine.connect() as conn:
        try:
            # Check if column exists is hard in raw sql for all dbs, so we just try to add it.
            # If it fails, it usually means it exists.
            # SQLite syntax
            conn.execute(text("ALTER TABLE internal_messages ADD COLUMN recipient_id INTEGER REFERENCES users(id)"))
            conn.commit()
            print("Successfully added recipient_id column.")
        except Exception as e:
            print(f"Error (might already exist): {e}")

if __name__ == "__main__":
    add_column()
