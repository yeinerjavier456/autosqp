import random
import unicodedata
from typing import List, Optional

from sqlalchemy.orm import Session

import models


def normalize_role_text(value: Optional[str]) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", str(value))
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return normalized.strip().lower().replace("-", "_").replace(" ", "_")


def is_active_user(user: Optional[models.User]) -> bool:
    if not user:
        return False
    return bool(getattr(user, "is_active", 1))


def is_advisor_role(role: Optional[models.Role]) -> bool:
    if not role:
        return False

    role_names = {
        normalize_role_text(getattr(role, "name", None)),
        normalize_role_text(getattr(role, "base_role_name", None)),
        normalize_role_text(getattr(role, "label", None)),
    }
    role_names.discard("")

    return bool(role_names & {"asesor", "vendedor", "asesor_vendedor"})


def can_user_receive_auto_assigned_leads(user: Optional[models.User]) -> bool:
    if not user or not is_active_user(user):
        return False

    role = getattr(user, "role", None)
    if not is_advisor_role(role):
        return False

    return bool(
        getattr(user, "auto_assign_leads", False)
        or getattr(role, "auto_assign_leads", False)
    )


def get_auto_assign_candidate_users(db: Session, company_id: Optional[int]) -> List[models.User]:
    if not company_id:
        return []

    users = db.query(models.User).join(models.Role, isouter=True).filter(
        models.User.company_id == company_id
    ).all()

    enabled_users = [user for user in users if can_user_receive_auto_assigned_leads(user)]
    if enabled_users:
        return enabled_users

    # If no advisor has the flag configured yet, do not leave new leads orphaned.
    return [
        user
        for user in users
        if is_active_user(user) and is_advisor_role(getattr(user, "role", None))
    ]


def choose_auto_assign_user(db: Session, company_id: Optional[int]) -> Optional[models.User]:
    candidates = get_auto_assign_candidate_users(db, company_id)
    if not candidates:
        return None
    return random.choice(candidates)
