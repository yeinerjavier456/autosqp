#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CONFIG_FILE="${AUTOSQP_BACKUP_CONFIG:-/etc/autosqp-backup.conf}"
[[ -r "$CONFIG_FILE" ]] || { echo "No se puede leer $CONFIG_FILE" >&2; exit 1; }
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${DB_NAME:?Falta DB_NAME}"
: "${MYSQL_DEFAULTS_FILE:?Falta MYSQL_DEFAULTS_FILE}"
: "${RESTORE_MYSQL_DEFAULTS_FILE:?Falta RESTORE_MYSQL_DEFAULTS_FILE}"
: "${APP_ROOT:?Falta APP_ROOT}"
: "${BACKUP_ROOT:?Falta BACKUP_ROOT}"
: "${S3_URI:?Falta S3_URI}"

STATIC_DIR="${STATIC_DIR:-$APP_ROOT/backend/static}"
APP_SERVICE="${APP_SERVICE:-autosqp}"
for command_name in mysql mysqldump gunzip gzip tar sha256sum aws systemctl; do
  command -v "$command_name" >/dev/null || { echo "Falta el comando $command_name" >&2; exit 1; }
done
[[ -r "$RESTORE_MYSQL_DEFAULTS_FILE" ]] || { echo "No se puede leer $RESTORE_MYSQL_DEFAULTS_FILE" >&2; exit 1; }
backup_id="${1:-}"
confirmation="${2:-}"
[[ -n "$backup_id" ]] || { echo "Uso: autosqp-restore ID_RESPALDO RESTAURAR-$DB_NAME" >&2; exit 2; }
[[ "$backup_id" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{2}-[0-9]{2}-[0-9]{2}$ ]] || { echo "ID inválido" >&2; exit 2; }
[[ "$confirmation" == "RESTAURAR-$DB_NAME" ]] || { echo "Confirmación incorrecta. Esta operación reemplaza la base y los archivos." >&2; exit 2; }

backup_dir="$BACKUP_ROOT/$backup_id"
mkdir -p "$backup_dir"
if [[ ! -f "$backup_dir/SHA256SUMS" ]]; then
  aws s3 cp "${S3_URI%/}/$backup_id/" "$backup_dir/" --recursive --only-show-errors
fi
(
  cd "$backup_dir"
  sha256sum -c SHA256SUMS
)
gzip -t "$backup_dir/database.sql.gz"
tar -tzf "$backup_dir/uploads.tar.gz" >/dev/null

pre_restore="$BACKUP_ROOT/pre-restore_$(date +'%Y-%m-%d_%H-%M-%S')"
mkdir -p "$pre_restore"
mysqldump --defaults-extra-file="$MYSQL_DEFAULTS_FILE" --single-transaction --quick \
  --no-tablespaces --databases "$DB_NAME" | gzip -9 > "$pre_restore/database.sql.gz"
if [[ -d "$STATIC_DIR" ]]; then
  tar -C "$(dirname "$STATIC_DIR")" -czf "$pre_restore/uploads.tar.gz" "$(basename "$STATIC_DIR")"
fi

systemctl stop "$APP_SERVICE"
restart_app() { systemctl start "$APP_SERVICE" || true; }
trap restart_app EXIT

gunzip -c "$backup_dir/database.sql.gz" | mysql --defaults-extra-file="$RESTORE_MYSQL_DEFAULTS_FILE"
rm -rf -- "$STATIC_DIR"
mkdir -p "$(dirname "$STATIC_DIR")"
tar -C "$(dirname "$STATIC_DIR")" -xzf "$backup_dir/uploads.tar.gz"
mkdir -p "$STATIC_DIR"
chown -R "${APP_USER:-www-data}:${APP_GROUP:-www-data}" "$STATIC_DIR"

systemctl start "$APP_SERVICE"
trap - EXIT
echo "Restauración $backup_id completada. Copia previa: $pre_restore"

