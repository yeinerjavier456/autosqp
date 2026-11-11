import ast
import asyncio
import datetime
from io import BytesIO
from pathlib import Path
import re
from types import SimpleNamespace as NS
import unicodedata
import unittest
from openpyxl import Workbook, load_workbook


class Field:
    def __eq__(self, other): return self
    def is_(self, other): return self
    def desc(self): return self
    def in_(self, other): return self


class Query:
    def __init__(self, value): self.value = value
    def filter(self, *args): return self
    def with_for_update(self): return self
    def first(self): return self.value
    def all(self): return [self.value] if self.value else []
    def order_by(self, *args): return self


class UploadError(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        super().__init__(detail)


class LeadExcelRoundtripTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path(__file__).with_name('main.py').read_text(encoding='utf-8'))
        names = {'_lead_excel_responsible_label', '_add_lead_excel_selectors', 'upload_leads_xlsx', 'export_leads_xlsx'}
        nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
        for node in nodes:
            node.decorator_list = []
            node.returns = None
            node.args.defaults = []
            for arg in node.args.args: arg.annotation = None
        self.user = NS(id=9, full_name='Asesora Nueva', email='nueva@empresa.com')
        self.lead = NS(id=42, name='Cliente', phone='3001234567', status='new', assigned_to_id=2, assigned_to=NS(full_name='Anterior'), email=None, source='web', message='')
        company_model = type('Company', (), {'id': Field()})
        user_model = type('User', (), {'company_id': Field(), 'email': Field(), 'full_name': Field()})
        lead_model = type('Lead', (), {'id': Field(), 'company_id': Field(), 'deleted_at': Field()})
        self.events = []
        db = NS(query=lambda model: Query(self.user if model is user_model else self.lead if model is lead_model else NS()),
                add=self.events.append, commit=lambda: None, rollback=lambda: None)
        self.db = db
        self.context = dict(
            BytesIO=BytesIO, datetime=datetime, re=re, unicodedata=unicodedata,
            models=NS(Company=company_model, User=user_model, Lead=lead_model, LeadHistory=lambda **kw: NS(**kw), SystemLog=lambda **kw: NS(**kw)),
            func=NS(lower=lambda value: Field()), or_=lambda *args: None,
            is_company_admin=lambda user: True, is_active_user=lambda user: True,
            get_company_allowed_lead_statuses=lambda company: ['new', 'contacted', 'reserved'],
            normalize_lead_duplicate_phone=lambda phone: re.sub(r'\D', '', phone),
            find_duplicate_company_lead=lambda *args: self.lead,
            LEAD_STATUS_LABELS={'new': 'Nuevos', 'contacted': 'Contactados', 'reserved': 'Reservas'},
            HTTPException=UploadError,
        )
        exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), '<lead excel>', 'exec'), self.context)

    def upload(self, status='Contactados', responsible='Asesora Nueva <nueva@empresa.com>', preview=False, confirm_delete=False, password=''):
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'Leads'
        sheet.append(['ID', 'Nombre', 'Teléfono', 'Estado', 'Responsable'])
        sheet.append([42, 'Cliente', '3001234567', status, responsible])
        buffer = BytesIO()
        workbook.save(buffer)
        async def read(): return buffer.getvalue()
        return asyncio.run(self.context['upload_leads_xlsx'](NS(filename='leads.xlsx', read=read), preview, True, confirm_delete, password, self.db, NS(id=1, company_id=3)))

    def configure_deletion(self, closed_sale=False):
        sale_model = type('Sale', (), {'lead_id': Field(), 'company_id': Field(), 'status': Field()})
        self.context['models'].Sale = sale_model
        self.context['models'].SaleStatus = NS(APPROVED=NS(value='approved'))
        self.context['normalize_lead_status_value'] = lambda value: value
        original_query = self.db.query
        self.db.query = lambda model: Query(NS(status='approved') if closed_sale else None) if model is sale_model else original_query(model)

    def test_deletion_requires_password_and_confirmation(self):
        self.configure_deletion()
        with self.assertRaises(UploadError) as error:
            self.upload(status='Eliminar')
        self.assertEqual(error.exception.status_code, 403)

    def test_preview_lists_deletion_without_mutation(self):
        self.configure_deletion()
        result = self.upload(status='Eliminar', preview=True)
        self.assertEqual(result['deletable'], 1)
        self.assertEqual(result['deleted'], 0)

    def test_approved_sale_is_protected(self):
        self.configure_deletion(closed_sale=True)
        result = self.upload(status='Eliminar', preview=True)
        self.assertEqual(result['protected'], 1)
        self.assertEqual(result['deletable'], 0)

    def test_sold_lead_is_protected_without_sale_record(self):
        self.configure_deletion()
        self.lead.status = 'sold'
        result = self.upload(status='Eliminar', preview=True)
        self.assertEqual(result['protected'], 1)

    def test_wrong_accounts_password_is_rejected(self):
        self.context['auth_utils'] = NS(verify_password=lambda password, hashed: False)
        original_query = self.db.query
        self.db.query = lambda model: Query(NS(finance_password_hash='hashed')) if model is self.context['models'].Company else original_query(model)
        with self.assertRaises(UploadError) as error:
            self.upload(status='Eliminar', confirm_delete=True, password='wrong')
        self.assertEqual(error.exception.status_code, 403)

    def test_updates_status_and_responsible_from_export_columns(self):
        result = self.upload()
        self.assertEqual(result['updated'], 1)
        self.assertEqual(self.lead.status, 'contacted')
        self.assertEqual(self.lead.assigned_to_id, 9)

    def test_invalid_status_does_not_reset_to_new(self):
        result = self.upload(status='Estado inexistente')
        self.assertEqual(result['errors'], 1)
        self.assertEqual(result['updated'], 0)

    def test_plural_exported_status_and_id_are_recognized(self):
        def unexpected_duplicate_lookup(*args):
            raise AssertionError('Exported rows must be identified by ID')
        self.context['find_duplicate_company_lead'] = unexpected_duplicate_lookup
        result = self.upload(status='Reservas')
        self.assertEqual(result['updated'], 1)
        self.assertEqual(self.lead.status, 'reserved')

    def test_unassign_is_explicit(self):
        self.upload(responsible='Sin asignar')
        self.assertIsNone(self.lead.assigned_to_id)

    def test_dropdowns_survive_save_and_reload(self):
        workbook = Workbook()
        self.context['_add_lead_excel_selectors'](workbook, workbook.active, [self.user], ['new', 'contacted'], 'H', 'I', 3)
        buffer = BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        saved = load_workbook(buffer)
        self.assertEqual(saved['Opciones'].sheet_state, 'hidden')
        self.assertEqual(saved['Opciones']['B2'].value, 'Asesora Nueva <nueva@empresa.com>')
        self.assertEqual(len(saved.active.data_validations.dataValidation), 2)
        self.assertEqual(saved.defined_names['EstadosLead'].attr_text, "'Opciones'!$A$1:$A$3")
        self.assertEqual(saved['Opciones']['A3'].value, 'Eliminar')

    def test_large_export_has_filters_and_dropdowns_without_structured_tables(self):
        import zipfile
        class Rows(Query):
            def all(self): return self.value
        leads = [NS(id=index, name=f'Cliente {index}', created_at=None, source='web', status='new',
                    phone=f'300{index:07}', email='', assigned_to=self.user, supervisors=[], message='')
                 for index in range(1, 1501)]
        users = [NS(id=index, full_name=f'Empleado {index}', email=f'empleado{index}@empresa.com') for index in range(400)]
        for name in ['created_at', 'company_id']:
            setattr(self.context['models'].Lead, name, Field())
        self.context['models'].User.is_active = Field()
        self.context['models'].PublicCreditSubmission = type('Submission', (), {'lead_id': Field(), 'created_at': Field()})
        self.context['models'].CreditApplication = type('Credit', (), {'lead_id': Field(), 'updated_at': Field(), 'created_at': Field()})
        def query(model):
            if model is self.context['models'].User: return Rows(users)
            if model is self.context['models'].Company: return Query(NS())
            return Rows([])
        self.context.update(
            apply_lead_access_filters=lambda *args, **kwargs: Rows(leads),
            build_lead_summary_query=lambda db: None,
            _public_credit_bogota_datetime=lambda value: None,
            normalize_lead_status_value=lambda value: value,
            StreamingResponse=lambda buffer, **kwargs: buffer.getvalue(),
        )
        payload = self.context['export_leads_xlsx'](None, None, None, NS(query=query), NS(company_id=3))
        with zipfile.ZipFile(BytesIO(payload)) as archive:
            self.assertFalse(any(name.startswith('xl/tables/') for name in archive.namelist()))
        saved = load_workbook(BytesIO(payload))
        self.assertEqual(saved['Leads'].max_row, 1501)
        self.assertEqual(saved['Leads'].auto_filter.ref, 'A1:N1501')
        self.assertEqual(saved.defined_names['ResponsablesLead'].attr_text, "'Opciones'!$B$1:$B$401")
        validations = saved['Leads'].data_validations.dataValidation
        self.assertEqual([str(item.sqref) for item in validations], ['H2:H10001', 'I2:I10001'])


if __name__ == '__main__':
    unittest.main()
