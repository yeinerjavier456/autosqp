#!/usr/bin/env bash
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/html/autosqp-preview}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_SNIPPET="/etc/nginx/snippets/autosqp-preview.conf"
NGINX_SITE="/etc/nginx/sites-available/autosqp"

# 1. Copiar archivos del sitio
sudo mkdir -p "$SITE_ROOT"
sudo rsync -a --delete "$SOURCE_DIR"/ "$SITE_ROOT"/ \
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
  # Inserta el include justo antes del primer location
  sudo sed -i '0,/location/{s|location|    include /etc/nginx/snippets/autosqp-preview.conf;\n\n    location|}' "$NGINX_SITE"
  echo "✓ Include agregado en $NGINX_SITE"
else
  echo "· Include ya existe en $NGINX_SITE, sin cambios"
fi

# 4. Validar y recargar Nginx
sudo nginx -t && sudo systemctl reload nginx
echo "✓ Nginx recargado — preview disponible en /preview/"
