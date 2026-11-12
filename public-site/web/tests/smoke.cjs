// Run against the production build, using isolated browser/API fixtures.
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const dist = path.resolve(__dirname, '../dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/preview\//, '/');
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(dist, '.' + pathname);
    if (!file.startsWith(dist + path.sep)) throw new Error('invalid path');
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let contactCalls = 0;
    const submittedSubjects = [];
    let inventoryCalls = 0;
    const car = id => ({ id: String(id), make: 'Mazda', model: id === 2 ? 'CX-5' : 'Mazda 3', version: '', year: 2020, price: 60000000,
      mileage: 45000, transmission: 'Automático', fuel: 'Gasolina', bodyType: '', images: ['/api/static/test.svg'],
      description: 'Vehículo de prueba', specs: { engine: '2.0', plateEnding: '3', color: 'Azul', city: 'Bogotá' } });
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/static/test.svg') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#1c3449"/><text x="200" y="200" fill="white">Vehículo de prueba</text></svg>' });
      let data = {};
      if (url.pathname.endsWith('/website/inventory')) {
        inventoryCalls++;
        data = { items: [car(url.search ? 1 : 2)], next_cursor: url.search ? null : 2 };
      } else if (url.pathname.endsWith('/website/contact')) {
        contactCalls++;
        submittedSubjects.push(route.request().postDataJSON().subject);
        await new Promise(resolve => setTimeout(resolve, 200));
        return route.fulfill({ status: contactCalls === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(contactCalls === 1 ? { detail: 'No pudimos registrar la solicitud.' } : { received: true, sent: true }) });
      } else if (url.pathname.endsWith('/public-chat/session')) data = { session_token: 'browser-test' };
      else if (url.pathname.endsWith('/messages')) data = [];
      else if (url.pathname.endsWith('/public-chat/config')) data = { bot_name: 'Asesor de prueba' };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.goto(base + '/preview/');
    await page.getByText('CX-5', { exact: false }).first().waitFor();
    assert.equal(inventoryCalls, 2);
    assert.equal(await page.getByRole('button', { name: 'Carros y Camionetas', exact: true }).count(), 0);
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'website-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Nosotros', exact: true }).first().click();
    assert.equal(await page.getByRole('heading', { name: 'Información legal y corporativa', exact: true }).count(), 0);
    assert.equal(await page.getByText('Diego Plazas', { exact: false }).count(), 0);
    const networks = page.getByRole('navigation', { name: 'Redes sociales', exact: true }).first();
    const socialUrls = [
      'https://www.facebook.com/share/19fMWb1pLP/?mibextid=wwXIfr',
      'https://www.instagram.com/autosqp?vrfl=ZGtucHlndDI4bjM2&utm_source=qr',
      'https://www.tiktok.com/@jenn_quimba?_r=1&_t=ZS-9BKPyEk75AV',
      'https://www.tiktok.com/@autosqp?_r=1&_t=ZS-9BKQB0VbcOb'
    ];
    for (const href of socialUrls) {
      const link = networks.locator(`a[href="${href}"]`);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
      assert(await link.locator('svg').count() >= 1);
    }
    await page.context().route('https://www.instagram.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Social link test</title>' }));
    const [popup] = await Promise.all([page.context().waitForEvent('page'), networks.locator(`a[href="${socialUrls[1]}"]`).click()]);
    await popup.waitForLoadState('domcontentloaded');
    assert(popup.url().startsWith('https://www.instagram.com/autosqp'));
    await popup.close();
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'website-socials.png'), fullPage: true });
    await page.getByRole('button', { name: 'Inicio', exact: true }).first().click();
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Vender mi auto', exact: true }).first().click();
      await page.getByRole('button', { name: 'Cerrar modal', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Inventario', exact: true }).first().click();
    await page.getByRole('button', { name: 'Ver detalles', exact: true }).first().click();
    await page.getByRole('button', { name: 'Preguntar al asesor virtual', exact: true }).click();
    await page.getByText('Atención comercial en línea', { exact: true }).waitFor();
    // Reload retains the selected section but starts a fresh component tree.
    await page.goto(base + '/preview/#contacto');
    await page.getByRole('button', { name: 'Chatea con nosotros', exact: true }).first().waitFor();
    const form = page.locator('form').filter({ has: page.locator('textarea') });
    await form.locator('input[type=text]').fill('Cliente Prueba');
    await form.locator('input[type=tel]').fill('3001234567');
    await form.locator('input[type=email]').fill('client@example.com');
    await form.locator('textarea').fill('Quiero información sobre un vehículo.');
    await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
    await page.getByRole('alert').filter({ hasText: 'No pudimos registrar' }).waitFor();
    assert.equal(contactCalls, 1);
    await form.getByRole('button', { name: 'Enviar consulta' }).click();
    await page.getByText('¡Mensaje recibido con éxito!').waitFor();
    assert.equal(contactCalls, 2);
    assert.deepEqual(submittedSubjects, ['Comprar vehículo', 'Comprar vehículo']);
    await page.goto(base + '/preview/#reactivacion-financiera');
    const reactivation = page.locator('form').filter({ has: page.getByPlaceholder('Tu nombre y apellido') });
    await reactivation.locator('input[type=text]').fill('Cliente Reactivación');
    await reactivation.locator('input[type=tel]').fill('3001234568');
    await reactivation.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
    await page.getByRole('status').filter({ hasText: 'Recibimos tu solicitud de Reactivación' }).waitFor();
    assert.equal(contactCalls, 3);
    assert.equal(submittedSubjects[2], 'Reactivación Financiera');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/preview/#inventario');
    await page.reload();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Ver detalles', exact: true }).first().waitFor();
    await page.evaluate(() => new Promise(resolve => { window.scrollTo(0, 0); requestAnimationFrame(() => requestAnimationFrame(resolve)); }));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile horizontal overflow');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'website-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Website smoke checks passed: preview, pagination, inventory modal, shared bot, SMTP success/error, duplicate clicks, mobile layout.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
