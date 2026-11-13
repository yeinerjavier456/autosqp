#!/usr/bin/env python3
"""Promote the known AutosQP preview setup without replacing CRM/API/TLS blocks."""
import datetime
import os
from pathlib import Path
import re
import subprocess
import sys

CONFIG = Path('/etc/nginx/sites-available/autosqp')
INDEX = Path('/var/www/html/autosqp-site/index.html')


def render_config(source):
    # Restrict all replacements to the principal HTTPS server supplied by the
    # operator. Balanced braces include locations; comments do not affect depth.
    starts = list(re.finditer(r'^server\s*\{', source, re.M))
    matches = []
    for start in starts:
        depth = 0
        end = None
        for line in source[start.start():].splitlines(keepends=True):
            active = line.split('#', 1)[0]
            depth += active.count('{') - active.count('}')
            end = (end or start.start()) + len(line)
            if depth == 0:
                break
        if depth != 0:
            raise ValueError('Bloque server incompleto. No se cambió nada.')
        block = source[start.start():end]
        if re.search(r'^\s*server_name\s+autosqp\.com\s*;', block, re.M) and re.search(r'listen\s+443\b', block):
            matches.append((start.start(), end, block))
    if len(matches) != 1:
        raise ValueError('No se encontró un único bloque HTTPS principal de autosqp.com. No se cambió nada.')
    begin, end, block = matches[0]

    def replace(old, new, already):
        nonlocal block
        count = len(re.findall(old, block, re.M))
        if count == 1:
            block = re.sub(old, lambda match: new, block, count=1, flags=re.M)
        elif count != 0 or not re.search(already, block, re.M):
            raise ValueError('La configuración no coincide con la versión esperada. No se cambió nada; revisa el bloque principal.')

    replace(r'^\s*root /var/www/html/web;', '    root /var/www/html/autosqp-site;', r'^\s*root /var/www/html/autosqp-site;')
    replace(r'^\s*index index\.php index\.html index\.htm;', '    index index.html;', r'^\s*index index\.html;')
    replace(r'    location = /\s*\{\s*return 302 https://autosqp\.com/crm/autos;\s*\}',
            '    location = / {\n        try_files /index.html =404;\n        add_header Cache-Control "no-cache, no-store, must-revalidate";\n    }',
            r'location = /\s*\{\s*try_files /index\.html =404;')
    replace(r'^\s*try_files \$uri \$uri/ /index\.php\?\$args;',
            '        try_files $uri $uri/ /index.html;', r'^\s*try_files \$uri \$uri/ /index\.html;')
    # Old /web links should also land on the new homepage. No HTTP/HTTPS or www
    # canonical redirects are altered (those live in the other server blocks).
    block = block.replace('return 301 https://autosqp.com/crm/autos;', 'return 301 https://autosqp.com/;')
    return source[:begin] + block + source[end:]


def activate():
    if os.geteuid() != 0:
        raise ValueError('Ejecuta con sudo python3 public-site/activate-homepage.py')
    if not INDEX.is_file() or not (INDEX.parent / 'assets').is_dir():
        raise ValueError('Primero compila la web y ejecuta bash public-site/deploy-static-site.sh')
    if CONFIG.is_symlink():
        raise ValueError('El archivo de sites-available es un enlace simbólico; revisa su destino antes de modificarlo.')
    original = CONFIG.read_text()
    updated = render_config(original)
    subprocess.run(['nginx', '-t'], check=True)
    if updated == original:
        print('La portada ya estaba configurada; se recargará Nginx.')
    else:
        backup = CONFIG.with_name(CONFIG.name + '.pre-public-home-' + datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))
        # Preserve permissions/owner and write to the existing file so symlinks
        # in sites-enabled keep working. The backup is recoverable, never deleted.
        subprocess.run(['cp', '-a', '--', str(CONFIG), str(backup)], check=True)
        try:
            CONFIG.write_text(updated)
            subprocess.run(['nginx', '-t'], check=True)
        except Exception:
            subprocess.run(['cp', '-a', '--', str(backup), str(CONFIG)], check=True)
            raise
        print(f'Copia de Nginx: {backup}', flush=True)
    try:
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        if updated != original:
            subprocess.run(['cp', '-a', '--', str(backup), str(CONFIG)], check=True)
            subprocess.run(['nginx', '-t'], check=True)
        raise
    print('Portada activada en https://autosqp.com/; CRM, API y Adminer conservados.')


if __name__ == '__main__':
    try:
        activate()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'No se pudo activar la portada: {error}', file=sys.stderr)
        sys.exit(1)
