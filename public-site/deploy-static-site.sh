#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/html/autosqp-site}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SOURCE_DIR/web/dist"
[[ "$(realpath -m "$SITE_ROOT")" == "/var/www/html/autosqp-site" ]] || { echo "Destino de publicación no permitido" >&2; exit 1; }
[[ -f "$BUILD_DIR/index.html" ]] || { echo "Primero ejecuta npm ci y npm run build dentro de public-site/web" >&2; exit 1; }

sudo mkdir -p "$SITE_ROOT"
sudo rsync -a --delete "$BUILD_DIR"/ "$SITE_ROOT"/ \
  --exclude "deploy-static-site.sh" \
  --exclude "nginx-autosqp-static-notes.txt"

sudo find "$SITE_ROOT" -type d -exec chmod 755 {} \;
sudo find "$SITE_ROOT" -type f -exec chmod 644 {} \;

echo "Web estatica copiada en $SITE_ROOT"
echo "Siguiente paso: sudo python3 public-site/activate-homepage.py (desde la raíz del repositorio)."
