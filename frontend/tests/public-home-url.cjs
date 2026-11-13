// Isolate the actual URL resolver from React/browser effects for unit tests.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/publicCompany.js'), 'utf8');
const resolver = source.slice(source.indexOf('const normalizeAbsolutePublicUrl'))
  .replace('export const getPublicCompanyHomeUrl', 'const getPublicCompanyHomeUrl');
const window = { location: { protocol: 'https:', origin: 'https://autosqp.com' } };
const resolve = vm.runInNewContext(resolver + '\ngetPublicCompanyHomeUrl;', { window, URL });
for (const company of [null, 'autosqp.com', 'www.autosqp.com', {public_domain:'autosqp.com'},
    {public_domain:'autosqp.com',website_url:''}, {website_url:'https://autosqp.com/preview/'},
    {website_url:'https://www.autosqp.com/crm/autos'}, {website_url:'autosqp.com'},
    {website_url:'https://autosqp.com/'}]) assert.equal(resolve(company),'https://autosqp.com/');
assert.equal(resolve({public_domain:'benitezcars.com'}),'https://benitezcars.com/crm/autos');
assert.equal(resolve({public_domain:'benitezcars.com',website_url:'https://otra-web.test/'}),'https://otra-web.test/');
assert.equal(resolve({public_domain:'benitezcars.com',website_url:'https://benitezcars.com/preview/'}),'https://benitezcars.com/preview/');
assert.equal(resolve({website_url:'https://autosqp.com/campana'}),'https://autosqp.com/campana');
window.location.origin='http://localhost:5173';window.location.protocol='http:';
assert.equal(resolve(null),'http://localhost:5173/crm/autos');
console.log('Public home URL: AutosQP root and legacy links, custom websites, other companies and local fallback passed.');
