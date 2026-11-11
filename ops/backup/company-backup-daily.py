#!/usr/bin/env python3
"""Run with the application's virtualenv; no MySQL root permissions required."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from database import SessionLocal, Base
import models
import company_backup as backups


def main():
    db = SessionLocal()
    ids = [company.id for company in db.query(models.Company).filter(models.Company.backups_enabled.is_(True)).all()]
    db.close()
    failures = 0
    for company_id in ids:
        db = SessionLocal()
        try:
            with backups.tenant_lock(company_id):
                backups.prune(company_id)
                result = backups.create_archive(db, Base.metadata, company_id, 'static')
                db.commit()
                print(f'Empresa {company_id}: {result["id"]}, completa={result["verified"]}', flush=True)
        except Exception as error:
            db.rollback()
            failures += 1
            print(f'Empresa {company_id}: ERROR {error}', flush=True)
        finally:
            db.close()
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
