#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/html/autosqp-preview}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SOURCE_DIR/web/dist"
[[ "$(realpath -m "$SITE_ROOT")" == "/var/www/html/autosqp-preview" ]] || { echo "Destino de preview no permitido" >&2; exit 1; }
[[ -f "$BUILD_DIR/index.html" ]] || { echo "Primero ejecuta npm ci y npm run build dentro de public-site/web" >&2; exit 1; }
NGINX_SNIPPET="/etc/nginx/snippets/autosqp-preview.conf"
NGINX_SITE="/etc/nginx/sites-available/autosqp"

# 1. Copiar archivos del sitio
sudo mkdir -p "$SITE_ROOT"
sudo rsync -a --delete "$BUILD_DIR"/ "$SITE_ROOT"/ \
  --exclude "deploy-static-site.sh" \
  --exclude "deploy-preview.sh" \
  --exclude "nginx-autosqp-static-notes.txt" \
  --exclude "nginx-preview-notes.txt" \
  --exclude "nginx-preview.conf"

sudo find "$SITE_ROOT" -type d -exec chmod 755 {} \;
sudo find "$SITE_ROOT" -type f -exec chmod 644 {} \;
echo "✓ Sitio preview copiado en $SITE_ROOT"

# 2. Instalar snippet de Nginx si no existe
sudo mkdir -p /etc/nginx/snippets
sudo cp "$SOURCE_DIR/nginx-preview.conf" "$NGINX_SNIPPET"
echo "✓ Snippet Nginx instalado en $NGINX_SNIPPET"

# 3. Agregar include en el site config si aún no está
if ! grep -q "autosqp-preview.conf" "$NGINX_SITE" 2>/dev/null; then
  echo "Agrega include /etc/nginx/snippets/autosqp-preview.conf; dentro del server HTTPS de autosqp.com y vuelve a ejecutar este script." >&2
  exit 1
else
  echo "· Include ya existe en $NGINX_SITE, sin cambios"
fi

# 4. Validar y recargar Nginx
sudo nginx -t && sudo systemctl reload nginx
echo "✓ Nginx recargado — preview disponible en /preview/"
