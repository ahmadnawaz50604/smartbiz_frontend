const app = document.getElementById('app');
const BASE = (window.API_BASE || '').replace(/\/$/, '');
const h = (t, a = {}, ...c) => { const e = document.createElement(t);
  for (const [k, v] of Object.entries(a)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v);
  e.append(...c.flat(Infinity).filter(x => x != null && x !== false)); return e; };       // textContent only => XSS-safe
const tok = () => { try { return localStorage.getItem('sb_token'); } catch { return null; } };
const setTok = t => { try { t ? localStorage.setItem('sb_token', t) : localStorage.removeItem('sb_token'); } catch {} };
async function api(url, body) {
  const headers = { 'Content-Type': 'application/json' }; if (tok()) headers.Authorization = 'Bearer ' + tok();
  let r; try { r = await fetch(BASE + url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Cannot reach the backend. Check API_BASE in config.js'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || 'Request failed'), { status: r.status });
  return j; }
let S = { role: '', demo: false }, DEMO = { enabled: false, roles: [] }, chart, flash = null, auto = true, canOrder = false;
const BADGE = { Active: 'g', Confirmed: 'b', Dispatched: 'g', Received: 'g', Sent: 'b', Pending: 'y', Draft: 'y', Backordered: 'y', Cancelled: 'r', Discontinued: 'r', Voided: 'r', OK: 'g' };
const LABEL = { admin: 'Admin', inventory_manager: 'Inventory', warehouse_manager: 'Warehouse', sales_manager: 'Sales Manager', purchase_manager: 'Purchase', sales_staff: 'Sales Staff', customer: 'Customer', supplier: 'Supplier' };
const DESC = { admin: 'Company-wide KPIs, users and all orders', inventory_manager: 'Low stock, reorder alerts, stock by category', warehouse_manager: 'Receive purchase orders and dispatch sales orders',
  sales_manager: 'Confirm, dispatch or cancel orders; sales performance', purchase_manager: 'Create and send purchase orders to suppliers', sales_staff: 'Product lookup and customer order entry',
  customer: 'Shop products, place and track your orders', supplier: 'Purchase orders addressed to you and your product stock' };
const money = n => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isId = c => c === 'id' || /_id$/i.test(c);
const isNum = (v, c) => !isId(c) && (typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)));
const fmt = v => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

function loginView() {
  const err = h('p', { style: 'color:#d92d20;margin:0 0 12px' });
  const u = h('input', { placeholder: 'Username' }), p = h('input', { type: 'password', placeholder: 'Password' });
  const go = async () => { try { const r = await api('/api/login', { username: u.value, password: p.value }); setTok(r.token); auto = true; load(r.role); }
    catch (e) { err.textContent = e.message; } };
  p.addEventListener('keydown', e => e.key === 'Enter' && go());
  app.replaceChildren(h('div', { class: 'card login' }, h('h3', {}, 'Sign in to SmartBiz'), err, u, p, h('button', { onclick: go }, 'Sign in'),
    DEMO.enabled ? h('p', {}, h('button', { class: 'ghost', onclick: () => { auto = true; switchDemo(location.hash.slice(1) || 'admin'); } }, 'Continue to demo (no password)')) : null)); }

