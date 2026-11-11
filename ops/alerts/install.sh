#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "Ejecuta con sudo" >&2; exit 1; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -x /home/autosqp/apps/autosqp/backend/venv/bin/python ]] || { echo "No se encontró el entorno de AutosQP" >&2; exit 1; }
# Bootstrap once before restarting multiple Gunicorn workers: avoid concurrent
# CREATE TABLE attempts for the new cursor table during a rolling deployment.
cd /home/autosqp/apps/autosqp/backend
runuser -u autosqp -- /home/autosqp/apps/autosqp/backend/venv/bin/python -c 'from database import engine; from models import AlertRuleProgress; AlertRuleProgress.__table__.create(engine, checkfirst=True)'
install -m 0644 "$script_dir/autosqp-alert-worker.service" /etc/systemd/system/autosqp-alert-worker.service
systemctl daemon-reload
systemctl enable --now autosqp-alert-worker.service
echo "Proceso de alertas habilitado. Tras actualizar código, reinicia autosqp-alert-worker."
