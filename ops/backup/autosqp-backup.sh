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
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-7}"
BACKUP_TIMEZONE="${BACKUP_TIMEZONE:-America/Bogota}"
STATIC_DIR="${STATIC_DIR:-$APP_ROOT/backend/static}"
LOCK_FILE="${LOCK_FILE:-/run/lock/autosqp-backup.lock}"
CATALOG_FILE="${CATALOG_FILE:-/var/lib/autosqp-backup/catalog.json}"
APP_GROUP="${APP_GROUP:-www-data}"

for command_name in mysqldump mysql gzip tar sha256sum flock python3; do
  command -v "$command_name" >/dev/null || { echo "Falta el comando $command_name" >&2; exit 1; }
done
if [[ -n "$S3_URI" ]]; then
  command -v aws >/dev/null || { echo "Falta el comando aws para enviar el respaldo a S3" >&2; exit 1; }
else
  command -v rsync >/dev/null || { echo "Falta rsync para crear respaldos locales incrementales" >&2; exit 1; }
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

if [[ -n "$S3_URI" && -d "$STATIC_DIR" ]]; then
  tar -C "$(dirname "$STATIC_DIR")" -czf "$stage_dir/uploads.tar.gz" "$(basename "$STATIC_DIR")"
elif [[ -n "$S3_URI" ]]; then
  tar -czf "$stage_dir/uploads.tar.gz" --files-from /dev/null
else
  mkdir -p "$stage_dir/static"
  previous_dir="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d \
    -name '20??-??-??_??-??-??' -print | sort | tail -n 1)"
  if [[ -n "$previous_dir" && -d "$previous_dir/static" ]]; then
    rsync -a --delete --link-dest="$previous_dir/static" "$STATIC_DIR/" "$stage_dir/static/"
  elif [[ -d "$STATIC_DIR" ]]; then
    rsync -a "$STATIC_DIR/" "$stage_dir/static/"
  fi
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
if [[ -f "$stage_dir/uploads.tar.gz" ]]; then
  tar -tzf "$stage_dir/uploads.tar.gz" >/dev/null
fi
(
  cd "$stage_dir"
  if [[ -f uploads.tar.gz ]]; then
    sha256sum database.sql.gz uploads.tar.gz metadata.txt > SHA256SUMS
  else
    find static -type f -print0 | sort -z | xargs -0 -r sha256sum > STATIC_SHA256SUMS
    sha256sum database.sql.gz metadata.txt STATIC_SHA256SUMS > SHA256SUMS
  fi
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

mkdir -p "$(dirname "$CATALOG_FILE")"
export BACKUP_ROOT CATALOG_FILE LOCAL_RETENTION_DAYS
python3 - <<'PY'
import datetime
import json
import os
import re

root = os.environ["BACKUP_ROOT"]
catalog_file = os.environ["CATALOG_FILE"]
pattern = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$")
items = []
for backup_id in sorted(os.listdir(root), reverse=True):
    directory = os.path.join(root, backup_id)
    if not pattern.match(backup_id) or not os.path.isdir(directory):
        continue
    metadata = {}
    metadata_path = os.path.join(directory, "metadata.txt")
    if os.path.isfile(metadata_path):
        with open(metadata_path, encoding="utf-8") as handle:
            for raw_line in handle:
                key, separator, value = raw_line.strip().partition("=")
                if separator:
                    metadata[key] = value
    static_files = 0
    static_bytes = 0
    static_root = os.path.join(directory, "static")
    if os.path.isdir(static_root):
        for current_root, _, filenames in os.walk(static_root):
            for filename in filenames:
                try:
                    file_stat = os.stat(os.path.join(current_root, filename))
                except OSError:
                    continue
                static_files += 1
                static_bytes += file_stat.st_size
    uploads_archive = os.path.join(directory, "uploads.tar.gz")
    if os.path.isfile(uploads_archive):
        static_bytes = os.path.getsize(uploads_archive)
    database_path = os.path.join(directory, "database.sql.gz")
    database_bytes = os.path.getsize(database_path) if os.path.isfile(database_path) else 0
    verified = all(os.path.isfile(os.path.join(directory, filename)) for filename in ("database.sql.gz", "SHA256SUMS"))
    items.append({
        "id": backup_id,
        "created_at": metadata.get("created_at"),
        "database": metadata.get("database"),
        "git_commit": metadata.get("git_commit"),
        "database_bytes": database_bytes,
        "static_bytes": static_bytes,
        "total_bytes": database_bytes + static_bytes,
        "static_files": static_files,
        "verified": verified,
    })

payload = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "retention_days": int(os.environ.get("LOCAL_RETENTION_DAYS", "7")),
    "items": items,
}
temporary_file = f"{catalog_file}.tmp"
with open(temporary_file, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
os.replace(temporary_file, catalog_file)
PY
chown root:"$APP_GROUP" "$CATALOG_FILE"
chmod 0640 "$CATALOG_FILE"

echo "[$(date --iso-8601=seconds)] Respaldo verificado: $destination"

