import argparse
import html
import re
from typing import Any, Dict, List, Optional, Tuple

import requests

import models
from database import SessionLocal


WP_LISTINGS_URL = "https://autosqp.co/web/wp-json/wp/v2/listings"


def first_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, list):
        if not value:
            return None
        value = value[0]
    text = str(value).strip()
    return text or None


def parse_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value)
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else default


def extract_photos(item: Dict[str, Any]) -> List[str]:
    photos = item.get("listivo_145") or []
    if isinstance(photos, str):
        photos = [photos]
    if not isinstance(photos, list):
        return []
    cleaned = []
    for photo in photos:
        url = str(photo).strip()
        if url.startswith("http://") or url.startswith("https://"):
            cleaned.append(url)
    return cleaned


def fetch_all_listings(per_page: int) -> List[Dict[str, Any]]:
    all_items: List[Dict[str, Any]] = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        resp = requests.get(
            WP_LISTINGS_URL,
            params={"per_page": per_page, "page": page},
            timeout=30,
        )
        resp.raise_for_status()
        items = resp.json() or []
        if not isinstance(items, list):
            raise RuntimeError("Respuesta inesperada del endpoint de WP.")
        all_items.extend(items)
        total_pages = int(resp.headers.get("X-WP-TotalPages", "1"))
        page += 1

    return all_items


def map_wp_listing(item: Dict[str, Any]) -> Dict[str, Any]:
    wp_id = item.get("id")
    title_raw = ((item.get("title") or {}).get("rendered") or "").strip()
    title = html.unescape(title_raw)

    make = first_text(item.get("listivo_945")) or ""
    model = first_text(item.get("listivo_946")) or title
    year = parse_int(item.get("listivo_4316"), default=0)
    mileage = parse_int(item.get("listivo_4686"), default=0)
    price = parse_int(item.get("listivo_130"), default=0)
    fuel_type = first_text(item.get("listivo_5667"))
    transmission = first_text(item.get("listivo_5666"))
    color = first_text(item.get("listivo_5674"))
    photos = extract_photos(item)
    location = first_text((item.get("listivo_153") or {}).get("address"))
    description = html.unescape(((item.get("content") or {}).get("rendered") or "").strip())
    source_link = (item.get("link") or "").strip()

    if source_link:
        source_note = f"Importado desde WP: {source_link}"
        description = f"{description}\n\n{source_note}".strip() if description else source_note

    fallback_plate = f"WP{wp_id}" if wp_id is not None else "WP000000"
    if len(fallback_plate) > 20:
        fallback_plate = fallback_plate[:20]

    return {
        "wp_id": wp_id,
        "internal_code": f"WP-{wp_id}",
        "make": make[:100] if make else "Sin marca",
        "model": (model or "Sin modelo")[:100],
        "year": year,
        "price": price,
        "mileage": mileage,
        "color": (color or "")[:50] or None,
        "fuel_type": (fuel_type or "")[:50] or None,
        "transmission": (transmission or "")[:50] or None,
        "engine": None,
        "plate": fallback_plate,
        "location": (location or "")[:100] or None,
        "description": description[:500] if description else None,
        "status": "available",
        "photos": photos,
    }


def choose_company_id(db, company_id_arg: Optional[int]) -> int:
    if company_id_arg:
        return company_id_arg
    company = db.query(models.Company).order_by(models.Company.id.asc()).first()
    if not company:
        raise RuntimeError("No hay empresas en la base de datos.")
    return int(company.id)


def upsert_vehicles(
    db,
    mapped_items: List[Dict[str, Any]],
    company_id: int,
    apply_changes: bool,
) -> Tuple[int, int, int]:
    created = 0
    updated = 0
    skipped = 0

    for data in mapped_items:
        existing = (
            db.query(models.Vehicle)
            .filter(
                models.Vehicle.company_id == company_id,
                models.Vehicle.internal_code == data["internal_code"],
            )
            .first()
        )

        if existing is None:
            created += 1
            if apply_changes:
                vehicle = models.Vehicle(
                    make=data["make"],
                    model=data["model"],
                    year=data["year"],
                    price=data["price"],
                    plate=data["plate"],
                    mileage=data["mileage"],
                    color=data["color"],
                    fuel_type=data["fuel_type"],
                    transmission=data["transmission"],
                    engine=data["engine"],
                    internal_code=data["internal_code"],
                    location=data["location"],
                    description=data["description"],
                    status=data["status"],
                    photos=data["photos"],
                    company_id=company_id,
                )
                db.add(vehicle)
            continue

        changed = False
        for field in [
            "make",
            "model",
            "year",
            "price",
            "plate",
            "mileage",
            "color",
            "fuel_type",
            "transmission",
            "location",
            "description",
            "status",
            "photos",
        ]:
            old_val = getattr(existing, field)
            new_val = data[field]
            if old_val != new_val:
                changed = True
                if apply_changes:
                    setattr(existing, field, new_val)

        if changed:
            updated += 1
        else:
            skipped += 1

    if apply_changes:
        db.commit()
    else:
        db.rollback()

    return created, updated, skipped


def main():
    parser = argparse.ArgumentParser(description="Importación única de catálogo WordPress a AutosQP")
    parser.add_argument("--company-id", type=int, default=None, help="ID de empresa destino en AutosQP")
    parser.add_argument("--per-page", type=int, default=100, help="Tamaño de página al leer WP")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplica cambios en BD. Si no se usa, corre en modo dry-run.",
    )
    args = parser.parse_args()

    print("Consultando catálogo WP...")
    listings = fetch_all_listings(per_page=args.per_page)
    print(f"Registros encontrados en WP: {len(listings)}")

    mapped_items = [map_wp_listing(item) for item in listings]

    db = SessionLocal()
    try:
        company_id = choose_company_id(db, args.company_id)
        print(f"Empresa destino: {company_id}")

        created, updated, skipped = upsert_vehicles(
            db=db,
            mapped_items=mapped_items,
            company_id=company_id,
            apply_changes=args.apply,
        )

        mode = "APPLY" if args.apply else "DRY-RUN"
        print(f"\nResultado [{mode}]")
        print(f"- Creados: {created}")
        print(f"- Actualizados: {updated}")
        print(f"- Sin cambios: {skipped}")
        print(f"- Total procesados: {len(mapped_items)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
