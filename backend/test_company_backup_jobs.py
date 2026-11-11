"""Integration test with a real temporary database and separate API/worker imports."""
import os
from pathlib import Path
import subprocess
import sys
import textwrap
import unittest
import tempfile


class PersistentBackupJobTests(unittest.TestCase):
    def test_request_and_completion_survive_separate_processes(self):
        with tempfile.TemporaryDirectory() as folder:
            database = (Path(folder) / 'queue.db').as_posix()
            env = dict(os.environ, DATABASE_URL=f'sqlite:///{database}', PYTHONPATH=str(Path(__file__).resolve().parent))
            first = subprocess.run([sys.executable, '-c', "import models,company_backup_jobs as jobs; from database import Base,engine,SessionLocal; Base.metadata.create_all(engine); db=SessionLocal(); company=models.Company(name='Persistencia',backups_enabled=True); db.add(company); db.commit(); print(jobs.enqueue(db,company.id,'backup')); db.close()"], env=env, capture_output=True, text=True, timeout=30)
            self.assertEqual(first.returncode, 0, first.stderr)
            job_id = first.stdout.strip()
            env['TEST_JOB_ID'] = job_id
            second = subprocess.run([sys.executable, '-c', "import os,models,company_backup_jobs as jobs; from database import SessionLocal; db=SessionLocal(); job_id=os.environ['TEST_JOB_ID']; assert db.get(models.CompanyBackupJob,job_id).state=='queued'; assert jobs.claim(db,'separate-worker')==job_id; jobs.finish(job_id,'separate-worker','complete','Terminada','archive-id'); db.close()"], env=env, capture_output=True, text=True, timeout=30)
            self.assertEqual(second.returncode, 0, second.stderr)
            third = subprocess.run([sys.executable, '-c', "import os,models; from database import SessionLocal; db=SessionLocal(); job=db.get(models.CompanyBackupJob,os.environ['TEST_JOB_ID']); assert job.state=='complete' and job.finished_at is not None; print(job.message); db.close()"], env=env, capture_output=True, text=True, timeout=30)
            self.assertEqual(third.returncode, 0, third.stderr)
            self.assertEqual(third.stdout.strip(), 'Terminada')

    def test_persistence_recovery_completion_and_duplicate_clicks(self):
        code = textwrap.dedent('''
            import contextlib, datetime, os, tempfile
            from pathlib import Path
            import models, company_backup_jobs as jobs, company_backup as backups
            from database import Base, engine, SessionLocal
            Base.metadata.create_all(engine)
            db = SessionLocal()
            company = models.Company(name='Empresa prueba', backups_enabled=True)
            other = models.Company(name='Otra empresa', backups_enabled=True)
            db.add_all([company, other]); db.commit()
            company_id, other_id = company.id, other.id
            first = jobs.enqueue(db, company_id, 'backup', actor=1)
            assert jobs.enqueue(db, company_id, 'backup', actor=1) == first
            assert db.query(models.CompanyBackupJob).count() == 1
            db.close()
            # A fresh session (as after browser reload or another web process)
            # sees the original request; it is not tied to the first session.
            db = SessionLocal()
            record = db.get(models.CompanyBackupJob, first)
            assert record.state == 'queued'
            claimed = jobs.claim(db, 'worker-one')
            assert claimed == first
            record = db.get(models.CompanyBackupJob, first)
            assert record.state == 'running'
            assert jobs.claim(db, 'another-worker') is None
            # Expire the abandoned lease: a backup, not a restore, can resume.
            db.query(models.CompanyBackupJob).filter_by(id=first).update({'lease_expires_at': datetime.datetime.utcnow() - datetime.timedelta(seconds=1)})
            db.commit()
            assert jobs.claim(db, 'worker-two') == first
            jobs.finish(first, 'worker-one', 'failed', 'stale worker must not overwrite')
            db.expire_all()
            assert db.get(models.CompanyBackupJob, first).state == 'running'
            jobs.finish(first, 'worker-two', 'complete', 'Terminada', 'saved-backup')
            db.expire_all()
            record = db.get(models.CompanyBackupJob, first)
            assert record.state == 'complete' and record.finished_at is not None
            assert record.backup_id == 'saved-backup' and record.attempts == 2
            assert db.query(models.CompanyBackupJob).filter_by(company_id=other_id).count() == 0
            # Operational queue rows never enter tenant archives or get restored.
            rows = backups.scope_rows(db, Base.metadata, company_id)
            assert 'company_backup_jobs' not in rows
            # Restores with an expired lease are never blindly replayed.
            restore_id = jobs.enqueue(db, company_id, 'restore', 'snapshot', actor=1)
            assert jobs.claim(db, 'worker-three') == restore_id
            db.query(models.CompanyBackupJob).filter_by(id=restore_id).update({'lease_expires_at': datetime.datetime.utcnow() - datetime.timedelta(seconds=1)})
            db.commit()
            assert jobs.claim(db, 'worker-four') is None
            jobs.finish(restore_id, 'worker-three', 'failed', 'Review required')
            db.close()
            # Execute the real archive creation without coupling it to any API
            # response. Only the OS-specific file lock is replaced on Windows.
            with tempfile.TemporaryDirectory() as folder:
                os.environ['AUTOSQP_COMPANY_BACKUP_ROOT'] = folder
                backups.tenant_lock = lambda company_id: contextlib.nullcontext()
                db = SessionLocal()
                actual = jobs.enqueue(db, company_id, 'backup', actor=1)
                assert jobs.claim(db, 'real-worker') == actual
                db.close()
                jobs.run_claimed(actual, 'real-worker')
                db = SessionLocal()
                record = db.get(models.CompanyBackupJob, actual)
                assert record.state == 'complete', record.message
                archive_id = record.backup_id
                assert backups.archive_path(company_id, archive_id).exists()
                db.query(models.CompanyBackupJob).filter_by(id=actual).update({
                    'state': 'running', 'worker_token': 'old-token',
                    'lease_expires_at': datetime.datetime.utcnow() - datetime.timedelta(seconds=1)})
                db.commit()
                assert jobs.claim(db, 'recover-worker') == actual
                db.close()
                jobs.run_claimed(actual, 'recover-worker')
                assert len(backups.catalog(company_id)['items']) == 1
                db = SessionLocal()
                assert db.get(models.CompanyBackupJob, actual).state == 'complete'
                db.close()
            print('Persistent backup queue checks passed')
        ''')
        env = dict(os.environ, DATABASE_URL='sqlite://', PYTHONPATH=str(Path(__file__).resolve().parent))
        result = subprocess.run([sys.executable, '-c', code], env=env, capture_output=True, text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__': unittest.main()
