#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/html/autosqp-site}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sudo mkdir -p "$SITE_ROOT"
sudo rsync -a --delete "$SOURCE_DIR"/ "$SITE_ROOT"/ \
  --exclude "deploy-static-site.sh" \
  --exclude "nginx-autosqp-static-notes.txt"

sudo find "$SITE_ROOT" -type d -exec chmod 755 {} \;
sudo find "$SITE_ROOT" -type f -exec chmod 644 {} \;

echo "Web estatica copiada en $SITE_ROOT"
echo "Siguiente paso: ajustar Nginx para usar root $SITE_ROOT en el bloque principal de autosqp.com."
