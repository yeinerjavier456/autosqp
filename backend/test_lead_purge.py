from pathlib import Path
import tempfile
import unittest

from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, ForeignKey, select, event
from sqlalchemy.orm import Session

from backend.lead_purge import purge_lead_records, remove_unreferenced_lead_files


class LeadPurgeTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        event.listen(self.engine, 'connect', lambda connection, _: connection.execute('PRAGMA foreign_keys=ON'))
        self.meta = MetaData()
        self.vehicles = Table('vehicles', self.meta, Column('id', Integer, primary_key=True))
        self.leads = Table('leads', self.meta, Column('id', Integer, primary_key=True))
        self.sales = Table('sales', self.meta, Column('id', Integer, primary_key=True), Column('lead_id', ForeignKey('leads.id')), Column('vehicle_id', ForeignKey('vehicles.id')))
        self.receipts = Table('receipts', self.meta, Column('id', Integer, primary_key=True), Column('sale_id', ForeignKey('sales.id')), Column('file_path', String))
        self.files = Table('files', self.meta, Column('id', Integer, primary_key=True), Column('lead_id', ForeignKey('leads.id')), Column('file_path', String))
        self.meta.create_all(self.engine)
        self.db = Session(self.engine)
        self.db.execute(self.vehicles.insert(), [{'id': 1}])
        self.db.execute(self.leads.insert(), [{'id': 1}, {'id': 2}])
        self.db.execute(self.sales.insert(), [{'id': 1, 'lead_id': 1, 'vehicle_id': 1}, {'id': 2, 'lead_id': 2, 'vehicle_id': 1}])
        self.db.execute(self.receipts.insert(), [{'id': 1, 'sale_id': 1, 'file_path': '/api/static/shared.pdf'}, {'id': 2, 'sale_id': 2, 'file_path': '/api/static/shared.pdf'}])
        self.db.execute(self.files.insert(), [{'id': 1, 'lead_id': 1, 'file_path': '/api/static/private.pdf'}])
        self.db.commit()
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)

    def test_descendants_removed_but_shared_parents_and_other_lead_remain(self):
        paths, counts = purge_lead_records(self.db, self.meta, 1)
        self.db.commit()
        self.assertEqual(counts, {'receipts': 1, 'sales': 1, 'files': 1, 'leads': 1})
        self.assertEqual(self.db.execute(select(self.leads.c.id)).scalars().all(), [2])
        self.assertEqual(self.db.execute(select(self.vehicles.c.id)).scalars().all(), [1])
        self.assertIn('/api/static/private.pdf', paths)

    def test_files_are_bounded_and_shared_files_are_preserved(self):
        paths, _ = purge_lead_records(self.db, self.meta, 1)
        self.db.commit()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'static'
            root.mkdir()
            for name in ['shared.pdf', 'private.pdf']:
                (root / name).write_bytes(b'test')
            outside = Path(folder) / 'outside.pdf'
            outside.write_bytes(b'test')
            failures = remove_unreferenced_lead_files(self.db, self.meta, paths | {'/static/../outside.pdf'}, root)
            self.assertEqual(failures, [])
            self.assertFalse((root / 'private.pdf').exists())
            self.assertTrue((root / 'shared.pdf').exists())
            self.assertTrue(outside.exists())

    def test_rollback_restores_all_records(self):
        purge_lead_records(self.db, self.meta, 1)
        self.db.rollback()
        self.assertEqual(len(self.db.execute(select(self.leads)).all()), 2)
        self.assertEqual(len(self.db.execute(select(self.sales)).all()), 2)


if __name__ == '__main__':
    unittest.main()
