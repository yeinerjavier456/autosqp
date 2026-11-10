#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CONFIG_FILE="${AUTOSQP_BACKUP_CONFIG:-/etc/autosqp-backup.conf}"
[[ -r "$CONFIG_FILE" ]] || { echo "No se puede leer $CONFIG_FILE" >&2; exit 1; }
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${DB_NAME:?Falta DB_NAME}"
REQUEST_FILE="${RESTORE_REQUEST_FILE:-/var/lib/autosqp-backup/requests/restore-request.json}"
[[ -f "$REQUEST_FILE" ]] || exit 0

exec 9>/run/lock/autosqp-restore.lock
flock -n 9 || { echo "Ya hay una restauración en ejecución" >&2; exit 1; }

backup_id="$(python3 - "$REQUEST_FILE" <<'PY'
import json
import re
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)
backup_id = str(payload.get("backup_id", ""))
if not re.fullmatch(r"\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}", backup_id):
    raise SystemExit("ID de respaldo inválido")
print(backup_id)
PY
)"

cleanup() { rm -f -- "$REQUEST_FILE"; }
trap cleanup EXIT
echo "Restauración solicitada para $backup_id; iniciando en 5 segundos"
sleep 5
/usr/local/sbin/autosqp-restore "$backup_id" "RESTAURAR-$DB_NAME"
echo "Restauración solicitada desde la interfaz completada: $backup_id"

