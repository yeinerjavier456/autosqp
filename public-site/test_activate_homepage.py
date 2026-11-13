import importlib.util
import contextlib
import io
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('activate_homepage', Path(__file__).with_name('activate-homepage.py'))
promotion = importlib.util.module_from_spec(spec)
spec.loader.exec_module(promotion)

HTTP = '''server {
    listen 80;
    server_name autosqp.com www.autosqp.com autosqp.co;
    return 301 https://autosqp.com$request_uri;
}
'''
SECONDARY = '''server {
    listen 443 ssl http2;
    server_name www.autosqp.com autosqp.co www.autosqp.co;
    ssl_certificate /etc/letsencrypt/live/autosqp.com/fullchain.pem;
    return 301 https://autosqp.com$request_uri;
}
'''
MAIN = '''server {
    listen 443 ssl http2;
    server_name autosqp.com;
    ssl_certificate /etc/letsencrypt/live/autosqp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/autosqp.com/privkey.pem;
    root /var/www/html/web;
    index index.php index.html index.htm;
    include /etc/nginx/snippets/autosqp-preview.conf;
    location = / {
        return 302 https://autosqp.com/crm/autos;
    }
    location ^~ /api/ { proxy_pass http://127.0.0.1:8000/; }
    location ^~ /crm/api/ { proxy_pass http://127.0.0.1:8000/; }
    location = /crm { return 301 /crm/; }
    location ^~ /crm/ {
        alias /home/autosqp/apps/autosqp/frontend/dist/;
        index index.html;
        try_files $uri $uri/ /crm/index.html;
    }
    location = /web { return 301 https://autosqp.com/crm/autos; }
    location = /web/ { return 301 https://autosqp.com/crm/autos; }
    location ^~ /web/ { return 301 https://autosqp.com/crm/autos; }
    location / {
        try_files $uri $uri/ /index.php?$args;
    }
    location ~* \\.(jpg|css|js|svg|webp)$ { try_files $uri =404; }
}
'''
ADMINER = '''server {
    listen 8080;
    server_name autosqp.com www.autosqp.com _;
    root /var/www/html/adminer;
    index index.php;
    location / { try_files $uri $uri/ =404; }
    location ~ \\.php$ { fastcgi_pass unix:/var/run/php/php8.3-fpm.sock; }
}
'''


class PromotionTests(unittest.TestCase):
    def test_targeted_changes_preserve_other_services(self):
        result=promotion.render_config(HTTP+SECONDARY+MAIN+ADMINER)
        self.assertTrue(result.startswith(HTTP+SECONDARY))
        self.assertTrue(result.endswith(ADMINER))
        for line in MAIN.splitlines():
            if 'crm/autos' not in line and any(token in line for token in ['proxy_pass','ssl_certificate','/crm/','autosqp-preview.conf']):
                self.assertIn(line,result)
        self.assertIn('root /var/www/html/autosqp-site;',result)
        self.assertIn('try_files /index.html =404;',result)
        self.assertIn('try_files $uri $uri/ /index.html;',result)
        self.assertNotIn('return 302 https://autosqp.com/crm/autos;',result)
        self.assertEqual(result.count('return 301 https://autosqp.com/;'),3)

    def test_repeat_activation_is_idempotent(self):
        updated=promotion.render_config(HTTP+SECONDARY+MAIN+ADMINER)
        self.assertEqual(promotion.render_config(updated),updated)

    def test_unexpected_config_is_rejected(self):
        for source in [HTTP+ADMINER, MAIN+MAIN, MAIN.replace('root /var/www/html/web;','root /some/other/site;'), MAIN.replace('return 302 https://autosqp.com/crm/autos;','return 302 https://elsewhere.test/;')]:
            with self.assertRaises(ValueError):promotion.render_config(source)

    def test_bad_nginx_validation_restores_backup_without_reload(self):
        with tempfile.TemporaryDirectory() as folder:
            config=Path(folder)/'autosqp'
            original=HTTP+SECONDARY+MAIN+ADMINER
            config.write_text(original)
            index=Path(folder)/'site/index.html'
            index.parent.mkdir();index.write_text('<html>Site</html>')
            (index.parent/'assets').mkdir()
            checks=0
            calls=[]
            def run(command,check):
                nonlocal checks
                calls.append(command)
                if command[:2]==['cp','-a']:
                    shutil.copy2(command[-2],command[-1])
                elif command==['nginx','-t']:
                    checks+=1
                    if checks==2:raise subprocess.CalledProcessError(1,command)
            with patch.object(promotion,'CONFIG',config),patch.object(promotion,'INDEX',index),patch.object(promotion.os,'geteuid',return_value=0,create=True),patch.object(promotion.subprocess,'run',side_effect=run),contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(subprocess.CalledProcessError):promotion.activate()
            self.assertEqual(config.read_text(),original)
            self.assertEqual(len(list(Path(folder).glob('autosqp.pre-public-home-*'))),1)
            self.assertNotIn(['systemctl','reload','nginx'],calls)
