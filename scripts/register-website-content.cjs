// Mechanical catalog/codemod: wraps presentation strings, never business values.
// Run with node scripts/register-website-content.cjs after adding website sections.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const requireFrontend = createRequire(path.join(root, 'frontend/package.json'));
const parser = requireFrontend('@babel/parser');
const traverse = requireFrontend('@babel/traverse').default;
const t = requireFrontend('@babel/types');
const generate = requireFrontend('@babel/generator').default;
const source = path.join(root, 'public-site/web/src');
const catalogPath = path.join(root, 'public-site/content-defaults.json');
const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : { version: 1, fields: [], testimonials: [] };
const labels = { Hero: 'Inicio · Portada', SolucionQP: 'Inicio · La solución QP', FeaturedVehicles: 'Inicio · Vehículos destacados',
  Testimonials: 'Inicio · Testimonios', SellCarCta: 'Inicio · Vender mi auto', Navbar: 'Menú principal', Footer: 'Pie de página',
  InventoryView: 'Inventario', VehicleDetailModal: 'Ficha del vehículo', FinanciamientoView: 'Financiamiento',
  ReactivacionFinancieraView: 'Reactivación financiera', NosotrosView: 'Nosotros', ContactoView: 'Contacto', FaqView: 'Preguntas frecuentes',
  SellCarModal: 'Formulario de venta', LegalModal: 'Políticas y privacidad', WhatsAppFloatingButton: 'Bot · Botón de atención',
  SocialLinks: 'Botones de redes', company: 'Datos de contacto y empresa', faqs: 'Preguntas frecuentes · Respuestas', App: 'Página · Mensajes generales' };
const displayProperties = new Set(['title','subtitle','desc','cta','question','answer','categoryLabel','label', 'name', 'brandName',
  'slogan','secondarySlogan','address','shortAddress','phone1','phone2','phone1Raw','phone2Raw','email', 'scheduleWeekday','scheduleWeekend',
  'facebook','instagram','instagramHandle','tiktok','tiktokHandle','tiktokAdvisor','tiktokAdvisorHandle','whatsapp','warrantyNotice','warrantyLegalFull','nit']);
