import argparse
import json
from typing import Iterable

from sqlalchemy import inspect, text

from database import SessionLocal
from view_registry import COMPANY_VIEW_IDS, DEFAULT_ROLE_MENU_ORDER, DEFAULT_ROLE_VIEW_ACCESS


DEFAULT_COMPANY_ENABLED_MODULES = sorted(COMPANY_VIEW_IDS)
ROLE_REQUIRED_MODULES = {
    "inventario": {"inventory"},
    "compras": {"purchase_board"},
    "gestion_creditos": {"credits"},
    "aliado": {"ally_board"},
}
MODULE_ROLE_FALLBACK_NAME = "user"


def table_columns(db, table_name: str) -> set[str]:
    return {column["name"] for column in inspect(db.bind).get_columns(table_name)}


def normalize_company_enabled_modules(modules):
    if modules is None:
        return DEFAULT_COMPANY_ENABLED_MODULES[:]
    normalized = []
    for module_id in modules:
        candidate = str(module_id or "").strip()
        if not candidate or candidate not in COMPANY_VIEW_IDS or candidate in normalized:
            continue
        normalized.append(candidate)
    return normalized


def get_company_enabled_modules(company: dict) -> list[str]:
    raw_value = company.get("enabled_modules_json")
    if raw_value is None:
        return DEFAULT_COMPANY_ENABLED_MODULES[:]
    try:
        parsed = json.loads(raw_value)
    except Exception:
        parsed = []
    if not isinstance(parsed, list):
        parsed = []
    return normalize_company_enabled_modules(parsed)


def normalize_role_text(value) -> str:
    if not value:
        return ""
    normalized = str(value).strip().lower()
    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "Ã¡": "a",
        "Ã©": "e",
        "Ã­": "i",
        "Ã³": "o",
        "Ãº": "u",
        "_": " ",
        "-": " ",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return " ".join(normalized.split())


def get_effective_role_key(role: dict | None) -> str:
    if not role:
        return ""
    role_names = {
        normalize_role_text(role.get("base_role_name")),
        normalize_role_text(role.get("name")),
        normalize_role_text(role.get("label")),
    }
    role_names.discard("")

    if any("super" in role_name and ("admin" in role_name or "administrador" in role_name) for role_name in role_names):
        return "super_admin"
    if any("admin" in role_name or "administrador" in role_name for role_name in role_names):
        return "admin"
    if "aliado" in role_names or "aliado estrategico" in role_names:
        return "aliado"
    if "asesor" in role_names or "vendedor" in role_names or "asesor vendedor" in role_names:
        return "asesor"
    if (
        "gestion creditos" in role_names
        or "gestion de creditos" in role_names
        or "gestor de creditos" in role_names
        or "gestor creditos" in role_names
        or any("gestion" in role_name and "credit" in role_name for role_name in role_names)
        or any("gestor" in role_name and "credit" in role_name for role_name in role_names)
        or any("coordinador" in role_name and "credit" in role_name for role_name in role_names)
    ):
        return "gestion_creditos"
    if "compras" in role_names:
        return "compras"
    if "inventario" in role_names:
        return "inventario"
    return role.get("base_role_name") or role.get("name") or ""


def get_role_disabled_required_modules(role: dict | None, company: dict) -> list[str]:
    role_name = get_effective_role_key(role)
    required_modules = ROLE_REQUIRED_MODULES.get(role_name, set())
    if not required_modules:
        return []
    enabled_modules = set(get_company_enabled_modules(company))
    return sorted(required_modules - enabled_modules)


def fetch_companies(db, company_id: int | None) -> Iterable[dict]:
    columns = table_columns(db, "companies")
    enabled_select = "enabled_modules_json" if "enabled_modules_json" in columns else "NULL AS enabled_modules_json"
    sql = f"SELECT id, name, {enabled_select} FROM companies"
    params = {}
    if company_id:
        sql += " WHERE id = :company_id"
        params["company_id"] = company_id
    sql += " ORDER BY id ASC"
    return [dict(row) for row in db.execute(text(sql), params).mappings().all()]


