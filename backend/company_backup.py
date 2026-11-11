"""Tenant-scoped, versioned database + local-file archives.

No SQL dump is executed and no global restore or recursive directory replacement
is used. Foreign references and primary-key collisions are checked before writes.
"""
import contextlib
import datetime as dt
import decimal
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import uuid
import zipfile
from urllib.parse import urlsplit

from sqlalchemy import select, delete, and_, or_, DateTime, Date, Numeric, LargeBinary, cast, String

ID_PATTERN = re.compile(r'^\d{8}T\d{6}-[a-f0-9]{8}$')
FILE_FIELDS = {'file_path', 'business_sheet_url', 'attachments', 'photos', 'media_url', 'form_payload', 'logo_url'}
EXCLUDED_TABLES = {'companies', 'company_backup_jobs'}


def root_dir():
    return Path(os.getenv('AUTOSQP_COMPANY_BACKUP_ROOT', '/var/lib/autosqp-company-backups')).resolve()


def tenant_dir(company_id):
    directory = root_dir() / str(int(company_id))
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    return directory


@contextlib.contextmanager
def tenant_lock(company_id):
    import fcntl
    with (tenant_dir(company_id) / '.lock').open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Ya hay una copia o restauración en curso para esta empresa')
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def key(table, row):
    return tuple(row[column.name] for column in table.primary_key.columns)


def scope_rows(db, metadata, company_id):
    """Company-owned rows plus children of those rows, never referenced parents."""
    selected = {}
    for table in metadata.sorted_tables:
        if table.name in EXCLUDED_TABLES or 'company_id' not in table.c:
            continue
        rows = db.execute(select(table).where(table.c.company_id == company_id)).mappings().all()
        selected[table.name] = {key(table, row): dict(row) for row in rows}
    changed = True
    while changed:
        changed = False
        for table in metadata.sorted_tables:
            if table.name in EXCLUDED_TABLES or 'company_id' in table.c:
                continue
            predicates = []
            for fk in table.foreign_keys:
                parents = selected.get(fk.column.table.name, {})
                values = {row[fk.column.name] for row in parents.values()}
                if values:
                    predicates.append(table.c[fk.parent.name].in_(values))
            if not predicates:
                continue
            target = selected.setdefault(table.name, {})
            for row in db.execute(select(table).where(or_(*predicates))).mappings():
                row_key = key(table, row)
                if row_key not in target:
                    target[row_key] = dict(row)
                    changed = True
    return {name: list(rows.values()) for name, rows in selected.items()}


def _file_paths(value):
    if isinstance(value, str):
        if value.startswith(('https://', 'http://')):
            value = urlsplit(value).path
        for prefix in ('/api/static/', '/static/', 'static/'):
            if value.startswith(prefix):
                yield value[len(prefix):].split('?', 1)[0]
                break
    elif isinstance(value, dict):
        for item in value.values():
            yield from _file_paths(item)
    elif isinstance(value, list):
        for item in value:
            yield from _file_paths(item)


def local_file(root, relative):
    target = (root / relative).resolve()
    if root not in target.parents:
        raise ValueError('Ruta de archivo fuera del directorio permitido')
    return target


def _encode(value):
    if isinstance(value, (dt.datetime, dt.date, decimal.Decimal)):
        return str(value)
    if isinstance(value, bytes):
        import base64
        return {'binary': base64.b64encode(value).decode('ascii')}
    raise TypeError(type(value).__name__)


def decode_rows(table, rows):
    result = []
    for row in rows:
        item = dict(row)
        for column in table.columns:
            value = item.get(column.name)
            if value is None:
                continue
            if isinstance(column.type, DateTime):
                item[column.name] = dt.datetime.fromisoformat(value)
            elif isinstance(column.type, Date):
                item[column.name] = dt.date.fromisoformat(value)
            elif isinstance(column.type, Numeric):
                item[column.name] = decimal.Decimal(str(value))
            elif isinstance(column.type, LargeBinary):
                import base64
                item[column.name] = base64.b64decode(value['binary'])
        result.append(item)
    return result


def schema_signature(metadata):
    structure = {table.name: [(col.name, str(col.type)) for col in table.columns] for table in metadata.sorted_tables if table.name != 'company_backup_jobs'}
    return hashlib.sha256(json.dumps(structure, sort_keys=True).encode()).hexdigest()


