from fastapi import FastAPI, Depends, HTTPException, status, Query, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func, text, false
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, get_db
import models, schemas, auth_utils
from models import LeadNote, LeadFile # Explicitly for create_all to see them
from routers import whatsapp, credits, purchases, notifications, rules, vehicles, meta, tiktok, gmail # Import the new routers
from jose import JWTError, jwt
import datetime
import os
import traceback
import requests
import time
import re
import json
import random
from io import BytesIO
from view_registry import SYSTEM_VIEWS, DEFAULT_ROLE_VIEW_ACCESS, DEFAULT_ROLE_MENU_ORDER, VALID_VIEW_IDS, COMPANY_VIEW_IDS
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse

# Create tables
models.Base.metadata.create_all(bind=engine)

def ensure_role_configuration_columns():
    with engine.begin() as conn:
        role_columns = {
            "company_id": "ALTER TABLE roles ADD COLUMN company_id INTEGER NULL",
            "permissions_json": "ALTER TABLE roles ADD COLUMN permissions_json TEXT NULL",
            "menu_order_json": "ALTER TABLE roles ADD COLUMN menu_order_json TEXT NULL",
            "is_system": "ALTER TABLE roles ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0",
            "base_role_name": "ALTER TABLE roles ADD COLUMN base_role_name VARCHAR(50) NULL",
            "auto_assign_leads": "ALTER TABLE roles ADD COLUMN auto_assign_leads BOOLEAN NOT NULL DEFAULT 0",
            "assignable_role_ids_json": "ALTER TABLE roles ADD COLUMN assignable_role_ids_json TEXT NULL",
        }

        for column_name, ddl in role_columns.items():
            exists = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' "
                "AND COLUMN_NAME = :column_name"
            ), {"column_name": column_name}).scalar()
            if not exists:
                conn.execute(text(ddl))


def ensure_payment_receipts_columns():
    with engine.begin() as conn:
        table_exists = conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_receipts'"
        )).scalar()
        if not table_exists:
            return

        receipt_columns = {
            "concept": "ALTER TABLE payment_receipts ADD COLUMN concept VARCHAR(200) NULL",
            "movement_type": "ALTER TABLE payment_receipts ADD COLUMN movement_type VARCHAR(20) NOT NULL DEFAULT 'income'"
        }
        for column_name, ddl in receipt_columns.items():
            exists = conn.execute(text(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_receipts' "
                "AND COLUMN_NAME = :column_name"
            ), {"column_name": column_name}).scalar()
            if not exists:
                conn.execute(text(ddl))

        sale_id_nullable = conn.execute(text(
            "SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_receipts' "
            "AND COLUMN_NAME = 'sale_id'"
        )).scalar()
        if sale_id_nullable == "NO":
            conn.execute(text("ALTER TABLE payment_receipts MODIFY COLUMN sale_id INTEGER NULL"))

        index_exists = conn.execute(text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' "
            "AND INDEX_NAME = 'ix_roles_company_id'"
        )).scalar()
        if not index_exists:
            conn.execute(text("CREATE INDEX ix_roles_company_id ON roles (company_id)"))

        conn.execute(text(
            "UPDATE roles SET is_system = 1 WHERE name IN "
            "('super_admin', 'admin', 'asesor', 'aliado', 'inventario', 'compras', 'user')"
        ))

ensure_role_configuration_columns()
ensure_payment_receipts_columns()

def ensure_gmail_settings_columns():
    """
    Backward-compatible bootstrap for Gmail integration settings.
    """
    try:
        with engine.connect() as conn:
            existing_cols_result = conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'integration_settings'"
            ))
            existing_cols = {row[0] for row in existing_cols_result.fetchall()}

            gmail_columns = {
                "gmail_enabled": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_enabled BOOLEAN NULL DEFAULT 0"
                ),
                "gmail_client_id": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_client_id TEXT NULL"
                ),
                "gmail_client_secret": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_client_secret TEXT NULL"
                ),
                "gmail_redirect_uri": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_redirect_uri VARCHAR(500) NULL"
                ),
                "gmail_refresh_token": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_refresh_token TEXT NULL"
                ),
                "gmail_monitored_sender": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_monitored_sender VARCHAR(255) NULL"
                ),
                "gmail_label": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_label VARCHAR(120) NULL"
                ),
                "gmail_sync_days": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_sync_days INT NULL DEFAULT 7"
                ),
                "gmail_sync_max_results": (
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN gmail_sync_max_results INT NULL DEFAULT 20"
                ),
            }

            for column_name, ddl in gmail_columns.items():
                if column_name not in existing_cols:
                    conn.execute(text(ddl))

            conn.commit()
    except Exception as exc:
        print(f"Warning: could not ensure gmail settings columns: {exc}", flush=True)

ensure_gmail_settings_columns()

def ensure_chatbot_settings_columns():
    """
    Backward-compatible bootstrap for legacy DBs where integration_settings
    still lacks chatbot config columns.
    """
    try:
        with engine.connect() as conn:
            existing_cols_result = conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'integration_settings'"
            ))
            existing_cols = {row[0] for row in existing_cols_result.fetchall()}

            if "chatbot_bot_name" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN chatbot_bot_name VARCHAR(120) NULL DEFAULT 'Jennifer Quimbayo'"
                ))
            if "chatbot_typing_min_ms" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN chatbot_typing_min_ms INT NULL DEFAULT 7000"
                ))
            if "chatbot_typing_max_ms" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE integration_settings "
                    "ADD COLUMN chatbot_typing_max_ms INT NULL DEFAULT 18000"
                ))
            conn.commit()
    except Exception as exc:
        print(f"Warning: could not ensure chatbot settings columns: {exc}", flush=True)

ensure_chatbot_settings_columns()


def ensure_lead_reply_columns():
    """
    Backward-compatible bootstrap for unread-reply markers on leads.
    """
    try:
        with engine.connect() as conn:
            existing_cols_result = conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads'"
            ))
            existing_cols = {row[0] for row in existing_cols_result.fetchall()}

            if "has_unread_reply" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE leads "
                    "ADD COLUMN has_unread_reply INT NULL DEFAULT 0"
                ))
            if "last_reply_at" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE leads "
                    "ADD COLUMN last_reply_at DATETIME NULL"
                ))
            conn.commit()
    except Exception as exc:
        print(f"Warning: could not ensure lead reply columns: {exc}", flush=True)


ensure_lead_reply_columns()


def ensure_lead_soft_delete_columns():
    """
    Backward-compatible bootstrap for soft-delete metadata on leads.
    """
    try:
        with engine.connect() as conn:
            existing_cols_result = conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads'"
            ))
            existing_cols = {row[0] for row in existing_cols_result.fetchall()}

            if "deleted_at" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE leads "
                    "ADD COLUMN deleted_at DATETIME NULL"
                ))
            if "deleted_reason" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE leads "
                    "ADD COLUMN deleted_reason TEXT NULL"
                ))
            if "deleted_by_id" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE leads "
                    "ADD COLUMN deleted_by_id INT NULL"
                ))
            conn.commit()
    except Exception as exc:
        print(f"Warning: could not ensure lead soft delete columns: {exc}", flush=True)


ensure_lead_soft_delete_columns()


def ensure_credit_application_link_column():
    """
    Backward-compatible bootstrap so credit applications can be tied to a lead.
    """
    try:
        with engine.connect() as conn:
            existing_cols_result = conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_applications'"
            ))
            existing_cols = {row[0] for row in existing_cols_result.fetchall()}

            if "lead_id" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE credit_applications "
                    "ADD COLUMN lead_id INT NULL"
                ))
                conn.execute(text(
                    "ALTER TABLE credit_applications "
                    "ADD INDEX ix_credit_applications_lead_id (lead_id)"
                ))
            conn.commit()
    except Exception as exc:
        print(f"Warning: could not ensure credit application lead link column: {exc}", flush=True)


ensure_credit_application_link_column()


def ensure_purchase_option_decision_columns():
    try:
        with engine.connect() as conn:
            existing_cols_result = conn.execute(text(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_options'"
            ))
            existing_cols = {row[0] for row in existing_cols_result.fetchall()}

            if "decision_status" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE purchase_options "
                    "ADD COLUMN decision_status VARCHAR(30) NULL DEFAULT 'pending'"
                ))
            if "decision_note" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE purchase_options "
                    "ADD COLUMN decision_note TEXT NULL"
                ))
            if "decision_user_id" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE purchase_options "
                    "ADD COLUMN decision_user_id INT NULL"
                ))
            if "decision_at" not in existing_cols:
                conn.execute(text(
                    "ALTER TABLE purchase_options "
                    "ADD COLUMN decision_at DATETIME NULL"
                ))
            conn.commit()
    except Exception as exc:
        print(f"Warning: could not ensure purchase option decision columns: {exc}", flush=True)


ensure_purchase_option_decision_columns()


def ensure_credit_notes_text_column():
    try:
        with engine.connect() as conn:
            notes_column_type = conn.execute(text(
                "SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'credit_applications' "
                "AND COLUMN_NAME = 'notes'"
            )).scalar()

            if notes_column_type and notes_column_type.lower() != "text":
                conn.execute(text(
                    "ALTER TABLE credit_applications MODIFY COLUMN notes TEXT NULL"
                ))
                conn.commit()
    except Exception as exc:
        print(f"Warning: could not ensure credit notes text column: {exc}", flush=True)


ensure_credit_notes_text_column()

app = FastAPI(title="AutosQP API", description="API para gestión de compra venta de carros")

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("CRITICAL ERROR IN REQUEST:", request.url, flush=True)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)}
    )

app.include_router(whatsapp.router) # Register the router
app.include_router(credits.router) # Register credits router
app.include_router(purchases.router)
app.include_router(notifications.router)
app.include_router(rules.router)
app.include_router(vehicles.router)
app.include_router(meta.router)
app.include_router(tiktok.router)
app.include_router(gmail.router)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://34.229.164.25:3000",
        "http://54.226.30.192:3000", # Old IP port
        "http://54.226.30.192", # Old Server IP
        "https://54.226.30.192", 
        "http://3.234.117.124:3000", # New Elastic IP port
        "http://3.234.117.124",      # New Elastic IP
        "https://3.234.117.124",     # New Elastic IP HTTPS
        "http://autosqp.co",         # Domain HTTP
        "https://autosqp.co",        # Domain HTTPS
        "http://www.autosqp.co",     # WWW Domain HTTP
        "https://www.autosqp.co",    # WWW Domain HTTPS
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
def ping():
    print("DEBUG: Ping called", flush=True)
    return {"message": "pong"}

from dependencies import (
    get_current_user,
    oauth2_scheme,
    ensure_can_modify_lead,
    ensure_can_manage_lead_supervision,
    is_company_admin,
)

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth_utils.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth_utils.create_access_token(
        data={"sub": str(user.id), "role": user.role.name if user.role else "user"}
    )
    
    # Log the successful login
    log_action_to_db(db, user.id, "LOGIN", "Auth", user.id, "Usuario inició sesión exitosamente")
    
    return {"access_token": access_token, "token_type": "bearer"}

def log_action_to_db(db: Session, user_id: int, action: str, entity_type: str, entity_id: int, details: str = None, ip_address: str = None):
    try:
        new_log = models.SystemLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=ip_address
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        print(f"Failed to log action: {e}", flush=True)
        db.rollback()

def is_inventory_editor(current_user: models.User) -> bool:
    role_name = current_user.role.name if current_user.role else ""
    return role_name in ["admin", "inventario"] or (role_name == "super_admin" and bool(current_user.company_id))

def is_company_admin_for_inventory(current_user: models.User) -> bool:
    role_name = current_user.role.name if current_user.role else ""
    return role_name == "admin" or (role_name == "super_admin" and bool(current_user.company_id))

def ensure_inventory_editor(current_user: models.User):
    if not is_inventory_editor(current_user):
        raise HTTPException(status_code=403, detail="Solo usuarios de inventario o administradores pueden crear/editar vehículos")

def ensure_inventory_admin_only(current_user: models.User):
    if not is_inventory_editor(current_user):
        raise HTTPException(status_code=403, detail="Solo usuarios de inventario o administradores pueden desactivar vehículos")

def enforce_ally_managed_status(
    db: Session,
    current_user: models.User,
    base_status: Optional[str],
    assigned_to_id: Optional[int] = None
) -> str:
    return base_status or models.LeadStatus.NEW.value


def can_manually_assign_to_any_role(current_user: models.User) -> bool:
    return bool(get_user_role_name(current_user) in {"admin", "super_admin", "aliado"})


def get_user_role_name(user: Optional[models.User]) -> Optional[str]:
    if not user or not user.role:
        return None
    return getattr(user.role, "base_role_name", None) or user.role.name


def is_advisor_role(role: Optional[models.Role]) -> bool:
    if not role:
        return False
    return (getattr(role, "base_role_name", None) or getattr(role, "name", None)) == "asesor"


def get_role_permissions(role: Optional[models.Role]) -> List[str]:
    if not role:
        return []
    fallback = DEFAULT_ROLE_VIEW_ACCESS.get(getattr(role, "base_role_name", None) or role.name, [])
    return sanitize_view_ids(parse_json_list(getattr(role, "permissions_json", None), fallback), getattr(role, "company_id", None))


def parse_json_int_list(value: Optional[str], fallback: Optional[List[int]] = None) -> List[int]:
    if not value:
        return fallback[:] if fallback else []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            normalized = []
            for item in parsed:
                try:
                    parsed_id = int(item)
                except (TypeError, ValueError):
                    continue
                if parsed_id not in normalized:
                    normalized.append(parsed_id)
            return normalized
    except Exception:
        pass
    return fallback[:] if fallback else []


def sanitize_assignable_role_ids(
    db: Session,
    role_ids: Optional[List[int]],
    company_id: Optional[int]
) -> List[int]:
    if not role_ids:
        return []

    normalized_ids = []
    for role_id in role_ids:
        try:
            parsed_id = int(role_id)
        except (TypeError, ValueError):
            continue
        if parsed_id not in normalized_ids:
            normalized_ids.append(parsed_id)

    if not normalized_ids:
        return []

    allowed_roles = db.query(models.Role).filter(models.Role.id.in_(normalized_ids))
    if company_id:
        allowed_roles = allowed_roles.filter(
            or_(
                models.Role.company_id == company_id,
                and_(models.Role.company_id.is_(None), models.Role.is_system == True)
            )
        )

    allowed_ids = {role.id for role in allowed_roles.all()}
    return [role_id for role_id in normalized_ids if role_id in allowed_ids]


def get_role_assignable_role_ids(role: Optional[models.Role]) -> List[int]:
    if not role:
        return []
    return parse_json_int_list(getattr(role, "assignable_role_ids_json", None), [])


def can_assign_lead_to_user(
    current_user: models.User,
    target_user: Optional[models.User]
) -> bool:
    if not target_user or not target_user.role:
        return False

    configured_role_ids = get_role_assignable_role_ids(getattr(current_user, "role", None))
    if configured_role_ids:
        return target_user.role.id in configured_role_ids

    return can_manually_assign_to_any_role(current_user) or is_advisor_role(target_user.role)


def get_company_ally_user_ids(db: Session, company_id: Optional[int]) -> List[int]:
    if not company_id:
        return []

    aliado_roles = db.query(models.Role).filter(
        or_(
            models.Role.name == "aliado",
            models.Role.base_role_name == "aliado"
        ),
        or_(
            models.Role.company_id == company_id,
            models.Role.company_id.is_(None)
        )
    ).all()
    aliado_role_ids = [role.id for role in aliado_roles]
    if not aliado_role_ids:
        return []

    return [
        row[0]
        for row in db.query(models.User.id).filter(
            models.User.company_id == company_id,
            models.User.role_id.in_(aliado_role_ids)
        ).all()
    ]


def normalize_role_text(value: Optional[str]) -> str:
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


def is_credit_coordinator_role(role: Optional[models.Role]) -> bool:
    if not role:
        return False

    role_names = {
        normalize_role_text(getattr(role, "name", None)),
        normalize_role_text(getattr(role, "base_role_name", None)),
        normalize_role_text(getattr(role, "label", None)),
    }
    role_names.discard("")

    explicit_credit_role_names = {
        "coordinador",
        "coordinador credito",
        "coordinador de credito",
        "coordinador creditos",
        "coordinador de creditos",
        "coordinador_credito",
        "coordinador_creditos",
    }

    if role_names & explicit_credit_role_names:
        return True

    return any("coordinador" in role_name and "credit" in role_name for role_name in role_names)


def get_credit_coordinator_users(db: Session, company_id: Optional[int]) -> List[models.User]:
    if not company_id:
        return []

    candidates = db.query(models.User).join(models.Role, isouter=True).filter(
        models.User.company_id == company_id
    ).all()

    coordinators = []
    credit_enabled_users = []
    for user in candidates:
        if "credits" not in get_role_permissions(user.role):
            continue
        credit_enabled_users.append(user)
        if not is_credit_coordinator_role(user.role):
            continue
        coordinators.append(user)
    return coordinators or credit_enabled_users


def choose_credit_coordinator(db: Session, company_id: Optional[int]) -> Optional[models.User]:
    coordinators = get_credit_coordinator_users(db, company_id)
    if not coordinators:
        return None
    return random.choice(coordinators)


def is_purchase_manager_role(role: Optional[models.Role]) -> bool:
    if not role:
        return False

    role_names = {
        normalize_role_text(getattr(role, "name", None)),
        normalize_role_text(getattr(role, "base_role_name", None)),
        normalize_role_text(getattr(role, "label", None)),
    }
    role_names.discard("")

    explicit_purchase_role_names = {
        "compras",
        "gestor compras",
        "gestor de compras",
        "gestor compra",
        "gestor de compra",
        "comprador",
    }
    if role_names & explicit_purchase_role_names:
        return True

    return any("compra" in role_name for role_name in role_names)