def fetch_users_with_roles(db, company_id: int) -> list[dict]:
    role_columns = table_columns(db, "roles")
    users_columns = table_columns(db, "users")
    select_parts = [
        "u.id AS user_id",
        "u.email AS email",
        "u.role_id AS role_id",
        "u.company_id AS company_id",
        "r.id AS resolved_role_id",
        "r.name AS role_name",
        "r.label AS role_label",
    ]
    select_parts.append("r.base_role_name AS role_base_role_name" if "base_role_name" in role_columns else "NULL AS role_base_role_name")
    select_parts.append("r.is_system AS role_is_system" if "is_system" in role_columns else "0 AS role_is_system")
    select_parts.append("u.auto_assign_leads AS auto_assign_leads" if "auto_assign_leads" in users_columns else "0 AS auto_assign_leads")
    rows = db.execute(text(
        f"""
        SELECT {", ".join(select_parts)}
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.company_id = :company_id
        ORDER BY u.id ASC
        """
    ), {"company_id": company_id}).mappings().all()
    return [dict(row) for row in rows]


def role_from_user_row(row: dict) -> dict:
    return {
        "id": row.get("resolved_role_id"),
        "name": row.get("role_name"),
        "label": row.get("role_label"),
        "base_role_name": row.get("role_base_role_name"),
        "is_system": row.get("role_is_system"),
    }


def get_affected_users(db, company: dict) -> list[dict]:
    affected = []
    for row in fetch_users_with_roles(db, company["id"]):
        role = role_from_user_row(row)
        disabled_modules = get_role_disabled_required_modules(role, company)
        if disabled_modules:
            row["disabled_required_modules"] = disabled_modules
            affected.append(row)
    return affected


def fetch_role_by_name(db, role_name: str) -> dict | None:
    role_columns = table_columns(db, "roles")
    select_parts = ["id", "name", "label"]
    select_parts.append("base_role_name" if "base_role_name" in role_columns else "NULL AS base_role_name")
    select_parts.append("is_system" if "is_system" in role_columns else "0 AS is_system")
    row = db.execute(text(
        f"SELECT {', '.join(select_parts)} FROM roles WHERE name = :name LIMIT 1"
    ), {"name": role_name}).mappings().first()
    return dict(row) if row else None


def fetch_company_override(db, company_id: int, base_role_name: str) -> dict | None:
    role_columns = table_columns(db, "roles")
    if "company_id" not in role_columns or "base_role_name" not in role_columns:
        return None
    row = db.execute(text(
        """
        SELECT id, name, label, base_role_name, is_system
        FROM roles
        WHERE company_id = :company_id AND base_role_name = :base_role_name
        LIMIT 1
        """
    ), {"company_id": company_id, "base_role_name": base_role_name}).mappings().first()
    return dict(row) if row else None


def ensure_fallback_role(db, company_id: int) -> dict:
    role_columns = table_columns(db, "roles")
    fallback = fetch_role_by_name(db, MODULE_ROLE_FALLBACK_NAME)
    if not fallback:
        insert_fields = ["name", "label"]
        insert_values = {"name": MODULE_ROLE_FALLBACK_NAME, "label": "Usuario Basico"}
        if "is_system" in role_columns:
            insert_fields.append("is_system")
            insert_values["is_system"] = 1
        if "permissions_json" in role_columns:
            insert_fields.append("permissions_json")
            insert_values["permissions_json"] = json.dumps(DEFAULT_ROLE_VIEW_ACCESS.get(MODULE_ROLE_FALLBACK_NAME, []))
        if "menu_order_json" in role_columns:
            insert_fields.append("menu_order_json")
            insert_values["menu_order_json"] = json.dumps(DEFAULT_ROLE_MENU_ORDER.get(MODULE_ROLE_FALLBACK_NAME, []))
        if "auto_assign_leads" in role_columns:
            insert_fields.append("auto_assign_leads")
            insert_values["auto_assign_leads"] = 0
        placeholders = ", ".join(f":{field}" for field in insert_fields)
        result = db.execute(text(
            f"INSERT INTO roles ({', '.join(insert_fields)}) VALUES ({placeholders})"
        ), insert_values)
        fallback = {
            "id": result.lastrowid,
            "name": MODULE_ROLE_FALLBACK_NAME,
            "label": "Usuario Basico",
            "base_role_name": None,
            "is_system": 1,
        }

    override = fetch_company_override(db, company_id, MODULE_ROLE_FALLBACK_NAME)
    return override or fallback


