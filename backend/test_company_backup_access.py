import ast
import datetime
import hashlib
from pathlib import Path
from types import SimpleNamespace as NS
import unittest


class Denied(Exception):
    def __init__(self, status, detail): self.status_code = status


class TokenError(Exception): pass


class Field:
    def __eq__(self, value): return self


class CompanyBackupAccessTests(unittest.TestCase):
    def setUp(self):
        source = Path(__file__).with_name('routers') / 'company_backups.py'
        tree = ast.parse(source.read_text(encoding='utf-8'))
        names = {'company_scope', 'marker', 'authorize', 'save_settings', 'unlock'}
        nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
        for node in nodes:
            node.decorator_list = []
            node.args.defaults = []
            for arg in node.args.args: arg.annotation = None
        self.company = NS(id=1, backups_enabled=True, finance_password_hash='current')
        self.db = NS(query=lambda model: NS(filter=lambda *args: NS(first=lambda: self.company)), add=lambda item: None, commit=lambda: None)
        self.user = NS(id=8, company_id=1, role='admin')
        self.token = {'type': 'company_backup_access', 'sub': '8', 'company_id': 1, 'marker': hashlib.sha256(b'current').hexdigest()}
        self.context = dict(hashlib=hashlib, datetime=datetime, HTTPException=Denied, JWTError=TokenError,
            models=NS(Company=NS(id=Field()), SystemLog=lambda **kw: NS(**kw)),
            is_company_admin=lambda user: user.role in {'admin', 'super_admin'}, get_effective_role_name=lambda user: user.role,
            jwt=NS(decode=lambda *args, **kw: self.token),
            auth_utils=NS(SECRET_KEY='test', ALGORITHM='HS256', verify_password=lambda password, hashed: password == 'correct', create_access_token=lambda **kw: kw))
        exec(compile(ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[])), '<backup access>', 'exec'), self.context)

    def authorize(self):
        return self.context['authorize'](1, self.user, self.db, NS(headers={'X-Backup-Access-Token': 'ticket'}))

    def test_admin_cannot_access_another_company(self):
        self.user.company_id = 2
        with self.assertRaises(Denied): self.authorize()

    def test_disabled_company_is_blocked(self):
        self.company.backups_enabled = False
        with self.assertRaises(Denied): self.authorize()

    def test_changed_password_invalidates_access(self):
        self.company.finance_password_hash = 'changed'
        with self.assertRaises(Denied): self.authorize()

    def test_token_cannot_be_reused_for_another_company_or_user(self):
        self.token['company_id'] = 2
        with self.assertRaises(Denied): self.authorize()
        self.token['company_id'] = 1
        self.token['sub'] = '77'
        with self.assertRaises(Denied): self.authorize()

    def test_only_global_admin_can_enable_backups(self):
        with self.assertRaises(Denied): self.context['save_settings'](1, NS(enabled=True), self.db, self.user)
        self.user.role = 'super_admin'
        self.assertTrue(self.context['save_settings'](1, NS(enabled=True), self.db, self.user)['enabled'])

    def test_unlock_requires_accounts_password(self):
        with self.assertRaises(Denied): self.context['unlock'](1, NS(password='wrong'), self.db, self.user)
        self.assertIn('access_token', self.context['unlock'](1, NS(password='correct'), self.db, self.user))


if __name__ == '__main__': unittest.main()
