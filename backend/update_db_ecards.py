from database import engine
from sqlalchemy import text


def migrate_ecards():
    statements = [
        ("ecard_enabled", "ALTER TABLE users ADD COLUMN ecard_enabled TINYINT(1) NOT NULL DEFAULT 0"),
        ("ecard_slug", "ALTER TABLE users ADD COLUMN ecard_slug VARCHAR(120) NULL"),
        ("ecard_photo_url", "ALTER TABLE users ADD COLUMN ecard_photo_url VARCHAR(500) NULL"),
        ("ecard_position", "ALTER TABLE users ADD COLUMN ecard_position VARCHAR(120) NULL"),
        ("ecard_display_email", "ALTER TABLE users ADD COLUMN ecard_display_email VARCHAR(150) NULL"),
        ("ecard_display_phone", "ALTER TABLE users ADD COLUMN ecard_display_phone VARCHAR(80) NULL"),
        ("ecard_header_color", "ALTER TABLE users ADD COLUMN ecard_header_color VARCHAR(50) NULL"),
        ("ecard_header_text_color", "ALTER TABLE users ADD COLUMN ecard_header_text_color VARCHAR(50) NULL"),
        ("ecard_card_color", "ALTER TABLE users ADD COLUMN ecard_card_color VARCHAR(50) NULL"),
        ("ecard_text_color", "ALTER TABLE users ADD COLUMN ecard_text_color VARCHAR(50) NULL"),
        ("ecard_accent_color", "ALTER TABLE users ADD COLUMN ecard_accent_color VARCHAR(50) NULL"),
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
