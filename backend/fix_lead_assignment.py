import argparse
import datetime
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session, joinedload

import models
from database import SessionLocal


RECOVERABLE_ROLE_NAMES = {"asesor", "compras", "coordinador_creditos", "aliado"}


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
        "ã¡": "a",
        "ã©": "e",
        "ã­": "i",
        "ã³": "o",
        "ãº": "u",
        "_": " ",
        "-": " ",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return " ".join(normalized.split())


def get_user_role_name(user: Optional[models.User]) -> Optional[str]:
    if not user or not getattr(user, "role", None):
        return None

    role_names = {
        normalize_role_text(getattr(user.role, "base_role_name", None)),
        normalize_role_text(getattr(user.role, "name", None)),
        normalize_role_text(getattr(user.role, "label", None)),
    }
    role_names.discard("")

    if (
        "super admin" in role_names
        or "super administrador" in role_names
        or any("super" in role_name and "admin" in role_name for role_name in role_names)
        or any("super" in role_name and "administrador" in role_name for role_name in role_names)
    ):
        return "super_admin"
    if (
        "admin" in role_names
        or "administrador" in role_names
        or "administrador de empresa" in role_names
        or any("admin" in role_name for role_name in role_names)
        or any("administrador" in role_name for role_name in role_names)
    ):
        return "admin"
    if "aliado" in role_names or "aliado estrategico" in role_names:
        return "aliado"
    if "asesor" in role_names or "vendedor" in role_names or "asesor vendedor" in role_names:
        return "asesor"
    if any("coordinador" in role_name and "credit" in role_name for role_name in role_names):
        return "coordinador_creditos"
    if any("compra" in role_name for role_name in role_names) or any("buyer" in role_name for role_name in role_names):
        return "compras"
    if "user" in role_names or "usuario" in role_names:
        return "user"
    return next(iter(role_names), None)


def is_active_user(user: Optional[models.User]) -> bool:
    if not user:
        return False
    return bool(getattr(user, "is_active", 1))


def is_valid_lead_assignee(user: Optional[models.User], company_id: Optional[int] = None) -> bool:
    if not user or not is_active_user(user):
        return False
    if company_id and getattr(user, "company_id", None) != company_id:
        return False

    role_name = get_user_role_name(user)
    return bool(role_name and role_name != "user")


def is_recoverable_lead_owner(user: Optional[models.User], company_id: Optional[int] = None) -> bool:
    if not is_valid_lead_assignee(user, company_id):
        return False
    return get_user_role_name(user) in RECOVERABLE_ROLE_NAMES


def get_history_owner_candidates(db: Session, lead_id: int, company_id: int) -> list[models.User]:
    return (
        db.query(models.User)
        .join(models.LeadHistory, models.LeadHistory.user_id == models.User.id)
        .options(joinedload(models.User.role))
        .filter(
            models.LeadHistory.lead_id == lead_id,
            models.User.company_id == company_id,
        )
        .order_by(models.LeadHistory.created_at.desc(), models.LeadHistory.id.desc())
        .all()
    )


def find_fallback_lead_assignee(db: Session, lead: models.Lead) -> Optional[models.User]:
    created_by_user = getattr(lead, "created_by", None)
    if created_by_user and is_recoverable_lead_owner(created_by_user, lead.company_id):
        return created_by_user

    if getattr(lead, "created_by_id", None) and created_by_user is None:
        created_by_user = (
            db.query(models.User)
            .options(joinedload(models.User.role))
            .filter(models.User.id == lead.created_by_id)
            .first()
        )
        if created_by_user and is_recoverable_lead_owner(created_by_user, lead.company_id):
            return created_by_user

    seen_ids = {getattr(created_by_user, "id", None)}
    for history_user in get_history_owner_candidates(db, lead.id, lead.company_id):
        history_user_id = getattr(history_user, "id", None)
        if history_user_id in seen_ids:
            continue
        if is_recoverable_lead_owner(history_user, lead.company_id):
            return history_user

    return None


