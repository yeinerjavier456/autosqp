"""Delete only descendants of a lead, never referenced company/user/account/vehicle parents."""
from pathlib import Path
from urllib.parse import unquote, urlparse

from sqlalchemy import select, delete, and_, cast, String


def purge_lead_records(db, metadata, lead_id):
    paths = set()
    visited = set()
    counts = {}
    file_columns = {'file_path', 'business_sheet_url', 'attachments', 'photos', 'media_url'}

    def collect_paths(value):
        if isinstance(value, str):
            paths.add(value)
        elif isinstance(value, dict):
            for item in value.values():
                collect_paths(item)
        elif isinstance(value, list):
            for item in value:
                collect_paths(item)

    def remove_rows(table, predicate):
        rows = db.execute(select(table).where(predicate).with_for_update()).mappings().all()
        for row in rows:
            key = (table.name, tuple(row[column.name] for column in table.primary_key.columns))
            if key in visited:
                continue
            visited.add(key)
            for column in table.columns:
                if column.name in file_columns:
                    collect_paths(row[column.name])
            # Follow foreign keys pointing TO this row, not parents referenced BY it.
            for child in metadata.tables.values():
                for constraint in child.foreign_key_constraints:
                    elements = list(constraint.elements)
                    if elements and all(element.column.table is table for element in elements):
                        remove_rows(child, and_(*[
                            child.c[element.parent.name] == row[element.column.name]
                            for element in elements
                        ]))
            db.execute(delete(table).where(and_(*[
                column == row[column.name] for column in table.primary_key.columns
            ])))
            counts[table.name] = counts.get(table.name, 0) + 1

    remove_rows(metadata.tables['leads'], metadata.tables['leads'].c.id == lead_id)
    return paths, counts


def remove_unreferenced_lead_files(db, metadata, paths, static_root):
    """After commit, remove local static files only if no database row still references them."""
    root = Path(static_root).resolve()
    failures = []
    for raw in paths:
        parsed = urlparse(raw)
        # Never fetch remote files or resolve arbitrary server paths.
        if parsed.scheme or parsed.netloc:
            continue
        path = unquote(parsed.path).replace('\\', '/')
        for prefix in ('/api/static/', '/static/', 'static/'):
            if path.startswith(prefix):
                path = path[len(prefix):]
                break
        else:
            continue
        target = (root / path).resolve()
        if root not in target.parents or not target.is_file():
            continue
        filename = target.name
        referenced = False
        for table in metadata.tables.values():
            for column in table.columns:
                if column.name in {'file_path', 'business_sheet_url', 'attachments', 'photos', 'media_url', 'form_payload'}:
                    if db.execute(select(column).where(cast(column, String).contains(filename)).limit(1)).first():
                        referenced = True
                        break
            if referenced:
                break
        if not referenced:
            try:
                target.unlink()
            except OSError:
                failures.append(str(target.relative_to(root)))
    return failures
