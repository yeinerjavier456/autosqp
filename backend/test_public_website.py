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
            result = send()
            assert result['received'] and not result['sent']
            assert db.query(models.Lead).count() == 1
            assert db.query(models.PublicWebsiteContact).one().state == 'failed'
            deliver.side_effect = None
            assert send()['sent']
            row = db.query(models.PublicWebsiteContact).one()
            assert row.state == 'sent' and row.attempts == 2
            assert db.query(models.Lead).count() == 1
        ''')

    def test_contact_subject_routes_to_leads_purchases_and_reactivation(self):
        self.run_case('''
            db.add_all([models.Role(id=1, name='asesor'), models.Role(id=2, name='compras'), models.Role(id=3, name='reactivacion')])
            db.add_all([models.User(id=i, company_id=1, role_id=i, email=f'u{i}@test.invalid', auto_assign_leads=True) for i in [1,2,3]])
            db.commit()
            for i, subject in enumerate(['Comprar vehículo', 'Financiamiento', 'Seguros', 'Garantía opcional', 'Otro', 'Vender mi vehículo', 'Reactivación Financiera']):
                data = ContactMessage(**dict(payload.model_dump(), request_id=f'routing-request-{i:020d}', phone=f'300111{i:04d}', subject=subject))
                result = send(data=data, ip=f'8.0.0.{i}')
                lead = db.query(models.Lead).filter_by(phone=data.phone).one()
                if subject == 'Vender mi vehículo':
                    purchase = db.query(models.CreditApplication).one()
                    assert purchase.lead_id == lead.id and purchase.assigned_to_id == 2
                    assert '[PURCHASE_REQUEST]' in purchase.notes and result['destination'] == 'purchases'
                elif subject == 'Reactivación Financiera':
                    assert lead.status == 'new' and lead.assigned_to_id == 3 and result['destination'] == 'financial_solutions'
                else:
                    assert lead.status == 'new' and lead.assigned_to_id == 1 and result['destination'] == 'leads'
            assert db.query(models.Lead).count() == 7
            assert db.query(models.CreditApplication).count() == 1
        ''')

    def test_purchase_retry_and_repeat_contact_do_not_duplicate_leads(self):
        self.run_case('''
            data = ContactMessage(**dict(payload.model_dump(), subject='Vender mi vehículo', vehicle_make='Mazda', vehicle_plate='ABC123'))
            deliver.side_effect = RuntimeError('SMTP down')
            assert send(data=data)['received']
            deliver.side_effect = None
            assert send(data=data)['sent']
            assert db.query(models.CreditApplication).count() == 1
            assert db.query(models.Lead).count() == 1
            purchase = db.query(models.CreditApplication).one()
            assert purchase.purchase_vehicle_plate == 'ABC123'
            send(data=ContactMessage(**dict(payload.model_dump(), request_id='another-request-1234567890')))
            assert db.query(models.Lead).count() == 1
            assert db.query(models.LeadNote).count() == 2
        ''')

    def test_reactivation_moves_existing_contact_and_requires_eligible_staff(self):
        self.run_case('''
            data = ContactMessage(**dict(payload.model_dump(), subject='Reactivación Financiera', email=None))
            try: send(data=data)
            except HTTPException as error: assert error.status_code == 503
            else: raise AssertionError('invisible unassigned case accepted')
            assert db.query(models.Lead).count() == 0
            db.add(models.Role(id=3, name='reactivacion', label='Reactivación Financiera'))
            db.add(models.Role(id=1, name='asesor'))
            db.add(models.User(id=3, role_id=3, company_id=1, email='reactivation@test.invalid'))
            db.add(models.User(id=1, role_id=1, company_id=1, email='advisor@test.invalid', auto_assign_leads=True))
            db.commit()
            send()
            lead = db.query(models.Lead).one()
            lead.status = 'contacted'; db.commit()
            assert send(data=ContactMessage(**dict(data.model_dump(), request_id='reactivation-request-123456')))['received']
            assert db.query(models.Lead).count() == 1
            db.refresh(lead)
            assert lead.assigned_to_id == 3 and lead.status == 'new'
            assert db.query(models.LeadHistory).count() >= 2
            lead.status = 'lost'; db.commit()
            send(data=ContactMessage(**dict(data.model_dump(), request_id='reactivation-renewed-123456')))
            db.refresh(lead)
            assert lead.status == 'new' and lead.assigned_to_id == 3
            send(data=ContactMessage(**dict(payload.model_dump(), request_id='commercial-request-12345678')))
            db.refresh(lead)
            assert lead.status == 'new' and lead.assigned_to_id == 1
            assert db.query(models.Lead).count() == 1
        ''')

    def test_newsletter_does_not_create_lead_and_still_reports_smtp_failure(self):
        self.run_case('''
            newsletter = ContactMessage(**dict(payload.model_dump(), subject='Suscripción al boletín', phone=''))
            deliver.side_effect = RuntimeError('SMTP down')
            try: send(data=newsletter)
            except HTTPException as error: assert error.status_code == 503
            else: raise AssertionError('newsletter false success')
            assert db.query(models.Lead).count() == 0
        ''')

    def test_capacity_failure_rolls_back_contact_and_crm_records(self):
        self.run_case('''
            def limit(*args): raise HTTPException(403, 'Capacity reached')
            try: submit_contact(db, company, payload, '1.2.3.4', loader, deliver, limit)
            except HTTPException as error: assert error.status_code == 403
            else: raise AssertionError('capacity bypassed')
            assert db.query(models.Lead).count() == 0
            assert db.query(models.PublicWebsiteContact).count() == 0
            assert deliver.call_count == 0
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
