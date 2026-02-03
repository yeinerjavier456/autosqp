from database import engine
from sqlalchemy import text

def migrate_users():
    with engine.connect() as conn:
        try:
            print("Adding base_salary column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN base_salary INT NULL"))
        except Exception as e:
            print(f"Skipping base_salary (likely exists): {e}")

        try:
            print("Adding payment_dates column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN payment_dates VARCHAR(100) NULL"))
        except Exception as e:
            print(f"Skipping payment_dates (likely exists): {e}")

        try:
            print("Adding created_at column...")
            conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME NULL"))
            conn.execute(text("UPDATE users SET created_at = NOW() WHERE created_at IS NULL"))
        except Exception as e:
            print(f"Skipping created_at (likely exists): {e}")

        conn.commit()
    print("Migration finished.")

if __name__ == "__main__":
    migrate_users()
