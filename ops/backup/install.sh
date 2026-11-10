#!/usr/bin/env bash
set -Eeuo pipefail
[[ "${EUID:-$(id -u)}" -eq 0 ]] || { echo "Ejecuta con sudo" >&2; exit 1; }

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install -m 0750 "$script_dir/autosqp-backup.sh" /usr/local/sbin/autosqp-backup
install -m 0750 "$script_dir/autosqp-restore.sh" /usr/local/sbin/autosqp-restore
install -m 0750 "$script_dir/autosqp-process-restore-request.sh" /usr/local/sbin/autosqp-process-restore-request
install -m 0644 "$script_dir/autosqp-backup.service" /etc/systemd/system/autosqp-backup.service
install -m 0644 "$script_dir/autosqp-backup.timer" /etc/systemd/system/autosqp-backup.timer
install -m 0644 "$script_dir/autosqp-restore-request.service" /etc/systemd/system/autosqp-restore-request.service
install -m 0644 "$script_dir/autosqp-restore-request.path" /etc/systemd/system/autosqp-restore-request.path
install -d -m 0770 -o root -g www-data /var/lib/autosqp-backup/requests

if [[ ! -e /etc/autosqp-backup.conf ]]; then
  install -m 0600 "$script_dir/autosqp-backup.conf.example" /etc/autosqp-backup.conf
  echo "Creado /etc/autosqp-backup.conf. Edítalo antes de activar el timer."
fi

systemctl daemon-reload
systemctl enable --now autosqp-restore-request.path
echo "Instalado. Completa la configuración, ejecuta una prueba y luego activa el timer."

