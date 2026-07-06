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
        ("ecard_headline", "ALTER TABLE users ADD COLUMN ecard_headline VARCHAR(180) NULL"),
        ("ecard_headline_highlight", "ALTER TABLE users ADD COLUMN ecard_headline_highlight VARCHAR(80) NULL"),
        ("ecard_subheadline", "ALTER TABLE users ADD COLUMN ecard_subheadline VARCHAR(250) NULL"),
        ("ecard_visit_title", "ALTER TABLE users ADD COLUMN ecard_visit_title VARCHAR(160) NULL"),
        ("ecard_visit_text", "ALTER TABLE users ADD COLUMN ecard_visit_text VARCHAR(250) NULL"),
        ("ecard_footer_label_1", "ALTER TABLE users ADD COLUMN ecard_footer_label_1 VARCHAR(80) NULL"),
        ("ecard_footer_label_2", "ALTER TABLE users ADD COLUMN ecard_footer_label_2 VARCHAR(80) NULL"),
        ("ecard_footer_label_3", "ALTER TABLE users ADD COLUMN ecard_footer_label_3 VARCHAR(80) NULL"),
        ("ecard_show_instagram", "ALTER TABLE users ADD COLUMN ecard_show_instagram TINYINT(1) NOT NULL DEFAULT 0"),
        ("ecard_instagram_url", "ALTER TABLE users ADD COLUMN ecard_instagram_url VARCHAR(500) NULL"),
        ("ecard_show_facebook", "ALTER TABLE users ADD COLUMN ecard_show_facebook TINYINT(1) NOT NULL DEFAULT 0"),
        ("ecard_facebook_url", "ALTER TABLE users ADD COLUMN ecard_facebook_url VARCHAR(500) NULL"),
        ("ecard_show_tiktok", "ALTER TABLE users ADD COLUMN ecard_show_tiktok TINYINT(1) NOT NULL DEFAULT 0"),
        ("ecard_tiktok_url", "ALTER TABLE users ADD COLUMN ecard_tiktok_url VARCHAR(500) NULL"),
        ("ecard_show_whatsapp", "ALTER TABLE users ADD COLUMN ecard_show_whatsapp TINYINT(1) NOT NULL DEFAULT 1"),
        ("ecard_whatsapp_url", "ALTER TABLE users ADD COLUMN ecard_whatsapp_url VARCHAR(500) NULL"),
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
