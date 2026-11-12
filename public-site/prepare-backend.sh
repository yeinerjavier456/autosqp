#!/usr/bin/env bash
set -Eeuo pipefail
BACKEND_DIR="/home/autosqp/apps/autosqp/backend"
[[ -x "$BACKEND_DIR/venv/bin/python" ]] || { echo "No se encontró el entorno de AutosQP" >&2; exit 1; }
cd "$BACKEND_DIR"
# Create additive tables before Gunicorn starts several workers concurrently.
sudo -u autosqp "$BACKEND_DIR/venv/bin/python" -c 'from database import engine; from models import PublicWebsiteContact, AlertRuleProgress, CompanyWebsiteContent; PublicWebsiteContact.__table__.create(engine, checkfirst=True); AlertRuleProgress.__table__.create(engine, checkfirst=True); CompanyWebsiteContent.__table__.create(engine, checkfirst=True)'
sudo systemctl restart autosqp
echo "API preparada para inventario web y contacto SMTP."
