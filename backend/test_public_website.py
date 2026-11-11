import os
from pathlib import Path
import subprocess
import sys
import textwrap
import unittest

SETUP = '''
import datetime as dt
from unittest.mock import Mock
from fastapi import HTTPException
from pydantic import ValidationError
import models
from database import Base, engine, SessionLocal
from public_website import ContactMessage, submit_contact, inventory_page
Base.metadata.create_all(engine)
db = SessionLocal()
company = models.Company(id=1, name='Autos QP')
other = models.Company(id=2, name='Other')
db.add_all([company, other])
db.add(models.IntegrationSettings(company_id=1, smtp_always_recipients='team@test.invalid; finance@test.invalid'))
db.commit()
payload = ContactMessage(request_id='12345678-1234-1234-1234-123456789012', name='Cliente',
    phone='3001234567', email='client@example.com', subject='Comprar vehículo', message='Quiero conocer un vehículo')
loader = Mock(return_value={'sender': 'sender@test.invalid'})
deliver = Mock()
def send(company=company, data=payload, ip='1.2.3.4'):
    return submit_contact(db, company, data, ip, loader, deliver)
'''


class PublicWebsiteTests(unittest.TestCase):
    def run_case(self, code):
        env = dict(os.environ, DATABASE_URL='sqlite://', PYTHONPATH=str(Path(__file__).resolve().parent))
        result = subprocess.run([sys.executable, '-c', textwrap.dedent(SETUP) + '\n' + textwrap.dedent(code)],
            env=env, capture_output=True, text=True, timeout=35)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_smtp_recipients_are_server_side_and_success_is_idempotent(self):
        self.run_case('''
            assert send()['sent']
            message = deliver.call_args.args[0]
            assert str(message['To']) == 'team@test.invalid, finance@test.invalid'
            assert str(message['Reply-To']) == 'client@example.com'
            assert send()['sent']
            assert deliver.call_count == 1
            assert db.query(models.PublicWebsiteContact).one().state == 'sent'
        ''')

    def test_smtp_failure_is_not_acknowledged_and_retry_uses_existing_message(self):
        self.run_case('''
            deliver.side_effect = RuntimeError('mail unavailable')
            try: send()
            except HTTPException as error: assert error.status_code == 503
            else: raise AssertionError('false success')
            assert db.query(models.PublicWebsiteContact).one().state == 'failed'
            deliver.side_effect = None
            assert send()['sent']
            row = db.query(models.PublicWebsiteContact).one()
            assert row.state == 'sent' and row.attempts == 2
        ''')

    def test_pending_message_and_changed_idempotency_payload_are_not_resent(self):
        self.run_case('''
            send()
            row = db.query(models.PublicWebsiteContact).one()
            row.state = 'pending'; db.commit()
            try: send()
            except HTTPException as error: assert error.status_code == 409
            else: raise AssertionError('duplicate pending message')
            changed = payload.model_copy(update={'message': 'Un mensaje diferente'})
            try: send(data=changed)
            except HTTPException as error: assert error.status_code == 409
            else: raise AssertionError('changed message accepted')
            assert deliver.call_count == 1
        ''')

    def test_unknown_domain_fails_closed_and_contact_records_are_company_scoped(self):
        self.run_case('''
            for action in [lambda: send(company=None), lambda: inventory_page(db, None)]:
                try: action()
                except HTTPException as error: assert error.status_code == 404
                else: raise AssertionError('unknown company accepted')
            send(); send(company=other)
            assert db.query(models.PublicWebsiteContact).count() == 2
            assert str(deliver.call_args.args[0]['To']) == 'sender@test.invalid'
        ''')

    def test_validation_honeypot_and_rate_limit(self):
        self.run_case('''
            for values in [dict(payload.model_dump(), name='  '), dict(payload.model_dump(), email='bad'), dict(payload.model_dump(), recipients=['attacker@example.com'])]:
                try: ContactMessage(**values)
                except ValidationError: pass
                else: raise AssertionError('invalid payload accepted')
            assert send(data=payload.model_copy(update={'website': 'spam'}))['sent']
            assert deliver.call_count == 0
            for i in range(5): send(data=payload.model_copy(update={'request_id': f'contact-request-{i:020d}'}))
            try: send(data=payload.model_copy(update={'request_id': 'contact-request-99999999999999999999'}))
            except HTTPException as error: assert error.status_code == 429
            else: raise AssertionError('rate limit missing')
        ''')

    def test_inventory_pagination_omits_other_companies_and_private_fields(self):
        self.run_case('''
            db.add_all([models.Vehicle(id=i, company_id=1, status='available', make='Mazda', model='CX', price=60000000,
                purchase_price=40000000, plate='ABC123', photos=['/api/static/car.jpg']) for i in range(1, 104)])
            db.add(models.Vehicle(id=104, company_id=2, status='available', make='Other'))
            db.add(models.Vehicle(id=105, company_id=1, status='sold', make='Sold'))
            db.commit()
            first = inventory_page(db, company)
            assert len(first['items']) == 100 and first['next_cursor'] == 4
            second = inventory_page(db, company, first['next_cursor'])
            assert len(second['items']) == 3 and second['next_cursor'] is None
            item = first['items'][0]
            assert item['specs']['plateEnding'] == '3'
            assert 'purchase_price' not in item and 'plate' not in item
            assert item['specs']['doors'] == 'Consultar'
        ''')
