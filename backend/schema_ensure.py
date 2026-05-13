from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _mysql_db_name(engine: Engine) -> str | None:
    try:
        return engine.url.database
    except Exception:
        return None


def _mysql_column_info(engine: Engine, table_name: str, column_name: str) -> dict | None:
    db_name = _mysql_db_name(engine)
    if not db_name:
        return None
    sql = text(
        """
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = :db
          AND TABLE_NAME = :table
          AND COLUMN_NAME = :col
        LIMIT 1
        """
    )
    with engine.connect() as conn:
        row = conn.execute(sql, {"db": db_name, "table": table_name, "col": column_name}).mappings().first()
        return dict(row) if row else None


def _mysql_table_exists(engine: Engine, table_name: str) -> bool:
    db_name = _mysql_db_name(engine)
    if not db_name:
        return False
    sql = text(
        """
        SELECT 1
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = :db
          AND TABLE_NAME = :table
        LIMIT 1
        """
    )
    with engine.connect() as conn:
        row = conn.execute(sql, {"db": db_name, "table": table_name}).first()
        return bool(row)


def _ensure_column(engine: Engine, table_name: str, column_name: str, add_column_sql: str) -> bool:
    if _mysql_column_info(engine, table_name, column_name):
        return False
    with engine.begin() as conn:
        conn.execute(text(add_column_sql))
    return True


def ensure_mysql_schema(engine: Engine) -> None:
    """
    Idempotent schema fixes for MySQL restores.

    We keep this intentionally narrow: only fields that have caused runtime 500s
    when importing an older dump.
    """
    if engine.url.get_backend_name() != "mysql":
        return

    if not _mysql_table_exists(engine, "credit_applications"):
        return

    # Credit applications: newer purchase + approval fields.
    _ensure_column(
        engine,
        "credit_applications",
        "approved_amount",
        "ALTER TABLE credit_applications ADD COLUMN approved_amount INT NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "approval_percentage",
        "ALTER TABLE credit_applications ADD COLUMN approval_percentage INT NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "approved_down_payment",
        "ALTER TABLE credit_applications ADD COLUMN approved_down_payment INT NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_vehicle_name",
        "ALTER TABLE credit_applications ADD COLUMN purchase_vehicle_name VARCHAR(120) NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_vehicle_model",
        "ALTER TABLE credit_applications ADD COLUMN purchase_vehicle_model VARCHAR(120) NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_vehicle_year",
        "ALTER TABLE credit_applications ADD COLUMN purchase_vehicle_year INT NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_vehicle_plate",
        "ALTER TABLE credit_applications ADD COLUMN purchase_vehicle_plate VARCHAR(30) NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_vehicle_mileage",
        "ALTER TABLE credit_applications ADD COLUMN purchase_vehicle_mileage INT NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_vehicle_location",
        "ALTER TABLE credit_applications ADD COLUMN purchase_vehicle_location VARCHAR(120) NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_price",
        "ALTER TABLE credit_applications ADD COLUMN purchase_price INT NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_sale_price",
        "ALTER TABLE credit_applications ADD COLUMN purchase_sale_price INT NULL",
    )
    _ensure_column(
        engine,
        "credit_applications",
        "purchase_expenses",
        "ALTER TABLE credit_applications ADD COLUMN purchase_expenses JSON NULL",
    )

    # Notes: older schema used VARCHAR(2000), which can overflow when we append Gmail excerpts.
    notes_info = _mysql_column_info(engine, "credit_applications", "notes")
    if notes_info and str(notes_info.get("DATA_TYPE", "")).lower() in {"varchar", "char"}:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE credit_applications MODIFY COLUMN notes TEXT NULL"))

    # Lead process details: delivery checklist fields.
    if _mysql_table_exists(engine, "lead_process_details"):
        _ensure_column(
            engine,
            "lead_process_details",
            "delivery_documents_complete",
            "ALTER TABLE lead_process_details ADD COLUMN delivery_documents_complete TINYINT(1) NOT NULL DEFAULT 0",
        )
        _ensure_column(
            engine,
            "lead_process_details",
            "delivery_road_kit",
            "ALTER TABLE lead_process_details ADD COLUMN delivery_road_kit TINYINT(1) NOT NULL DEFAULT 0",
        )
        _ensure_column(
            engine,
            "lead_process_details",
            "delivery_basic_tools",
            "ALTER TABLE lead_process_details ADD COLUMN delivery_basic_tools TINYINT(1) NOT NULL DEFAULT 0",
        )
        _ensure_column(
            engine,
            "lead_process_details",
            "delivery_credit_disbursement",
            "ALTER TABLE lead_process_details ADD COLUMN delivery_credit_disbursement TINYINT(1) NOT NULL DEFAULT 0",
        )
        _ensure_column(
            engine,
            "lead_process_details",
            "delivery_scheduled_at",
            "ALTER TABLE lead_process_details ADD COLUMN delivery_scheduled_at DATETIME NULL",
        )
        _ensure_column(
            engine,
            "lead_process_details",
            "delivery_scheduled_note",
            "ALTER TABLE lead_process_details ADD COLUMN delivery_scheduled_note VARCHAR(255) NULL",
        )
