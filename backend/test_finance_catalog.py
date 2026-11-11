import ast
from pathlib import Path
from types import SimpleNamespace as NS
import unittest
import uuid

from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, Boolean, func
from sqlalchemy.orm import declarative_base, Session

Base = declarative_base()


class Company(Base):
    __tablename__ = 'companies'
    id = Column(Integer, primary_key=True)


class Entry(Base):
    __tablename__ = 'entries'
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer)
    kind = Column(String)
    code = Column(String)
    label = Column(String)
    category_code = Column(String)
    movement_type = Column(String)
    is_active = Column(Boolean)


class Denied(Exception):
    def __init__(self, status, detail): self.status_code = status


class FinanceCatalogTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('finance_catalog.py').read_text(encoding='utf-8'))
        nodes = []
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.ClassDef)) or (isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id in {'CATEGORIES', 'CONCEPTS'} for target in node.targets)):
                if isinstance(node, ast.FunctionDef):
                    node.decorator_list = []
                    if node.name != 'validate': node.args.defaults = []
                    for arg in node.args.args: arg.annotation = None
                nodes.append(node)
        self.context = dict(uuid=uuid, BaseModel=BaseModel, Field=Field, func=func, HTTPException=Denied,
            models=NS(Company=Company, FinanceCatalogEntry=Entry), is_company_admin=lambda user: user.role == 'admin')
        exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), '<finance catalog>', 'exec'), self.context)
        self.engine = create_engine('sqlite://')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.addCleanup(self.engine.dispose); self.addCleanup(self.db.close)
        self.user = NS(company_id=1, role='admin')
        self.db.add_all([Company(id=1), Company(id=2)]); self.db.commit()
        self.context['seed'](self.db, self.user)

    def payload(self, **kwargs):
        return self.context['EntryInput'](**kwargs)

    def create_category(self, name='Nueva categoría'):
        return self.context['create'](self.payload(kind='category', label=name), self.db, self.user)

    def test_default_seed_is_idempotent(self):
        before = self.db.query(Entry).count()
        self.context['seed'](self.db, self.user)
        self.assertEqual(self.db.query(Entry).count(), before)

    def test_create_concept_with_category_and_movement(self):
        category = self.create_category()
        concept = self.context['create'](self.payload(kind='concept', label='Seguro especial', category_code=category['code'], movement_type='expense'), self.db, self.user)
        self.assertEqual(concept['category_code'], category['code'])
        self.assertEqual(concept['movement_type'], 'expense')

    def test_rename_category_keeps_code_and_soft_delete_keeps_label(self):
        category = self.create_category()
        updated = self.context['update'](category['id'], self.payload(kind='category', label='Nombre editado'), self.db, self.user)
        self.assertEqual(updated['code'], category['code'])
        self.context['remove'](category['id'], self.db, self.user)
        entry = self.db.get(Entry, category['id'])
        self.assertFalse(entry.is_active)
        self.assertEqual(self.context['category_label'](self.db, 1, category['code']), 'Nombre editado')

    def test_cannot_edit_other_company(self):
        category = self.create_category()
        with self.assertRaises(Denied): self.context['update'](category['id'], self.payload(kind='category', label='Otro'), self.db, NS(company_id=2, role='admin'))

    def test_non_admin_and_duplicate_names_are_blocked(self):
        employee = NS(company_id=1, role='asesor')
        with self.assertRaises(Denied): self.context['listing'](self.db, employee)
        with self.assertRaises(Denied): self.context['create'](self.payload(kind='category', label='No permitida'), self.db, employee)
        entry = self.db.query(Entry).first()
        with self.assertRaises(Denied): self.context['update'](entry.id, self.payload(kind='category', label='No permitida'), self.db, employee)
        with self.assertRaises(Denied): self.context['remove'](entry.id, self.db, employee)
        self.create_category()
        with self.assertRaises(Denied): self.create_category()

    def test_employee_gets_only_active_form_options_of_own_company(self):
        category = self.create_category()
        self.context['remove'](category['id'], self.db, self.user)
        self.db.add(Entry(company_id=2, kind='category', code='private', label='Otra empresa', is_active=True))
        self.db.commit()
        items = self.context['form_options'](self.db, NS(company_id=1, role='asesor'))['items']
        self.assertTrue(items)
        self.assertTrue(all('id' not in entry and entry['is_active'] for entry in items))
        self.assertFalse(any(entry['code'] in {'private', category['code']} for entry in items))

    def test_category_in_use_and_transfer_are_protected(self):
        used = self.db.query(Entry).filter(Entry.code == 'ingreso_venta').first()
        with self.assertRaises(Denied): self.context['remove'](used.id, self.db, self.user)
        transfer = self.db.query(Entry).filter(Entry.code == 'transferencia_cuentas').first()
        with self.assertRaises(Denied): self.context['remove'](transfer.id, self.db, self.user)


if __name__ == '__main__': unittest.main()