function shell(d) {
  const groups = [['Switch dashboard', 'internal'], ['Portals', 'portal']];
  const side = h('aside', { id: 'side' }, h('div', { class: 'brand' }, 'SmartBiz'),
    h('div', { class: 'nav' + (d.view === 'home' ? ' on' : ''), onclick: () => { document.getElementById('side').classList.remove('open'); home(); } }, h('i', {}, '\u2302'), 'Dashboard'),
    d.can_pos ? h('div', { class: 'nav' + (d.view === 'counter' ? ' on' : ''), onclick: () => { document.getElementById('side').classList.remove('open'); counter(); } }, h('i', {}, '$'), 'Counter') : null,
    d.can_import ? h('div', { class: 'nav' + (d.view === 'import' ? ' on' : ''), onclick: () => { document.getElementById('side').classList.remove('open'); importer(); } }, h('i', {}, '+'), 'Import products') : null,
    h('div', { class: 'nav' + (d.view === 'help' ? ' on' : ''), onclick: () => { document.getElementById('side').classList.remove('open'); help(); } }, h('i', {}, '?'), 'Help & Guide'),
    groups.map(([label, g]) => { const items = d.nav.filter(n => n.group === g); return items.length ? [h('div', { class: 'grp' }, label),
      items.map(n => h('div', { class: 'nav' + (n.role === d.role && d.view === 'dash' ? ' on' : ''), onclick: () => { document.getElementById('side').classList.remove('open'); go(n.role); } },
        h('i', {}, (LABEL[n.role] || n.title)[0]), LABEL[n.role] || n.title))] : null; }),
    h('div', { class: 'foot' }, d.name, h('br'), d.demo ? 'Demo mode' + (d.readonly ? ' (read-only)' : '') : 'Signed in'));
  const top = h('div', { class: 'top' }, h('button', { class: 'menu', onclick: () => document.getElementById('side').classList.toggle('open') }, '\u2630'),
    h('h1', {}, d.title), d.demo ? h('span', { class: 'badge' }, 'Demo') : null, h('span', { class: 'who' }, d.name),
    h('button', { class: 'ghost', onclick: () => { setTok(null); auto = false; loginView(); } }, d.demo ? 'Sign in' : 'Logout'));
  app.replaceChildren(h('div', { class: 'layout' }, side, h('div', { class: 'main' }, top, h('div', { id: 'content' })))); }

async function go(role) { S.demo ? switchDemo(role) : load(role); }
async function switchDemo(role) {
  try { const r = await api('/api/demo/login', { role }); setTok(r.token); await load(role, '', true); }
  catch (e) { app.replaceChildren(h('div', { class: 'card login' }, h('h3', {}, 'Cannot open demo'), h('p', {}, e.message), h('button', { onclick: loginView }, 'Sign in'))); } }
async function load(role, q = '', fromDemo = false) {
  const c = document.getElementById('content'); if (c) c.replaceChildren(h('div', { class: 'ld' }, 'Loading...'));
  try { const d = await api(`/api/dashboard/${role}?q=${encodeURIComponent(q)}`); location.hash = role; S = d; render(d, q); }
  catch (e) { if ((e.status === 401 || e.status === 403) && DEMO.enabled && auto && !fromDemo) return switchDemo(role);
    if (e.status === 401) { setTok(null); return loginView(); }
    (document.getElementById('content') || app).replaceChildren(h('div', { class: 'toast err' }, e.message)); } }
async function act(url, body) {
  try { flash = { t: (await api(url, body)).message }; } catch (e) { if (e.status === 401) return loginView(); flash = { t: e.message, err: 1 }; }
  load(S.role); }

