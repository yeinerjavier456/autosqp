"""Regression: a legacy NULL plate must not turn sales/receipts into HTTP 500."""
import ast
import asyncio
from pathlib import Path
from types import SimpleNamespace as NS
import sys
import unittest

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
import schemas


def vehicle(plate):
    return NS(id=1, company_id=1, make='Renault', year=2020, price=40000000, plate=plate)


def sale(plate):
    return NS(id=1, company_id=1, status='pending', sale_price=40000000,
              commission_percentage=1.0, commission_amount=400000, net_revenue=39600000,
              sale_date='2026-11-13T15:00:00', vehicle=vehicle(plate), payment_receipts=[])


class FinanceResponseTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()

        @self.app.get('/sales/', response_model=schemas.SaleList)
        def sales():
            return {'items': [sale('ABC123'), sale(None), sale('')], 'total': 3}

        @self.app.get('/finance/receipts', response_model=schemas.PaymentReceiptList)
        def receipts():
            account = NS(id=1, company_id=1, name='Cuenta de prueba', opening_balance=90000000,
                         current_balance=100000000, income_total=20000000, expense_total=10000000,
                         movement_count=30, created_at='2026-11-13T15:00:00')
            return {'items': [NS(id=i+1, company_id=1, user_id=1, amount=100000,
                created_at='2026-11-13T15:00:00', sale=sale(plate), account=account)
                for i, plate in enumerate(['ABC123', None, None, '', None])], 'total': 5}
        self.client = TestClient(self.app)

    def test_sales_response_keeps_all_sales_and_preserves_null_plate(self):
        response = self.client.get('/sales/?status=pending&limit=300&start_date=2026-10-14&end_date=2026-11-13')
        self.assertEqual(response.status_code, 200, response.text)
        data=response.json()
        self.assertEqual(data['total'],3)
        self.assertEqual([item['vehicle']['plate'] for item in data['items']],['ABC123',None,''])

    def test_receipts_response_keeps_nested_sales_but_never_exposes_account_balances(self):
        response=self.client.get('/finance/receipts?limit=300&start_date=2026-10-14&end_date=2026-11-13')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['total'],5)
        for item in response.json()['items']:
            self.assertIn('vehicle',item['sale'])
            self.assertEqual(item['account']['name'],'Cuenta de prueba')
            for field in ['opening_balance','current_balance','income_total','expense_total','movement_count']:
                self.assertNotIn(field,item['account'])

    def test_vehicle_creation_validation_is_not_weakened(self):
        for plate in [None,123]:
            with self.assertRaises(ValidationError):
                schemas.VehicleCreate(make='Renault',year=2020,price=40000000,plate=plate)
        with self.assertRaises(ValidationError):
            schemas.VehicleCreate(make='Renault',year=2020,price=40000000)
        self.assertEqual(schemas.VehicleCreate(make='Renault',year=2020,price=40000000,plate='ABC123').plate,'ABC123')

    def test_only_accounts_trigger_password_middleware(self):
        source=ast.parse(Path(__file__).with_name('main.py').read_text(encoding='utf-8'))
        fn=next(node for node in source.body if isinstance(node,ast.AsyncFunctionDef) and node.name=='protect_finance_routes')
        fn.decorator_list=[]
        for arg in fn.args.args:arg.annotation=None
        namespace={'JSONResponse':JSONResponse}
        exec(compile(ast.Module(body=[fn],type_ignores=[]),'<finance middleware>','exec'),namespace)
        calls=[]
        async def next_handler(request):
            calls.append(request.url.path)
            return JSONResponse({'ok':True})
        for path in ['/sales/','/finance/receipts','/finance/stats','/finance/tax-report','/finance/account-options']:
            response=asyncio.run(namespace['protect_finance_routes'](NS(url=NS(path=path)),next_handler))
            self.assertEqual(response.status_code,200)
        for headers,code in [({},401),({'Authorization':'Bearer fixture'},403)]:
            request=NS(url=NS(path='/finance/accounts'),headers=headers,query_params={})
            response=asyncio.run(namespace['protect_finance_routes'](request,next_handler))
            self.assertEqual(response.status_code,code)
        self.assertNotIn('/finance/accounts',calls)