def get_purchase_manager_users(db: Session, company_id: Optional[int]) -> List[models.User]:
    if not company_id:
        return []

    candidates = db.query(models.User).join(models.Role, isouter=True).filter(
        models.User.company_id == company_id
    ).all()

    purchase_users = []
    purchase_enabled_users = []
    for user in candidates:
        role = getattr(user, "role", None)
        if not role:
            continue
        if "purchase_board" not in get_role_permissions(role):
            continue
        purchase_enabled_users.append(user)
        if is_purchase_manager_role(role):
            purchase_users.append(user)

    return purchase_users or purchase_enabled_users


def choose_purchase_manager(db: Session, company_id: Optional[int]) -> Optional[models.User]:
    candidates = get_purchase_manager_users(db, company_id)
    if not candidates:
        return None
    return random.choice(candidates)


def get_auto_assign_candidate_users(db: Session, company_id: Optional[int]) -> List[models.User]:
    if not company_id:
        return []

    candidates = db.query(models.User).join(models.Role, isouter=True).filter(
        models.User.company_id == company_id
    ).all()

    eligible_users = []
    for user in candidates:
        role = getattr(user, "role", None)
        if not role:
            continue
        if bool(getattr(role, "auto_assign_leads", False)) and is_advisor_role(role):
            eligible_users.append(user)

    if eligible_users:
        return eligible_users

    # Backward-compatible fallback for companies that still rely on the default advisor role.
    fallback_users = []
    for user in candidates:
        if is_advisor_role(getattr(user, "role", None)):
            fallback_users.append(user)

    if fallback_users:
        return fallback_users

    return eligible_users


def choose_auto_assign_user(db: Session, company_id: Optional[int]) -> Optional[models.User]:
    candidates = get_auto_assign_candidate_users(db, company_id)
    if not candidates:
        return None
    return random.choice(candidates)


def should_self_assign_manual_lead(current_user: models.User) -> bool:
    role_name = get_user_role_name(current_user)
    if role_name == "aliado":
        return True
    if is_advisor_role(getattr(current_user, "role", None)):
        return True
    return is_purchase_manager_role(getattr(current_user, "role", None))


def normalize_supervisor_ids(supervisor_ids: Optional[List[int]]) -> List[int]:
    normalized = []
    for raw_id in supervisor_ids or []:
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if user_id not in normalized:
            normalized.append(user_id)
    return normalized


def validate_supervisors(
    db: Session,
    company_id: Optional[int],
    supervisor_ids: Optional[List[int]]
) -> List[models.User]:
    normalized_ids = normalize_supervisor_ids(supervisor_ids)
    if not normalized_ids:
        return []

    supervisors = db.query(models.User).filter(models.User.id.in_(normalized_ids)).all()
    if len(supervisors) != len(normalized_ids):
        raise HTTPException(status_code=400, detail="Uno o más supervisores no existen")

    for supervisor in supervisors:
        if company_id and supervisor.company_id != company_id:
            raise HTTPException(status_code=400, detail="Todos los supervisores deben pertenecer a la misma empresa")

    supervisors_by_id = {user.id: user for user in supervisors}
    return [supervisors_by_id[user_id] for user_id in normalized_ids if user_id in supervisors_by_id]


def sync_lead_supervisors(
    db: Session,
    lead: models.Lead,
    supervisor_ids: Optional[List[int]],
    assigned_by_id: Optional[int] = None
) -> List[models.User]:
    target_supervisors = validate_supervisors(db, lead.company_id, supervisor_ids)
    target_ids = {user.id for user in target_supervisors}

    existing_links = list(lead.supervisor_links or [])
    for link in existing_links:
        if link.user_id not in target_ids:
            db.delete(link)

    existing_ids = {link.user_id for link in existing_links}
    for supervisor in target_supervisors:
        if supervisor.id in existing_ids:
            continue
        db.add(models.LeadSupervisor(
            lead_id=lead.id,
            user_id=supervisor.id,
            assigned_by_id=assigned_by_id
        ))

    db.flush()
    db.refresh(lead)
    return target_supervisors


def ensure_user_in_supervisors(supervisor_ids: Optional[List[int]], user_id: Optional[int]) -> List[int]:
    normalized_ids = normalize_supervisor_ids(supervisor_ids)
    if user_id and user_id not in normalized_ids:
        normalized_ids.append(user_id)
    return normalized_ids


def maybe_assign_credit_coordinator(
    db: Session,
    lead_company_id: Optional[int],
    target_status: Optional[str],
    assigned_to_id: Optional[int],
    supervisor_ids: Optional[List[int]]
):
    if target_status != models.LeadStatus.CREDIT_APPLICATION.value:
        return assigned_to_id, normalize_supervisor_ids(supervisor_ids), None

    coordinator = choose_credit_coordinator(db, lead_company_id)
    if not coordinator:
        return assigned_to_id, normalize_supervisor_ids(supervisor_ids), None

    next_supervisor_ids = ensure_user_in_supervisors(supervisor_ids, assigned_to_id)
    return coordinator.id, next_supervisor_ids, coordinator


def should_keep_assigner_as_supervisor(
    current_user_id: Optional[int],
    target_assigned_to_id: Optional[int]
) -> bool:
    return bool(current_user_id and target_assigned_to_id and current_user_id != target_assigned_to_id)


def should_reset_status_for_board_transfer(previous_role_name: Optional[str], target_role_name: Optional[str]) -> bool:
    return (previous_role_name == "aliado") != (target_role_name == "aliado")


def validate_interested_process_detail(
    target_status: Optional[str],
    process_detail_data: Optional[schemas.LeadProcessDetailCreate],
    existing_detail: Optional[models.LeadProcessDetail] = None,
):
    if target_status != models.LeadStatus.INTERESTED.value:
        return

    has_vehicle = process_detail_data.has_vehicle if process_detail_data is not None else bool(getattr(existing_detail, "has_vehicle", False))
    vehicle_id = process_detail_data.vehicle_id if process_detail_data is not None else getattr(existing_detail, "vehicle_id", None)
    desired_vehicle = process_detail_data.desired_vehicle if process_detail_data is not None else getattr(existing_detail, "desired_vehicle", None)
    desired_vehicle = (desired_vehicle or "").strip()

    if has_vehicle and not vehicle_id:
        raise HTTPException(status_code=400, detail="Debes seleccionar un vehículo disponible del inventario.")

    if not has_vehicle and not desired_vehicle:
        raise HTTPException(status_code=400, detail="Debes indicar qué vehículo busca el cliente.")


def build_lead_board_link(target_user: Optional[models.User], lead_id: int) -> str:
    target_role_name = get_user_role_name(target_user)
    base_path = "/aliado/dashboard" if target_role_name == "aliado" else "/admin/leads"
    return f"{base_path}?leadId={lead_id}"


def parse_json_list(value: Optional[str], fallback: Optional[List[str]] = None) -> List[str]:
    if not value:
        return fallback[:] if fallback else []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except Exception:
        pass
    return fallback[:] if fallback else []


def sanitize_view_ids(view_ids: Optional[List[str]], company_id: Optional[int] = None) -> List[str]:
    if not view_ids:
        return []
    sanitized = []
    for view_id in view_ids:
        normalized = str(view_id)
        if normalized not in VALID_VIEW_IDS:
            continue
        if company_id and normalized not in COMPANY_VIEW_IDS:
            continue
        if normalized not in sanitized:
            sanitized.append(normalized)
    return sanitized


def ensure_role_view_defaults_synced():
    """
    Keep existing admin/super-admin roles aligned with newly introduced views.
    """
    try:
        with Session(engine) as db:
            roles = db.query(models.Role).all()
            updated = False

            for role in roles:
                effective_role_name = getattr(role, "base_role_name", None) or getattr(role, "name", None)
                if effective_role_name not in {"admin", "super_admin"}:
                    continue

                default_permissions = DEFAULT_ROLE_VIEW_ACCESS.get(effective_role_name, [])
                permissions = sanitize_view_ids(
                    parse_json_list(getattr(role, "permissions_json", None), default_permissions),
                    getattr(role, "company_id", None)
                )
                menu_order = sanitize_view_ids(
                    parse_json_list(getattr(role, "menu_order_json", None), DEFAULT_ROLE_MENU_ORDER.get(effective_role_name, permissions)),
                    getattr(role, "company_id", None)
                )

                role_changed = False
                for view_id in default_permissions:
                    if view_id not in permissions:
                        permissions.append(view_id)
                        role_changed = True
                    if view_id not in menu_order:
                        menu_order.append(view_id)
                        role_changed = True

                if role_changed:
                    role.permissions_json = json.dumps(permissions)
                    role.menu_order_json = json.dumps(menu_order)
                    updated = True

            if updated:
                db.commit()
    except Exception as exc:
        print(f"Warning: could not sync role view defaults: {exc}", flush=True)


def serialize_role(role: models.Role) -> schemas.Role:
    default_permissions = DEFAULT_ROLE_VIEW_ACCESS.get(role.name, [])
    permissions = sanitize_view_ids(parse_json_list(getattr(role, "permissions_json", None), default_permissions), getattr(role, "company_id", None))
    menu_order = sanitize_view_ids(parse_json_list(getattr(role, "menu_order_json", None), DEFAULT_ROLE_MENU_ORDER.get(role.name, permissions)), getattr(role, "company_id", None))
    effective_role_name = getattr(role, "base_role_name", None) or role.name

    for view_id in permissions:
        if view_id not in menu_order:
            menu_order.append(view_id)

    return schemas.Role(
        id=role.id,
        name=role.name,
        label=role.label,
        permissions=permissions,
        menu_order=menu_order,
        auto_assign_leads=bool(getattr(role, "auto_assign_leads", False) or effective_role_name == "asesor"),
        assignable_role_ids=get_role_assignable_role_ids(role),
        company_id=getattr(role, "company_id", None),
        is_system=bool(getattr(role, "is_system", False)),
        base_role_name=getattr(role, "base_role_name", None)
    )


def ensure_role_management_permissions(current_user: models.User):
    role_name = current_user.role.name if current_user.role else ""
    if role_name not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Not authorized")


ensure_role_view_defaults_synced()


def get_company_role_override(db: Session, company_id: Optional[int], base_role_name: Optional[str]) -> Optional[models.Role]:
    if not company_id or not base_role_name:
        return None
    return db.query(models.Role).filter(
        models.Role.company_id == company_id,
        models.Role.base_role_name == base_role_name
    ).first()


def resolve_assignable_role(db: Session, target_role: models.Role, company_id: Optional[int]) -> models.Role:
    if company_id and target_role and target_role.is_system:
        override = get_company_role_override(db, company_id, target_role.name)
        if override:
            return override
    return target_role


def serialize_user(user: models.User, is_online: Optional[bool] = None) -> dict:
    payload = schemas.User.model_validate(user, from_attributes=True).model_dump()
    payload["role"] = serialize_role(user.role) if user.role else None
    if is_online is not None:
        payload["is_online"] = is_online
    return payload

def upsert_purchase_request_from_lead(db: Session, lead: models.Lead):
    """
    Create/update a credit application for purchase managers when a lead is in
    interested status and is marked as "no vehicle in inventory" with a desired vehicle.
    """
    if not lead or lead.status != models.LeadStatus.INTERESTED.value:
        return

    detail = db.query(models.LeadProcessDetail).filter(models.LeadProcessDetail.lead_id == lead.id).first()
    if not detail:
        return
    if detail.has_vehicle:
        return

    desired_vehicle = (detail.desired_vehicle or "").strip()
    if not desired_vehicle:
        return

    safe_phone = (lead.phone or "").strip() or f"lead-{lead.id}"
    existing_credit = db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == lead.company_id,
        or_(
            models.CreditApplication.lead_id == lead.id,
            and_(
                models.CreditApplication.phone == safe_phone,
                models.CreditApplication.desired_vehicle == desired_vehicle,
                models.CreditApplication.status.in_([
                    models.CreditStatus.PENDING.value,
                    models.CreditStatus.IN_REVIEW.value,
                    models.CreditStatus.APPROVED.value
                ])
            )
        )
    ).order_by(models.CreditApplication.created_at.desc()).first()

    auto_note = f"Generado automáticamente desde lead #{lead.id} en estado En proceso."
    if existing_credit:
        existing_credit.lead_id = lead.id
        existing_credit.client_name = lead.name or existing_credit.client_name
        existing_credit.email = lead.email or existing_credit.email
        existing_credit.company_id = lead.company_id
        existing_credit.desired_vehicle = desired_vehicle or existing_credit.desired_vehicle
        if not existing_credit.notes:
            existing_credit.notes = auto_note
        return

    compras_users = get_purchase_manager_users(db, lead.company_id)
    assigned_purchase_user = choose_purchase_manager(db, lead.company_id)
    assigned_compras_id = assigned_purchase_user.id if assigned_purchase_user else None

    new_credit = models.CreditApplication(
        lead_id=lead.id,
        client_name=lead.name or f"Lead {lead.id}",
        phone=safe_phone,
        email=lead.email,
        desired_vehicle=desired_vehicle,
        monthly_income=0,
        other_income=0,
        occupation="employee",
        application_mode="individual",
        down_payment=0,
        status=models.CreditStatus.PENDING.value,
        notes=auto_note,
        company_id=lead.company_id,
        assigned_to_id=assigned_compras_id
    )
    db.add(new_credit)

    for compras_user in compras_users:
        db.add(models.Notification(
            user_id=compras_user.id,
            title="Nuevo vehículo por buscar",
            message=f"{lead.name or 'Lead'} busca: {desired_vehicle}",
            type="warning",
            link="/admin/purchases"
        ))


def upsert_credit_application_from_lead(
    db: Session,
    lead: models.Lead,
    comment: Optional[str] = None
):
    """
    Create/update a credit application when the lead enters credit request stage.
    This keeps the same lead visible in /creditos without creating duplicates.
    """
    if not lead or lead.status != models.LeadStatus.CREDIT_APPLICATION.value:
        return

    detail = db.query(models.LeadProcessDetail).filter(
        models.LeadProcessDetail.lead_id == lead.id
    ).first()

    desired_vehicle = ""
    if detail:
        if detail.vehicle_id:
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == detail.vehicle_id).first()
            if vehicle:
                desired_vehicle = " ".join(
                    part for part in [vehicle.make, vehicle.model, str(vehicle.year or "")] if part
                ).strip()
        if not desired_vehicle:
            desired_vehicle = (detail.desired_vehicle or "").strip()

    if not desired_vehicle:
        desired_vehicle = (lead.message or "").strip() or "Por definir"

    note_parts = [f"Generado autom?ticamente desde lead #{lead.id}."]
    if comment and comment.strip():
        note_parts.append(f"Seguimiento: {comment.strip()}")
    auto_note = " ".join(note_parts)

    existing_credit = db.query(models.CreditApplication).filter(
        models.CreditApplication.company_id == lead.company_id,
        models.CreditApplication.lead_id == lead.id
    ).order_by(models.CreditApplication.created_at.desc()).first()

    if existing_credit:
        existing_credit.client_name = lead.name or existing_credit.client_name
        existing_credit.phone = (lead.phone or "").strip() or existing_credit.phone
        existing_credit.email = lead.email or existing_credit.email
        existing_credit.desired_vehicle = desired_vehicle or existing_credit.desired_vehicle
        existing_credit.assigned_to_id = lead.assigned_to_id or existing_credit.assigned_to_id
        existing_credit.notes = auto_note
        if not existing_credit.status:
            existing_credit.status = models.CreditStatus.PENDING.value
        return

    db.add(models.CreditApplication(
        lead_id=lead.id,
        client_name=lead.name or f"Lead {lead.id}",
        phone=(lead.phone or "").strip() or f"lead-{lead.id}",
        email=lead.email,
        desired_vehicle=desired_vehicle,
        monthly_income=0,
        other_income=0,
        occupation="employee",
        application_mode="individual",
        down_payment=0,
        status=models.CreditStatus.PENDING.value,
        notes=auto_note,
        company_id=lead.company_id,
        assigned_to_id=lead.assigned_to_id
    ))



# --- USER ENDPOINTS ---

@app.get("/users/", response_model=schemas.UserList)
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    q: str = None, 
    role_id: int = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    today = datetime.datetime.utcnow()
    five_min_ago = today - datetime.timedelta(minutes=5)

    # Update current user last_active
    current_user.last_active = today
    db.commit()

    query = db.query(models.User)
    
    # If user belongs to a company, limit scope to that company specific users
    if current_user.company_id:
        query = query.filter(models.User.company_id == current_user.company_id)

    if q:
        query = query.filter(models.User.email.ilike(f"%{q}%"))
    
    if role_id:
        query = query.filter(models.User.role_id == role_id)
    
    total = query.count()
    users = query.offset(skip).limit(limit).all()

    # Compute is_online for each user
    serialized_users = []
    for user in users:
        is_online = bool(user.last_active and user.last_active > five_min_ago)
        serialized_users.append(serialize_user(user, is_online=is_online))

    return {"items": serialized_users, "total": total}

@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    print(f"Creating user with payload: {user.dict()}") 
    
    # Verify role exists
    role_obj = db.query(models.Role).filter(models.Role.id == user.role_id).first()
    if not role_obj:
        raise HTTPException(status_code=400, detail="Invalid Role ID")
    role_obj = resolve_assignable_role(db, role_obj, current_user.company_id)
    if current_user.company_id and role_obj.company_id not in {None, current_user.company_id}:
        raise HTTPException(status_code=403, detail="No puedes usar roles de otra empresa")

    # Check permissions and scope
    if current_user.company_id:
        user.company_id = current_user.company_id
        # Prevent creating Super Admins
        if role_obj.name == "super_admin":
             raise HTTPException(status_code=403, detail="Company admins cannot create Super Users")
    
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth_utils.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role_id=role_obj.id, 
        company_id=user.company_id
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    log_action_to_db(db, current_user.id, "CREATE", "User", new_user.id, f"Usuario creado: {new_user.email} con Rol ID {new_user.role_id}")
    
    return serialize_user(new_user)


# Keep this for backward compatibility or strict "me" endpoint
@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return serialize_user(current_user)

@app.get("/users/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.company_id and user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver usuarios de otra empresa")
    return serialize_user(user)