function render(d, q) {
  d.view = 'dash'; document.title = d.title + ' - SmartBiz'; canOrder = d.can_order;
  if (!document.getElementById('content') || document.getElementById('side').dataset.r !== d.role + d.demo + d.view) { shell(d); document.getElementById('side').dataset.r = d.role + d.demo + d.view; }
  const out = []; if (d.warning) out.push(h('div', { class: 'toast err' }, d.warning));
  if (flash) { const f = flash; flash = null; out.push(h('div', { class: 'toast' + (f.err ? ' err' : '') }, f.t)); }
  out.push(h('div', { class: 'k' }, d.kpis.map(k => h('div', { class: 'card' }, h('span', {}, k.label), h('b', {}, fmt(k.value ?? 0))))));
  if (d.chart) out.push(h('div', { class: 'card' }, h('h4', {}, d.chart.title), h('canvas', { id: 'ch', height: 90 })));
  if (d.can_order) out.push(orderForm(d));
  if (d.forms && d.forms.length) out.push(h('h4', { style: 'margin:4px 0 14px' }, 'Manage data (add, change, remove, stock in / out)'), ...d.forms.map(formCard));
  if (d.search) { const i = h('input', { value: q, placeholder: 'Search product or category' });
    i.addEventListener('keydown', e => e.key === 'Enter' && load(d.role, i.value));
    out.push(h('div', { class: 'card' }, h('div', { class: 'row', style: 'margin:0' }, i, h('button', { onclick: () => load(d.role, i.value) }, 'Search')))); }
  d.tables.forEach(t => out.push(h('div', { class: 'card' }, h('h4', {}, t.title), t.rows.length ? h('div', { class: 'w' }, h('table', {},
    h('thead', {}, h('tr', {}, t.columns.map(c => h('th', { class: isNum(1, c) && t.rows.some(r => isNum(r[t.columns.indexOf(c)], c)) ? 'num' : '' }, c.replace(/_/g, ' '))), t.actions.length ? h('th') : null)),
    h('tbody', {}, t.rows.map(r => h('tr', {}, r.map((v, i) => cellOf(v, t.columns[i], d)), t.actions.length ? h('td', {},
      t.actions.map(a => h('button', { onclick: () => act(a.url, { id: r[0] }) }, a.label))) : null))))) : h('p', { style: 'color:var(--m);margin:0' }, 'Nothing here.'))));
  const c = document.getElementById('content'); c.replaceChildren(...out);
  if (chart) chart.destroy();
  if (d.chart) chart = new Chart(document.getElementById('ch'), { type: 'bar', data: { labels: d.chart.rows.map(r => r.label),
    datasets: [{ data: d.chart.rows.map(r => Number(r.value)), backgroundColor: '#0f766e', borderRadius: 6 }] }, options: { plugins: { legend: { display: false } } } }); }

function home() {
  const d = { ...S, view: 'home', title: 'Dashboard' }; document.title = 'Dashboard - SmartBiz';
  shell(d); document.getElementById('side').dataset.r = d.role + d.demo + d.view;
  document.getElementById('content').replaceChildren(
    h('p', { style: 'color:var(--m);margin:0 0 20px' }, 'Welcome, ' + S.name + '. Choose a dashboard to open it.'),
    h('div', { class: 'k', style: 'grid-template-columns:repeat(auto-fill,minmax(260px,1fr))' }, S.nav.map(n =>
      h('div', { class: 'card', style: 'cursor:pointer', onclick: () => go(n.role) }, h('h4', {}, LABEL[n.role] || n.title),
        h('p', { style: 'color:var(--m);margin:0 0 16px;min-height:44px' }, DESC[n.role] || ''), h('button', {}, 'Open dashboard'))))); }

