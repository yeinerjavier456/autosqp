#!/usr/bin/env bash
set -euo pipefail

WP_PATH="${WP_PATH:-/var/www/html/web}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

upsert_page() {
  local slug="$1"
  local title="$2"
  local file="$3"
  local existing_id

  existing_id="$(wp post list --path="$WP_PATH" --post_type=page --name="$slug" --field=ID --allow-root 2>/dev/null || true)"

  if [[ -n "$existing_id" ]]; then
    wp post update "$existing_id" \
      --path="$WP_PATH" \
      --post_title="$title" \
      --post_name="$slug" \
      --post_status=publish \
      --post_content="$(cat "$BASE_DIR/$file")" \
      --allow-root >/dev/null
    echo "$existing_id"
  else
    wp post create \
      --path="$WP_PATH" \
      --post_type=page \
      --post_title="$title" \
      --post_name="$slug" \
      --post_status=publish \
      --post_content="$(cat "$BASE_DIR/$file")" \
      --porcelain \
      --allow-root
  fi
}

home_id="$(upsert_page inicio "Autos QP" autosqp-home.html)"
upsert_page venta "Compra y retoma de vehiculos" venta.html >/dev/null
upsert_page formulario "Formulario Autos QP" formulario.html >/dev/null
upsert_page detailing "Detailing Autos QP" detailing.html >/dev/null

wp option update show_on_front page --path="$WP_PATH" --allow-root >/dev/null
wp option update page_on_front "$home_id" --path="$WP_PATH" --allow-root >/dev/null
wp rewrite flush --hard --path="$WP_PATH" --allow-root >/dev/null

echo "Paginas publicadas:"
echo "- Inicio: https://autosqp.com/"
echo "- Compra: https://autosqp.com/venta"
echo "- Formulario: https://autosqp.com/formulario"
echo "- Detailing: https://autosqp.com/detailing"