@app.put("/users/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    print(f"Updating user {user_id} with: {user_update.dict()}") 
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.company_id and db_user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar usuarios de otra empresa")
    
    if user_update.email:
        db_user.email = user_update.email
    if user_update.password:
        db_user.hashed_password = auth_utils.get_password_hash(user_update.password)
    if user_update.role_id is not None:
        target_role = db.query(models.Role).filter(models.Role.id == user_update.role_id).first()
        if not target_role:
            raise HTTPException(status_code=400, detail="Invalid Role ID")
        target_role = resolve_assignable_role(db, target_role, current_user.company_id)
        if current_user.company_id and target_role.company_id not in {None, current_user.company_id}:
            raise HTTPException(status_code=403, detail="No puedes usar roles de otra empresa")
        print(f"Setting role_id to: {target_role.id}") 
        db_user.role_id = target_role.id
    if user_update.company_id is not None:
        if current_user.company_id and user_update.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="No puedes mover usuarios a otra empresa")
        db_user.company_id = user_update.company_id
    
    # Update new fields
    if user_update.full_name is not None:
        db_user.full_name = user_update.full_name
    if user_update.commission_percentage is not None:
        db_user.commission_percentage = user_update.commission_percentage
    if user_update.base_salary is not None:
        db_user.base_salary = user_update.base_salary
    if user_update.payment_dates is not None:
        db_user.payment_dates = user_update.payment_dates
        
    try:
        db.commit()
        db.refresh(db_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    log_action_to_db(db, current_user.id, "UPDATE", "User", db_user.id, f"Usuario modificado: {db_user.email}")
        
    return serialize_user(db_user)

@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Check if the executing user has permission (Admin or Super Admin)
    role_obj = db.query(models.Role).filter(models.Role.id == current_user.role_id).first()
    if not role_obj or role_obj.name not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar usuarios")
        
    # 2. Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    # 3. Find user
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    # 4. If current user is just 'admin', they can only delete users in their same company
    if role_obj.name == "admin":
        if db_user.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="No puedes eliminar usuarios de otra empresa")
            
        # Prevent 'admin' from deleting a 'super_admin'
        target_role = db.query(models.Role).filter(models.Role.id == db_user.role_id).first()
        if target_role and target_role.name == "super_admin":
            raise HTTPException(status_code=403, detail="No puedes eliminar a un Súper Administrador")
            
    user_email_snapshot = db_user.email
            
    try:
        # 5. Remove relationships before deleting to avoid MySQL Integrity Error 1451
        db.query(models.LeadHistory).filter(models.LeadHistory.user_id == user_id).update({"user_id": None})
        db.query(models.Lead).filter(models.Lead.assigned_to_id == user_id).update({"assigned_to_id": None})
        db.query(models.Lead).filter(models.Lead.created_by_id == user_id).update({"created_by_id": None})
        db.query(models.LeadSupervisor).filter(models.LeadSupervisor.user_id == user_id).delete(synchronize_session=False)
        db.query(models.LeadSupervisor).filter(models.LeadSupervisor.assigned_by_id == user_id).update({"assigned_by_id": None}, synchronize_session=False)
        db.query(models.Sale).filter(models.Sale.seller_id == user_id).update({"seller_id": None})
        
        db.delete(db_user)
        db.commit()
        
        log_action_to_db(db, current_user.id, "DELETE", "User", user_id, f"Usuario eliminado: {user_email_snapshot}")
        
        return {"status": "success", "message": "Usuario eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar el usuario porque tiene registros dependientes (ej: ventas o leads asigandos). {str(e)}")

# --- SYSTEM LOGS ENDPOINTS ---