def get_valid_supervisor_ids(lead: models.Lead) -> list[int]:
    valid_ids: list[int] = []
    for supervisor in (getattr(lead, "supervisors", None) or []):
        if is_valid_lead_assignee(supervisor, getattr(lead, "company_id", None)):
            valid_ids.append(supervisor.id)
    return valid_ids


def set_supervisors(db: Session, lead: models.Lead, supervisor_ids: list[int]) -> None:
    current_links = {link.user_id: link for link in (lead.supervisor_links or [])}
    target_ids = set(supervisor_ids)

    for existing_user_id, link in list(current_links.items()):
        if existing_user_id not in target_ids:
            db.delete(link)

    for user_id in supervisor_ids:
        if user_id not in current_links:
            db.add(
                models.LeadSupervisor(
                    lead_id=lead.id,
                    user_id=user_id,
                    assigned_by_id=None,
                )
            )


def add_sanitization_history(
    db: Session,
    lead: models.Lead,
    previous_assignee_name: str,
    new_assignee_name: str,
) -> None:
    db.add(
        models.LeadHistory(
            lead_id=lead.id,
            user_id=None,
            previous_status=lead.status,
            new_status=lead.status,
            comment=(
                f"Saneamiento automático de asignación: responsable inválido "
                f"'{previous_assignee_name}' corregido a '{new_assignee_name}'."
            ),
            created_at=datetime.datetime.utcnow(),
        )
    )


@dataclass
class LeadFixResult:
    lead_id: int
    lead_name: str
    company_id: int
    previous_assignee: str
    previous_assignee_id: Optional[int]
    new_assignee: Optional[str]
    new_assignee_id: Optional[int]
    cleaned_supervisors: bool
    reason: str


def format_user(user: Optional[models.User], fallback_id: Optional[int] = None) -> str:
    if user:
        role_name = get_user_role_name(user) or "sin rol"
        return f"{user.full_name or user.email or f'Usuario {user.id}'} [{role_name}]"
    if fallback_id:
        return f"ID {fallback_id} sin relación válida"
    return "Sin asignar"


def build_query(db: Session, args: argparse.Namespace):
    query = (
        db.query(models.Lead)
        .options(
            joinedload(models.Lead.assigned_to).joinedload(models.User.role),
            joinedload(models.Lead.created_by).joinedload(models.User.role),
            joinedload(models.Lead.supervisors).joinedload(models.User.role),
            joinedload(models.Lead.supervisor_links),
        )
        .order_by(models.Lead.id.asc())
    )

    if not args.include_deleted:
        query = query.filter(models.Lead.deleted_at.is_(None))
    if args.company_id:
        query = query.filter(models.Lead.company_id == args.company_id)
    if args.lead_id:
        query = query.filter(models.Lead.id == args.lead_id)
    if args.only_status:
        query = query.filter(models.Lead.status == args.only_status.strip())

    return query.limit(args.limit) if args.limit else query


def should_fix_lead(lead: models.Lead, include_unassigned: bool) -> bool:
    if getattr(lead, "assigned_to_id", None):
        return not is_valid_lead_assignee(getattr(lead, "assigned_to", None), lead.company_id)
    return include_unassigned


