import datetime
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import tracemalloc

from sqlalchemy import create_engine, event, MetaData, Table, Column, Integer, String, ForeignKey, DateTime, select, update
from sqlalchemy.orm import Session
from backend import company_backup as backups


class CompanyBackupTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.static = self.root / 'static'
        self.static.mkdir()
        self.env = patch.dict(os.environ, AUTOSQP_COMPANY_BACKUP_ROOT=str(self.root / 'backups'))
        self.env.start()
        self.addCleanup(self.env.stop)
        self.engine = create_engine('sqlite://')
        event.listen(self.engine, 'connect', lambda connection, _: connection.execute('PRAGMA foreign_keys=ON'))
        self.meta = MetaData()
        self.company = Table('companies', self.meta, Column('id', Integer, primary_key=True), Column('secret', String))
        self.leads = Table('leads', self.meta, Column('id', Integer, primary_key=True), Column('company_id', ForeignKey('companies.id')), Column('name', String), Column('created_at', DateTime))
        self.files = Table('files', self.meta, Column('id', Integer, primary_key=True), Column('lead_id', ForeignKey('leads.id')), Column('file_path', String))
        self.meta.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.db.execute(self.company.insert(), [{'id': 1, 'secret': 'keep-current'}, {'id': 2, 'secret': 'other'}])
        self.db.execute(self.leads.insert(), [{'id': 1, 'company_id': 1, 'name': 'Original', 'created_at': datetime.datetime(2026, 11, 11)}, {'id': 2, 'company_id': 2, 'name': 'Other company', 'created_at': datetime.datetime(2026, 11, 12)}])
        self.db.execute(self.files.insert(), [{'id': 1, 'lead_id': 1, 'file_path': '/api/static/one.txt'}, {'id': 2, 'lead_id': 2, 'file_path': '/api/static/two.txt'}])
        self.db.commit()
        (self.static / 'one.txt').write_text('original', encoding='utf-8')
        (self.static / 'two.txt').write_text('other company', encoding='utf-8')

    def snapshot(self):
        result = backups.create_archive(self.db, self.meta, 1, self.static)
        self.db.commit()
        return result

    def test_archive_contains_only_company_data_and_files(self):
        result = self.snapshot()
        with zipfile.ZipFile(backups.archive_path(1, result['id'])) as archive:
            payload = json.loads(archive.read('data.json'))
            self.assertEqual([row['id'] for row in payload['tables']['leads']], [1])
            self.assertIn('files/one.txt', archive.namelist())
            self.assertNotIn('files/two.txt', archive.namelist())
            self.assertNotIn('companies', payload['tables'])

    def test_large_archive_is_batched_without_loading_all_company_rows(self):
        self.db.execute(self.leads.insert(), [
            {'id': index, 'company_id': 1, 'name': 'x' * 8192}
            for index in range(3, 2003)
        ])
        self.db.commit()
        queries = []
        listener = lambda conn, cursor, statement, parameters, context, many: queries.append(statement)
        event.listen(self.engine, 'before_cursor_execute', listener)
        try:
            tracemalloc.start()
            with patch.object(backups, 'scope_rows', side_effect=AssertionError('unbounded reader used')):
                result = self.snapshot()
            _, peak = tracemalloc.get_traced_memory()
        finally:
            tracemalloc.stop()
            event.remove(self.engine, 'before_cursor_execute', listener)
        self.assertEqual(result['rows'], 2002)
        self.assertGreater(result['database_bytes'], 16_000_000)
        self.assertLess(peak, 12 * 1024 ** 2)
        self.assertLess(len(queries), 30)
        with zipfile.ZipFile(backups.archive_path(1, result['id'])) as archive:
            payload = json.loads(archive.read('data.json'))
            self.assertEqual(len(payload['tables']['leads']), 2001)
            self.assertNotIn(2, [row['id'] for row in payload['tables']['leads']])

    def test_restore_changes_only_target_company_and_creates_preventive(self):
        saved = self.snapshot()
        self.db.execute(update(self.leads).where(self.leads.c.id == 1).values(name='Changed'))
        self.db.commit()
        (self.static / 'one.txt').write_text('changed', encoding='utf-8')
        preventive = backups.restore_archive(self.db, self.meta, 1, saved['id'], self.static)
        self.assertTrue(backups.archive_path(1, preventive).is_file())
        rows = self.db.execute(select(self.leads).order_by(self.leads.c.id)).mappings().all()
        self.assertEqual([row['name'] for row in rows], ['Original', 'Other company'])
        self.assertEqual((self.static / 'one.txt').read_text(), 'original')
        self.assertEqual((self.static / 'two.txt').read_text(), 'other company')
        self.assertEqual(self.db.execute(select(self.company.c.secret).where(self.company.c.id == 1)).scalar(), 'keep-current')

    def test_other_company_cannot_resolve_archive_or_traverse_path(self):
        saved = self.snapshot()
        with self.assertRaises(ValueError): backups.archive_path(2, saved['id'])
        with self.assertRaises(ValueError): backups.archive_path(1, '../data')

    def test_missing_file_marks_archive_incomplete(self):
        (self.static / 'one.txt').unlink()
        saved = self.snapshot()
        self.assertFalse(saved['verified'])
        self.assertEqual(saved['missing_files'], 1)

    def test_checksum_failure_does_not_modify_database(self):
        saved = self.snapshot()
        path = backups.archive_path(1, saved['id'])
        with zipfile.ZipFile(path) as archive:
            contents = {name: archive.read(name) for name in archive.namelist()}
        contents['data.json'] = b'{}'
        with zipfile.ZipFile(path, 'w') as archive:
            for name, data in contents.items(): archive.writestr(name, data)
        with self.assertRaises(ValueError): backups.restore_archive(self.db, self.meta, 1, saved['id'], self.static)
        self.assertEqual(self.db.execute(select(self.leads.c.name).where(self.leads.c.id == 1)).scalar(), 'Original')

    def test_schema_change_blocks_restore(self):
        saved = self.snapshot()
        self.leads.append_column(Column('new_field', String))
        with self.assertRaises(ValueError): backups.restore_archive(self.db, self.meta, 1, saved['id'], self.static)

    def test_cross_company_reference_blocks_archive(self):
        # An unscoped child connected to another tenant's lead must never leak.
        cross = Table('cross_links', self.meta, Column('id', Integer, primary_key=True),
            Column('company_id', ForeignKey('companies.id')), Column('lead_id', ForeignKey('leads.id')))
        cross.create(self.engine)
        self.db.execute(cross.insert().values(id=1, company_id=1, lead_id=2))
        self.db.commit()
        with self.assertRaises(ValueError): self.snapshot()

    def test_primary_key_owned_by_another_company_is_never_overwritten(self):
        saved = self.snapshot()
        self.db.execute(self.files.delete().where(self.files.c.id == 1))
        self.db.execute(update(self.leads).where(self.leads.c.id == 1).values(company_id=2, name='Now belongs to company 2'))
        self.db.commit()
        with self.assertRaises(ValueError): backups.restore_archive(self.db, self.meta, 1, saved['id'], self.static)
        self.assertEqual(self.db.execute(select(self.leads.c.company_id).where(self.leads.c.id == 1)).scalar(), 2)


if __name__ == '__main__':
    unittest.main()