@app.get("/logs/", response_model=schemas.SystemLogList)
def read_system_logs(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Get all system logs.
    Restricted to Admins and Super Admins.
    """
    role_obj = db.query(models.Role).filter(models.Role.id == current_user.role_id).first()
    if not role_obj or role_obj.name not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver auditoría")

    query = db.query(models.SystemLog)
    
    total = query.count()
    items = query.order_by(models.SystemLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return {"items": items, "total": total}

@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    companies_count = db.query(models.Company).count()
    users_count = db.query(models.User).count()
    return {"companies_count": companies_count, "users_count": users_count}

@app.get("/")
def read_root():
    return {"message": "Bienvenido a la API de AutosQP"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/companies/", response_model=schemas.Company)
def create_company(company: schemas.CompanyCreate, db: Session = Depends(get_db)):
    db_company = db.query(models.Company).filter(models.Company.name == company.name).first()
    if db_company:
        raise HTTPException(status_code=400, detail="Company already registered")
    
    new_company = models.Company(
        name=company.name,
        logo_url=company.logo_url,
        primary_color=company.primary_color,
        secondary_color=company.secondary_color
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return new_company

@app.get("/companies/", response_model=schemas.CompanyList)
def read_companies(skip: int = 0, limit: int = 10, q: str = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Company)
    if q:
        query = query.filter(models.Company.name.ilike(f"%{q}%"))
    
    total = query.count()
    companies = query.offset(skip).limit(limit).all()
    return {"items": companies, "total": total}

@app.get("/companies/{company_id}", response_model=schemas.Company)
def read_company(company_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

@app.put("/companies/{company_id}", response_model=schemas.Company)
def update_company(company_id: int, company_update: schemas.CompanyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db_company.name = company_update.name
    db_company.logo_url = company_update.logo_url
    db_company.primary_color = company_update.primary_color
    db_company.secondary_color = company_update.secondary_color
    
    try:
        db.commit()
        db.refresh(db_company)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return db_company

@app.get("/companies/{company_id}/integrations", response_model=schemas.IntegrationSettings)
def read_integration_settings(company_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check permissions
    if current_user.company_id and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to view these settings")
    
    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
    if not settings:
        # Create default empty settings if not exists
        settings = models.IntegrationSettings(company_id=company_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
        
    return settings

@app.get("/roles/views")
def read_role_views(current_user: models.User = Depends(get_current_user)):
    ensure_role_management_permissions(current_user)
    return {"items": SYSTEM_VIEWS}


@app.get("/roles/", response_model=list[schemas.Role])
def read_roles(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Role)
    if current_user.company_id:
        query = query.filter(
            or_(
                models.Role.company_id == current_user.company_id,
                and_(models.Role.company_id.is_(None), models.Role.is_system == True)
            )
        )
    roles = query.order_by(models.Role.is_system.desc(), models.Role.label.asc()).all()
    if current_user.company_id:
        override_names = {role.base_role_name for role in roles if role.company_id == current_user.company_id and role.base_role_name}
        roles = [role for role in roles if not (role.is_system and role.name in override_names)]
    return [serialize_role(role) for role in roles]


@app.post("/roles/", response_model=schemas.Role)
def create_role(
    role: schemas.RoleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_role_management_permissions(current_user)
    if not current_user.company_id and current_user.role and current_user.role.name != "super_admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    sanitized_permissions = sanitize_view_ids(role.permissions, current_user.company_id)
    sanitized_menu_order = sanitize_view_ids(role.menu_order, current_user.company_id)
    sanitized_assignable_role_ids = sanitize_assignable_role_ids(db, role.assignable_role_ids, current_user.company_id)
    for view_id in sanitized_permissions:
        if view_id not in sanitized_menu_order:
            sanitized_menu_order.append(view_id)

    slug_base = re.sub(r"[^a-z0-9]+", "_", role.label.lower()).strip("_") or "rol"
    generated_name = f"custom_{current_user.company_id or 'global'}_{slug_base}_{int(time.time())}"

    db_role = models.Role(
        name=generated_name,
        label=role.label.strip(),
        company_id=current_user.company_id,
        permissions_json=json.dumps(sanitized_permissions),
        menu_order_json=json.dumps(sanitized_menu_order),
        auto_assign_leads=bool(role.auto_assign_leads),
        assignable_role_ids_json=json.dumps(sanitized_assignable_role_ids),
        is_system=False,
        base_role_name=None
    )
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return serialize_role(db_role)


@app.put("/roles/{role_id}", response_model=schemas.Role)
def update_role(
    role_id: int,
    role_update: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_role_management_permissions(current_user)
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    if current_user.company_id and db_role.company_id not in {None, current_user.company_id}:
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.company_id and db_role.is_system and db_role.company_id is None:
        sanitized_permissions = sanitize_view_ids(role_update.permissions, current_user.company_id) if role_update.permissions is not None else sanitize_view_ids(DEFAULT_ROLE_VIEW_ACCESS.get(db_role.name, []), current_user.company_id)
        sanitized_menu_order = sanitize_view_ids(role_update.menu_order, current_user.company_id) if role_update.menu_order is not None else sanitize_view_ids(DEFAULT_ROLE_MENU_ORDER.get(db_role.name, sanitized_permissions), current_user.company_id)
        current_assignable_role_ids = get_role_assignable_role_ids(db_role)
        sanitized_assignable_role_ids = sanitize_assignable_role_ids(
            db,
            role_update.assignable_role_ids if role_update.assignable_role_ids is not None else current_assignable_role_ids,
            current_user.company_id
        )
        for view_id in sanitized_permissions:
            if view_id not in sanitized_menu_order:
                sanitized_menu_order.append(view_id)

        override_role = get_company_role_override(db, current_user.company_id, db_role.name)
        if not override_role:
            override_role = models.Role(
                name=f"override_{current_user.company_id}_{db_role.name}",
                label=(role_update.label.strip() if role_update.label is not None else db_role.label),
                company_id=current_user.company_id,
                permissions_json=json.dumps(sanitized_permissions),
                menu_order_json=json.dumps(sanitize_view_ids(sanitized_menu_order, current_user.company_id)),
                auto_assign_leads=bool(role_update.auto_assign_leads if role_update.auto_assign_leads is not None else getattr(db_role, "auto_assign_leads", False)),
                assignable_role_ids_json=json.dumps(sanitized_assignable_role_ids),
                is_system=False,
                base_role_name=db_role.name
            )
            db.add(override_role)
            db.commit()
            db.refresh(override_role)
        else:
            if role_update.label is not None:
                override_role.label = role_update.label.strip()
            override_role.permissions_json = json.dumps(sanitized_permissions)
            override_role.menu_order_json = json.dumps(sanitize_view_ids(sanitized_menu_order, current_user.company_id))
            if role_update.auto_assign_leads is not None:
                override_role.auto_assign_leads = bool(role_update.auto_assign_leads)
            if role_update.assignable_role_ids is not None:
                override_role.assignable_role_ids_json = json.dumps(sanitized_assignable_role_ids)
            db.commit()
            db.refresh(override_role)

        db.query(models.User).filter(
            models.User.company_id == current_user.company_id,
            models.User.role_id == db_role.id
        ).update({"role_id": override_role.id}, synchronize_session=False)
        db.commit()
        db.refresh(override_role)
        return serialize_role(override_role)

    if current_user.company_id and db_role.company_id is None:
        raise HTTPException(status_code=403, detail="No puedes modificar roles globales del sistema")

    if role_update.label is not None:
        db_role.label = role_update.label.strip()
    if role_update.auto_assign_leads is not None:
        db_role.auto_assign_leads = bool(role_update.auto_assign_leads)
    if role_update.assignable_role_ids is not None:
        db_role.assignable_role_ids_json = json.dumps(
            sanitize_assignable_role_ids(
                db,
                role_update.assignable_role_ids,
                current_user.company_id or db_role.company_id
            )
        )
    if role_update.permissions is not None:
        sanitized_permissions = sanitize_view_ids(role_update.permissions, current_user.company_id or db_role.company_id)
        db_role.permissions_json = json.dumps(sanitized_permissions)
        current_menu = sanitize_view_ids(role_update.menu_order, current_user.company_id or db_role.company_id) if role_update.menu_order is not None else parse_json_list(db_role.menu_order_json, sanitized_permissions)
        for view_id in sanitized_permissions:
            if view_id not in current_menu:
                current_menu.append(view_id)
        db_role.menu_order_json = json.dumps(sanitize_view_ids(current_menu, current_user.company_id or db_role.company_id))
    elif role_update.menu_order is not None:
        current_permissions = sanitize_view_ids(parse_json_list(db_role.permissions_json, DEFAULT_ROLE_VIEW_ACCESS.get(db_role.name, [])), current_user.company_id or db_role.company_id)
        current_menu = sanitize_view_ids(role_update.menu_order, current_user.company_id or db_role.company_id)
        for view_id in current_permissions:
            if view_id not in current_menu:
                current_menu.append(view_id)
        db_role.menu_order_json = json.dumps(current_menu)

    db.commit()
    db.refresh(db_role)
    return serialize_role(db_role)


@app.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_role_management_permissions(current_user)
    db_role = db.query(models.Role).filter(models.Role.id == role_id).first()
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    if db_role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")
    if current_user.company_id and db_role.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    in_use = db.query(models.User).filter(models.User.role_id == role_id).count()
    if in_use:
        raise HTTPException(status_code=400, detail="No se puede eliminar un rol que tiene usuarios asignados")

    db.delete(db_role)
    db.commit()
    return None

@app.put("/companies/{company_id}/integrations", response_model=schemas.IntegrationSettings)
def update_integration_settings(company_id: int, settings_update: schemas.IntegrationSettingsUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Check permissions (only admins or super admins)
    role_name = current_user.role.name if current_user.role else "user"
    if role_name not in ["super_admin", "admin"]:
         raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.company_id and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify these settings")
        
    settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
    if not settings:
        settings = models.IntegrationSettings(company_id=company_id)
        db.add(settings)
    
    # Update fields
    for field, value in settings_update.dict(exclude_unset=True).items():
        setattr(settings, field, value)
        
    try:
        db.commit()
        db.refresh(settings)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    return settings
    return settings

# --- LEADS ENDPOINTS ---

@app.get("/leads", response_model=schemas.LeadList)
def read_leads(
    source: str = None, 
    status: str = None,
    board_scope: str = None,
    q: str = None,
    skip: int = 0, 
    limit: int = 1000, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Lead).options(
        joinedload(models.Lead.assigned_to),
        joinedload(models.Lead.deleted_by),
        joinedload(models.Lead.supervisors),
        joinedload(models.Lead.history),
        joinedload(models.Lead.conversation).joinedload(models.Conversation.messages),
        joinedload(models.Lead.notes),
        joinedload(models.Lead.files),
        joinedload(models.Lead.purchase_options)
    )
    query = query.filter(models.Lead.deleted_at.is_(None))
    
    # Filter by user company
    if current_user.company_id:
        query = query.filter(models.Lead.company_id == current_user.company_id)
    
    aliado_roles = db.query(models.Role).filter(
        or_(
            models.Role.name == "aliado",
            models.Role.base_role_name == "aliado"
        )
    ).all()
    aliado_role_ids = [role.id for role in aliado_roles]
    aliado_user_ids = []
    if aliado_role_ids:
        aliado_user_ids = [row[0] for row in db.query(models.User.id).filter(models.User.role_id.in_(aliado_role_ids)).all()]

    if board_scope == "ally":
        if get_user_role_name(current_user) == "aliado":
            query = query.filter(
                or_(
                    models.Lead.assigned_to_id == current_user.id,
                    models.Lead.supervisors.any(models.User.id == current_user.id)
                )
            )
        elif aliado_user_ids:
            query = query.filter(
                or_(
                    models.Lead.assigned_to_id.in_(aliado_user_ids),
                    models.Lead.supervisors.any(models.User.id.in_(aliado_user_ids))
                )
            )
        else:
            query = query.filter(false())
    elif aliado_user_ids:
        query = query.filter(
            or_(
                models.Lead.assigned_to_id.is_(None),
                ~models.Lead.assigned_to_id.in_(aliado_user_ids)
            )
        )

    # Filter by Advisor (Asesor) - Only see assigned leads
    if get_user_role_name(current_user) in ['asesor', 'vendedor']:
        query = query.filter(
            or_(
                models.Lead.assigned_to_id == current_user.id,
                models.Lead.supervisors.any(models.User.id == current_user.id)
            )
        )
    
    # Filter by Aliado - Only see their own queue
    if get_user_role_name(current_user) == 'aliado':
        query = query.filter(
            or_(
                models.Lead.assigned_to_id == current_user.id,
                models.Lead.supervisors.any(models.User.id == current_user.id)
            )
        )

    if source:
        query = query.filter(models.Lead.source == source)
    
    if status:
        query = query.filter(models.Lead.status == status)

    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Lead.name.ilike(search)) | 
            (models.Lead.email.ilike(search)) | 
            (models.Lead.phone.ilike(search))
        )
        
    total = query.count()
    leads = query.order_by(models.Lead.id.desc()).offset(skip).limit(limit).all()

    lead_ids = [lead.id for lead in leads]
    credit_map = {}
    if lead_ids:
        related_credits = db.query(models.CreditApplication).filter(
            models.CreditApplication.lead_id.in_(lead_ids)
        ).order_by(
            models.CreditApplication.updated_at.desc(),
            models.CreditApplication.created_at.desc()
        ).all()

        for credit in related_credits:
            if credit.lead_id and credit.lead_id not in credit_map:
                credit_map[credit.lead_id] = credit

    for lead in leads:
        related_credit = credit_map.get(lead.id)
        if related_credit:
            lead.credit_application_id = related_credit.id
            lead.credit_application_status = related_credit.status
            lead.credit_application_updated_at = related_credit.updated_at

    return {"items": leads, "total": total}


@app.get("/leads/deleted", response_model=schemas.LeadList)
def read_deleted_leads(
    skip: int = 0,
    limit: int = 500,
    q: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if get_user_role_name(current_user) not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver leads eliminados")

    query = db.query(models.Lead).options(
        joinedload(models.Lead.assigned_to),
        joinedload(models.Lead.deleted_by),
        joinedload(models.Lead.supervisors)
    ).filter(models.Lead.deleted_at.is_not(None))

    if current_user.company_id:
        query = query.filter(models.Lead.company_id == current_user.company_id)

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                models.Lead.name.ilike(search),
                models.Lead.email.ilike(search),
                models.Lead.phone.ilike(search),
                models.Lead.deleted_reason.ilike(search)
            )
        )

    total = query.count()
    items = query.order_by(models.Lead.deleted_at.desc(), models.Lead.id.desc()).offset(skip).limit(limit).all()
    return {"items": items, "total": total}

@app.put("/leads/bulk-assign", status_code=200)
def bulk_assign_leads(
    payload: schemas.LeadBulkAssign, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify assigned_to user exists and is in same company
    target_user = db.query(models.User).join(models.Role, isouter=True).filter(models.User.id == payload.assigned_to_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
        
    if current_user.company_id and target_user.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Target user is in a different company")
    if not is_advisor_role(target_user.role):
        raise HTTPException(status_code=400, detail="Solo se pueden asignar leads a usuarios con rol asesor")

    leads_to_update = db.query(models.Lead).options(joinedload(models.Lead.supervisors)).filter(
        models.Lead.id.in_(payload.lead_ids)
    )
    
    if current_user.company_id:
        leads_to_update = leads_to_update.filter(models.Lead.company_id == current_user.company_id)
    
    leads = leads_to_update.all()
    result = 0
    for lead in leads:
        previous_assigned_to_id = lead.assigned_to_id
        lead.assigned_to_id = payload.assigned_to_id
        supervisor_ids = normalize_supervisor_ids(getattr(lead, "supervisor_ids", []))
        if should_keep_assigner_as_supervisor(current_user.id, payload.assigned_to_id):
            supervisor_ids = ensure_user_in_supervisors(supervisor_ids, current_user.id)
        sync_lead_supervisors(db, lead, supervisor_ids, current_user.id)

        if previous_assigned_to_id != payload.assigned_to_id:
            db.add(models.LeadHistory(
                lead_id=lead.id,
                user_id=current_user.id,
                previous_status=lead.status,
                new_status=lead.status,
                comment=f"Lead asignado a {target_user.full_name or target_user.email}; quien asigna queda en supervision"
            ))
            db.add(models.Notification(
                user_id=payload.assigned_to_id,
                title="Lead Asignado",
                message=f"Se te asigno el lead: {lead.name}. Continúa con la gestion.",
                type="info",
                link=build_lead_board_link(target_user, lead.id)
            ))
        result += 1

    db.commit()
    return {"message": f"Successfully assigned {result} leads to user {target_user.email}"}


@app.post("/leads", response_model=schemas.Lead)
def create_lead(lead: schemas.LeadCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    import datetime
    import random
    
    # 1. Determine Company
    company_id = lead.company_id
    if not company_id:
        if current_user.company_id:
            company_id = current_user.company_id
        else:
             raise HTTPException(status_code=400, detail="Company ID required for assignment")

    # 2. Assignment Logic
    assigned_user_id = lead.assigned_to_id
    supervisor_ids = normalize_supervisor_ids(getattr(lead, "supervisor_ids", []))
    if supervisor_ids and not is_company_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo un administrador puede agregar o quitar supervisores de un lead.")
    
    # Automatic Assignment if not provided
    if not assigned_user_id:
        if should_self_assign_manual_lead(current_user):
            assigned_user_id = current_user.id

        if not assigned_user_id:
            auto_assigned_user = choose_auto_assign_user(db, company_id)
            if auto_assigned_user:
                assigned_user_id = auto_assigned_user.id
    else:
        target_user = db.query(models.User).join(models.Role, isouter=True).filter(models.User.id == assigned_user_id).first()
        if not target_user or target_user.company_id != company_id:
            raise HTTPException(status_code=400, detail="Invalid assigned user (not in company)")
        if not can_assign_lead_to_user(current_user, target_user):
            raise HTTPException(status_code=400, detail="Tu rol no tiene permitido reasignar leads a este rol")
    
    effective_status = enforce_ally_managed_status(
        db=db,
        current_user=current_user,
        base_status=lead.status,
        assigned_to_id=assigned_user_id
    )
    assigned_user_id, supervisor_ids, credit_coordinator = maybe_assign_credit_coordinator(
        db=db,
        lead_company_id=company_id,
        target_status=effective_status,
        assigned_to_id=assigned_user_id,
        supervisor_ids=supervisor_ids
    )
    if should_keep_assigner_as_supervisor(current_user.id, assigned_user_id):
        supervisor_ids = ensure_user_in_supervisors(supervisor_ids, current_user.id)

    new_lead = models.Lead(
        created_at=datetime.datetime.now(),
        source=lead.source,
        name=lead.name,
        email=lead.email,
        phone=lead.phone,
        message=lead.message,
        status=effective_status,
        company_id=company_id,
        assigned_to_id=assigned_user_id,
        created_by_id=current_user.id
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    sync_lead_supervisors(db, new_lead, supervisor_ids, current_user.id)

    initial_history = models.LeadHistory(
        lead_id=new_lead.id,
        user_id=current_user.id,
        previous_status=None,
        new_status=new_lead.status,
        comment=(
            f"{new_lead.message or 'Lead creado manualmente'} "
            f"(Asignado automaticamente a coordinacion de credito: {credit_coordinator.full_name or credit_coordinator.email})"
            if credit_coordinator else
            (new_lead.message or "Lead creado manualmente")
        )
    )
    db.add(initial_history)
    db.commit()
    db.refresh(new_lead)
    return new_lead

@app.get("/reports/stats", response_model=schemas.ReportsStats)
def get_reports_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        # Base query filtered by company
        query = db.query(models.Lead).options(
            joinedload(models.Lead.assigned_to),
            joinedload(models.Lead.supervisors),
            joinedload(models.Lead.purchase_options)
        )
        if current_user.company_id:
            query = query.filter(models.Lead.company_id == current_user.company_id)
        
        leads = query.all()
        total_leads = len(leads)
        ally_user_ids = set(get_company_ally_user_ids(db, current_user.company_id))
        credit_query = db.query(models.CreditApplication)
        purchase_query = db.query(models.CreditApplication).filter(
            models.CreditApplication.lead_id.isnot(None),
            models.CreditApplication.lead.has(
                and_(
                    models.Lead.status == models.LeadStatus.INTERESTED.value,
                    models.Lead.process_detail.has(models.LeadProcessDetail.has_vehicle == False),  # noqa: E712
                    models.Lead.process_detail.has(models.LeadProcessDetail.desired_vehicle.isnot(None))
                )
            )
        )
        vehicle_query = db.query(models.Vehicle)
        sales_query = db.query(models.Sale)

        if current_user.company_id:
            credit_query = credit_query.filter(models.CreditApplication.company_id == current_user.company_id)
            purchase_query = purchase_query.filter(models.CreditApplication.company_id == current_user.company_id)
            vehicle_query = vehicle_query.filter(models.Vehicle.company_id == current_user.company_id)
            sales_query = sales_query.filter(models.Sale.company_id == current_user.company_id)

        credit_applications = credit_query.all()
        purchase_requests = purchase_query.all()
        vehicles = vehicle_query.all()
        sales = sales_query.all()
        
        # Calculate Stats
        leads_by_status = {}
        leads_by_source = {}
        leads_by_advisor = {}
        converted_count = 0
        active_pipeline_count = 0
        unread_replies_count = 0
        unread_replies_by_source = {}
        assignment_split = {"assigned": 0, "unassigned": 0}
        ally_status_split = {}
        credit_status_split = {}
        purchase_status_split = {}
        purchase_option_decision_split = {"pending": 0, "accepted": 0, "rejected": 0}
        vehicle_status_split = {}
        sales_status_split = {}

        today = datetime.datetime.utcnow().date()
        recent_dates = [today - datetime.timedelta(days=offset) for offset in range(6, -1, -1)]
        recent_leads_by_day = {day.strftime("%d/%m"): 0 for day in recent_dates}
        ally_board_count = 0
        
        for lead in leads:
            # Status
            status = lead.status or "unknown"
            leads_by_status[status] = leads_by_status.get(status, 0) + 1
            if status == "sold":
                converted_count += 1
            if status not in ["sold", "lost"]:
                active_pipeline_count += 1
                
            # Source
            source = lead.source or "manual"
            leads_by_source[source] = leads_by_source.get(source, 0) + 1
            
            # Advisor
            advisor_name = "Sin Asignar"
            if lead.assigned_to:
                advisor_name = lead.assigned_to.email
                assignment_split["assigned"] += 1
            else:
                assignment_split["unassigned"] += 1
            leads_by_advisor[advisor_name] = leads_by_advisor.get(advisor_name, 0) + 1

            if lead.has_unread_reply:
                unread_replies_count += 1
                unread_replies_by_source[source] = unread_replies_by_source.get(source, 0) + 1

            supervisor_ids = {supervisor.id for supervisor in (lead.supervisors or []) if supervisor and supervisor.id}
            touches_ally_board = bool(
                ally_user_ids and (
                    (lead.assigned_to_id in ally_user_ids) or
                    bool(supervisor_ids & ally_user_ids)
                )
            )
            if touches_ally_board:
                ally_board_count += 1
                ally_status_split[status] = ally_status_split.get(status, 0) + 1

            created_at = lead.created_at.date() if lead.created_at else None
            if created_at in recent_dates:
                recent_leads_by_day[created_at.strftime("%d/%m")] += 1

            for option in lead.purchase_options or []:
                decision_status = (getattr(option, "decision_status", None) or "pending").lower()
                if decision_status not in purchase_option_decision_split:
                    purchase_option_decision_split[decision_status] = 0
                purchase_option_decision_split[decision_status] += 1

        for application in credit_applications:
            status_key = application.status or "pending"
            credit_status_split[status_key] = credit_status_split.get(status_key, 0) + 1

        for purchase in purchase_requests:
            status_key = purchase.status or "pending"
            purchase_status_split[status_key] = purchase_status_split.get(status_key, 0) + 1

        for vehicle in vehicles:
            status_key = vehicle.status or "available"
            vehicle_status_split[status_key] = vehicle_status_split.get(status_key, 0) + 1

        for sale in sales:
            status_key = sale.status or "pending"
            sales_status_split[status_key] = sales_status_split.get(status_key, 0) + 1

        conversion_rate = (converted_count / total_leads * 100) if total_leads > 0 else 0.0

        return {
            "total_leads": total_leads,
            "conversion_rate": round(conversion_rate, 2),
            "active_pipeline_count": active_pipeline_count,
            "unread_replies_count": unread_replies_count,
            "ally_board_count": ally_board_count,
            "credit_applications_count": len(credit_applications),
            "purchase_requests_count": len(purchase_requests),
            "available_inventory_count": vehicle_status_split.get("available", 0),
            "approved_sales_count": sales_status_split.get("approved", 0),
            "pending_sales_count": sales_status_split.get("pending", 0),
            "leads_by_status": leads_by_status,
            "leads_by_source": leads_by_source,
            "leads_by_advisor": leads_by_advisor,
            "recent_leads_by_day": recent_leads_by_day,
            "unread_replies_by_source": unread_replies_by_source,
            "assignment_split": assignment_split,
            "ally_status_split": ally_status_split,
            "credit_status_split": credit_status_split,
            "purchase_status_split": purchase_status_split,
            "purchase_option_decision_split": purchase_option_decision_split,
            "vehicle_status_split": vehicle_status_split,
            "sales_status_split": sales_status_split,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- STATIC FILES & UPLOAD ---
from fastapi.staticfiles import StaticFiles
from fastapi import UploadFile, File, Form
import shutil
import os
import uuid

# Ensure static directory exists
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.post("/upload/")
async def upload_image(request: Request, file: UploadFile = File(...)):
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"static/{unique_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    relative_url = f"/api/static/{unique_filename}"
    base_url = str(request.base_url).rstrip("/")
    # Behind reverse proxies, base_url can already include /api.
    if base_url.endswith("/api"):
        base_url = base_url[:-4]
    return {
        "url": f"{base_url}{relative_url}",
        "url_relative": relative_url
    }

@app.get("/internal-files/{storage_name}")
def get_internal_file(storage_name: str):
    safe_name = os.path.basename(storage_name)
    base_dir = os.path.abspath("static/internal_chat")
    file_path = os.path.abspath(os.path.join(base_dir, safe_name))

    if not file_path.startswith(base_dir):
        raise HTTPException(status_code=400, detail="Invalid file path")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(path=file_path, filename=safe_name)

# --- BRANDS & MODELS ENDPOINTS ---

@app.get("/brands/", response_model=List[schemas.CarBrand])
def read_brands(db: Session = Depends(get_db)):
    return db.query(models.CarBrand).order_by(models.CarBrand.name).all()

@app.get("/brands/{brand_id}/models/", response_model=List[schemas.CarModel])
def read_models_by_brand(brand_id: int, db: Session = Depends(get_db)):
    return db.query(models.CarModel).filter(models.CarModel.brand_id == brand_id).order_by(models.CarModel.name).all()

def normalize_catalog_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned if cleaned else None

def catalog_key(value: Optional[str]) -> str:
    normalized = normalize_catalog_value(value) or ""
    return re.sub(r"[^a-z0-9]", "", normalized.lower())

def upsert_brand_model(db: Session, make: Optional[str], model: Optional[str]):
    make_name = normalize_catalog_value(make)
    model_name = normalize_catalog_value(model)
    if not make_name:
        return

    brand = db.query(models.CarBrand).filter(func.lower(models.CarBrand.name) == make_name.lower()).first()
    if not brand:
        brand = models.CarBrand(name=make_name)
        db.add(brand)
        db.flush()

    if model_name:
        existing_model = db.query(models.CarModel).filter(
            models.CarModel.brand_id == brand.id,
            func.lower(models.CarModel.name) == model_name.lower()
        ).first()
        if not existing_model:
            db.add(models.CarModel(name=model_name, brand_id=brand.id))

@app.get("/stats/advisor", response_model=schemas.RoleDashboardStats)
def read_advisor_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="Dashboard disponible solo para usuarios de empresa")

    role_name = get_user_role_name(current_user) or ""
    permissions = set(get_role_permissions(current_user.role))
    company_scope = role_name in {"admin", "super_admin"}
    ally_user_ids = set(get_company_ally_user_ids(db, current_user.company_id))

    leads_query = db.query(models.Lead).options(
        joinedload(models.Lead.supervisors),
        joinedload(models.Lead.purchase_options)
    ).filter(models.Lead.company_id == current_user.company_id)
    if not company_scope:
        leads_query = leads_query.filter(
            or_(
                models.Lead.assigned_to_id == current_user.id,
                models.Lead.supervisors.any(models.User.id == current_user.id)
            )
        )
    leads = leads_query.all()

    status_distribution = {}
    ally_status_distribution = {}
    unread_replies_count = 0
    active_pipeline_count = 0
    purchase_option_decision_distribution = {"pending": 0, "accepted": 0, "rejected": 0}
    today = datetime.datetime.utcnow().date()
    recent_dates = [today - datetime.timedelta(days=offset) for offset in range(6, -1, -1)]
    recent_leads_by_day = {day.strftime("%d/%m"): 0 for day in recent_dates}

    relevant_lead_ids = []
    ally_total = 0
    for lead in leads:
        relevant_lead_ids.append(lead.id)
        status_key = lead.status or "new"
        status_distribution[status_key] = status_distribution.get(status_key, 0) + 1
        if status_key not in {"sold", "lost"}:
            active_pipeline_count += 1
        if lead.has_unread_reply:
            unread_replies_count += 1
        created_at = lead.created_at.date() if lead.created_at else None
        if created_at in recent_dates:
            recent_leads_by_day[created_at.strftime("%d/%m")] += 1
        for option in lead.purchase_options or []:
            decision_status = (getattr(option, "decision_status", None) or "pending").lower()
            if decision_status not in purchase_option_decision_distribution:
                purchase_option_decision_distribution[decision_status] = 0
            purchase_option_decision_distribution[decision_status] += 1

        supervisor_ids = {supervisor.id for supervisor in (lead.supervisors or []) if supervisor and supervisor.id}
        touches_ally_board = bool(
            ally_user_ids and (
                (lead.assigned_to_id in ally_user_ids) or
                bool(supervisor_ids & ally_user_ids)
            )
        )
        if touches_ally_board:
            ally_total += 1
            ally_status_distribution[status_key] = ally_status_distribution.get(status_key, 0) + 1

    total_leads = len(leads)
    leads_sold = status_distribution.get("sold", 0)
    leads_new = status_distribution.get("new", 0)
    conversion_rate = (leads_sold / total_leads * 100) if total_leads else 0

    credit_status_distribution = {}
    credit_total = 0
    if "credits" in permissions:
        credits_query = db.query(models.CreditApplication).filter(
            models.CreditApplication.company_id == current_user.company_id
        )
        if not company_scope:
            credits_query = credits_query.filter(
                or_(
                    models.CreditApplication.assigned_to_id == current_user.id,
                    models.CreditApplication.lead_id.in_(relevant_lead_ids or [-1])
                )
            )
        credits = credits_query.all()
        credit_total = len(credits)
        for credit in credits:
            status_key = credit.status or "pending"
            credit_status_distribution[status_key] = credit_status_distribution.get(status_key, 0) + 1

    purchase_status_distribution = {}
    purchase_total = 0
    if "purchase_board" in permissions:
        purchase_lead_ids = [
            lead_id for (lead_id,) in db.query(models.Lead.id).filter(
                models.Lead.company_id == current_user.company_id,
                models.Lead.status == models.LeadStatus.INTERESTED.value,
                models.Lead.process_detail.has(models.LeadProcessDetail.has_vehicle == False),  # noqa: E712
                models.Lead.process_detail.has(models.LeadProcessDetail.desired_vehicle.isnot(None))
            ).all()
        ]
        purchases_query = db.query(models.CreditApplication).filter(
            models.CreditApplication.company_id == current_user.company_id,
            models.CreditApplication.lead_id.in_(purchase_lead_ids or [-1])
        )
        if not company_scope:
            purchases_query = purchases_query.filter(
                or_(
                    models.CreditApplication.assigned_to_id == current_user.id,
                    models.CreditApplication.lead_id.in_(relevant_lead_ids or [-1])
                )
            )
        purchases = purchases_query.all()
        purchase_total = len(purchases)
        for purchase in purchases:
            status_key = purchase.status or "pending"
            purchase_status_distribution[status_key] = purchase_status_distribution.get(status_key, 0) + 1

    sales_status_distribution = {}
    sales_total = 0
    sales_approved = 0
    sales_pending = 0
    if "sales" in permissions or "my_sales" in permissions:
        sales_query = db.query(models.Sale).filter(models.Sale.company_id == current_user.company_id)
        if "my_sales" in permissions and not company_scope:
            sales_query = sales_query.filter(models.Sale.seller_id == current_user.id)
        sales = sales_query.all()
        sales_total = len(sales)
        for sale in sales:
            status_key = sale.status or "pending"
            sales_status_distribution[status_key] = sales_status_distribution.get(status_key, 0) + 1
        sales_approved = sales_status_distribution.get("approved", 0)
        sales_pending = sales_status_distribution.get("pending", 0)

    inventory_status_distribution = {}
    inventory_total = 0
    if "inventory" in permissions:
        vehicles = db.query(models.Vehicle).filter(
            models.Vehicle.company_id == current_user.company_id
        ).all()
        inventory_total = len(vehicles)
        for vehicle in vehicles:
            status_key = vehicle.status or "available"
            inventory_status_distribution[status_key] = inventory_status_distribution.get(status_key, 0) + 1

    return {
        "total_leads": total_leads,
        "leads_new": leads_new,
        "leads_sold": leads_sold,
        "ally_total": ally_total,
        "conversion_rate": round(conversion_rate, 2),
        "response_time_min": 37,
        "active_pipeline_count": active_pipeline_count,
        "unread_replies_count": unread_replies_count,
        "status_distribution": status_distribution,
        "ally_status_distribution": ally_status_distribution,
        "recent_leads_by_day": recent_leads_by_day,
        "credit_total": credit_total,
        "credit_status_distribution": credit_status_distribution,
        "purchase_total": purchase_total,
        "purchase_status_distribution": purchase_status_distribution,
        "purchase_option_decision_distribution": purchase_option_decision_distribution,
        "sales_total": sales_total,
        "sales_approved": sales_approved,
        "sales_pending": sales_pending,
        "sales_status_distribution": sales_status_distribution,
        "inventory_total": inventory_total,
        "inventory_status_distribution": inventory_status_distribution,
    }

@app.post("/seed/brands")
def seed_brands(db: Session = Depends(get_db)):
    # Data for common cars in Colombia
    data = {
        "Chevrolet": ["Spark", "Sail", "Onix", "Tracker", "Captiva", "Colorado", "Tahoe", "Joy", "Beat", "Equinox"],
        "Renault": ["Logan", "Sandero", "Stepway", "Duster", "Kwid", "Captur", "Koleos", "Alaskan", "Oroch", "Twingo"],
        "Mazda": ["Mazda 2", "Mazda 3", "Mazda 6", "CX-30", "CX-5", "CX-50", "CX-9", "CX-90", "MX-5"],
        "Kia": ["Picanto", "Rio", "Cerato", "Sportage", "Sorento", "Niro", "Stonic", "Soluto", "Eko Taxi"],
        "Toyota": ["Hilux", "Fortuner", "Corolla", "Prado", "Yaris", "Rav4", "Land Cruiser", "4Runner", "TXL"],
        "Nissan": ["Versa", "March", "Sentra", "Kicks", "Qashqai", "X-Trail", "Frontier", "Murano", "Patrol"],
        "Ford": ["Fiesta", "Focus", "Ecosport", "Escape", "Edge", "Explorer", "Ranger", "F-150", "Bronco"],
        "Volkswagen": ["Gol", "Voyage", "Polo", "Virtus", "T-Cross", "Nivus", "Amarok", "Jetta", "Tiguan"],
        "Hyundai": ["Grand i10", "Accent", "HB20", "Tucson", "Santa Fe", "Creta", "Elantra", "Venue", "Palisade"],
        "Suzuki": ["Swift", "Alto", "S-Presso", "Vitara", "Jimny", "Baleno", "Ertiga"],
        "Honda": ["Civic", "CR-V", "HR-V", "Pilot", "City", "WR-V"],
        "BMW": ["Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "X1", "X3", "X4", "X5"],
        "Mercedes-Benz": ["Clase A", "Clase C", "Clase E", "Clase GLA", "Clase GLC", "Clase GLE"],
        "Audi": ["A3", "A4", "Q2", "Q3", "Q5", "Q7", "Q8"]
    }

    count = 0
    for brand_name, models_list in data.items():
        # Check if brand exists
        brand = db.query(models.CarBrand).filter(models.CarBrand.name == brand_name).first()
        if not brand:
            brand = models.CarBrand(name=brand_name)
            db.add(brand)
            db.commit()
            db.refresh(brand)
        
        for model_name in models_list:
            # Check if model exists
            exists = db.query(models.CarModel).filter(
                models.CarModel.brand_id == brand.id,
                models.CarModel.name == model_name
            ).first()
            if not exists:
                new_model = models.CarModel(name=model_name, brand_id=brand.id)
                db.add(new_model)
                count += 1
    
    db.commit()
    return {"message": f"Seeded {count} new models successfully."}

@app.post("/seed/brands/from-vehicles")
def seed_brands_from_vehicles(db: Session = Depends(get_db)):
    rows = db.query(models.Vehicle.make, models.Vehicle.model).all()
    if not rows:
        return {
            "message": "No hay vehiculos para sincronizar.",
            "brands_created": 0,
            "models_created": 0
        }

    existing_brands = db.query(models.CarBrand).all()
    brands_by_key = {b.name.lower(): b for b in existing_brands if b.name}

    existing_models = db.query(models.CarModel).all()
    models_by_key = {
        (m.brand_id, m.name.lower()): m
        for m in existing_models
        if m.name and m.brand_id
    }

    brands_created = 0
    models_created = 0

    for make_raw, model_raw in rows:
        make_name = normalize_catalog_value(make_raw)
        model_name = normalize_catalog_value(model_raw)

        if not make_name:
            continue

        brand_key = make_name.lower()
        brand = brands_by_key.get(brand_key)
        if not brand:
            brand = models.CarBrand(name=make_name)
            db.add(brand)
            db.flush()
            brands_by_key[brand_key] = brand
            brands_created += 1

        if not model_name:
            continue

        model_key = (brand.id, model_name.lower())
        if model_key not in models_by_key:
            new_model = models.CarModel(name=model_name, brand_id=brand.id)
            db.add(new_model)
            db.flush()
            models_by_key[model_key] = new_model
            models_created += 1

    db.commit()
    return {
        "message": "Sincronizacion completada",
        "brands_created": brands_created,
        "models_created": models_created
    }

@app.post("/seed/brands/external")
def seed_brands_external(
    max_makes: int = Query(80, ge=1, le=250),
    max_models_per_make: int = Query(120, ge=1, le=500),
    include_models: bool = Query(True),
    only_common: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Pobla catalogo desde la API publica vPIC de NHTSA.
    Fuente:
    - https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json
    - https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeId/{make_id}?format=json
    """
    base_url = "https://vpic.nhtsa.dot.gov/api/vehicles"

    try:
        makes_resp = requests.get(f"{base_url}/GetAllMakes?format=json", timeout=30)
        makes_resp.raise_for_status()
        makes_data = makes_resp.json().get("Results", [])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo consultar catalogo externo: {str(exc)}")

    common_brands_colombia = {
        catalog_key("Chevrolet"),
        catalog_key("Renault"),
        catalog_key("Mazda"),
        catalog_key("Kia"),
        catalog_key("Toyota"),
        catalog_key("Nissan"),
        catalog_key("Ford"),
        catalog_key("Volkswagen"),
        catalog_key("Hyundai"),
        catalog_key("Suzuki"),
        catalog_key("Honda"),
        catalog_key("BMW"),
        catalog_key("Mercedes-Benz"),
        catalog_key("Audi"),
        catalog_key("Jeep"),
        catalog_key("Peugeot"),
        catalog_key("Citroen"),
        catalog_key("Seat"),
        catalog_key("Volvo"),
        catalog_key("Subaru"),
        catalog_key("Mitsubishi"),
        catalog_key("Fiat"),
        catalog_key("Chery"),
        catalog_key("Great Wall"),
        catalog_key("JAC"),
        catalog_key("BYD"),
        catalog_key("MG"),
        catalog_key("DFSK"),
    }

    if only_common:
        makes_data = [
            item for item in makes_data
            if catalog_key(item.get("Make_Name")) in common_brands_colombia
        ]

    if not makes_data:
        return {
            "message": "La fuente externa no devolvio marcas.",
            "brands_created": 0,
            "models_created": 0,
            "makes_processed": 0,
            "filter": "common_colombia" if only_common else "all"
        }

    # Marcas existentes por nombre normalizado
    existing_brands = db.query(models.CarBrand).all()
    brands_by_key = {b.name.lower(): b for b in existing_brands if b.name}

    # Modelos existentes por (brand_id, nombre normalizado)
    existing_models = db.query(models.CarModel).all()
    models_by_key = {
        (m.brand_id, m.name.lower()): m
        for m in existing_models
        if m.name and m.brand_id
    }

    brands_created = 0
    models_created = 0
    makes_processed = 0

    for raw_make in makes_data[:max_makes]:
        make_name = normalize_catalog_value(raw_make.get("Make_Name"))
        make_id = raw_make.get("Make_ID")
        if not make_name:
            continue

        make_key = make_name.lower()
        brand = brands_by_key.get(make_key)
        if not brand:
            brand = models.CarBrand(name=make_name)
            db.add(brand)
            db.flush()
            brands_by_key[make_key] = brand
            brands_created += 1

        makes_processed += 1

        if not include_models or not make_id:
            continue

        try:
            models_resp = requests.get(
                f"{base_url}/GetModelsForMakeId/{int(make_id)}?format=json",
                timeout=30
            )
            models_resp.raise_for_status()
            models_data = models_resp.json().get("Results", [])
        except Exception:
            # Si una marca falla, continuamos con las demas.
            continue

        for raw_model in models_data[:max_models_per_make]:
            model_name = normalize_catalog_value(raw_model.get("Model_Name"))
            if not model_name:
                continue

            model_key = (brand.id, model_name.lower())
            if model_key not in models_by_key:
                new_model = models.CarModel(name=model_name, brand_id=brand.id)
                db.add(new_model)
                db.flush()
                models_by_key[model_key] = new_model
                models_created += 1

        # Evita activar control de trafico del proveedor externo.
        time.sleep(0.05)

    db.commit()
    return {
        "message": "Catalogo externo sincronizado correctamente",
        "brands_created": brands_created,
        "models_created": models_created,
        "makes_processed": makes_processed,
        "filter": "common_colombia" if only_common else "all"
    }


# --- PUBLIC SALES CHATBOT ENDPOINTS ---

def get_public_company_id(db: Session, explicit_company_id: Optional[int] = None) -> Optional[int]:
    if explicit_company_id:
        company = db.query(models.Company).filter(models.Company.id == explicit_company_id).first()
        if company:
            return company.id
    env_company_id = os.getenv("PUBLIC_CHAT_COMPANY_ID")
    if env_company_id and env_company_id.isdigit():
        company = db.query(models.Company).filter(models.Company.id == int(env_company_id)).first()
        if company:
            return company.id
    company_with_ai = db.query(models.IntegrationSettings).filter(
        models.IntegrationSettings.openai_api_key.isnot(None)
    ).order_by(models.IntegrationSettings.company_id.asc()).first()
    if company_with_ai and company_with_ai.company_id:
        return company_with_ai.company_id

    first_company = db.query(models.Company).order_by(models.Company.id.asc()).first()
    return first_company.id if first_company else None

def get_company_ai_settings(db: Session, company_id: Optional[int]) -> tuple[Optional[str], str]:
    model_name = "gpt-4o-mini"
    api_key = (os.getenv("OPENAI_API_KEY") or "").strip() or None
    if company_id:
        settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
        if settings:
            if settings.openai_api_key and settings.openai_api_key.strip():
                api_key = settings.openai_api_key.strip()
            if settings.gw_model:
                model_name = settings.gw_model
    return api_key, model_name

def get_company_chatbot_settings(db: Session, company_id: Optional[int]) -> tuple[str, int, int]:
    bot_name = "Jennifer Quimbayo"
    typing_min_ms = 7000
    typing_max_ms = 18000

    if company_id:
        settings = db.query(models.IntegrationSettings).filter(models.IntegrationSettings.company_id == company_id).first()
        if settings:
            if settings.chatbot_bot_name and settings.chatbot_bot_name.strip():
                bot_name = settings.chatbot_bot_name.strip()
            if settings.chatbot_typing_min_ms is not None:
                typing_min_ms = int(settings.chatbot_typing_min_ms)
            if settings.chatbot_typing_max_ms is not None:
                typing_max_ms = int(settings.chatbot_typing_max_ms)

    typing_min_ms = max(0, typing_min_ms)
    typing_max_ms = max(typing_min_ms, typing_max_ms)
    return bot_name, typing_min_ms, typing_max_ms

def call_openai_chat(api_key: str, model_name: str, messages: List[Dict[str, str]]) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.5
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, headers=headers, json=payload, timeout=45)
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()

