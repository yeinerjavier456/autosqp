#!/usr/bin/env python3
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))
from company_backup_jobs import serve

if __name__ == '__main__':
    serve()
