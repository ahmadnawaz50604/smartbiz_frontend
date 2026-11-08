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
const BADGE = { Active: 'g', Confirmed: 'b', Dispatched: 'g', Received: 'g', Sent: 'b', Pending: 'y', Draft: 'y', Backordered: 'y', Cancelled: 'r', Discontinued: 'r' };
const LABEL = { admin: 'Admin', inventory_manager: 'Inventory', warehouse_manager: 'Warehouse', sales_manager: 'Sales Manager', purchase_manager: 'Purchase', sales_staff: 'Sales Staff', customer: 'Customer', supplier: 'Supplier' };
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
    h('div', { class: 'nav', onclick: () => { document.getElementById('side').classList.remove('open'); load(d.role); } }, h('i', {}, '\u2302'), 'Dashboard'),
    groups.map(([label, g]) => { const items = d.nav.filter(n => n.group === g); return items.length ? [h('div', { class: 'grp' }, label),
      items.map(n => h('div', { class: 'nav' + (n.role === d.role ? ' on' : ''), onclick: () => { document.getElementById('side').classList.remove('open'); go(n.role); } },
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
  document.title = d.title + ' - SmartBiz'; canOrder = d.can_order;
  if (!document.getElementById('content') || document.getElementById('side').dataset.r !== d.role + d.demo) { shell(d); document.getElementById('side').dataset.r = d.role + d.demo; }
  const out = [];
  if (flash) { const f = flash; flash = null; out.push(h('div', { class: 'toast' + (f.err ? ' err' : '') }, f.t)); }
  out.push(h('div', { class: 'k' }, d.kpis.map(k => h('div', { class: 'card' }, h('span', {}, k.label), h('b', {}, fmt(k.value ?? 0))))));
  if (d.chart) out.push(h('div', { class: 'card' }, h('h4', {}, d.chart.title), h('canvas', { id: 'ch', height: 90 })));
  if (d.can_order) out.push(orderForm(d));
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

function cellOf(v, col, d) {
  if (v == null || v === '') return h('td', {}, '');
  if (BADGE[v]) return h('td', {}, h('span', { class: 'pill ' + BADGE[v] }, v));
  if (d.can_order && col === 'product_id') return h('td', {}, h('span', { class: 'pick', title: 'Click to add to the order form',
    onclick: () => { const f = [...document.querySelectorAll('.pid')].find(x => !x.value) || document.querySelector('.pid'); f.value = v; f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.nextElementSibling.focus(); } }, v));
  return isNum(v, col) ? h('td', { class: 'num' }, fmt(v)) : h('td', {}, String(v)); }

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
