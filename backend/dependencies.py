from fastapi import Depends, HTTPException, status, Request, Query
from fastapi.security import OAuth2PasswordBearer
from typing import Optional
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models, auth_utils

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def _verify_token_and_get_user(token: str, db: Session):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).options(
        joinedload(models.User.role),
        joinedload(models.User.company)
    ).filter(models.User.id == user_id).first()
    
    if user is None:
        raise credentials_exception
    if not getattr(user, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inhabilitado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    return await _verify_token_and_get_user(token, db)

async def get_user_from_anywhere(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return await _verify_token_and_get_user(token, db)


def get_effective_role_name(user: models.User | None) -> str:
    if not user or not user.role:
        return ""
    raw_names = {
        getattr(user.role, "base_role_name", None) or "",
        getattr(user.role, "name", None) or "",
        getattr(user.role, "label", None) or "",
    }
    normalized_names = {str(name).strip().lower() for name in raw_names if str(name).strip()}

    if any("super" in name and ("admin" in name or "administrador" in name) for name in normalized_names):
        return "super_admin"
    if any("admin" in name or "administrador" in name for name in normalized_names):
        return "admin"

    return getattr(user.role, "base_role_name", None) or getattr(user.role, "name", None) or ""


def is_company_admin(user: models.User | None) -> bool:
    return get_effective_role_name(user) in {"admin", "super_admin"}


def get_lead_supervisor_ids(lead: models.Lead | None) -> set[int]:
    if not lead:
        return set()

    raw_ids = getattr(lead, "supervisor_ids", None)
    if raw_ids:
        normalized_ids = set()
        for raw_id in raw_ids:
            try:
                normalized_ids.add(int(raw_id))
            except (TypeError, ValueError):
                continue
        if normalized_ids:
            return normalized_ids

    return {
        int(user.id)
        for user in getattr(lead, "supervisors", []) or []
        if user and getattr(user, "id", None) is not None
    }


def ensure_can_modify_lead(current_user: models.User, lead: models.Lead):
    if is_company_admin(current_user):
        return

    supervisor_ids = get_lead_supervisor_ids(lead)
    is_supervisor_only = current_user.id in supervisor_ids and lead.assigned_to_id != current_user.id
    if is_supervisor_only:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Los supervisores solo pueden ver el lead. Solo un administrador puede modificarlo."
        )


def ensure_can_manage_lead_supervision(current_user: models.User, lead: models.Lead):
    if is_company_admin(current_user):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Solo un administrador puede agregar o quitar supervisores de un lead."
    )
