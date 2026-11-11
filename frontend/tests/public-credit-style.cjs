const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
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
  } catch { res.statusCode = 404; res.end(); }
});
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const url = route.request().url();
      const data = url.includes('company-context') ? { id: 1, name: 'Autos QP', enabled_modules: ['public_credit_form'],
        primary_color: '#2563eb', secondary_color: '#0f172a', public_body_color: '#f8fafc', public_body_text_color: '#0f172a' }
        : url.includes('/advisors') ? { items: [{ id: 1, full_name: 'Asesor de prueba', email: 'advisor@example.com' }] } : {};
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/crm/credito?website=1&return=%2Fpreview%2F', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Formulario de Crédito', exact: true }).waitFor();
    assert.equal(await page.locator('.website-credit-form').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(12, 15, 19)');
    assert.equal(await page.getByRole('link', { name: 'Ver inventario', exact: true }).getAttribute('href'), '/preview/#inventario');
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    assert(await page.getByText('Paso 1 de 6', { exact: true }).isVisible(), 'required-field validation changed');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'credit-website-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'credit-website-mobile.png'), fullPage: true });
    await page.goto(base + '/crm/credito', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Formulario de Crédito', exact: true }).waitFor();
    assert.equal(await page.locator('.website-credit-form').count(), 0, 'company theme overwritten');
    assert.deepEqual(errors, []);
    console.log('Credit form website styling, mobile layout, return links, validation and original company theme passed.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