const FAQ = [
 ['What is SmartBiz?', 'A sales and inventory management system. It keeps products, suppliers, warehouses, customers, stock, sales orders and purchase orders in one PostgreSQL database, and gives each stakeholder its own dashboard.'],
 ['Who uses it and what can each role do?', 'Admin: whole business, users, all data. Inventory: stock levels, reorder alerts, products, expired stock. Warehouse: receive purchase orders, dispatch sales orders, move stock between warehouses. Sales Manager: confirm, dispatch or cancel orders. Purchase: create and send purchase orders, manage suppliers. Sales Staff and Customer: browse products and place orders. Supplier: sees the purchase orders addressed to them.'],
 ['How do I switch between dashboards?', 'Use the left sidebar. Each name opens that dashboard immediately. The Dashboard item shows a home page with a card for every dashboard.'],
 ['What happens when someone places an order?', 'The order is saved with its items and the stock is reduced immediately, all in one database transaction. If any item is unknown, discontinued or short of stock, nothing is saved. The order then moves Pending, Confirmed, Dispatched. Cancelling before dispatch returns the stock.'],
 ['What happens when an item runs out or gets low?', 'It appears in the Reorder list (stock at or below its reorder level) and in the Out of stock count. The Purchase Manager clicks Create PO to make a draft purchase order for that product\'s supplier, sends it, and the Warehouse Manager clicks Receive when goods arrive, which adds the stock.'],
 ['How are expired items removed from stock?', 'The Expired stock table lists items whose expiration date has passed. Write off removes the remaining units and records the removal in the stock movement history.'],
 ['How do I add, change or remove items, suppliers, warehouses or customers?', 'Open the Manage data section on the relevant dashboard. Each card adds, updates or deletes a record. Items that still have history cannot be deleted; mark a product Discontinued instead.'],
 ['How do I bring stock in or out manually?', 'Use Stock in / out: enter the product ID and a quantity (+ for stock in, - for stock out). Every change appears in Recent stock movements.'],
 ['How do I add a new user, for example a Sales Manager?', 'On the Admin dashboard open Add user, choose the role and a password of at least 8 characters. Use Enable / disable user to block a login.'],
 ['Which technologies are used?', 'PostgreSQL on Neon for the database, a Python Flask REST API on Vercel as the backend, and an HTML, CSS and JavaScript frontend on Vercel. Code is stored on GitHub.'],
 ['How is the system kept secure?', 'Passwords are stored as salted hashes, logins use signed tokens that expire, every action is checked against the role on the server, and SQL uses parameters to prevent injection.'],
 ['What if a business wanted to use this system?', 'They get their own database and logins, replace the demo data with their own products, suppliers and warehouses through the Manage data forms, and turn demo mode off so every user must sign in.'],
 ['Why do some figures look old?', 'The sample dataset contains dates from 2024 and 2025, so many items count as expired today. This is a property of the dataset, which is why the Expired stock table is useful for showing write-offs.']];
function help() {
  const d = { ...S, view: 'help', title: 'Help & Guide' }; document.title = 'Help & Guide - SmartBiz';
  shell(d); document.getElementById('side').dataset.r = d.role + d.demo + d.view;
  document.getElementById('content').replaceChildren(h('p', { style: 'color:var(--m);margin:0 0 20px' }, 'Answers to common questions about this system.'),
    ...FAQ.map(([q, a]) => h('details', { class: 'card' }, h('summary', {}, q), h('p', { style: 'margin:14px 0 0;color:var(--m)' }, a)))); }

function receiptEl(r) {
  const row = (a, b, bold) => h('div', { style: 'display:flex;justify-content:space-between;' + (bold ? 'font-weight:700;' : '') }, h('span', {}, a), h('span', {}, b));
  return h('div', { id: 'receipt', class: 'receipt' }, h('div', { style: 'text-align:center;font-weight:700' }, 'SmartBiz Store'), h('div', { style: 'text-align:center' }, 'Receipt ' + r.receipt_no + (r.voided ? ' (VOIDED)' : '')),
    h('div', { style: 'text-align:center' }, r.time + ' - ' + r.cashier), h('hr'), r.lines.map(l => [h('div', {}, l.name), row(l.qty + ' x ' + money(l.price), money(l.amount))]), h('hr'),
    row('Subtotal', money(r.subtotal)), r.discount > 0 ? row('Discount', '-' + money(r.discount)) : null, row('TOTAL', money(r.total), true),
    row('Paid by ' + r.method, money(r.tendered)), row('Change', money(r.change)), h('hr'), h('div', { style: 'text-align:center' }, 'Thank you for shopping with us')); }