def create_archive(db, metadata, company_id, static_root, reason='daily', job_id=None):
    directory = tenant_dir(company_id)
    backup_id = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S-') + uuid.uuid4().hex[:8]
    rows = scope_rows(db, metadata, company_id)
    # Validate ownership before even making an archive available for download.
    validate_ownership(db, metadata, company_id, rows)
    root = Path(static_root).resolve()
    references = set()
    for table_rows in rows.values():
        for row in table_rows:
            for field, value in row.items():
                if field in FILE_FIELDS:
                    references.update(_file_paths(value))
    data = json.dumps({'format': 1, 'company_id': company_id, 'schema': schema_signature(metadata), 'tables': rows}, default=_encode, ensure_ascii=False).encode()
    required_space = len(data)
    for relative in references:
        candidate = local_file(root, relative)
        if candidate.is_file():
            required_space += candidate.stat().st_size
    if shutil.disk_usage(directory).free < required_space + 2 * 1024 ** 3:
        raise ValueError('No hay espacio suficiente para la copia y el margen de seguridad de 2 GB')
    hashes = {'data.json': hashlib.sha256(data).hexdigest()}
    file_bytes = 0
    missing_files = []
    temp = directory / f'.{backup_id}.tmp'
    destination = directory / f'{backup_id}.zip'
    try:
        with zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED, compresslevel=3) as archive:
            archive.writestr('data.json', data)
            for relative in sorted(references):
                path = local_file(root, relative)
                if not path.is_file():
                    missing_files.append(relative)
                    continue
                entry = f'files/{relative}'
                digest = hashlib.sha256()
                with path.open('rb') as source, archive.open(entry, 'w', force_zip64=True) as output:
                    while block := source.read(1024 * 1024):
                        digest.update(block)
                        file_bytes += len(block)
                        output.write(block)
                hashes[entry] = digest.hexdigest()
            archive.writestr('checksums.json', json.dumps(hashes))
        manifest = dict(id=backup_id, company_id=company_id, created_at=dt.datetime.now(dt.timezone.utc).isoformat(),
            job_id=job_id,
            reason=reason, database_bytes=len(data), static_bytes=file_bytes, static_files=len(hashes) - 1,
            total_bytes=temp.stat().st_size, verified=not missing_files, missing_files=len(missing_files),
            rows=sum(len(items) for items in rows.values()))
        os.replace(temp, destination)
        temp_manifest = directory / f'.{backup_id}.json.tmp'
        temp_manifest.write_text(json.dumps(manifest), encoding='utf-8')
        os.replace(temp_manifest, directory / f'{backup_id}.json')
        return manifest
    finally:
        temp.unlink(missing_ok=True)


def validate_ownership(db, metadata, company_id, rows):
    for name, items in rows.items():
        table = metadata.tables[name]
        for row in items:
            if name in EXCLUDED_TABLES or ('company_id' in row and row['company_id'] != company_id):
                raise ValueError('La copia contiene información fuera de esta empresa')
            for fk in table.foreign_keys:
                parent = fk.column.table
                value = row.get(fk.parent.name)
                if value is None:
                    continue
                if parent.name == 'companies' and value != company_id:
                    raise ValueError('Referencia a otra empresa')
                if 'company_id' in parent.c:
                    owner = db.execute(select(parent.c.company_id).where(parent.c[fk.column.name] == value)).first()
                    if owner and owner[0] not in (None, company_id):
                        raise ValueError(f'La empresa tiene referencias cruzadas en {name}; requiere revisión antes de respaldar/restaurar')


def catalog(company_id):
    items = []
    for path in tenant_dir(company_id).glob('*.json'):
        if not ID_PATTERN.fullmatch(path.stem):
            continue
        item = json.loads(path.read_text(encoding='utf-8'))
        if item.get('company_id') == company_id and path.with_suffix('.zip').is_file():
            items.append(item)
    return {'items': sorted(items, key=lambda item: item['id'], reverse=True), 'retention_days': 7, 'available': True}


def archive_path(company_id, backup_id):
    if not ID_PATTERN.fullmatch(backup_id):
        raise ValueError('Identificador de copia inválido')
    path = tenant_dir(company_id) / f'{backup_id}.zip'
    if not path.is_file():
        raise ValueError('La copia no existe para esta empresa')
    return path


