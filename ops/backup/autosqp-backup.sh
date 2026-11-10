#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CONFIG_FILE="${AUTOSQP_BACKUP_CONFIG:-/etc/autosqp-backup.conf}"
[[ -r "$CONFIG_FILE" ]] || { echo "No se puede leer $CONFIG_FILE" >&2; exit 1; }
# shellcheck source=/dev/null
source "$CONFIG_FILE"

: "${DB_NAME:?Falta DB_NAME}"
: "${MYSQL_DEFAULTS_FILE:?Falta MYSQL_DEFAULTS_FILE}"
: "${APP_ROOT:?Falta APP_ROOT}"
: "${BACKUP_ROOT:?Falta BACKUP_ROOT}"

S3_URI="${S3_URI:-}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-30}"
BACKUP_TIMEZONE="${BACKUP_TIMEZONE:-America/Bogota}"
STATIC_DIR="${STATIC_DIR:-$APP_ROOT/backend/static}"
LOCK_FILE="${LOCK_FILE:-/run/lock/autosqp-backup.lock}"

for command_name in mysqldump mysql gzip tar sha256sum flock; do
  command -v "$command_name" >/dev/null || { echo "Falta el comando $command_name" >&2; exit 1; }
done
if [[ -n "$S3_URI" ]]; then
  command -v aws >/dev/null || { echo "Falta el comando aws para enviar el respaldo a S3" >&2; exit 1; }
fi
[[ -r "$MYSQL_DEFAULTS_FILE" ]] || { echo "No se puede leer $MYSQL_DEFAULTS_FILE" >&2; exit 1; }

mkdir -p "$BACKUP_ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Ya hay un respaldo en ejecución" >&2; exit 1; }

backup_id="$(TZ="$BACKUP_TIMEZONE" date +'%Y-%m-%d_%H-%M-%S')"
stage_dir="$BACKUP_ROOT/.${backup_id}.tmp"
final_dir="$BACKUP_ROOT/$backup_id"

cleanup() { rm -rf -- "$stage_dir"; }
trap cleanup EXIT
mkdir -p "$stage_dir"

echo "[$(date --iso-8601=seconds)] Iniciando respaldo $backup_id"
mysqldump \
  --defaults-extra-file="$MYSQL_DEFAULTS_FILE" \
  --single-transaction --quick --triggers --events --hex-blob \
  --no-tablespaces \
  --databases "$DB_NAME" | gzip -9 > "$stage_dir/database.sql.gz"

if [[ -d "$STATIC_DIR" ]]; then
  tar -C "$(dirname "$STATIC_DIR")" -czf "$stage_dir/uploads.tar.gz" "$(basename "$STATIC_DIR")"
else
  tar -czf "$stage_dir/uploads.tar.gz" --files-from /dev/null
fi

cat > "$stage_dir/metadata.txt" <<EOF
backup_id=$backup_id
database=$DB_NAME
created_at=$(date --iso-8601=seconds)
timezone=$BACKUP_TIMEZONE
hostname=$(hostname -f 2>/dev/null || hostname)
git_commit=$(git -C "$APP_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)
EOF

gzip -t "$stage_dir/database.sql.gz"
tar -tzf "$stage_dir/uploads.tar.gz" >/dev/null
(
  cd "$stage_dir"
  sha256sum database.sql.gz uploads.tar.gz metadata.txt > SHA256SUMS
  sha256sum -c SHA256SUMS
)

mv -- "$stage_dir" "$final_dir"
trap - EXIT

if [[ -n "$S3_URI" ]]; then
  aws s3 cp "$final_dir/" "${S3_URI%/}/$backup_id/" \
    --recursive --only-show-errors --sse AES256
  aws s3 ls "${S3_URI%/}/$backup_id/SHA256SUMS" >/dev/null
  destination="${S3_URI%/}/$backup_id/"
else
  destination="$final_dir"
fi

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '.*.tmp' \
  -mtime "+$LOCAL_RETENTION_DAYS" -exec rm -rf -- {} +

echo "[$(date --iso-8601=seconds)] Respaldo verificado: $destination"