function counter() {
  const d = { ...S, view: 'counter', title: 'Counter' }; document.title = 'Counter - SmartBiz';
  shell(d); document.getElementById('side').dataset.r = d.role + d.demo + d.view;
  let cart = [];
  const q = h('input', { placeholder: 'Scan a barcode or type a product name, then press Enter', style: 'width:100%;font-size:18px' });
  const results = h('div', {}), cartBox = h('div', {}), receiptBox = h('div', {}), msg = h('div', {}), totals = h('div', {});
  const disc = h('input', { type: 'number', min: 0, step: 'any', value: 0, style: 'width:110px', title: 'Discount' });
  const method = h('select', {}, ['cash', 'card', 'other'].map(m => h('option', { value: m }, m)));
  const tend = h('input', { type: 'number', min: 0, step: 'any', placeholder: 'Cash received', style: 'width:150px' });
  const rn = h('input', { placeholder: 'Receipt no. e.g. R-000012' });
  const sum = () => cart.reduce((a, l) => a + l.qty * l.price, 0), total = () => Math.max(0, sum() - (Number(disc.value) || 0));
  const err = e => msg.replaceChildren(h('div', { class: 'toast err' }, e.message));
  function draw() {
    cartBox.replaceChildren(cart.length ? h('div', { class: 'w' }, h('table', {}, h('thead', {}, h('tr', {}, ['Item', 'Price', 'Qty', 'Amount', ''].map(c => h('th', {}, c)))),
      h('tbody', {}, cart.map(l => h('tr', {}, h('td', {}, l.name), h('td', { class: 'num' }, money(l.price)),
        h('td', {}, h('input', { type: 'number', min: 1, value: l.qty, style: 'width:70px', onchange: e => { l.qty = Math.max(1, parseInt(e.target.value) || 1); draw(); } })),
        h('td', { class: 'num' }, money(l.qty * l.price)), h('td', {}, h('button', { class: 'ghost', onclick: () => { cart = cart.filter(x => x !== l); draw(); } }, 'Remove'))))))) : h('p', { style: 'color:var(--m)' }, 'The cart is empty. Scan or search a product.'));
    const ch = (Number(tend.value) || 0) - total();
    totals.replaceChildren(h('div', {}, 'Subtotal: ' + money(sum())), h('div', { style: 'font:700 28px "Space Grotesk",sans-serif;margin:6px 0' }, 'Total: ' + money(total())), method.value === 'cash' ? h('div', {}, 'Change: ' + money(Math.max(0, ch))) : null); }
  function add(it) { if (it.stock <= 0) return err(new Error(it.name + ' is out of stock')); const l = cart.find(x => x.product_id === it.product_id);
    if (l) l.qty += 1; else cart.push({ ...it, qty: 1 }); results.replaceChildren(); msg.replaceChildren(); q.value = ''; q.focus(); draw(); }
  async function find() {
    const t = q.value.trim(); if (!t) return;
    try { const items = (await api('/api/pos/lookup?q=' + encodeURIComponent(t))).items;
      if (!items.length) return results.replaceChildren(h('p', {}, 'No product found for "' + t + '".'));
      if (items.length === 1 || items[0].exact) return add(items[0]);
      results.replaceChildren(h('div', { class: 'w' }, h('table', {}, h('tbody', {}, items.map(it => h('tr', {}, h('td', {}, it.name), h('td', { class: 'num' }, money(it.price)), h('td', {}, it.stock + ' in stock'),
        h('td', {}, it.stock > 0 ? h('button', { onclick: () => add(it) }, 'Add') : h('span', { style: 'color:#b42318' }, 'Out of stock'))))))));
    } catch (e) { err(e); } }
  async function pay() {
    msg.replaceChildren(); if (!cart.length) return err(new Error('Add at least one product.'));
    try { const r = await api('/api/pos/sale', { lines: cart.map(l => ({ product_id: l.product_id, quantity: l.qty })), discount: Number(disc.value) || 0, method: method.value, tendered: Number(tend.value) || 0 });
      cart = []; disc.value = 0; tend.value = ''; draw(); receiptBox.replaceChildren(h('div', { class: 'toast' }, 'Sale completed.'), receiptEl(r.message), h('button', { onclick: () => window.print() }, 'Print receipt'));
    } catch (e) { err(e); } }
  async function reprint() { try { const r = await api('/api/pos/receipt/' + encodeURIComponent(rn.value.trim())); receiptBox.replaceChildren(receiptEl(r.message), h('button', { onclick: () => window.print() }, 'Print receipt')); } catch (e) { err(e); } }
  q.addEventListener('keydown', e => e.key === 'Enter' && find()); disc.addEventListener('input', draw); tend.addEventListener('input', draw);
  method.addEventListener('change', () => { tend.style.display = method.value === 'cash' ? '' : 'none'; draw(); });
  document.getElementById('content').replaceChildren(h('div', { class: 'pos' },
    h('div', {}, h('div', { class: 'card' }, h('h4', {}, 'Find a product'), q, results), h('div', { class: 'card' }, h('h4', {}, 'Reprint a receipt'), h('div', { class: 'row', style: 'margin:0' }, rn, h('button', { onclick: reprint }, 'Show')))),
    h('div', {}, h('div', { class: 'card' }, h('h4', {}, 'Cart'), cartBox, h('div', { class: 'row' }, h('span', {}, 'Discount'), disc, method, tend), totals, msg,
      h('button', { style: 'font-size:18px;padding:12px 22px', onclick: pay }, 'Complete sale')), receiptBox)));
  draw(); q.focus(); }