def call_openai_chat_with_fallback(
    primary_key: str,
    model_name: str,
    messages: List[Dict[str, str]],
    fallback_key: Optional[str]
) -> str:
    try:
        return call_openai_chat(primary_key, model_name, messages)
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        if status_code == 401 and fallback_key and fallback_key.strip() and fallback_key.strip() != primary_key.strip():
            return call_openai_chat(fallback_key.strip(), model_name, messages)
        raise

def extract_prospect_data_with_ai(api_key: str, model_name: str, full_conversation: str) -> Dict[str, Any]:
    extraction_messages = [
        {
            "role": "system",
            "content": (
                "Extrae datos de prospecto de conversación de compra de autos. "
                "Responde SOLO JSON con estas claves exactas: "
                "name, phone, email, interested_vehicle, payment_type, down_payment_amount, has_credit_report, "
                "report_entity, has_payment_agreement, occupation_type, residence_city, monthly_income, is_ready_to_create_lead. "
                "Si falta un dato usa null. "
                "is_ready_to_create_lead=true solo si hay name, phone, email, interested_vehicle, payment_type, down_payment_amount, "
                "occupation_type, residence_city y monthly_income. "
                "Si has_credit_report=true tambien deben venir report_entity y has_payment_agreement."
            )
        },
        {
            "role": "user",
            "content": full_conversation
        }
    ]
    url = "https://api.openai.com/v1/chat/completions"
    payload = {
        "model": model_name,
        "messages": extraction_messages,
        "temperature": 0,
        "response_format": {"type": "json_object"}
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, headers=headers, json=payload, timeout=45)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)

def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    if len(digits) == 10:
        return f"+57{digits}"
    if len(digits) == 12 and digits.startswith("57"):
        return f"+{digits}"
    if len(digits) > 10:
        return f"+57{digits[-10:]}"
    return None

def phone_variants_for_lookup(phone: Optional[str]) -> List[str]:
    normalized = normalize_phone(phone)
    if not normalized:
        return []
    digits = re.sub(r"\D", "", normalized)
    variants = {normalized, digits}
    if digits.startswith("57") and len(digits) == 12:
        variants.add(digits[2:])
        variants.add(f"+{digits[2:]}")
    return list(variants)

def upsert_lead_process_detail(db: Session, lead_id: int, interested_vehicle: str):
    detail = db.query(models.LeadProcessDetail).filter(models.LeadProcessDetail.lead_id == lead_id).first()
    if detail:
        if interested_vehicle and detail.desired_vehicle != interested_vehicle:
            detail.has_vehicle = False
            detail.desired_vehicle = interested_vehicle
    else:
        db.add(models.LeadProcessDetail(
            lead_id=lead_id,
            has_vehicle=False,
            desired_vehicle=interested_vehicle
        ))


def sync_vehicle_reservation_for_lead(
    db: Session,
    lead_id: int,
    previous_vehicle_id: Optional[int],
    next_vehicle_id: Optional[int]
):
    if previous_vehicle_id == next_vehicle_id:
        return

    if previous_vehicle_id:
        other_lead_holds = db.query(models.LeadProcessDetail).filter(
            models.LeadProcessDetail.vehicle_id == previous_vehicle_id,
            models.LeadProcessDetail.lead_id != lead_id
        ).count()
        pending_sale = db.query(models.Sale).filter(
            models.Sale.vehicle_id == previous_vehicle_id,
            models.Sale.status == models.SaleStatus.PENDING.value
        ).first()
        previous_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == previous_vehicle_id).first()
        if previous_vehicle and previous_vehicle.status == models.VehicleStatus.RESERVED.value and not other_lead_holds and not pending_sale:
            previous_vehicle.status = models.VehicleStatus.AVAILABLE.value

    if next_vehicle_id:
        next_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == next_vehicle_id).first()
        if not next_vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        if next_vehicle.status == models.VehicleStatus.SOLD.value:
            raise HTTPException(status_code=400, detail="El vehículo ya fue vendido")
        next_vehicle.status = models.VehicleStatus.RESERVED.value

def sync_public_chat_to_lead_conversation(db: Session, session: models.PublicChatSession):
    if not session.lead_id:
        return

    lead = db.query(models.Lead).filter(models.Lead.id == session.lead_id).first()
    if not lead:
        return

    conversation = db.query(models.Conversation).filter(models.Conversation.lead_id == lead.id).first()
    if not conversation:
        conversation = models.Conversation(
            lead_id=lead.id,
            company_id=lead.company_id,
            last_message_at=datetime.datetime.utcnow()
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    public_messages = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.asc()).all()

    for pm in public_messages:
        marker = f"publicchat:{session.session_token}:{pm.id}"
        exists = db.query(models.Message).filter(models.Message.whatsapp_message_id == marker).first()
        if exists:
            continue

        sender_type = "lead" if pm.role == "user" else "user"
        db.add(models.Message(
            conversation_id=conversation.id,
            sender_type=sender_type,
            content=pm.content,
            message_type="text",
            status="delivered",
            whatsapp_message_id=marker,
            created_at=pm.created_at
        ))
        conversation.last_message_at = pm.created_at or datetime.datetime.utcnow()

    db.commit()

