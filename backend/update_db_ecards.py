from database import engine
from sqlalchemy import text


def migrate_ecards():
    statements = [
        ("ecard_enabled", "ALTER TABLE users ADD COLUMN ecard_enabled TINYINT(1) NOT NULL DEFAULT 0"),
        ("ecard_slug", "ALTER TABLE users ADD COLUMN ecard_slug VARCHAR(120) NULL"),
        ("ecard_photo_url", "ALTER TABLE users ADD COLUMN ecard_photo_url VARCHAR(500) NULL"),
        ("ecard_position", "ALTER TABLE users ADD COLUMN ecard_position VARCHAR(120) NULL"),
    ]
    with engine.begin() as conn:
        for label, statement in statements:
            try:
                print(f"Adding {label} column...")
                conn.execute(text(statement))
            except Exception as exc:
                print(f"Skipping {label} (likely exists): {exc}")
        try:
            print("Adding ix_users_ecard_slug index...")
            conn.execute(text("CREATE INDEX ix_users_ecard_slug ON users (ecard_slug)"))
        except Exception as exc:
            print(f"Skipping ix_users_ecard_slug (likely exists): {exc}")
    print("E-card migration finished.")


if __name__ == "__main__":
    migrate_ecards()