const attrs = new Set(['placeholder', 'title', 'alt', 'aria-label']);
function register(section, kind, value, label) {
  const key = section + '.' + crypto.createHash('sha1').update(kind + ':' + value).digest('hex').slice(0, 12);
  if (!catalog.fields.some(field => field.key === key)) catalog.fields.push({ key, section: labels[section] || section, kind,
    label: label + ': ' + value.replace(/\s+/g, ' ').trim().slice(0, 85), value });
  return t.callExpression(t.identifier('webText'), [t.stringLiteral(key), t.stringLiteral(value)]);
}
const files = ['App.tsx', ...fs.readdirSync(path.join(source, 'components')).filter(file => file.endsWith('.tsx')).map(file => 'components/' + file), 'data/company.ts', 'data/faqs.ts'];
for (const file of files) {
  const full = path.join(source, file);
  const code = fs.readFileSync(full, 'utf8');
  const section = path.basename(file, path.extname(file));
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let changed = false;
  traverse(ast, {
    JSXText(p) {
      const clean = t.react.buildChildren({ children: [p.node] })[0]?.value;
      if (typeof clean !== 'string' || !clean.trim()) return;
      const parent = p.parentPath.node.openingElement?.name;
      const tag = t.isJSXIdentifier(parent) ? parent.name : 'Texto';
      p.replaceWith(t.jsxExpressionContainer(register(section, 'text', clean, tag)));
      changed = true; p.skip();
    },
    JSXAttribute(p) {
      const attr = p.node.name.name;
      const value = p.node.value;
      if (!t.isStringLiteral(value) || !value.value.trim()) return;
      if (attr === 'src' && p.parentPath.node.name.name === 'img') {
        p.node.value = t.jsxExpressionContainer(register(section, 'image', value.value, 'Imagen'));
      } else if (attrs.has(attr)) {
        p.node.value = t.jsxExpressionContainer(register(section, 'text', value.value, attr === 'alt' ? 'Descripción de imagen' : attr));
      } else return;
      changed = true; p.skip();
    },
    StringLiteral(p) {
      if (!p.node.value.trim() || p.node.value.trim().length < 3 || p.findParent(parent => parent.isCallExpression() && parent.node.callee.name === 'webText')) return;
      if (p.parentPath.isObjectProperty() && p.key === 'value') {
        const owner = p.parentPath.parentPath.parentPath;
        if (owner.isCallExpression() && ['sendContact', 'submit', 'useState'].includes(owner.node.callee.name)) return;
        const key = p.parentPath.node.key.name || p.parentPath.node.key.value;
        if (!displayProperties.has(key)) return;
        const call = register(section, /^https?:\/\//.test(p.node.value) ? 'link' : 'text', p.node.value, key);
        if (file.startsWith('data/')) {
          const property = p.parentPath;
          property.replaceWith(t.objectMethod('get', t.cloneNode(property.node.key), [], t.blockStatement([t.returnStatement(call)])));
          property.skip();
        } else { p.replaceWith(call); p.skip(); }
        changed = true;
      } else if (p.parentPath.isArrayExpression()) {
        const variable = p.parentPath.parentPath;
        if (!variable.isVariableDeclarator() || !['services', 'includes', 'targetAudience'].includes(variable.node.id.name)) return;
        p.replaceWith(register(section, 'text', p.node.value, 'Descripción')); changed = true; p.skip();
      } else if (p.parentPath.isConditionalExpression() && ['consequent','alternate'].includes(p.key)) {
        const container = p.findParent(parent => parent.isJSXExpressionContainer());
        if (!container || (container.parentPath.isJSXAttribute() && !attrs.has(container.parentPath.node.name.name))) return;
        p.replaceWith(register(section, 'text', p.node.value, 'Mensaje')); changed = true; p.skip();
      }
    }
  });
  if (changed) {
    if (!ast.program.body.some(node => t.isImportDeclaration(node) && node.specifiers.some(item => item.local?.name === 'webText'))) {
      ast.program.body.unshift(t.importDeclaration([t.importSpecifier(t.identifier('webText'), t.identifier('webText'))], t.stringLiteral(file.includes('/') ? '../content' : './content')));
    }
    fs.writeFileSync(full, generate(ast, { retainLines: false, comments: true }).code + '\n');
  }
}
if (!catalog.testimonials.length) {
  const ast = parser.parse(fs.readFileSync(path.join(source, 'data/vehicles.ts'), 'utf8'), { sourceType: 'module', plugins: ['typescript'] });
  traverse(ast, { VariableDeclarator(p) {
    if (p.node.id.name !== 'TESTIMONIALS') return;
    catalog.testimonials = p.node.init.elements.map(item => Object.fromEntries(item.properties.map(prop => [prop.key.name, prop.value.value])));
  } });
}
const used = new Set();
for (const file of files) {
  const full = path.join(source, file);
  const ast = parser.parse(fs.readFileSync(full, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const seen = new Set();
  let changed = false;
  traverse(ast, { CallExpression(p) {
    if (p.node.callee.name !== 'webText' || !t.isStringLiteral(p.node.arguments[0]) || !t.isStringLiteral(p.node.arguments[1])) return;
    const key = p.node.arguments[0].value;
    const value = p.node.arguments[1].value;
    if (!/[\p{L}\p{N}]/u.test(value)) { p.replaceWith(t.stringLiteral(value)); p.skip(); changed = true; return; }
    if (seen.has(key)) {
      let suffix = 2;
      while (seen.has(key + '.' + suffix)) suffix++;
      const next = key + '.' + suffix;
      const field = catalog.fields.find(item => item.key === key);
      const getter = p.findParent(parent => parent.isObjectMethod());
      if (field && !catalog.fields.some(item => item.key === next)) catalog.fields.push({ ...field, key: next,
        label: getter ? `${getter.node.key.name}: ${value}` : field.label + ` (${suffix})` });
      p.node.arguments[0] = t.stringLiteral(next); seen.add(next); changed = true;
    } else seen.add(key);
  } });
  if (changed) fs.writeFileSync(full, generate(ast, { comments: true }).code + '\n');
  traverse(ast, { CallExpression(p) { if (p.node.callee.name === 'webText' && t.isStringLiteral(p.node.arguments[0])) used.add(p.node.arguments[0].value); } });
}
catalog.fields = catalog.fields.filter(field => used.has(field.key));
for (const field of catalog.fields) if (field.kind === 'image') field.label = field.key.startsWith('Hero.') ? 'Imagen principal de portada' : 'Imagen de la sección Vender mi auto';
const fieldNames = { h1:'Título principal', h2:'Título de sección', h3:'Subtítulo', p:'Párrafo', span:'Texto destacado', button:'Texto de botón', a:'Texto de enlace', option:'Nombre de opción', strong:'Texto resaltado', label:'Etiqueta', placeholder:'Ejemplo de campo', alt:'Descripción de imagen', 'aria-label':'Descripción accesible', title:'Título', subtitle:'Subtítulo', desc:'Descripción', cta:'Texto de botón', name:'Nombre', brandName:'Marca', slogan:'Eslogan', secondarySlogan:'Eslogan secundario', address:'Dirección completa', shortAddress:'Dirección corta', phone1:'Teléfono principal visible', phone2:'Teléfono secundario visible', phone1Raw:'Teléfono principal para llamadas (con código de país)', phone2Raw:'Teléfono secundario para llamadas (con código de país)', email:'Correo visible en la web (no cambia el SMTP)', scheduleWeekday:'Horario entre semana', scheduleWeekend:'Horario fines de semana', facebook:'Enlace de Facebook', instagram:'Enlace de Instagram', instagramHandle:'Usuario de Instagram', tiktok:'Enlace de TikTok Autos QP', tiktokHandle:'Usuario de TikTok Autos QP', tiktokAdvisor:'Enlace de TikTok asesoría', tiktokAdvisorHandle:'Usuario de TikTok asesoría', whatsapp:'Enlace de WhatsApp', question:'Pregunta', answer:'Respuesta', categoryLabel:'Nombre de categoría', warrantyNotice:'Aviso de garantía', warrantyLegalFull:'Condiciones de garantía', nit:'Identificación en las políticas' };
for (const field of catalog.fields) {
  const prefix = field.label.split(':')[0];
  if (fieldNames[prefix]) field.label = `${fieldNames[prefix]}: ${field.value.replace(/\s+/g,' ').trim().slice(0,85)}`;
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Website catalog: ${catalog.fields.length} fields, ${catalog.testimonials.length} testimonials.`);
