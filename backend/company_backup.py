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
import sqlite3
import time
from urllib.parse import urlsplit

from sqlalchemy import select, delete, and_, or_, tuple_, DateTime, Date, Numeric, LargeBinary, cast, String

ID_PATTERN = re.compile(r'^\d{8}T\d{6}-[a-f0-9]{8}$')
FILE_FIELDS = {'file_path', 'business_sheet_url', 'attachments', 'photos', 'media_url', 'form_payload', 'logo_url'}
EXCLUDED_TABLES = {'companies', 'company_backup_jobs', 'alert_rule_progress'}


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
    """Compatibility reader used during restore; creation uses bounded batches."""
    predicates = scope_predicates(metadata, company_id)
    selected = {}
    for name, predicate in predicates.items():
        selected[name] = [row for batch in table_batches(db, metadata.tables[name], predicate) for row in batch]
    return selected


def scope_predicates(metadata, company_id):
    """Use indexed subqueries instead of collecting millions of IDs in Python."""
    scopes = {}
    for table in metadata.sorted_tables:
        if table.name in EXCLUDED_TABLES or 'company_id' not in table.c:
            continue
        scopes[table.name] = table.c.company_id == company_id
    for table in metadata.sorted_tables:
        if table.name in EXCLUDED_TABLES or table.name in scopes:
            continue
        choices = [table.c[fk.parent.name].in_(select(fk.column).where(scopes[fk.column.table.name]))
            for fk in table.foreign_keys if fk.column.table.name in scopes]
        if choices:
            scopes[table.name] = or_(*choices)
    return scopes


def table_batches(db, table, predicate, size=250):
    columns = list(table.primary_key.columns)
    if not columns:
        raise ValueError(f'No se puede paginar de forma segura la tabla {table.name}')
    last = None
    while True:
        query = select(table).where(predicate).order_by(*columns).limit(size)
        if last is not None:
            query = query.where(columns[0] > last[0] if len(columns) == 1 else tuple_(*columns) > tuple_(*last))
        result = db.execute(query)
        try:
            batch = [dict(row) for row in result.mappings()]
        finally:
            result.close()
        if not batch:
            return
        last = key(table, batch[-1])
        yield batch
        if len(batch) < size:
            return


def validate_scopes(db, metadata, company_id, scopes):
    """One bounded existence query per relation, never one query per record."""
    for name, predicate in scopes.items():
        table = metadata.tables[name]
        for fk in table.foreign_keys:
            parent = fk.column.table
            if parent.name == 'companies':
                invalid = select(table.c[fk.parent.name]).where(predicate, table.c[fk.parent.name] != company_id).limit(1)
            elif 'company_id' in parent.c:
                owner = parent.alias()
                invalid = select(table.c[fk.parent.name]).select_from(table.join(owner, table.c[fk.parent.name] == owner.c[fk.column.name])).where(predicate, owner.c.company_id.is_not(None), owner.c.company_id != company_id).limit(1)
            else:
                continue
            if db.execute(invalid).first():
                raise ValueError(f'La empresa tiene referencias cruzadas en {name}; requiere revisión antes de respaldar/restaurar')


def ensure_free_space(directory, required=0):
    if shutil.disk_usage(directory).free < required + 2 * 1024 ** 3:
        raise ValueError('No hay espacio suficiente para la copia y el margen de seguridad de 2 GB')


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


def schema_signature(metadata, before_website_contacts=False):
    ignored = {'company_backup_jobs', 'alert_rule_progress'}
    if before_website_contacts:
        ignored.add('public_website_contacts')
    structure = {table.name: [(col.name, str(col.type)) for col in table.columns] for table in metadata.sorted_tables if table.name not in ignored}
    return hashlib.sha256(json.dumps(structure, sort_keys=True).encode()).hexdigest()


