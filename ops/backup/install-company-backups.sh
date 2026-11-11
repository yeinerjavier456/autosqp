#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "Ejecuta con sudo" >&2; exit 1; }
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
[[ -x /home/autosqp/apps/autosqp/backend/venv/bin/python ]] || { echo "No se encontró el entorno de AutosQP en la ruta esperada" >&2; exit 1; }
install -d -m 0700 -o autosqp -g autosqp /var/lib/autosqp-company-backups
install -m 0644 "$script_dir/autosqp-company-backup.service" /etc/systemd/system/autosqp-company-backup.service
install -m 0644 "$script_dir/autosqp-company-backup.timer" /etc/systemd/system/autosqp-company-backup.timer
systemctl daemon-reload
systemctl enable --now autosqp-company-backup.timer
echo "Copias por empresa programadas diariamente a las 03:45 de Bogotá (hasta 5 minutos de variación)."
echo "Activa cada empresa desde Empresas Globales > Editar > Copias de seguridad."