def is_inventory_request(message: str) -> bool:
    text = (message or "").strip().lower()
    triggers = [
        "que carros tenemos",
        "qué carros tenemos",
        "que autos tienen",
        "qué autos tienen",
        "que vehiculos tienen",
        "qué vehículos tienen",
        "carros disponibles",
        "autos disponibles",
        "vehiculos disponibles",
        "inventario"
    ]
    return any(t in text for t in triggers)

def build_inventory_response(db: Session, company_id: Optional[int]) -> str:
    query = db.query(models.Vehicle).filter(models.Vehicle.status == "available")
    if company_id:
        query = query.filter(models.Vehicle.company_id == company_id)
    vehicles = query.order_by(models.Vehicle.id.desc()).limit(5).all()

    if not vehicles:
        return (
            "En este momento no tengo vehículos disponibles para mostrarte en el chat. "
            "Puedes revisar el inventario completo aquí: https://autosqp.co/autos"
        )

    lines = ["Claro. Estos son 5 carros disponibles en este momento:"]
    for idx, v in enumerate(vehicles, start=1):
        price = f"{v.price:,}".replace(",", ".") if v.price is not None else "N/A"
        lines.append(f"{idx}. {v.make} {v.model or ''} {v.year} - COP {price}")
    lines.append("Puedes ver más opciones aquí: https://autosqp.co/autos")
    return "\n".join(lines)

def maybe_create_public_chat_lead(
    db: Session,
    session: models.PublicChatSession,
    extracted_data: Dict[str, Any]
) -> Optional[int]:
    if session.lead_id:
        return session.lead_id

    name = (extracted_data.get("name") or "").strip()
    first_name = name.split(" ")[0] if name else ""
    phone = normalize_phone(extracted_data.get("phone"))
    email = (extracted_data.get("email") or "").strip() or None
    interested_vehicle = (extracted_data.get("interested_vehicle") or "").strip()
    payment_type = (extracted_data.get("payment_type") or "").strip().lower()
    down_payment_amount = extracted_data.get("down_payment_amount")
    has_credit_report = extracted_data.get("has_credit_report")
    report_entity = (extracted_data.get("report_entity") or "").strip()
    has_payment_agreement = extracted_data.get("has_payment_agreement")
    occupation_type = (extracted_data.get("occupation_type") or "").strip()
    residence_city = (extracted_data.get("residence_city") or "").strip()
    monthly_income = extracted_data.get("monthly_income")
    is_ready = bool(extracted_data.get("is_ready_to_create_lead"))

    required_core = all([
        is_ready,
        name,
        first_name,
        phone,
        email,
        interested_vehicle,
        payment_type,
        down_payment_amount is not None,
        occupation_type,
        residence_city,
        monthly_income is not None
    ])
    if not required_core:
        return None

    if has_credit_report is True and not (report_entity and has_payment_agreement is not None):
        return None

    lookup_phones = phone_variants_for_lookup(phone)
    duplicate_window_days = int(os.getenv("PUBLIC_CHAT_DUPLICATE_WINDOW_DAYS", "30") or "30")
    recent_threshold = datetime.datetime.utcnow() - datetime.timedelta(days=duplicate_window_days)

    existing_lead = None
    if lookup_phones:
        existing_lead = db.query(models.Lead).filter(
            models.Lead.company_id == session.company_id,
            models.Lead.phone.in_(lookup_phones),
            models.Lead.created_at >= recent_threshold
        ).order_by(models.Lead.created_at.desc()).first()

    lead_message = (
        f"Interes detectado por chatbot web: {interested_vehicle} | "
        f"Pago: {payment_type} | Cuota inicial: {down_payment_amount} | "
        f"Ingresos: {monthly_income} | Ocupacion: {occupation_type} | "
        f"Residencia: {residence_city} | Reportado: {has_credit_report} | "
        f"Entidad reporte: {report_entity or 'N/A'} | Acuerdo/Paz y salvo: {has_payment_agreement}"
    )

    if existing_lead:
        existing_lead.name = first_name or existing_lead.name
        existing_lead.email = email or existing_lead.email
        existing_lead.message = lead_message
        upsert_lead_process_detail(db, existing_lead.id, interested_vehicle)
        session.lead_id = existing_lead.id
        db.commit()
        sync_public_chat_to_lead_conversation(db, session)
        return existing_lead.id

    assigned_user_id = None
    if session.company_id:
        auto_assigned_user = choose_auto_assign_user(db, session.company_id)
        if auto_assigned_user:
            assigned_user_id = auto_assigned_user.id

    new_lead = models.Lead(
        source=models.LeadSource.WEB.value,
        name=first_name,
        phone=phone,
        email=email,
        message=lead_message,
        status=models.LeadStatus.NEW.value,
        company_id=session.company_id,
        assigned_to_id=assigned_user_id
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    upsert_lead_process_detail(db, new_lead.id, interested_vehicle)
    session.lead_id = new_lead.id
    db.commit()
    sync_public_chat_to_lead_conversation(db, session)
    return new_lead.id

@app.post("/public-chat/session", response_model=schemas.PublicChatSession)
def create_public_chat_session(payload: schemas.PublicChatSessionCreate, db: Session = Depends(get_db)):
    company_id = get_public_company_id(db, payload.company_id)
    session_token = str(uuid.uuid4())
    session = models.PublicChatSession(
        session_token=session_token,
        company_id=company_id,
        source_page=payload.source_page or "/autos",
        status="active"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@app.post("/public-chat/config")
def get_public_chat_config(payload: schemas.PublicChatInactiveCheck, db: Session = Depends(get_db)):
    session = db.query(models.PublicChatSession).filter(
        models.PublicChatSession.session_token == payload.session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    bot_name, typing_min_ms, typing_max_ms = get_company_chatbot_settings(db, session.company_id)
    return {
        "bot_name": bot_name,
        "typing_min_ms": typing_min_ms,
        "typing_max_ms": typing_max_ms
    }

@app.get("/public-chat/{session_token}/messages", response_model=List[schemas.PublicChatMessageItem])
def get_public_chat_messages(session_token: str, db: Session = Depends(get_db)):
    session = db.query(models.PublicChatSession).filter(models.PublicChatSession.session_token == session_token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.asc()).all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]

@app.post("/public-chat/check-inactive")
def public_chat_check_inactive(payload: schemas.PublicChatInactiveCheck, db: Session = Depends(get_db)):
    """
    If assistant asked a question and user has not replied for 5+ minutes,
    send a follow-up check-in message once.
    """
    token = (payload.session_token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Session token is required")

    session = db.query(models.PublicChatSession).filter(models.PublicChatSession.session_token == token).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    last_message = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.desc()).first()

    if not last_message or last_message.role != "assistant":
        return {"nudged": False}

    assistant_text = (last_message.content or "").strip()
    asked_question = ("?" in assistant_text) or ("¿" in assistant_text)
    if not asked_question:
        return {"nudged": False}

    now_utc = datetime.datetime.utcnow()
    if (now_utc - last_message.created_at).total_seconds() < 300:
        return {"nudged": False}

    has_user_reply = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id,
        models.PublicChatMessage.role == "user",
        models.PublicChatMessage.created_at > last_message.created_at
    ).first()
    if has_user_reply:
        return {"nudged": False}

    existing_checkin = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id,
        models.PublicChatMessage.role == "assistant",
        models.PublicChatMessage.content == "¿Sigues en línea? Si quieres, te ayudo a continuar."
    ).order_by(models.PublicChatMessage.created_at.desc()).first()
    if existing_checkin and existing_checkin.created_at > last_message.created_at:
        return {"nudged": False}

    nudge_text = "¿Sigues en línea? Si quieres, te ayudo a continuar."
    db.add(models.PublicChatMessage(session_id=session.id, role="assistant", content=nudge_text))
    db.commit()
    return {"nudged": True, "message": nudge_text}

@app.post("/public-chat/message", response_model=schemas.PublicChatMessageResponse)
def public_chat_message(payload: schemas.PublicChatMessageCreate, db: Session = Depends(get_db)):
    user_message = (payload.message or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message is required")

    session = db.query(models.PublicChatSession).filter(
        models.PublicChatSession.session_token == payload.session_token
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if payload.source_page:
        session.source_page = payload.source_page

    api_key, model_name = get_company_ai_settings(db, session.company_id)
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key no configurada")
    env_fallback_key = (os.getenv("OPENAI_API_KEY") or "").strip() or None

    db.add(models.PublicChatMessage(session_id=session.id, role="user", content=user_message))
    db.commit()

    history = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.asc()).all()

    vehicle_hint = ""
    if payload.vehicle_id:
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == payload.vehicle_id).first()
        if vehicle:
            vehicle_hint = (
                f"Vehículo que está viendo el cliente: {vehicle.make} {vehicle.model} {vehicle.year}, "
                f"precio {vehicle.price} COP."
            )

    bot_name, _, _ = get_company_chatbot_settings(db, session.company_id)
    system_prompt = (
        f"Eres {bot_name}, asesora comercial de AutosQP en Colombia. "
        "Habla en tono amigable, cercano y comercial. "
        "En tu primera respuesta de cada sesion debes presentarte explicitamente como: "
        f"\"Hola, soy {bot_name}, asesora comercial de Autos QP\" y luego continuar con la asesoria. "
        "Si el cliente da nombre completo, dirigete solo por su primer nombre. "
        "Debes perfilar al cliente con preguntas claras, una por turno, en este orden: "
        "1) vehiculo de interes, 2) nombre, 3) telefono, 4) correo (OBLIGATORIO), "
        "5) pago de contado o con credito, 6) cuota inicial y monto, "
        "7) si tiene reportes en centrales de riesgo, "
        "8) si esta reportado: entidad y si tiene acuerdo de pago o paz y salvo, "
        "9) ocupacion (empleado, independiente u otro), "
        "10) lugar de residencia, 11) ingresos mensuales. "
        "No inventes informacion ni cierres perfilado hasta tener todo lo obligatorio. "
        f"{vehicle_hint}"
    )

    if is_inventory_request(user_message):
        assistant_reply = build_inventory_response(db, session.company_id)
    else:
        chat_messages = [{"role": "system", "content": system_prompt}]
        for msg in history[-20:]:
            if msg.role in ["user", "assistant"]:
                chat_messages.append({"role": msg.role, "content": msg.content})

        try:
            assistant_reply = call_openai_chat_with_fallback(api_key, model_name, chat_messages, env_fallback_key)
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 500
            if status_code == 401:
                raise HTTPException(status_code=400, detail="OpenAI API key inválida o expirada para el chatbot público")
            raise HTTPException(status_code=500, detail=f"Error consultando OpenAI: {str(exc)}")
    db.add(models.PublicChatMessage(session_id=session.id, role="assistant", content=assistant_reply))
    db.commit()

    full_text = "\n".join([f"{m.role}: {m.content}" for m in history[-30:]] + [f"assistant: {assistant_reply}"])
    lead_created = False
    lead_id = session.lead_id
    try:
        extraction_key = api_key
        if env_fallback_key and env_fallback_key.strip():
            extraction_key = env_fallback_key if api_key != env_fallback_key else api_key
        extracted = extract_prospect_data_with_ai(extraction_key, model_name, full_text)
        lead_id = maybe_create_public_chat_lead(db, session, extracted)
        lead_created = bool(lead_id and not session.lead_id is None)
    except Exception:
        # Extraction failure should not break chat response.
        lead_created = False

    # Keep lead conversation in sync after each turn once lead exists.
    if session.lead_id:
        sync_public_chat_to_lead_conversation(db, session)

    latest_messages = db.query(models.PublicChatMessage).filter(
        models.PublicChatMessage.session_id == session.id
    ).order_by(models.PublicChatMessage.created_at.asc()).all()

    return {
        "session_token": session.session_token,
        "reply": assistant_reply,
        "lead_created": bool(session.lead_id),
        "lead_id": session.lead_id,
        "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in latest_messages]
    }


# --- LEADS ENDPOINTS ---


# Remove duplicate read_leads