function importer() {
  const d = { ...S, view: 'import', title: 'Import products' }; document.title = 'Import products - SmartBiz';
  shell(d); document.getElementById('side').dataset.r = d.role + d.demo + d.view;
  const COLS = ['product_id', 'barcode', 'product_name', 'category', 'supplier', 'unit_price', 'stock_quantity', 'reorder_level', 'reorder_quantity', 'expiration_date', 'warehouse'];
  let rows = [];
  const info = h('div', {}), preview = h('div', {}), result = h('div', {});
  const mode = h('select', {}, h('option', { value: 'skip' }, 'Skip products that already exist (safe)'), h('option', { value: 'update' }, 'Update name, category, supplier and price of existing products'));
  const file = h('input', { type: 'file', accept: '.csv,.xlsx,.xls' });
  const go = h('button', { disabled: 'disabled', onclick: run }, 'Import products');
  function template() {
    const csv = COLS.join(',') + '\n8964000100012,8964000100012,Basmati Rice 5kg,Grains & Pulses,ABC Traders,1850,40,10,50,2027-06-30,Main Warehouse\n,8964000100029,Milk 1L,Dairy,City Dairy,290,60,20,60,2026-12-15,Cold Storage\n';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'smartbiz_products_template.csv'; a.click(); }
  file.addEventListener('change', async () => {
    result.replaceChildren(); preview.replaceChildren(); info.replaceChildren(); go.disabled = true; rows = []; const f = file.files[0]; if (!f) return;
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      rows = raw.map((r, i) => ({ ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase().replace(/\s+/g, '_'), String(v).trim()])), _row: i + 2 }));
      if (!rows.length) throw new Error('The file has no data rows.');
      const miss = ['product_name', 'unit_price'].filter(c => !(c in rows[0])); if (!('barcode' in rows[0]) && !('product_id' in rows[0])) miss.push('barcode or product_id');
      if (miss.length) { rows = []; throw new Error('Missing column(s): ' + miss.join(', ') + '. Download the template to see the layout.'); }
      info.replaceChildren(h('div', { class: 'toast' }, rows.length + ' rows found. Check the preview, then click Import.'));
      preview.replaceChildren(h('div', { class: 'w' }, h('table', {}, h('thead', {}, h('tr', {}, COLS.map(c => h('th', {}, c.replace(/_/g, ' '))))),
        h('tbody', {}, rows.slice(0, 8).map(r => h('tr', {}, COLS.map(c => h('td', {}, r[c] || '')))))))); go.disabled = false;
    } catch (e) { info.replaceChildren(h('div', { class: 'toast err' }, e.message)); } });
  async function run() {
    go.disabled = true; const tot = { created: 0, updated: 0, skipped: 0, errors: [] };
    try {
      for (let i = 0; i < rows.length; i += 40) {
        const r = (await api('/api/import/products', { rows: rows.slice(i, i + 40), existing: mode.value })).message;
        tot.created += r.created; tot.updated += r.updated; tot.skipped += r.skipped; tot.errors.push(...r.errors);
        result.replaceChildren(h('div', { class: 'toast' }, 'Imported ' + Math.min(i + 40, rows.length) + ' of ' + rows.length + ' rows...')); }
      result.replaceChildren(h('div', { class: 'toast' + (tot.errors.length ? ' err' : '') }, tot.created + ' created, ' + tot.updated + ' updated, ' + tot.skipped + ' skipped, ' + tot.errors.length + ' rows with problems.'),
        tot.errors.length ? h('div', { class: 'w' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Row'), h('th', {}, 'Problem'))), h('tbody', {}, tot.errors.slice(0, 30).map(e => h('tr', {}, h('td', {}, e.row), h('td', {}, e.message)))))) : null);
    } catch (e) { result.replaceChildren(h('div', { class: 'toast err' }, e.message + ' (rows before this point were already imported)')); }
    go.disabled = false; }
  document.getElementById('content').replaceChildren(h('div', { class: 'card' }, h('h4', {}, 'Import products from Excel or CSV'),
    h('p', {}, 'Required: product_name, unit_price, and a barcode or product_id. Optional: category, supplier, stock_quantity, reorder_level, reorder_quantity, expiration_date (like 2027-06-30), warehouse. Missing categories, suppliers and warehouses are created automatically.'),
    h('p', {}, 'Opening stock applies to new products only. Existing products never have their stock changed here; use Stock in / out for that.'),
    h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: template }, 'Download template')), h('div', { class: 'row' }, file, mode, go), info, preview, result)); }

