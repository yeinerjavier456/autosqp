"""Isolate real ORM tests from the application's environment and database."""
import os
from pathlib import Path
import subprocess
import sys
import textwrap
import unittest

SETUP = '''
import datetime as dt
from unittest.mock import patch
from sqlalchemy import event
import models
from database import Base, engine, SessionLocal
from routers import rules
from fastapi import HTTPException
Base.metadata.create_all(engine)
db = SessionLocal()
db.add_all([models.Company(id=1, name='One'), models.Company(id=2, name='Two')])
db.add(models.Role(id=1, name='asesor', base_role_name='asesor'))
db.add_all([models.User(id=i, company_id=1 if i < 3 else 2, role_id=1,
    email=f'u{i}@test.invalid', full_name=f'User {i}', auto_assign_leads=True)
    for i in [1, 2, 3]])
db.add(models.AutomationRule(id=1, company_id=1, name='Waiting', event_type='time_in_status',
    condition_value='new', time_value=1, time_unit='minutes', recipient_type='assigned_advisor',
    is_active=1, is_repeating=False))
now = dt.datetime.utcnow()
db.add_all([models.Lead(id=i, company_id=1 if i <= 250 else 2, assigned_to_id=1 if i <= 250 else 3,
    name=f'Lead {i}', status='new', status_updated_at=now - dt.timedelta(days=1))
    for i in range(1, 256)])
db.add(models.Lead(id=300, company_id=1, assigned_to_id=1, name='Deleted', status='new',
    status_updated_at=now - dt.timedelta(days=1), deleted_at=now))
db.commit()
def batch():
    return rules.process_rule_batch(db, 1, 1)
def reset_cycle():
    p = db.get(models.AlertRuleProgress, 1)
    p.cycle_at = None; p.next_run_at = None; p.last_lead_id = 0
    db.commit()
'''