def restore_archive(db, metadata, company_id, backup_id, static_root):
    path = archive_path(company_id, backup_id)
    root = Path(static_root).resolve()
    with tempfile.TemporaryDirectory(prefix='.restore-', dir=tenant_dir(company_id)) as stage_name, zipfile.ZipFile(path) as archive:
        if shutil.disk_usage(path.parent).free < sum(info.file_size for info in archive.infolist()) * 3 + 2 * 1024 ** 3:
            raise ValueError('No hay espacio suficiente para restaurar con copia preventiva y archivos temporales')
        stage = Path(stage_name)
        hashes = json.loads(archive.read('checksums.json'))
        for name, expected in hashes.items():
            digest = hashlib.sha256()
            if name != 'data.json' and not name.startswith('files/'):
                raise ValueError('Contenido de copia inválido')
            target = local_file(stage, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(name) as source, target.open('wb') as output:
                while block := source.read(1024 * 1024):
                    digest.update(block)
                    output.write(block)
            if digest.hexdigest() != expected:
                raise ValueError('La verificación de integridad de la copia falló')
        payload = json.loads((stage / 'data.json').read_text(encoding='utf-8'))
        if payload.get('company_id') != company_id or payload.get('format') != 1:
            raise ValueError('Esta copia no pertenece a la empresa seleccionada')
        if payload.get('schema') != schema_signature(metadata):
            raise ValueError('La estructura de la aplicación cambió. Esta copia requiere una migración antes de restaurarla')
        rows = {name: decode_rows(metadata.tables[name], items) for name, items in payload['tables'].items()}
        current = scope_rows(db, metadata, company_id)
        validate_ownership(db, metadata, company_id, rows)
        # Never delete records referenced by another tenant or overwrite its IDs.
        for name, items in current.items():
            table = metadata.tables[name]
            for row in items:
                for child in metadata.tables.values():
                    current_keys = {key(child, item) for item in current.get(child.name, [])}
                    for fk in child.foreign_keys:
                        if fk.column.table is table:
                            for referenced in db.execute(select(child).where(child.c[fk.parent.name] == row[fk.column.name])).mappings():
                                if key(child, referenced) not in current_keys:
                                    raise ValueError(f'Hay registros externos relacionados ({child.name}); restauración bloqueada para no afectar a otra empresa')
        for name, items in rows.items():
            table = metadata.tables[name]
            owned_keys = {key(table, row) for row in current.get(name, [])}
            for row in items:
                existing = db.execute(select(table).where(and_(*[col == row[col.name] for col in table.primary_key.columns]))).first()
                if existing and key(table, row) not in owned_keys:
                    raise ValueError('Un identificador ya pertenece a otra empresa; no se puede restaurar automáticamente')
        # Mandatory rescue copy before any replacement.
        preventive = create_archive(db, metadata, company_id, root, reason='pre-restore')
        installed = []
        try:
            for table in reversed(metadata.sorted_tables):
                for row in current.get(table.name, []):
                    db.execute(delete(table).where(and_(*[col == row[col.name] for col in table.primary_key.columns])))
            for table in metadata.sorted_tables:
                for row in rows.get(table.name, []):
                    db.execute(table.insert().values(**row))
            for name in hashes:
                if not name.startswith('files/'):
                    continue
                relative = name[len('files/'):]
                target = local_file(root, relative)
                staged = local_file(stage, name)
                # Shared paths are never replaced with different content.
                if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != hashes[name]:
                    for table in metadata.tables.values():
                        for column in table.columns:
                            if column.name not in FILE_FIELDS:
                                continue
                            matches = db.execute(select(table).where(cast(column, String).contains(target.name))).mappings().all()
                            own = {key(table, row) for row in rows.get(table.name, [])}
                            if any(key(table, row) not in own for row in matches):
                                raise ValueError('Un archivo está compartido con otra empresa y no puede reemplazarse')
                target.parent.mkdir(parents=True, exist_ok=True)
                undo = stage / 'undo' / relative
                if target.exists():
                    undo.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(target, undo)
                installed.append((target, undo if undo.exists() else None))
                with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temporary:
                    with staged.open('rb') as source:
                        shutil.copyfileobj(source, temporary)
                    temp_path = temporary.name
                os.chmod(temp_path, 0o640)
                os.replace(temp_path, target)
            db.commit()
        except Exception:
            db.rollback()
            for target, undo in reversed(installed):
                if undo:
                    shutil.copy2(undo, target)
                else:
                    target.unlink(missing_ok=True)
            raise
        return preventive['id']


def prune(company_id):
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=7)
    for item in catalog(company_id)['items']:
        if dt.datetime.fromisoformat(item['created_at']) < cutoff:
            archive_path(company_id, item['id']).unlink()
            (tenant_dir(company_id) / f"{item['id']}.json").unlink()