function cellOf(v, col, d) {
  if (v == null || v === '') return h('td', {}, '');
  if (BADGE[v]) return h('td', {}, h('span', { class: 'pill ' + BADGE[v] }, v));
  if (d.can_order && col === 'product_id') return h('td', {}, h('span', { class: 'pick', title: 'Click to add to the order form',
    onclick: () => { const f = [...document.querySelectorAll('.pid')].find(x => !x.value) || document.querySelector('.pid'); f.value = v; f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.nextElementSibling.focus(); } }, v));
  return isNum(v, col) ? h('td', { class: 'num' }, fmt(v)) : h('td', {}, String(v)); }

function formCard(f) {
  const ins = f.fields.map(x => [x, x.t === 'select' ? h('select', {}, h('option', { value: '' }, '-- choose --'), x.o.map(o => h('option', { value: o[0] }, o[1])))
    : h('input', { type: x.t, step: 'any', placeholder: x.l })]);
  return h('details', { class: 'card' }, h('summary', {}, f.title), h('div', { class: 'fgrid' }, ins.map(([x, el]) => h('div', {}, h('label', {}, x.l + (x.req ? ' *' : '')), el))),
    h('button', { onclick: () => act(f.url, Object.fromEntries(ins.map(([x, el]) => [x.n, el.value]))) }, f.button)); }

function orderForm(d) {
  const sel = d.customers.length ? h('select', {}, d.customers.map(c => h('option', { value: c.customer_id }, c.name))) : null;
  const rows = [0, 1, 2].map(() => [h('input', { class: 'pid', placeholder: 'Product ID (click an ID in a table below)', size: 34 }), h('input', { type: 'number', min: 1, placeholder: 'Qty', style: 'width:90px' })]);
  return h('div', { class: 'card' }, h('h4', {}, 'New sales order'), sel && h('div', { class: 'row' }, sel),
    rows.map(r => h('div', { class: 'row' }, r[0], r[1])),
    h('button', { onclick: () => act('/api/so/new', { customer_id: sel && sel.value, lines: rows.map(r => ({ product_id: r[0].value, quantity: r[1].value })) }) }, 'Place order')); }

window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r && S.role && r !== S.role) go(r); });
(async () => {
  try { DEMO = await api('/api/demo/roles'); } catch { DEMO = { enabled: false, roles: [] }; }
  const want = location.hash.slice(1), valid = r => DEMO.roles.some(x => x.role === r);
  if (tok()) { try { const m = await api('/api/me');
      if (DEMO.enabled && m.demo && want && m.role !== want && valid(want)) return switchDemo(want);
      return load(want || m.role); } catch { setTok(null); } }
  if (DEMO.enabled) return switchDemo(valid(want) ? want : 'admin');
  loginView(); })();
