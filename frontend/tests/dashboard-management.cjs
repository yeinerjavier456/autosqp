// Built CRM + isolated APIs; never touches production data.
const { createServer } = require('node:http');
const { readFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dist = path.resolve(__dirname, '../dist');
const server = createServer(async (req, res) => {
  try {
    let pathname = new URL(req.url, 'http://localhost').pathname.replace(/^\/crm\//, '/');
    if (!pathname.startsWith('/assets/')) pathname = '/index.html';
    const file = path.resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + path.sep)) throw new Error('invalid path');
    res.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(await readFile(file));
  } catch { res.statusCode=404; res.end(); }
});
async function main() {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1050}});
    const errors=[], calls=[], detailCalls=[];
    let discardAttempts=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{ if (location.pathname.startsWith('/crm/')) localStorage.setItem('token','dashboard-fixture'); });
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());
      const endpoint=url.pathname.replace('/crm/api','/api');
      let data=[];
      if(endpoint==='/api/users/me') data={id:1,company_id:1,full_name:'Admin Prueba',email:'admin@test.local',role:{id:1,name:'admin',base_role_name:'admin'}};
      else if(endpoint==='/api/users/') data={items:[{id:7,company_id:1,full_name:'Camila Prueba'},{id:8,company_id:1,full_name:'Otro empleado'}]};
      else if(endpoint==='/api/stats/advisor/transitions') {
        const params=Object.fromEntries(url.searchParams);detailCalls.push(params);
        if(params.status==='discarded' && discardAttempts++===0) return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({detail:'Error de prueba, reintenta'})});
        const offset=Number(params.offset||0),total=params.status==='new'?0:params.status==='contacted'?51:1;
        const items=Array.from({length:Math.min(50,Math.max(0,total-offset))},(_,index)=>({id:offset+index+1,
          name:params.status==='lost'?'Lead perdido y reasignado':`Cliente ${offset+index+1}`,phone:'3001234567',email:'cliente@test.local',
          transitioned_at:'2026-11-12T15:00:00',transition_comment:params.status==='lost'?'Cliente solicita llamada <b>mañana</b>':null,
          current_status:params.status==='discarded'?'discarded':'new',assigned_name:'Responsable actual distinto'}));
        data={items,total,offset,limit:50,status:params.status};
      }
      else if(endpoint==='/api/stats/advisor') {
        calls.push(Object.fromEntries(url.searchParams));
        const selected=url.searchParams.get('employee_id')==='7';
        data={total_leads:5,leads_sold:0,conversion_rate:0,new_leads_in_range:5,appointments_total:0,
          credit_total:99,purchase_total:88,sales_total:77,inventory_total:66,
          recent_leads_by_day:{'12/11':0},status_distribution:{sold:99},
          management_actions_total:selected?7:100,management_leads_total:selected?4:100,
          management_transition_distribution:selected?{credit_study:1,contacted:2,lost:1,discarded:1}:{sold:100},
          management_current_distribution:selected?{new:1,approvals:2,discarded:1}:{sold:100},
          management_leads_by_day:{'12/11':4},management_source_distribution:{web:4},
          top_managers:[{user_id:7,full_name:'Camila Prueba',count:0,managed_leads_count:0}],least_managers:[]};
      }
      else if(endpoint.includes('company-context')) data={id:1,name:'Empresa Prueba'};
      return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/crm/admin/dashboard`,{waitUntil:'domcontentloaded'});
    await page.getByRole('combobox',{name:'Empleado'}).selectOption('7');
    const inputs=page.locator('input[type=date]');
    await inputs.nth(0).fill('2026-11-12');await inputs.nth(1).fill('2026-11-12');
    assert(!calls.some(call=>call.employee_id),'must wait for Apply');
    await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
    const section=page.getByRole('region',{name:'Gestiones por estado'});
    await page.waitForFunction(()=>document.body.innerText.includes('por el empleado del 2026-11-12 al 2026-11-12'));
    for(const [label,count] of [['Solicitudes de crédito · Estudio','1'],['Contactados','2'],['Perdidos','1'],['Descartados','1']]) {
      assert.equal(await section.getByText(label,{exact:true}).locator('..').locator('p').nth(1).innerText(),count);
    }
    assert.equal(await page.getByText('Leads gestionados',{exact:true}).locator('..').locator('p').nth(1).innerText(),'4');
    assert.equal(await page.getByText('Acciones realizadas',{exact:true}).locator('..').locator('p').nth(1).innerText(),'7');
    assert.equal(await page.getByText('Usuarios con menor gestion',{exact:true}).count(),0);
    assert.equal(await page.getByText('Estado general de leads',{exact:true}).count(),0);
    await page.getByText('Estado actual de los leads gestionados',{exact:true}).waitFor();
    const call=calls.at(-1);
    assert.equal(call.employee_id,'7');assert.equal(call.start_date,'2026-11-12');assert.equal(call.end_date,'2026-11-12');
    // Unsaved filters must not alter what a metric click queries.
    await page.getByRole('combobox',{name:'Empleado'}).selectOption('8');
    await inputs.nth(0).fill('2026-11-11');
    await section.getByRole('button').filter({has:page.getByText('Perdidos',{exact:true})}).click();
    let dialog=page.getByRole('dialog');
    await dialog.getByText('Lead perdido y reasignado',{exact:true}).waitFor();
    assert.equal(detailCalls.at(-1).employee_id,'7');assert.equal(detailCalls.at(-1).start_date,'2026-11-12');
    assert.equal(detailCalls.at(-1).end_date,'2026-11-12');assert.equal(detailCalls.at(-1).status,'lost');
    await dialog.getByText('Responsable actual distinto',{exact:true}).waitFor();
    await dialog.getByText('Cliente solicita llamada <b>mañana</b>',{exact:true}).waitFor();
    assert.equal(await dialog.locator('td b').count(),0,'history messages must remain plain text');
    assert((await dialog.innerText()).includes('10:00'),'must display 15:00 UTC as 10:00 Bogota');
    if(process.env.SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'dashboard-transition-leads.png')});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
    await section.getByRole('button').filter({has:page.getByText('Contactados',{exact:true})}).click();
    dialog=page.getByRole('dialog');await dialog.getByText('Cliente 1',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Siguiente',exact:true}).click();
    await dialog.getByText('Cliente 51',{exact:true}).waitFor();
    await dialog.getByText('Sin mensaje registrado',{exact:true}).waitFor();
    assert.equal(detailCalls.at(-1).offset,'50');
    assert(await dialog.getByRole('button',{name:'Siguiente',exact:true}).isDisabled());
    await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
    await section.getByRole('button').filter({has:page.getByText('Descartados',{exact:true})}).click();
    dialog=page.getByRole('dialog');await dialog.getByRole('alert').waitFor();
    await dialog.getByRole('button',{name:'Reintentar',exact:true}).click();
    await dialog.getByText('Cliente 1',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
    await section.getByRole('button').filter({has:page.getByText('Nuevos',{exact:true})}).click();
    dialog=page.getByRole('dialog');await dialog.getByText('No hay leads que coincidan con este estado, empleado y rango.',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
    if(process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'dashboard-management.png')});
    }
    // Explicit logout must leave the /crm router for the domain root.
    const home=`http://127.0.0.1:${server.address().port}/`;
    await page.route(home,route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<meta charset="utf-8"><h1>Portada pública</h1>'}));
    await page.getByRole('button',{name:'Cerrar Sesion',exact:true}).click();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('token')),'dashboard-fixture');
    await page.getByRole('button',{name:'Cerrar Sesion',exact:true}).click();
    await page.getByRole('button',{name:'Si, cerrar sesion',exact:true}).click();
    await page.waitForURL(home);
    assert.equal(await page.evaluate(()=>localStorage.getItem('token')),null);
    await page.getByRole('heading',{name:'Portada pública',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('Dashboard: applied filters, clickable states, historical leads after reassignment, Bogota time, pagination, retry and empty results passed.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