def add_system_log(db, details: dict):
    if "system_logs" not in inspect(db.bind).get_table_names():
        return
    log_columns = table_columns(db, "system_logs")
    fields = []
    values = {}
    for field, value in {
        "company_id": details.get("company_id"),
        "user_id": None,
        "action": "MODULE_ROLE_FALLBACK",
        "entity_type": "User",
        "entity_id": details.get("user_id"),
        "details": json.dumps(details, ensure_ascii=True),
    }.items():
        if field in log_columns:
            fields.append(field)
            values[field] = value
    if not fields:
        return
    db.execute(text(
        f"INSERT INTO system_logs ({', '.join(fields)}) VALUES ({', '.join(f':{field}' for field in fields)})"
    ), values)


def format_user(row: dict, company: dict) -> dict:
    role = role_from_user_row(row)
    return {
        "company_id": company["id"],
        "company_name": company["name"],
        "user_id": row["user_id"],
        "email": row["email"],
        "role_id": row["role_id"],
        "role_name": get_effective_role_key(role),
        "role_label": role.get("label"),
        "disabled_required_modules": row["disabled_required_modules"],
        "enabled_modules": get_company_enabled_modules(company),
    }


def remediate_company(db, company: dict, affected_users: list[dict]) -> list[dict]:
    users_columns = table_columns(db, "users")
    fallback_role = ensure_fallback_role(db, company["id"])
    remediated = []
    for row in affected_users:
        role = role_from_user_row(row)
        update_parts = ["role_id = :role_id"]
        params = {"role_id": fallback_role["id"], "user_id": row["user_id"]}
        if "auto_assign_leads" in users_columns:
            update_parts.append("auto_assign_leads = 0")
        db.execute(text(
            f"UPDATE users SET {', '.join(update_parts)} WHERE id = :user_id"
        ), params)
        details = {
            "source": "fix_disabled_module_roles_script",
            "company_id": company["id"],
            "user_id": row["user_id"],
            "email": row["email"],
            "old_role_id": row["role_id"],
            "old_role_name": get_effective_role_key(role),
            "old_role_label": role.get("label"),
            "new_role_id": fallback_role["id"],
            "new_role_name": get_effective_role_key(fallback_role),
            "disabled_required_modules": row["disabled_required_modules"],
            "enabled_modules": get_company_enabled_modules(company),
        }
        add_system_log(db, details)
        remediated.append(details)
    return remediated


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Find and optionally fix users whose role depends on disabled company modules."
    )
    parser.add_argument("--company-id", type=int, default=None, help="Limit the scan to one company id.")
    parser.add_argument("--apply", action="store_true", help="Apply the fallback to the basic user role.")
    args = parser.parse_args()

    with SessionLocal() as db:
        companies = list(fetch_companies(db, args.company_id))
        if args.company_id and not companies:
            print(json.dumps({"error": "company_not_found", "company_id": args.company_id}))
            return 1

        total_affected = 0
        for company in companies:
            affected_users = get_affected_users(db, company)
            total_affected += len(affected_users)

            if not affected_users:
                continue

            print(json.dumps({
                "company_id": company["id"],
                "company_name": company["name"],
                "affected_users": [format_user(user, company) for user in affected_users],
            }, ensure_ascii=True))

            if args.apply:
                remediated = remediate_company(db, company, affected_users)
                db.commit()
                print(json.dumps({
                    "company_id": company["id"],
                    "remediated_users": len(remediated),
                    "fallback": "user",
                }, ensure_ascii=True))

        if not args.apply:
            print(json.dumps({
                "mode": "dry_run",
                "affected_users": total_affected,
                "next_step": "Run with --apply to reassign affected users to the basic user role and write system logs.",
            }, ensure_ascii=True))
        else:
            print(json.dumps({"mode": "apply", "affected_users": total_affected}, ensure_ascii=True))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
