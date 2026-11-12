import ast
import os
from pathlib import Path
import subprocess
import sys
import unittest


class ManagementTests(unittest.TestCase):
    def test_real_history_counts_actor_not_owner_and_preserves_losses(self):
        script = '''
import datetime as dt
import models
from database import Base, engine, SessionLocal
from dashboard_management import management_metrics
Base.metadata.create_all(engine)
db=SessionLocal()
db.add_all([models.Company(id=1,name='One'),models.Company(id=2,name='Two')]);db.flush()
db.add_all([models.User(id=i,full_name=str(i),email=f'{i}@test.local',hashed_password='x',company_id=1) for i in [7,8,9]]);db.flush()
db.add_all([models.Lead(id=i,company_id=2 if i==5 else 1,name=str(i),status='new' if i==1 else 'approvals',assigned_to_id=9,source='web',deleted_at=dt.datetime(2026,11,12,15) if i==3 else None) for i in range(1,7)]);db.flush()
def event(lead,user,old,new,comment='',when=None):
    db.add(models.LeadHistory(lead_id=lead,user_id=user,previous_status=old,new_status=new,comment=comment,created_at=when or dt.datetime(2026,11,12,15)))
event(1,7,'contacted','lost','Lead marcado como perdido.')
event(1,7,'lost','new','Transferido automáticamente a Soluciones Financieras y asignado a 9.')
event(2,7,'contacted','credit_study')
event(2,7,'credit_study','contacted')
event(2,7,'contacted','credit_application')
event(2,7,'credit_study','credit_study','Llamada realizada')
event(3,7,'contacted','contacted','Lead eliminado del tablero. Motivo: No interesado')
event(4,8,'new','sold')
event(5,7,'new','sold') # another company must never leak
event(6,7,'new','sold',when=dt.datetime(2026,11,12,4,59)) # yesterday Bogota
event(6,7,'new','sold',when=dt.datetime(2026,11,13,5)) # tomorrow Bogota
event(6,None,'new','sold','Sistema')
event(6,7,'creation','new','Lead creado')
event(6,7,None,'new','Cliente interesado en Mazda') # creation with custom message
event(6,7,'new','new','[AUTO_ALERT] Lead reasignado automaticamente a 7')
event(6,7,'new','contacted',when=dt.datetime(2026,11,12,5)) # inclusive start
db.commit()
start,end=dt.datetime(2026,11,12,5),dt.datetime(2026,11,13,5)
r=management_metrics(db,1,start,end,[7],bucket=lambda value:'12/11')
assert r['management_actions_total']==7,r
assert r['management_leads_total']==4,r
assert r['management_transition_distribution']=={'lost':1,'credit_study':1,'contacted':2,'discarded':1},r
assert r['management_current_distribution']=={'new':1,'approvals':2,'discarded':1},r
assert r['management_leads_by_day']=={'12/11':4},r
assert r['management_source_distribution']=={'web':4},r
assert management_metrics(db,1,start,end,[8])['management_transition_distribution']=={'sold':1}
assert management_metrics(db,1,start,end,[])['management_actions_total']==0
assert management_metrics(db,1,start,end)['management_leads_total']==5
assert management_metrics(db,2,start,end,[7])['management_transition_distribution']=={'sold':1}
'''
        env = dict(os.environ, DATABASE_URL='sqlite://', PYTHONPATH=str(Path(__file__).resolve().parent))
        result = subprocess.run([sys.executable, '-c', script], env=env, capture_output=True, text=True, timeout=45)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_endpoint_wires_actor_and_date_bounds_and_response_schema(self):
        source = Path(__file__).with_name('main.py').read_text(encoding='utf-8')
        dashboard = next(node for node in ast.parse(source).body if isinstance(node, ast.FunctionDef) and node.name=='read_advisor_stats')
        call = next(node for node in ast.walk(dashboard) if isinstance(node, ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='management_metrics')
        code=ast.unparse(call)
        self.assertIn('current_user.company_id, period_start, period_end',code)
        self.assertIn('[employee_id] if employee_id',code)
        self.assertIn('None if company_scope else visible_user_ids',code)
        self.assertIn('management_transition_distribution',Path(__file__).with_name('schemas.py').read_text(encoding='utf-8'))
