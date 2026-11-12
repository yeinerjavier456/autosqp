// Both production builds, isolated API fixtures: editor -> saved content -> public web.
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
const catalog = require('../../public-site/content-defaults.json');
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const crm = url.pathname.startsWith('/crm/');
    const directory = path.join(root, crm ? 'frontend/dist' : 'public-site/web/dist');
    let pathname = url.pathname.replace(crm ? /^\/crm\// : /^\/preview\//, '/');
    if (!pathname.startsWith('/assets/')) pathname = '/index.html';
    const file = path.resolve(directory, '.' + pathname);
    if (!file.startsWith(directory + path.sep)) throw new Error('invalid path');
    res.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await context.addInitScript(() => localStorage.setItem('token', 'cms-test-token'));
    const state = { 1: { values: {}, testimonials: structuredClone(catalog.testimonials), revision: 0 }, 2: { values: {}, testimonials: structuredClone(catalog.testimonials), revision: 0 } };
    let saves = 0;
    const uploaded = '/api/static/company-websites/1/fixture.webp';
    await context.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      const pathname = url.pathname.replace('/crm/api', '/api');
      if (pathname.startsWith('/api/static/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#00654b"/><text x="150" y="200" fill="white">Imagen actualizada</text></svg>' });
      let data = [];
      if (pathname === '/api/users/me') data = { id: 999, full_name: 'Global Test', email: 'admin@example.com', company_id: null, role: { id: 1, name: 'super_admin', base_role_name: 'super_admin' } };
      else if (/^\/api\/companies\/\d+\/website\/images$/.test(pathname)) data = { url: uploaded };
      else if (/^\/api\/companies\/\d+\/website$/.test(pathname)) {
        const id = Number(pathname.split('/')[3]);
        if (route.request().method() === 'PUT') {
          const body = route.request().postDataJSON();
          if (body.revision !== state[id].revision) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ detail: 'Otra persona modificó la página. Actualiza el contenido.' }) });
          state[id] = { ...body, revision: body.revision + 1 }; saves++;
        }
        data = state[id];
      } else if (/^\/api\/companies\/\d+$/.test(pathname)) data = { id: Number(pathname.split('/')[3]), name: 'Empresa de prueba', primary_color: '#2563eb', secondary_color: '#0f172a', public_domains: [], enabled_modules: [] };
      else if (pathname.endsWith('/integrations')) data = {};
      else if (pathname === '/api/public/website/content') data = state[1];
      else if (pathname === '/api/public/website/inventory') data = { items: [], next_cursor: null };
      else if (pathname === '/api/users/') data = { items: [] };
      else if (pathname === '/api/public/company-context') data = { id: 1, name: 'Empresa de prueba' };
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/crm/admin/companies/1', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Página web/ }).click();
    await page.getByText('Editas únicamente la página de esta empresa.', { exact: false }).waitFor();
    const title = catalog.fields.find(field => field.key.startsWith('Hero.') && field.value.includes('MÁS QUE AUTOS'));
    await page.getByLabel(title.label, { exact: true }).fill('NUEVA PORTADA <b>sin HTML</b>');
    await page.getByLabel('Cantidad de autos disponibles', { exact: true }).fill('350');
    await page.getByRole('button', { name: 'Editar imágenes', exact: true }).click();
    await page.locator('input[type=file]').first().setInputFiles({ name: 'hero.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jg1EAAAAASUVORK5CYII=', 'base64') });
    const image = catalog.fields.find(field => field.key.startsWith('Hero.') && field.kind === 'image');
    await page.getByRole('textbox', { name: `URL ${image.label}`, exact: true }).waitFor();
    await page.waitForFunction(({ name, url }) => document.querySelector(`input[aria-label="${name}"]`)?.value === url, { name: `URL ${image.label}`, url: uploaded });
    await page.getByRole('button', { name: 'Editar testimonios', exact: true }).click();
    while (await page.getByRole('button', { name: 'Quitar', exact: true }).count()) await page.getByRole('button', { name: 'Quitar', exact: true }).first().click();
    await page.getByRole('button', { name: 'Agregar testimonio', exact: true }).click();
    await page.getByLabel('Nombre del cliente', { exact: true }).fill('María Prueba');
    await page.getByLabel('Opinión del cliente', { exact: true }).fill('Excelente experiencia administrada desde el CRM.');
    await page.getByRole('button', { name: 'Guardar página web', exact: true }).click();
    await page.getByText(/Página guardada/).waitFor();
    assert.equal(saves, 1);
    assert.equal(state[1].values[title.key], 'NUEVA PORTADA <b>sin HTML</b>');
    assert.equal(state[1].values[image.key], uploaded);
    assert.equal(state[1].testimonials.length, 1);
    assert.deepEqual(state[2].values, {});
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'website-cms-admin.png'), fullPage: true });
    await page.goto(base + '/preview/', { waitUntil: 'domcontentloaded' });
    await page.locator('h1').filter({ hasText: 'NUEVA PORTADA <b>sin HTML</b>' }).waitFor();
    assert.equal(await page.locator('h1 b').count(), 0);
    await page.getByText('María Prueba', { exact: true }).waitFor();
    await page.getByText('350', { exact: true }).waitFor();
    assert.equal(await page.locator(`img[src="${uploaded}"]`).count(), 1);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'website-cms-public.png'), fullPage: true });
    await page.goto(base + '/crm/admin/companies/1', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^Página web/ }).click();
    await page.getByLabel(title.label, { exact: true }).fill('Edición desactualizada');
    state[1].revision++;
    await page.getByRole('button', { name: 'Guardar página web', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Otra persona modificó' }).waitFor();
    assert.equal(state[1].values[title.key], 'NUEVA PORTADA <b>sin HTML</b>');
    // An empty override restores the actual loaded inventory count (zero here).
    state[1].values['Hero.available_vehicle_count'] = '';
    await page.goto(base + '/preview/', { waitUntil: 'domcontentloaded' });
    await page.getByText('Autos disponibles', { exact: true }).waitFor();
    assert.equal(await page.getByText('Autos disponibles', { exact: true }).locator('..').locator('p').first().innerText(), '0');
    assert.deepEqual(errors, []);
    console.log('CMS editor save, image upload, testimonial CRUD, public rendering, tenant isolation, escaped text and stale-edit protection passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
