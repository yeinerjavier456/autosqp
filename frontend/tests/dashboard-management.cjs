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
    const errors=[], calls=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>localStorage.setItem('token','dashboard-fixture'));
    await page.route('**/api/**',route=>{
      const url=new URL(route.request().url());
      const endpoint=url.pathname.replace('/crm/api','/api');
      let data=[];
      if(endpoint==='/api/users/me') data={id:1,company_id:1,full_name:'Admin Prueba',email:'admin@test.local',role:{id:1,name:'admin',base_role_name:'admin'}};
      else if(endpoint==='/api/users/') data={items:[{id:7,company_id:1,full_name:'Camila Prueba'},{id:8,company_id:1,full_name:'Otro empleado'}]};
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
    if(process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});
      await section.scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'dashboard-management.png')});
    }
    assert.deepEqual(errors,[]);
    console.log('Dashboard: applied actor/date filters, transition cards, discarded/lost management and current-state chart passed.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
