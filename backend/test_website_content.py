import os
from pathlib import Path
import subprocess
import sys
import textwrap
import unittest

SETUP = '''
import tempfile, json
from pathlib import Path
from types import SimpleNamespace
from io import BytesIO
from PIL import Image
from fastapi import HTTPException
from pydantic import ValidationError
import models
from database import Base, engine, SessionLocal
import website_content as cms
Base.metadata.create_all(engine)
db = SessionLocal()
db.add_all([models.Company(id=1,name='One'), models.Company(id=2,name='Two')]); db.commit()
key = next(field['key'] for field in cms.catalog()['fields'] if field['key'].startswith('Hero.') and field['kind']=='text')
image_key = next(field['key'] for field in cms.catalog()['fields'] if field['kind']=='image')
def payload(revision=0, value='Título nuevo', testimonials=None):
    return cms.WebsiteContentUpdate(revision=revision,values={key:value},testimonials=cms.catalog()['testimonials'] if testimonials is None else testimonials)
'''


class WebsiteContentTests(unittest.TestCase):
    def run_case(self, code):
        env = dict(os.environ, DATABASE_URL='sqlite://', PYTHONPATH=str(Path(__file__).resolve().parent))
        result = subprocess.run([sys.executable, '-c', textwrap.dedent(SETUP) + '\n' + textwrap.dedent(code)], env=env, capture_output=True, text=True, timeout=35)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_only_authoritative_global_admin_can_edit(self):
        self.run_case('''
            for role in [None, SimpleNamespace(name='admin',base_role_name='admin'), SimpleNamespace(name='asesor',base_role_name='asesor',label='Super Admin')]:
                try: cms.ensure_global_editor(SimpleNamespace(role=role))
                except HTTPException as error: assert error.status_code == 403
                else: raise AssertionError('permission escalation')
            cms.ensure_global_editor(SimpleNamespace(role=SimpleNamespace(name='custom',base_role_name='super_admin')))
        ''')

    def test_defaults_isolation_persistence_and_revision_conflicts(self):
        self.run_case('''
            assert cms.read_content(db,1)['revision'] == 0
            result=cms.save_content(db,1,payload(),10)
            assert result['values'][key]=='Título nuevo' and result['revision']==1
            db.close(); db=SessionLocal()
            assert cms.read_content(db,1)['values'][key]=='Título nuevo'
            assert cms.read_content(db,2)['values']=={}
            try: cms.save_content(db,1,payload(0,'Stale editor'),20)
            except HTTPException as error: assert error.status_code==409
            else: raise AssertionError('lost update')
            assert cms.read_content(db,1)['values'][key]=='Título nuevo'
        ''')

    def test_add_edit_remove_reorder_testimonials(self):
        self.run_case('''
            items=cms.catalog()['testimonials'][:2]
            cms.save_content(db,1,payload(testimonials=items),10)
            items=[dict(items[1], name='Cliente editado'), dict(items[0])]
            cms.save_content(db,1,payload(1,testimonials=items),10)
            assert cms.read_content(db,1)['testimonials'][0]['name']=='Cliente editado'
            cms.save_content(db,1,payload(2,testimonials=[]),10)
            assert cms.read_content(db,1)['testimonials']==[]
            assert len(cms.read_content(db,2)['testimonials'])==4
        ''')

    def test_unknown_fields_unsafe_urls_duplicate_ids_and_invalid_ratings_rejected(self):
        self.run_case('''
            for values in [{'private.setting':'secret'}, {image_key:'javascript:alert(1)'}, {image_key:'file:///etc/passwd'}, {image_key:'data:text/html,<script>alert(1)</script>'}, {image_key:'https://user:secret@example.com/photo.jpg'}]:
                try: cms.WebsiteContentUpdate(revision=0,values=values,testimonials=[])
                except ValidationError: pass
                else: raise AssertionError('invalid content accepted')
            item=cms.catalog()['testimonials'][0]
            for items in [[item,item], [dict(item,rating=6)], [dict(item,avatar='javascript:alert(1)')]]:
                try: cms.WebsiteContentUpdate(revision=0,values={},testimonials=items)
                except ValidationError: pass
                else: raise AssertionError('invalid testimonial accepted')
        ''')

    def test_image_upload_has_owned_path_real_image_validation_and_no_metadata(self):
        self.run_case('''
            with tempfile.TemporaryDirectory() as folder:
                image=Image.new('RGB',(80,40),'green')
                data=BytesIO(); image.save(data,format='JPEG',exif=b'Exif\\x00\\x00')
                result=cms.save_image(data.getvalue(),2,folder)
                assert result['url'].startswith('/api/static/company-websites/2/')
                stored=Path(folder)/result['url'].removeprefix('/api/static/')
                with Image.open(stored) as uploaded:
                    assert uploaded.format=='WEBP' and uploaded.size==(80,40)
                    assert not uploaded.getexif()
                for bad in [b'<svg onload="alert(1)"/>', b'not an image', b'x'*(8*1024*1024+1)]:
                    try: cms.save_image(bad,1,folder)
                    except HTTPException as error: assert error.status_code==400
                    else: raise AssertionError('unsafe file accepted')
        ''')

    def test_defaults_can_be_restored_without_overrides(self):
        self.run_case('''
            default=next(field['value'] for field in cms.catalog()['fields'] if field['key']==key)
            result=cms.save_content(db,1,payload(value=default),10)
            assert key not in result['values']
        ''')

    def test_admin_routes_check_role_before_work_and_public_route_resolves_host(self):
        source = (Path(__file__).parent / 'main.py').read_text(encoding='utf-8')
        import ast
        module = ast.parse(source)
        methods = {node.name: node for node in module.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for name in ['get_company_website', 'update_company_website', 'upload_company_website_image']:
            first = methods[name].body[0]
            self.assertEqual(ast.unparse(first), 'website_content.ensure_global_editor(current_user)')
        public = ast.unparse(methods['get_public_website_content'])
        self.assertIn('resolve_public_company(db, request)', public)
        self.assertIn("'no-store'", public)
