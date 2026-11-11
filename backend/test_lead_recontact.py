import ast
import datetime
from pathlib import Path
from types import SimpleNamespace
import re
import unicodedata
import unittest

from sqlalchemy import create_engine, Column, Integer, String, DateTime, or_
from sqlalchemy.orm import declarative_base, Session

Base = declarative_base()


class Company(Base):
    __tablename__ = 'companies'
    id = Column(Integer, primary_key=True)


class Lead(Base):
    __tablename__ = 'leads'
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer)
    name = Column(String)
    phone = Column(String)
    status = Column(String)
    assigned_to_id = Column(Integer)
    deleted_at = Column(DateTime)


class History(Base):
    __tablename__ = 'history'
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer)
    user_id = Column(Integer)
    previous_status = Column(String)
    new_status = Column(String)
    comment = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    title = Column(String)
    message = Column(String)
    type = Column(String)
    link = Column(String)


class RecontactTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('lead_recontact.py').read_text(encoding='utf-8'))
        nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.Assign))]
        self.ctx = dict(datetime=datetime, re=re, unicodedata=unicodedata, or_=or_, models=SimpleNamespace(
            Company=Company, Lead=Lead, LeadHistory=History, Notification=Notification))
        exec(compile(ast.Module(body=nodes, type_ignores=[]), '<recontact>', 'exec'), self.ctx)
        self.engine = create_engine('sqlite://')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.db.close)
        self.lead = Lead(id=1, company_id=1, name='Felipe Quiroga', phone='+57 301 263 2424', status='contacted', assigned_to_id=12)
        self.db.add_all([Company(id=1), Company(id=2), self.lead])
        self.db.commit()

    def test_phone_normalization_and_company_isolation(self):
        find = self.ctx['find_existing_contact']
        self.assertEqual(find(self.db, 1, 'Otro nombre', '3012632424').id, 1)
        self.assertIsNone(find(self.db, 2, 'Felipe Quiroga', '3012632424'))
        self.assertIsNone(find(self.db, 1, 'Pendiente', ''))
        self.assertIsNone(find(self.db, 1, 'Felipe Quiroga', '3000000000'))

    def test_notify_owner_without_changing_status_or_assignment(self):
        request = self.ctx['request_recontact']
        self.assertTrue(request(self.db, self.lead, 'web'))
        self.db.commit()
        self.assertFalse(request(self.db, self.lead, 'web'))
        self.assertEqual(self.db.query(Notification).count(), 1)
        self.assertEqual(self.db.query(Notification).first().user_id, 12)
        self.assertEqual(self.lead.status, 'contacted')
        self.assertEqual(self.lead.assigned_to_id, 12)
        self.ctx['hydrate_recontact_alerts'](self.db, [self.lead])
        self.assertTrue(self.lead.recontact_requested)

    def test_acknowledgment_removes_badge(self):
        self.ctx['request_recontact'](self.db, self.lead, 'TikTok')
        self.db.commit()
        self.db.add(History(lead_id=1, comment='[RECONTACT_ACK] Atendida', created_at=datetime.datetime.utcnow() + datetime.timedelta(seconds=1)))
        self.db.commit()
        self.ctx['hydrate_recontact_alerts'](self.db, [self.lead])
        self.assertFalse(self.lead.recontact_requested)


if __name__ == '__main__':
    unittest.main()