@app.post("/leads", response_model=schemas.Lead)
def create_lead(
    lead: schemas.LeadCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Assign to current user's company if not provided
    company_id = lead.company_id or current_user.company_id
    
    if not company_id:
        raise HTTPException(status_code=400, detail="Company ID required for assignment")
    
    # Exclude company_id because we pass it manually
    lead_data = lead.dict(exclude={'company_id'})
    supervisor_ids = normalize_supervisor_ids(getattr(lead, "supervisor_ids", []))
    if supervisor_ids and not is_company_admin(current_user):
        raise HTTPException(status_code=403, detail="Solo un administrador puede agregar o quitar supervisores de un lead.")
    
    # Manual Assignment by Aliado/Admin
    assigned_to_id = lead.assigned_to_id
    
    # Automatic Assignment Logic (Fallback if not manually assigned)
    if not assigned_to_id:
        if should_self_assign_manual_lead(current_user):
            assigned_to_id = current_user.id

        if not assigned_to_id:
            auto_assigned_user = choose_auto_assign_user(db, company_id)
            if auto_assigned_user:
                assigned_to_id = auto_assigned_user.id
    
    # Verify the manually assigned user belongs to the company
    elif assigned_to_id:
        target_user = db.query(models.User).join(models.Role, isouter=True).filter(models.User.id == assigned_to_id).first()
        if not target_user or target_user.company_id != company_id:
             raise HTTPException(status_code=400, detail="Invalid assigned user (not in company)")
        if not can_manually_assign_to_any_role(current_user) and not is_advisor_role(target_user.role):
             raise HTTPException(status_code=400, detail="Solo se pueden asignar leads a usuarios con rol asesor")

    lead_data["status"] = enforce_ally_managed_status(
        db=db,
        current_user=current_user,
        base_status=lead_data.get("status"),
        assigned_to_id=assigned_to_id
    )

    db_lead = models.Lead(
        **lead_data, 
        company_id=company_id, 
        assigned_to_id=assigned_to_id,
        created_by_id=current_user.id # Track who created it
    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)

    initial_history = models.LeadHistory(
        lead_id=db_lead.id,
        user_id=current_user.id,
        previous_status=None,
        new_status=db_lead.status,
        comment=(db_lead.message or "Lead creado manualmente")
    )
    db.add(initial_history)
    db.commit()
    db.refresh(db_lead)
    
    log_action_to_db(db, current_user.id, "CREATE", "Lead", db_lead.id, f"Lead creado: {db_lead.name} ({db_lead.email or db_lead.phone})")
    
    
    # Create Notification for assigned user
    if db_lead.assigned_to_id:
        target_user = db.query(models.User).join(models.Role, isouter=True).filter(models.User.id == db_lead.assigned_to_id).first()
        notification = models.Notification(
            user_id=db_lead.assigned_to_id,
            title="Nuevo Lead Asignado",
            message=f"Se te ha asignado un nuevo lead: {db_lead.name}. Continúa con la gestion.",
            type="info",
            link=build_lead_board_link(target_user, db_lead.id)
        )
        db.add(notification)
        db.commit()
        
    return db_lead


@app.delete("/leads/{lead_id}", status_code=200)
def delete_lead(
    lead_id: int,
    payload: schemas.LeadDeleteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Debes indicar el motivo de eliminación")

    lead = db.query(models.Lead).options(
        joinedload(models.Lead.assigned_to),
        joinedload(models.Lead.supervisors)
    ).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    ensure_can_modify_lead(current_user, lead)

    if lead.deleted_at:
        raise HTTPException(status_code=400, detail="El lead ya fue eliminado")

    lead.deleted_at = datetime.datetime.utcnow()
    lead.deleted_reason = reason
    lead.deleted_by_id = current_user.id

    db.add(models.LeadHistory(
        lead_id=lead.id,
        user_id=current_user.id,
        previous_status=lead.status,
        new_status=lead.status,
        comment=f"Lead eliminado del tablero. Motivo: {reason}"
    ))

    log_action_to_db(
        db,
        current_user.id,
        "DELETE",
        "Lead",
        lead.id,
        f"Lead ocultado de tableros. Motivo: {reason}"
    )

    db.commit()
    return {"message": "Lead eliminado correctamente"}

@app.put("/leads/{lead_id}", response_model=schemas.Lead)
def update_lead(
    lead_id: int, 
    lead_update: schemas.LeadUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    ensure_can_modify_lead(current_user, lead)
    if lead_update.supervisor_ids is not None:
        ensure_can_manage_lead_supervision(current_user, lead)

    previous_assigned_user = lead.assigned_to
    previous_role_name = get_user_role_name(previous_assigned_user)
    target_assigned_user = previous_assigned_user
    current_supervisor_ids = normalize_supervisor_ids(getattr(lead, "supervisor_ids", []))
    target_supervisor_ids = normalize_supervisor_ids(lead_update.supervisor_ids) if lead_update.supervisor_ids is not None else current_supervisor_ids

    if lead_update.assigned_to_id is not None:
        if lead_update.assigned_to_id:
            target_user = db.query(models.User).join(models.Role, isouter=True).filter(
                models.User.id == lead_update.assigned_to_id
            ).first()
            if not target_user or target_user.company_id != lead.company_id:
                raise HTTPException(status_code=400, detail="Invalid assigned user (not in company)")
            if not can_assign_lead_to_user(current_user, target_user):
                raise HTTPException(status_code=400, detail="Tu rol no tiene permitido reasignar leads a este rol")
            target_assigned_user = target_user
        else:
            target_assigned_user = None
    
    payload_update = lead_update.dict(exclude={'comment', 'process_detail', 'supervisor_ids'}, exclude_unset=True)
    target_assigned_to_id = payload_update.get('assigned_to_id', lead.assigned_to_id)
    target_status = payload_update.get('status', lead.status)
    target_assigned_to_id, target_supervisor_ids, credit_coordinator = maybe_assign_credit_coordinator(
        db=db,
        lead_company_id=lead.company_id,
        target_status=target_status,
        assigned_to_id=target_assigned_to_id,
        supervisor_ids=target_supervisor_ids
    )
    if credit_coordinator:
        target_assigned_user = credit_coordinator
        payload_update['assigned_to_id'] = target_assigned_to_id
    manual_assignment_requested = lead_update.assigned_to_id is not None
    if (manual_assignment_requested or credit_coordinator) and should_keep_assigner_as_supervisor(current_user.id, target_assigned_to_id):
        target_supervisor_ids = ensure_user_in_supervisors(target_supervisor_ids, current_user.id)
    target_role_name = get_user_role_name(target_assigned_user)
    board_transfer = should_reset_status_for_board_transfer(previous_role_name, target_role_name)
    effective_status = enforce_ally_managed_status(
        db=db,
        current_user=current_user,
        base_status=payload_update.get('status', lead.status),
        assigned_to_id=target_assigned_to_id
    )
    if board_transfer:
        effective_status = models.LeadStatus.NEW.value
    if payload_update.get('status') is not None or payload_update.get('assigned_to_id') is not None:
        payload_update['status'] = effective_status

    # Check for status change OR comment to log history
    # If status changes, or if there's a comment (even without status change), we log it.
    has_status_change = effective_status != lead.status
    auto_transfer_comment = None
    if board_transfer:
        auto_transfer_comment = (
            "Lead enviado al tablero de aliados"
            if target_role_name == "aliado"
            else "Lead devuelto al tablero general"
        )
    auto_credit_comment = None
    if credit_coordinator and credit_coordinator.id != getattr(previous_assigned_user, "id", None):
        auto_credit_comment = f"Lead asignado automaticamente a coordinacion de credito: {credit_coordinator.full_name or credit_coordinator.email}"
    history_comment = lead_update.comment.strip() if lead_update.comment and lead_update.comment.strip() else (auto_credit_comment or auto_transfer_comment)
    has_comment = bool(history_comment)
    process_detail_data = lead_update.process_detail
    previous_process_detail = db.query(models.LeadProcessDetail).filter(models.LeadProcessDetail.lead_id == lead.id).first()
    previous_vehicle_id = previous_process_detail.vehicle_id if previous_process_detail else None
    validate_interested_process_detail(effective_status, process_detail_data, previous_process_detail)

    if has_status_change or has_comment:
        if has_status_change:
            lead.status_updated_at = datetime.datetime.utcnow()
            
        new_history = models.LeadHistory(
            lead_id=lead.id,
            user_id=current_user.id,
            previous_status=lead.status,
            new_status=effective_status,
            comment=history_comment
        )
        db.add(new_history)
        
    allowed_lead_update_fields = {
        "name",
        "email",
        "phone",
        "status",
        "message",
        "assigned_to_id",
    }
    for field, value in payload_update.items():
        if field not in allowed_lead_update_fields:
            continue
        setattr(lead, field, value)

    sync_lead_supervisors(db, lead, target_supervisor_ids, current_user.id)
        
    # Handle Process Detail Upsert
    if process_detail_data:
        existing_detail = db.query(models.LeadProcessDetail).filter(models.LeadProcessDetail.lead_id == lead.id).first()
        if existing_detail:
            for k, v in process_detail_data.dict().items():
                setattr(existing_detail, k, v)
        else:
            new_detail = models.LeadProcessDetail(
                lead_id=lead.id,
                **process_detail_data.dict()
            )
            db.add(new_detail)

        sync_vehicle_reservation_for_lead(
            db=db,
            lead_id=lead.id,
            previous_vehicle_id=previous_vehicle_id,
            next_vehicle_id=process_detail_data.vehicle_id if process_detail_data.has_vehicle else None
        )

    # Auto-create/update credit request queue when lead enters credit stage
    upsert_credit_application_from_lead(db, lead, lead_update.comment)

    # Auto-create/update purchase request queue for role "compras"
    upsert_purchase_request_from_lead(db, lead)
        
    db.commit()
    db.refresh(lead)

    if target_assigned_to_id and target_assigned_to_id != getattr(previous_assigned_user, "id", None):
        notification = models.Notification(
            user_id=target_assigned_to_id,
            title="Lead Reasignado" if not credit_coordinator else "Lead de crédito asignado",
            message=(
                f"Se te ha asignado el lead: {lead.name}. Continua con la gestion."
                if not credit_coordinator
                else f"Se te ha asignado el lead en solicitud de crédito: {lead.name}"
            ),
            type="info",
            link=build_lead_board_link(target_assigned_user, lead.id)
        )
        db.add(notification)
        db.commit()
        db.refresh(lead)
    
    log_action_to_db(db, current_user.id, "UPDATE", "Lead", lead.id, f"Lead modificado: {lead.name} a estado {lead.status}")
    
    return lead

# --- LEAD NOTES AND FILES ENDPOINTS ---

@app.post("/leads/{lead_id}/notes", response_model=schemas.LeadNote)
def create_lead_note(
    lead_id: int, 
    note: schemas.LeadNoteCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    ensure_can_modify_lead(current_user, lead)
        
    db_note = models.LeadNote(
        lead_id=lead_id,
        user_id=current_user.id,
        content=note.content
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    
    log_action_to_db(db, current_user.id, "CREATE", "LeadNote", db_note.id, f"Nota agregada al lead {lead.name}")
    
    return db_note

@app.get("/leads/{lead_id}/notes", response_model=List[schemas.LeadNote])
def get_lead_notes(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return db.query(models.LeadNote).options(
        joinedload(models.LeadNote.user)
    ).filter(
        models.LeadNote.lead_id == lead_id
    ).order_by(models.LeadNote.created_at.desc()).all()

@app.post("/leads/{lead_id}/files", response_model=schemas.LeadFile)
async def upload_lead_file(
    lead_id: int, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    import os
    import uuid
    import shutil
    
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    ensure_can_modify_lead(current_user, lead)
        
    os.makedirs("static/leads", exist_ok=True)
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = f"static/leads/{unique_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    db_file = models.LeadFile(
        lead_id=lead_id,
        user_id=current_user.id,
        file_name=file.filename,
        file_path=f"/{file_path}",
        file_type=file.content_type
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    log_action_to_db(db, current_user.id, "CREATE", "LeadFile", db_file.id, f"Archivo adjuntado al lead {lead.name}")
    
    return db_file

@app.get("/leads/{lead_id}/files", response_model=List[schemas.LeadFile])
def get_lead_files(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return db.query(models.LeadFile).options(
        joinedload(models.LeadFile.user)
    ).filter(
        models.LeadFile.lead_id == lead_id
    ).order_by(models.LeadFile.created_at.desc()).all()

@app.delete("/leads/{lead_id}/files/{file_id}")
def delete_lead_file(
    lead_id: int,
    file_id: int,
    payload: schemas.LeadFileDeleteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    ensure_can_modify_lead(current_user, lead)

    reason = (payload.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Deletion reason is required")

    lead_file = db.query(models.LeadFile).filter(
        models.LeadFile.id == file_id,
        models.LeadFile.lead_id == lead_id
    ).first()
    if not lead_file:
        raise HTTPException(status_code=404, detail="Lead file not found")

    stored_path = (lead_file.file_path or "").lstrip("/")
    if stored_path and os.path.exists(stored_path):
        try:
            os.remove(stored_path)
        except OSError:
            pass

    history_entry = models.LeadHistory(
        lead_id=lead.id,
        user_id=current_user.id,
        previous_status=lead.status,
        new_status=lead.status,
        comment=f"Documento eliminado: {lead_file.file_name}. Motivo: {reason}"
    )
    db.add(history_entry)

    db_note = models.LeadNote(
        lead_id=lead.id,
        user_id=current_user.id,
        content=f"Se eliminó el documento '{lead_file.file_name}'. Motivo: {reason}"
    )
    db.add(db_note)

    file_name = lead_file.file_name
    db.delete(lead_file)
    db.commit()

    log_action_to_db(
        db,
        current_user.id,
        "DELETE",
        "LeadFile",
        file_id,
        f"Archivo {file_name} eliminado del lead {lead.name}. Motivo: {reason}"
    )

    return {"message": "Lead file deleted successfully"}

@app.get("/leads/{lead_id}/messages")
def get_lead_messages(
    lead_id: int, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # Retrieve the lead first to check company scope
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    if current_user.company_id and lead.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if lead.has_unread_reply:
        lead.has_unread_reply = 0
        db.commit()
        
    # Get the conversation directly linked to this lead.
    conversation = db.query(models.Conversation).filter(models.Conversation.lead_id == lead_id).first()
    if not conversation and lead.source in {"facebook", "instagram", "whatsapp"} and lead.phone:
        channel_session = db.query(models.ChannelChatSession).filter(
            models.ChannelChatSession.company_id == lead.company_id,
            models.ChannelChatSession.source == lead.source,
            models.ChannelChatSession.external_user_id == lead.phone,
            models.ChannelChatSession.conversation_id.isnot(None),
        ).first()
        if channel_session and channel_session.conversation_id:
            conversation = db.query(models.Conversation).filter(
                models.Conversation.id == channel_session.conversation_id
            ).first()
            if conversation and conversation.lead_id != lead.id:
                conversation.lead_id = lead.id
                if channel_session.lead_id != lead.id:
                    channel_session.lead_id = lead.id
                db.commit()
    if not conversation:
        return [] # No messages yet
        
    # Get messages associated with this conversation
    messages = db.query(models.Message).filter(
        models.Message.conversation_id == conversation.id
    ).order_by(models.Message.created_at.desc()).all()
    
    return messages

@app.post("/webhooks/leads/{source}")
def receive_webhook_lead(
    source: str, 
    data: dict
):
    """
    Mock endpoint to receive leads from external sources (Webhooks).
    Payload expected: { "name": "...", "phone": "...", "message": "..." }
    In a real scenario, you'd map Facebook/WhatsApp payloads here.
    """
    # Simple mapping for demonstration
    name = data.get("name", "Unknown Lead")
    phone = data.get("phone") or data.get("from") # FB often uses 'from'
    email = data.get("email")
    message = data.get("message") or data.get("text")
    
    # Default to first company found if no ID logic (For demo purposes)
    # In prod, you'd map the webhook token/ID to a specific company
    company = db.query(models.Company).first()
    company_id = company.id if company else None

    # Create Lead
    new_lead = models.Lead(
        name=name,
        phone=phone,
        email=email,
        message=message,
        source=source, # facebook, whatsapp, etc
        company_id=company_id,
        status="new"
    )
    db.add(new_lead)
    db.commit()
    return {"status": "received", "lead_id": new_lead.id}

# --- VEHICLES ENDPOINTS ---

@app.get("/vehicles/makes")
def get_public_makes(db: Session = Depends(get_db)):
    # Returns distinct makes from available vehicles
    makes = db.query(models.Vehicle.make).filter(models.Vehicle.status == 'available').distinct().all()
    return [m[0] for m in makes if m[0]]

@app.get("/vehicles/public")
def get_public_vehicles(
    q: Optional[str] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    year_from: Optional[int] = None,
    year_to: Optional[int] = None,
    price_min: Optional[int] = None,
    price_max: Optional[int] = None,
    mileage_min: Optional[int] = None,
    mileage_max: Optional[int] = None,
    color: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(models.Vehicle).filter(models.Vehicle.status == 'available')
    
    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Vehicle.make.ilike(search)) |
            (models.Vehicle.model.ilike(search)) |
            (models.Vehicle.plate.ilike(search))
        )
    if make:
        query = query.filter(models.Vehicle.make.ilike(f"%{make}%"))
    if model:
        query = query.filter(models.Vehicle.model.ilike(f"%{model}%"))
    if color:
        query = query.filter(models.Vehicle.color.ilike(f"%{color}%"))
    if year_from is not None:
        query = query.filter(models.Vehicle.year >= year_from)
    if year_to is not None:
        query = query.filter(models.Vehicle.year <= year_to)
    if price_min is not None:
        query = query.filter(models.Vehicle.price >= price_min)
    if price_max is not None:
        query = query.filter(models.Vehicle.price <= price_max)
    if mileage_min is not None:
        query = query.filter(models.Vehicle.mileage >= mileage_min)
    if mileage_max is not None:
        query = query.filter(models.Vehicle.mileage <= mileage_max)
        
    vehicles = query.order_by(models.Vehicle.id.desc()).limit(limit).all()
    # Serialize to dict to match expected frontend structure if needed, or rely on FastAPI's response_model
    return vehicles

@app.get("/vehicles/", response_model=schemas.VehicleList)
def read_vehicles(
    q: str = None,
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Vehicle)
    
    # Filter by Company
    if current_user.company_id:
        query = query.filter(models.Vehicle.company_id == current_user.company_id)
    query = query.filter(models.Vehicle.status != "inactive")
        
    if q:
        search = f"%{q}%"
        query = query.filter(
            (models.Vehicle.make.ilike(search)) |
            (models.Vehicle.model.ilike(search)) |
            (models.Vehicle.plate.ilike(search))
        )

    effective_status = status if is_inventory_editor(current_user) else "available"
    if effective_status:
        query = query.filter(models.Vehicle.status == effective_status)
        
    total = query.count()
    vehicles = query.order_by(models.Vehicle.id.desc()).offset(skip).limit(limit).all()
    return {"items": vehicles, "total": total}

@app.post("/vehicles/", response_model=schemas.Vehicle)
def create_vehicle(
    vehicle: schemas.VehicleCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_inventory_editor(current_user)

    if current_user.company_id and vehicle.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Cannot create vehicle for another company")
        
    # Default to user's company if not provided and user has one
    if not vehicle.company_id and current_user.company_id:
        vehicle.company_id = current_user.company_id

    upsert_brand_model(db, vehicle.make, vehicle.model)
        
    db_vehicle = models.Vehicle(**vehicle.dict())
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@app.put("/vehicles/{vehicle_id}", response_model=schemas.Vehicle)
def update_vehicle(
    vehicle_id: int, 
    vehicle_update: schemas.VehicleUpdate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_inventory_editor(current_user)

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle or vehicle.status == "inactive":
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if current_user.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if status is changing to 'sold'
    if vehicle_update.status == 'sold' and vehicle.status != 'sold':
        # Create a Sale record automatically to track who sold it
        # Check if sale already exists
        existing_sale = db.query(models.Sale).filter(models.Sale.vehicle_id == vehicle.id).first()
        if not existing_sale:
            new_sale = models.Sale(
                vehicle_id=vehicle.id,
                seller_id=current_user.id,
                company_id=current_user.company_id,
                sale_price=vehicle.price, # Default to listing price
                status=models.SaleStatus.APPROVED,
                commission_percentage=current_user.commission_percentage or 0,
                commission_amount=int(vehicle.price * (current_user.commission_percentage or 0) / 100),
                net_revenue=vehicle.price - int(vehicle.price * (current_user.commission_percentage or 0) / 100),
                sale_date=datetime.datetime.utcnow()
            )
            db.add(new_sale)
            # db.commit() will happen below
        
    for field, value in vehicle_update.dict(exclude_unset=True).items():
        setattr(vehicle, field, value)

    target_make = vehicle_update.make if vehicle_update.make is not None else vehicle.make
    target_model = vehicle_update.model if vehicle_update.model is not None else vehicle.model
    upsert_brand_model(db, target_make, target_model)
        
    db.commit()
    db.refresh(vehicle)
    return vehicle

@app.delete("/vehicles/{vehicle_id}", response_model=dict)
def delete_vehicle(
    vehicle_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    ensure_inventory_admin_only(current_user)

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not vehicle or vehicle.status == "inactive":
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if current_user.company_id and vehicle.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    vehicle.status = "inactive"
    db.commit()
    return {"status": "success", "message": "Vehicle deactivated"}

# --- SALES & COMMISSION ENDPOINTS ---

@app.post("/sales/", response_model=schemas.Sale)
def create_sale(
    sale: schemas.SaleCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # 1. Verify Vehicle
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == sale.vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    if vehicle.status == "sold":
        raise HTTPException(status_code=400, detail="Vehicle is already sold")
    
    # 2. Get Seller 
    # Logic: Admin can assign a specific seller (e.g. the lead's owner). Default is current user.
    seller = current_user
    
    # Check if admin is overriding seller
    if sale.seller_id:
        # Verify permissions: Only Admin/SuperAdmin can override seller
        if current_user.role.name in ["admin", "super_admin"]:
             target_seller = db.query(models.User).filter(models.User.id == sale.seller_id).first()
             if target_seller:
                 # Verify company match
                 if current_user.company_id and target_seller.company_id != current_user.company_id:
                     raise HTTPException(status_code=400, detail="Target seller is in different company")
                 seller = target_seller
             else:
                 raise HTTPException(status_code=404, detail="Target seller not found")
        else:
             # Regular user tried to override - ignore or error? 
             # Let's ignore it to be safe and enforce 'me', or raise error
             pass 
    
    # 3. Calculate Commission
    # Snapshot at time of creation, though approval locks it
    commission_pct = seller.commission_percentage or 0.0
    commission_amount = (sale.sale_price * commission_pct) / 100
    net_revenue = sale.sale_price - commission_amount
    
    # 4. Create Sale Record
    new_sale = models.Sale(
        vehicle_id=sale.vehicle_id,
        lead_id=sale.lead_id,
        seller_id=seller.id,
        company_id=seller.company_id,
        sale_price=sale.sale_price,
        commission_percentage=commission_pct,
        commission_amount=commission_amount,
        net_revenue=net_revenue,
        status="pending"
    )
    
    db.add(new_sale)
    
    # 5. Lock Vehicle (Reserve it until approved)
    vehicle.status = "reserved"
    
    # 6. Update Lead Status if provided
    if sale.lead_id:
        lead = db.query(models.Lead).filter(models.Lead.id == sale.lead_id).first()
        if lead:
            lead.status = "sold"  # Mark as sold on frontend triggers this, so sync it back
            
    db.commit()
    db.refresh(new_sale)
    return new_sale

@app.get("/sales/", response_model=schemas.SaleList)
def read_sales(
    status: str = None, # Optional status
    month: int = None,
    year: int = None,
    q: str = None, # Search query
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Sale).options(
        joinedload(models.Sale.vehicle),
        joinedload(models.Sale.lead),
        joinedload(models.Sale.seller)
    )
    
    # Permission Logic
    if current_user.role.name in ["admin", "super_admin"]:
        # Admin sees all company sales
        if current_user.company_id:
            query = query.filter(models.Sale.company_id == current_user.company_id)
    else:
        # Advisors/Others sees only THEIR sales
        query = query.filter(models.Sale.seller_id == current_user.id)
        
    # Filters
    if status:
        query = query.filter(models.Sale.status == status)
        
    if month and year:
        # Filter by specific month/year
        # Note: SQLite/Postgres specific might vary, using Generic extract or range
        # Easier to construct a date range for the month
        import calendar
        _, last_day = calendar.monthrange(year, month)
        start_date = datetime.datetime(year, month, 1)
        end_date = datetime.datetime(year, month, last_day, 23, 59, 59)
        query = query.filter(models.Sale.sale_date >= start_date, models.Sale.sale_date <= end_date)
        
    if q:
        search = f"%{q}%"
        query = query.join(models.Vehicle).filter(
            (models.Vehicle.make.ilike(search)) |
            (models.Vehicle.model.ilike(search)) |
            (models.Vehicle.plate.ilike(search))
        )
        
    total = query.count()
    sales = query.order_by(models.Sale.sale_date.desc()).offset(skip).limit(limit).all()
    return {"items": sales, "total": total}

@app.put("/sales/{sale_id}/approve", response_model=schemas.Sale)
def approve_sale(
    sale_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Only Admin or Super Admin
    if current_user.role.name not in ["admin", "super_admin"]:
         raise HTTPException(status_code=403, detail="Only admins can approve sales")
         
    sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
        
    if sale.status == "approved":
        raise HTTPException(status_code=400, detail="Sale already approved")
        
    # Finalize
    sale.status = "approved"
    sale.approved_by_id = current_user.id
    sale.sale_date = datetime.datetime.utcnow()
    
    # Mark Vehicle as Sold
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == sale.vehicle_id).first()
    if vehicle:
        vehicle.status = "sold"
        
    db.commit()
    db.refresh(sale)
    return sale


@app.put("/sales/{sale_id}/reject", response_model=schemas.Sale)
def reject_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role.name not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admins can reject sales")

    sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale.status == models.SaleStatus.REJECTED.value:
        raise HTTPException(status_code=400, detail="Sale already rejected")
    if sale.status == models.SaleStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Approved sales cannot be rejected")

    sale.status = models.SaleStatus.REJECTED.value
    sale.approved_by_id = current_user.id

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == sale.vehicle_id).first()
    if vehicle and vehicle.status != models.VehicleStatus.SOLD.value:
        vehicle.status = models.VehicleStatus.AVAILABLE.value

    db.commit()
    db.refresh(sale)
    return sale

@app.get("/finance/stats")
def get_finance_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Only Admin/Super Admin
    if get_user_role_name(current_user) not in ["admin", "super_admin"]:
         raise HTTPException(status_code=403, detail="Not authorized")
         
    # 1. Total Stats (All time)
    query = db.query(models.Sale).filter(models.Sale.status == "approved")
    if current_user.company_id:
        query = query.filter(models.Sale.company_id == current_user.company_id)
    sales = query.all()
    
    total_revenue = sum(s.net_revenue for s in sales)
    total_commissions = sum(s.commission_amount for s in sales)
    total_sales_count = len(sales)
    
    # 2. Pending Count
    pending_query = db.query(models.Sale).filter(models.Sale.status == "pending")
    if current_user.company_id:
        pending_query = pending_query.filter(models.Sale.company_id == current_user.company_id)
    pending_count = pending_query.count()

    # 3. Monthly Stats (Current Month)
    now = datetime.datetime.utcnow()
    current_month_sales = [s for s in sales if s.sale_date and s.sale_date.month == now.month and s.sale_date.year == now.year]
    
    monthly_revenue = sum(s.net_revenue for s in current_month_sales)
    monthly_commissions = sum(s.commission_amount for s in current_month_sales)

    # 4. Payroll Expenses (Sum of base_salary of all users)
    # Filter by company if needed
    user_query = db.query(models.User)
    if current_user.company_id:
        user_query = user_query.filter(models.User.company_id == current_user.company_id)
    
    users = user_query.all()
    payroll_expenses = sum(u.base_salary or 0 for u in users)

    receipts_query = db.query(models.PaymentReceipt)
    if current_user.company_id:
        receipts_query = receipts_query.filter(models.PaymentReceipt.company_id == current_user.company_id)
    receipts = receipts_query.all()
    current_month_receipts = [
        receipt for receipt in receipts
        if receipt.payment_date and receipt.payment_date.month == now.month and receipt.payment_date.year == now.year
    ]
    total_income = sum((receipt.amount or 0) for receipt in receipts if (receipt.movement_type or "income") == "income")
    total_expense = sum((receipt.amount or 0) for receipt in receipts if (receipt.movement_type or "income") == "expense")
    monthly_income = sum((receipt.amount or 0) for receipt in current_month_receipts if (receipt.movement_type or "income") == "income")
    monthly_expense = sum((receipt.amount or 0) for receipt in current_month_receipts if (receipt.movement_type or "income") == "expense")
    
    return {
        "total_revenue": total_revenue,
        "total_commissions": total_commissions,
        "total_sales_count": total_sales_count,
        "pending_sales_count": pending_count,
        "monthly_revenue": monthly_revenue, 
        "monthly_commissions": monthly_commissions,
        "payroll_expenses": payroll_expenses,
        "receipts_total_count": len(receipts),
        "receipts_total_amount": sum(receipt.amount or 0 for receipt in receipts),
        "receipts_monthly_amount": sum(receipt.amount or 0 for receipt in current_month_receipts),
        "accounting_income_total": total_income,
        "accounting_expense_total": total_expense,
        "accounting_balance_total": total_income - total_expense,
        "accounting_income_monthly": monthly_income,
        "accounting_expense_monthly": monthly_expense,
        "accounting_balance_monthly": monthly_income - monthly_expense
    }


@app.get("/finance/receipts", response_model=schemas.PaymentReceiptList)
def read_payment_receipts(
    sale_id: Optional[int] = None,
    category: Optional[str] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if get_user_role_name(current_user) not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = db.query(models.PaymentReceipt).options(
        joinedload(models.PaymentReceipt.sale).joinedload(models.Sale.vehicle),
        joinedload(models.PaymentReceipt.sale).joinedload(models.Sale.seller),
        joinedload(models.PaymentReceipt.user)
    )
    if current_user.company_id:
        query = query.filter(models.PaymentReceipt.company_id == current_user.company_id)
    if sale_id:
        query = query.filter(models.PaymentReceipt.sale_id == sale_id)
    if category:
        query = query.filter(models.PaymentReceipt.category == category)
    if q:
        search = f"%{q}%"
        query = query.join(models.Sale, models.PaymentReceipt.sale_id == models.Sale.id, isouter=True).join(
            models.Vehicle, models.Sale.vehicle_id == models.Vehicle.id, isouter=True
        ).filter(
            or_(
                models.PaymentReceipt.concept.ilike(search),
                models.PaymentReceipt.receipt_number.ilike(search),
                models.PaymentReceipt.notes.ilike(search),
                models.Vehicle.make.ilike(search),
                models.Vehicle.model.ilike(search),
                models.Vehicle.plate.ilike(search)
            )
        )

    total = query.count()
    items = query.order_by(models.PaymentReceipt.payment_date.desc(), models.PaymentReceipt.id.desc()).offset(skip).limit(limit).all()
    return {"items": items, "total": total}


def _get_receipt_with_access(
    db: Session,
    receipt_id: int,
    current_user: models.User
) -> models.PaymentReceipt:
    receipt = db.query(models.PaymentReceipt).options(
        joinedload(models.PaymentReceipt.sale).joinedload(models.Sale.vehicle),
        joinedload(models.PaymentReceipt.sale).joinedload(models.Sale.seller),
        joinedload(models.PaymentReceipt.user)
    ).filter(models.PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if current_user.company_id and receipt.company_id != current_user.company_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return receipt


@app.post("/finance/receipts", response_model=schemas.PaymentReceipt)
async def create_payment_receipt(
    request: Request,
    sale_id: Optional[int] = Form(None),
    concept: Optional[str] = Form(None),
    amount: int = Form(...),
    movement_type: Optional[str] = Form("income"),
    payment_date: Optional[str] = Form(None),
    receipt_number: Optional[str] = Form(None),
    category: Optional[str] = Form("sale_payment"),
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if get_user_role_name(current_user) not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    concept_value = (concept or "").strip() or None
    movement_type_value = (movement_type or "income").strip().lower()
    if movement_type_value not in {"income", "expense"}:
        raise HTTPException(status_code=400, detail="movement_type must be income or expense")
    sale = None
    company_id = current_user.company_id
    if sale_id:
        sale = db.query(models.Sale).options(
            joinedload(models.Sale.vehicle),
            joinedload(models.Sale.seller)
        ).filter(models.Sale.id == sale_id).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
        if current_user.company_id and sale.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        company_id = sale.company_id
    elif not concept_value:
        raise HTTPException(status_code=400, detail="Debes indicar una venta o un concepto contable")

    parsed_payment_date = datetime.datetime.utcnow()
    if payment_date:
        payment_date = payment_date.strip()
        try:
            if len(payment_date) == 10:
                parsed_payment_date = datetime.datetime.strptime(payment_date, "%Y-%m-%d")
            else:
                parsed_payment_date = datetime.datetime.fromisoformat(payment_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payment date")

    stored_file_name = None
    stored_file_path = None
    stored_file_type = None
    if file and file.filename:
        os.makedirs("static/accounting", exist_ok=True)
        safe_name = os.path.basename(file.filename)
        extension = safe_name.split(".")[-1] if "." in safe_name else "bin"
        unique_filename = f"{uuid.uuid4()}.{extension}"
        file_path = f"static/accounting/{unique_filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        stored_file_name = safe_name
        stored_file_path = f"/{file_path.replace('\\', '/')}"
        stored_file_type = file.content_type

    receipt = models.PaymentReceipt(
        company_id=company_id,
        sale_id=sale.id if sale else None,
        user_id=current_user.id,
        concept=concept_value,
        movement_type=movement_type_value,
        receipt_number=(receipt_number or "").strip() or None,
        payment_date=parsed_payment_date,
        amount=amount,
        category=(category or "sale_payment").strip() or "sale_payment",
        notes=(notes or "").strip() or None,
        file_name=stored_file_name,
        file_path=stored_file_path,
        file_type=stored_file_type
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return db.query(models.PaymentReceipt).options(
        joinedload(models.PaymentReceipt.sale).joinedload(models.Sale.vehicle),
        joinedload(models.PaymentReceipt.sale).joinedload(models.Sale.seller),
        joinedload(models.PaymentReceipt.user)
    ).filter(models.PaymentReceipt.id == receipt.id).first()


@app.get("/finance/receipts/{receipt_id}/pdf")
def download_payment_receipt_pdf(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if get_user_role_name(current_user) not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    receipt = _get_receipt_with_access(db, receipt_id, current_user)

    try:
        from reportlab.lib.colors import HexColor
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError:
        raise HTTPException(status_code=500, detail="La libreria reportlab no esta instalada en el servidor")

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    y = height - 60
    pdf.setTitle(f"recibo_{receipt.id}.pdf")
    pdf.setFillColor(HexColor("#0f172a"))
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(50, y, "Recibo de Contabilidad")
    y -= 24

    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(HexColor("#475569"))
    pdf.drawString(50, y, f"Generado: {datetime.datetime.utcnow().strftime('%d/%m/%Y %H:%M')}")
    y -= 36

    lines = [
        ("ID de recibo", str(receipt.id)),
        ("Numero de recibo", receipt.receipt_number or "Sin consecutivo"),
        ("Fecha de pago", receipt.payment_date.strftime("%d/%m/%Y") if receipt.payment_date else "Sin fecha"),
        ("Categoria", (receipt.category or "sale_payment").replace("_", " ")),
        ("Tipo", "Ingreso" if (receipt.movement_type or "income") == "income" else "Egreso"),
        ("Concepto", receipt.concept or "Sin concepto"),
        ("Valor", f"COP ${int(receipt.amount or 0):,}".replace(",", ".")),
        ("Registrado por", getattr(receipt.user, "full_name", None) or getattr(receipt.user, "email", "") or "Usuario"),
    ]

    if receipt.sale:
        vehicle_label = " ".join(filter(None, [
            getattr(receipt.sale.vehicle, "make", None),
            getattr(receipt.sale.vehicle, "model", None),
            getattr(receipt.sale.vehicle, "plate", None)
        ])).strip()
        lines.extend([
            ("Venta asociada", f"#{receipt.sale.id}"),
            ("Vehiculo", vehicle_label or "Sin vehiculo"),
            ("Vendedor", getattr(receipt.sale.seller, "full_name", None) or getattr(receipt.sale.seller, "email", "") or "Sin vendedor")
        ])
    else:
        lines.append(("Venta asociada", "No"))

    pdf.setFont("Helvetica", 12)
    pdf.setFillColor(HexColor("#111827"))
    for label, value in lines:
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(50, y, f"{label}:")
        pdf.setFont("Helvetica", 11)
        pdf.drawString(190, y, str(value))
        y -= 22

    if receipt.notes:
        y -= 8
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(50, y, "Notas:")
        y -= 18
        pdf.setFont("Helvetica", 10)
        text_object = pdf.beginText(50, y)
        for paragraph in str(receipt.notes).splitlines() or [""]:
            safe_line = paragraph[:120]
            text_object.textLine(safe_line)
        pdf.drawText(text_object)

    pdf.showPage()
    pdf.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="recibo_{receipt.id}.pdf"'}
    )


@app.delete("/finance/receipts/{receipt_id}")
def delete_payment_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if get_user_role_name(current_user) not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Solo un administrador puede eliminar recibos")

    receipt = _get_receipt_with_access(db, receipt_id, current_user)
    if receipt.file_path:
        try:
            relative_path = receipt.file_path.lstrip("/").replace("/", os.sep)
            absolute_path = os.path.abspath(relative_path)
            if os.path.exists(absolute_path):
                os.remove(absolute_path)
        except Exception:
            pass

    db.delete(receipt)
    db.commit()
    return {"message": "Recibo eliminado correctamente"}

# --- INTERNAL CHAT ENDPOINTS ---

@app.get("/internal-messages", response_model=List[schemas.InternalMessage])
def get_internal_messages(
    date: str = Query(None), # YYYY-MM-DD
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Filter by company
    query = db.query(models.InternalMessage).filter(models.InternalMessage.company_id == current_user.company_id)
    
    # Filter Permissions: 
    # Show message IF:
    # 1. recipient_id is NULL (Broadcast)
    # 2. recipient_id == current_user.id (Received DM)
    # 3. sender_id == current_user.id (Sent DM)
    from sqlalchemy import or_
    query = query.filter(
        or_(
            models.InternalMessage.recipient_id == None,
            models.InternalMessage.recipient_id == current_user.id,
            models.InternalMessage.sender_id == current_user.id
        )
    )
    
    if date:
        try:
            date_obj = datetime.datetime.strptime(date, "%Y-%m-%d").date()
            # Filter by date range (start of day to end of day)
            start_of_day = datetime.datetime.combine(date_obj, datetime.time.min)
            end_of_day = datetime.datetime.combine(date_obj, datetime.time.max)
            query = query.filter(models.InternalMessage.created_at >= start_of_day, models.InternalMessage.created_at <= end_of_day)
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        # Default to today
        today = datetime.datetime.utcnow().date()
        start_of_day = datetime.datetime.combine(today, datetime.time.min)
        query = query.filter(models.InternalMessage.created_at >= start_of_day)
        
    return query.order_by(models.InternalMessage.created_at.asc()).all()

@app.post("/internal-messages", response_model=schemas.InternalMessage)
def create_internal_message(
    message: schemas.InternalMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Verify recipient strictly if provided
    recipient_id = message.recipient_id
    if recipient_id:
        recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        if recipient.company_id != current_user.company_id:
             raise HTTPException(status_code=403, detail="Cannot message users from other companies")

    db_message = models.InternalMessage(
        content=message.content,
        company_id=current_user.company_id,
        sender_id=current_user.id,
        recipient_id=recipient_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

@app.post("/internal-messages/upload", response_model=schemas.InternalMessage)
async def upload_internal_message_file(
    request: Request,
    file: UploadFile = File(...),
    recipient_id: Optional[int] = Form(None),
    content: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if recipient_id:
        recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient not found")
        if recipient.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Cannot message users from other companies")

    os.makedirs("static/internal_chat", exist_ok=True)

    safe_name = os.path.basename(file.filename or "archivo")
    ext = safe_name.split(".")[-1] if "." in safe_name else "bin"
    unique_name = f"{uuid.uuid4()}.{ext}"
    rel_path = f"static/internal_chat/{unique_name}"

    with open(rel_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    rel_path_web = rel_path.replace("\\", "/")
    relative_url = f"/api/{rel_path_web}"
    file_url = f"{str(request.base_url).rstrip('/')}{relative_url}"
    payload = {
        "type": "file",
        "file_name": safe_name,
        "storage_name": unique_name,
        "file_url": file_url,
        "file_url_relative": relative_url,
        "file_path": rel_path_web,
        "file_type": file.content_type or "application/octet-stream",
        "file_size": os.path.getsize(rel_path),
        "text": content.strip() if content else ""
    }

    db_message = models.InternalMessage(
        content=f"__FILE__{json.dumps(payload, ensure_ascii=False)}",
        company_id=current_user.company_id,
        sender_id=current_user.id,
        recipient_id=recipient_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