def process_lead(db: Session, lead: models.Lead, args: argparse.Namespace) -> Optional[LeadFixResult]:
    if not should_fix_lead(lead, args.include_unassigned):
        return None

    previous_user = getattr(lead, "assigned_to", None)
    previous_assignee_id = getattr(lead, "assigned_to_id", None)
    previous_assignee_name = format_user(previous_user, getattr(lead, "assigned_to_id", None))
    fallback_user = find_fallback_lead_assignee(db, lead)
    valid_supervisor_ids = get_valid_supervisor_ids(lead)
    current_supervisor_ids = [link.user_id for link in (lead.supervisor_links or [])]
    cleaned_supervisors = sorted(valid_supervisor_ids) != sorted(current_supervisor_ids)

    if not fallback_user and not cleaned_supervisors:
        return LeadFixResult(
            lead_id=lead.id,
            lead_name=lead.name,
            company_id=lead.company_id,
            previous_assignee=previous_assignee_name,
            previous_assignee_id=getattr(lead, "assigned_to_id", None),
            new_assignee=None,
            new_assignee_id=None,
            cleaned_supervisors=False,
            reason="Sin candidato recuperable; se deja para revisión manual.",
        )

    new_assignee_name = format_user(fallback_user)
    if args.apply:
        lead.assigned_to_id = fallback_user.id if fallback_user else None
        if cleaned_supervisors:
            set_supervisors(db, lead, valid_supervisor_ids)
        assignment_changed = previous_assignee_id != (fallback_user.id if fallback_user else None)
        if assignment_changed:
            add_sanitization_history(
                db,
                lead,
                previous_assignee_name,
                new_assignee_name if fallback_user else "Sin asignar",
            )

    reason_parts = []
    if fallback_user:
        reason_parts.append("Responsable recuperado desde creador/historial")
    else:
        reason_parts.append("Sin responsable recuperable")
    if cleaned_supervisors:
        reason_parts.append("supervisores inválidos limpiados")

    return LeadFixResult(
        lead_id=lead.id,
        lead_name=lead.name,
        company_id=lead.company_id,
        previous_assignee=previous_assignee_name,
        previous_assignee_id=getattr(lead, "assigned_to_id", None),
        new_assignee=new_assignee_name if fallback_user else None,
        new_assignee_id=fallback_user.id if fallback_user else None,
        cleaned_supervisors=cleaned_supervisors,
        reason=". ".join(reason_parts) + ".",
    )


def print_result(result: LeadFixResult) -> None:
    print(
        f"Lead #{result.lead_id} | Empresa {result.company_id} | {result.lead_name}\n"
        f"  Antes: {result.previous_assignee}\n"
        f"  Despues: {result.new_assignee or 'Sin cambio'}\n"
        f"  Supervisores limpiados: {'si' if result.cleaned_supervisors else 'no'}\n"
        f"  Motivo: {result.reason}\n"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sanea leads con responsable inválido usando creador o historial reciente."
    )
    parser.add_argument("--apply", action="store_true", help="Aplica los cambios en la base de datos.")
    parser.add_argument("--company-id", type=int, help="Procesa solo una empresa.")
    parser.add_argument("--lead-id", type=int, help="Procesa un lead específico.")
    parser.add_argument("--only-status", type=str, help="Procesa solo leads en un estado.")
    parser.add_argument("--limit", type=int, default=0, help="Máximo de leads a revisar. 0 = sin límite.")
    parser.add_argument(
        "--include-unassigned",
        action="store_true",
        help="Incluye leads sin assigned_to_id para intentar recuperarles responsable.",
    )
    parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Incluye leads eliminados lógicamente.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    db = SessionLocal()
    scanned = 0
    proposed = 0
    applied = 0
    manual_review = 0

    try:
        leads = build_query(db, args).all()
        for lead in leads:
            scanned += 1
            result = process_lead(db, lead, args)
            if not result:
                continue

            proposed += 1
            if result.new_assignee_id is None and not result.cleaned_supervisors:
                manual_review += 1
            else:
                applied += 1 if args.apply else 0
            print_result(result)

        if args.apply:
            db.commit()
        else:
            db.rollback()

        print("Resumen")
        print(f"  Leads revisados: {scanned}")
        print(f"  Leads detectados para saneamiento: {proposed}")
        print(f"  Leads con revisión manual pendiente: {manual_review}")
        if args.apply:
            print(f"  Leads saneados aplicados: {applied}")
        else:
            print("  Modo: simulación (sin cambios en base de datos)")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Error ejecutando saneamiento: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