class AlertBatchTests(unittest.TestCase):
    def run_case(self, code):
        env = dict(os.environ, DATABASE_URL='sqlite://', PYTHONPATH=str(Path(__file__).resolve().parent))
        result = subprocess.run([sys.executable, '-c', textwrap.dedent(SETUP) + '\n' + textwrap.dedent(code)],
            env=env, capture_output=True, text=True, timeout=40)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_bounded_batch_resumes_in_new_session_and_preserves_tenant_scope(self):
        self.run_case('''
            assert batch() == 100
            assert db.query(models.Notification).count() == 100
            assert db.get(models.AlertRuleProgress, 1).last_lead_id == 100
            db.close(); db = SessionLocal()
            assert batch() == 100
            assert batch() == 50
            assert not batch()
            assert db.query(models.SentAlertLog).count() == 250
            assert db.query(models.Notification).filter(models.Notification.user_id == 3).count() == 0
            assert db.get(models.AlertRuleProgress, 1).next_run_at is not None
            assert not batch()
            reset_cycle()
            batch(); batch(); batch(); batch()
            assert db.query(models.Notification).count() == 250
        ''')

    def test_failed_batch_rolls_back_alerts_and_cursor_before_retry(self):
        self.run_case('''
            with patch.object(rules, 'perform_rule_reassignment_if_needed', side_effect=RuntimeError('failure')):
                try: batch()
                except RuntimeError: db.rollback()
                else: raise AssertionError('expected failure')
            assert db.query(models.Notification).count() == 0
            assert db.query(models.SentAlertLog).count() == 0
            assert db.get(models.AlertRuleProgress, 1) is None
            assert batch() == 100
            assert db.query(models.Notification).count() == 100
        ''')

    def test_repeating_rules_respect_interval(self):
        self.run_case('''
            r = db.get(models.AutomationRule, 1)
            r.is_repeating = True; r.repeat_interval = 30; db.commit()
            batch(); batch(); batch(); batch()
            reset_cycle()
            batch(); batch(); batch(); batch()
            assert db.query(models.Notification).count() == 250
            db.query(models.SentAlertLog).update({'sent_at': now - dt.timedelta(hours=1)})
            db.commit(); reset_cycle()
            batch()
            assert db.query(models.Notification).count() == 350
        ''')

    def test_reassignment_and_history_remain_atomic_and_company_scoped(self):
        self.run_case('''
            r = db.get(models.AutomationRule, 1)
            r.reassign_after_alerts_enabled = True; r.reassign_after_alerts_count = 1
            r.reassign_to_user_id = 2; db.commit()
            batch()
            assert db.query(models.Lead).filter(models.Lead.assigned_to_id == 2).count() == 100
            assert db.query(models.LeadHistory).count() == 100
            assert db.get(models.Lead, 251).assigned_to_id == 3
            assert db.query(models.Notification).filter(models.Notification.user_id == 3).count() == 0
        ''')

    def test_busy_company_lock_skips_work_and_http_entry_does_not_evaluate(self):
        self.run_case('''
            from contextlib import contextmanager
            @contextmanager
            def busy(*args): yield False
            with patch.object(rules, 'optional_work_lock', busy):
                assert not batch()
            assert db.query(models.SentAlertLog).count() == 0
            with patch.object(rules, 'evaluate_time_in_status', side_effect=AssertionError('HTTP scan')):
                assert rules.trigger_checks(db, db.get(models.User, 1))['status'] == 'queued'
            assert db.query(models.SentAlertLog).count() == 0
        ''')

    def test_board_alerts_enforce_batch_limit_and_access_scope(self):
        self.run_case('''
            user = db.get(models.User, 1)
            try: rules.get_board_alerts({'lead_ids': list(range(1, 102))}, db, user)
            except HTTPException as error: assert error.status_code == 400
            else: raise AssertionError('unbounded request accepted')
            items = rules.get_board_alerts({'lead_ids': [1, 251, 300]}, db, user)
            assert [item['lead_id'] for item in items] == [1]
        ''')

    def test_log_aggregation_and_lead_queries_are_limited_to_one_batch(self):
        self.run_case('''
            queries = []
            event.listen(engine, 'before_cursor_execute', lambda c, cur, s, p, ctx, many: queries.append((s,p)))
            batch()
            selects = [(s,p) for s,p in queries if s.lstrip().upper().startswith('SELECT')]
            assert len(selects) < 12, len(selects)
            lead_select = next(s for s,p in selects if 'FROM leads' in s)
            assert 'LIMIT' in lead_select
            logs = next(p for s,p in selects if 'max(sent_alert_logs.sent_at)' in s)
            assert len(logs) == 101, len(logs)
        ''')

    def test_reminders_and_appointments_are_bounded_and_not_duplicated(self):
        self.run_case('''
            from routers import notifications
            local_past = dt.datetime.now(notifications.BOGOTA_TZ).replace(tzinfo=None) - dt.timedelta(days=1)
            db.add_all([models.LeadReminder(user_id=1, lead_id=1, reminder_date=local_past, note='Reminder') for _ in range(120)])
            db.add_all([models.LeadAppointment(user_id=1, lead_id=1, appointment_date=local_past) for _ in range(120)])
            db.commit()
            notifications.check_due_reminders(db, 1)
            notifications.check_due_appointments(db, 1)
            assert db.query(models.Notification).count() == 200
            notifications.check_due_reminders(db, 1)
            notifications.check_due_appointments(db, 1)
            assert db.query(models.Notification).count() == 240
            notifications.check_due_reminders(db, 1)
            notifications.check_due_appointments(db, 1)
            assert db.query(models.Notification).count() == 240
        ''')

    def test_independent_worker_runs_one_batch_and_ignores_restoring_company(self):
        self.run_case('''
            import alert_worker
            with patch.object(alert_worker.time, 'sleep', side_effect=KeyboardInterrupt):
                try: alert_worker.serve()
                except KeyboardInterrupt: pass
            assert db.query(models.SentAlertLog).count() == 100
            db.add(models.CompanyBackupJob(id='restore', company_id=1, kind='restore', state='running'))
            db.commit()
            assert alert_worker.company_is_restoring(db, 1)
            assert not alert_worker.company_is_restoring(db, 2)
        ''')