def create_archive(db, metadata, company_id, static_root, reason='daily', job_id=None):
    """Stream database and files to disk; memory is bounded by one row batch."""
    directory = tenant_dir(company_id)
    ensure_free_space(directory)
    scopes = scope_predicates(metadata, company_id)
    validate_scopes(db, metadata, company_id, scopes)
    backup_id = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S-') + uuid.uuid4().hex[:8]
    root = Path(static_root).resolve()
    temp = directory / f'.{backup_id}.tmp'
    destination = directory / f'{backup_id}.zip'
    row_count = file_bytes = missing = file_count = 0
    try:
        with tempfile.TemporaryDirectory(prefix='.spool-', dir=directory) as spool:
            data_path = Path(spool) / 'data.json'
            with contextlib.closing(sqlite3.connect(str(Path(spool) / 'references.sqlite'))) as refs:
                refs.execute('CREATE TABLE files (path TEXT PRIMARY KEY, digest TEXT)')
                digest = hashlib.sha256()
                with data_path.open('wb') as output:
                    def write(value):
                        block = value.encode('utf-8')
                        digest.update(block)
                        output.write(block)
                    header = {'format': 1, 'company_id': company_id, 'schema': schema_signature(metadata)}
                    write(json.dumps(header)[:-1] + ',"tables":{')
                    for index, (name, predicate) in enumerate(scopes.items()):
                        write((',' if index else '') + json.dumps(name) + ':[')
                        first = True
                        for batch in table_batches(db, metadata.tables[name], predicate):
                            ensure_free_space(directory)
                            for row in batch:
                                write(('' if first else ',') + json.dumps(row, default=_encode, ensure_ascii=False))
                                first = False
                                row_count += 1
                                for field, value in row.items():
                                    if field in FILE_FIELDS:
                                        refs.executemany('INSERT OR IGNORE INTO files(path) VALUES (?)', ((relative,) for relative in _file_paths(value)))
                            refs.commit()
                            time.sleep(0.01)
                        write(']')
                    write('}}')
                required = data_path.stat().st_size
                for (relative,) in refs.execute('SELECT path FROM files'):
                    candidate = local_file(root, relative)
                    if candidate.is_file():
                        required += candidate.stat().st_size
                ensure_free_space(directory, required)
                with zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
                    archive.write(data_path, 'data.json')
                    for (relative,) in refs.execute('SELECT path FROM files ORDER BY path'):
                        ensure_free_space(directory)
                        path = local_file(root, relative)
                        if not path.is_file():
                            missing += 1
                            continue
                        entry = zipfile.ZipInfo(f'files/{relative}')
                        entry.compress_type = zipfile.ZIP_STORED if path.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.mp4', '.zip', '.gz', '.xlsx', '.pdf'} else zipfile.ZIP_DEFLATED
                        file_digest = hashlib.sha256()
                        with path.open('rb') as source, archive.open(entry, 'w', force_zip64=True) as output:
                            while block := source.read(1024 * 1024):
                                file_digest.update(block)
                                file_bytes += len(block)
                                output.write(block)
                        refs.execute('UPDATE files SET digest=? WHERE path=?', (file_digest.hexdigest(), relative))
                        file_count += 1
                    refs.commit()
                    with archive.open('checksums.json', 'w') as output:
                        output.write(('{"data.json":' + json.dumps(digest.hexdigest())).encode())
                        for relative, checksum in refs.execute('SELECT path, digest FROM files WHERE digest IS NOT NULL ORDER BY path'):
                            output.write((',' + json.dumps('files/' + relative) + ':' + json.dumps(checksum)).encode())
                        output.write(b'}')
                manifest = dict(id=backup_id, company_id=company_id, created_at=dt.datetime.now(dt.timezone.utc).isoformat(),
                    job_id=job_id, reason=reason, database_bytes=data_path.stat().st_size, static_bytes=file_bytes,
                    static_files=file_count, total_bytes=temp.stat().st_size, verified=not missing,
                    missing_files=missing, rows=row_count)
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
            for start in range(0, len(items), 250):
                values = {row[fk.parent.name] for row in items[start:start + 250] if row.get(fk.parent.name) is not None}
                if parent.name == 'companies' and any(value != company_id for value in values):
                    raise ValueError('Referencia a otra empresa')
                if values and 'company_id' in parent.c:
                    invalid = select(parent.c.company_id).where(parent.c[fk.column.name].in_(values), parent.c.company_id.is_not(None), parent.c.company_id != company_id).limit(1)
                    if db.execute(invalid).first():
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
        # Known additive migration: older snapshots predate the public-contact
        # table. Accept only the exact old schema hash, never arbitrary changes.
        legacy_website_schema = ('public_website_contacts' not in payload.get('tables', {})
            and payload.get('schema') == schema_signature(metadata, before_website_contacts=True))
        if payload.get('schema') != schema_signature(metadata) and not legacy_website_schema:
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
            if 'alert_rule_progress' in metadata.tables:
                progress = metadata.tables['alert_rule_progress']
                db.execute(delete(progress).where(progress.c.company_id == company_id))
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
