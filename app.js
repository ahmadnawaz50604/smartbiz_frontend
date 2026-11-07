const app = document.getElementById('app'), who = document.getElementById('who');
const h = (t, a = {}, ...c) => { const e = document.createElement(t);
  for (const [k, v] of Object.entries(a)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v);
  e.append(...c.flat().filter(x => x != null)); return e; };            // textContent-only => XSS-safe
const BASE = (window.API_BASE || '').replace(/\/$/, '');
const tok = () => { try { return localStorage.getItem('sb_token'); } catch { return null; } };
async function api(url, body) {
  const headers = { 'Content-Type': 'application/json' }; if (tok()) headers.Authorization = 'Bearer ' + tok();
  let r; try { r = await fetch(BASE + url, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Cannot reach the backend. Check API_BASE in config.js'); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { try { localStorage.removeItem('sb_token'); } catch {} }
  if (!r.ok) throw Object.assign(new Error(j.message || 'Request failed'), { status: r.status });
  return j; }
let chart, flash = null;
function loginView() {
  who.replaceChildren(); const err = h('p', { style: 'color:#d92d20' });
  const u = h('input', { placeholder: 'Username' }), p = h('input', { type: 'password', placeholder: 'Password' });
  const go = async () => { try { const r = await api('/api/login', { username: u.value, password: p.value }); localStorage.setItem('sb_token', r.token); load(r.role); }
    catch (e) { err.textContent = e.message; } };
  p.addEventListener('keydown', e => e.key === 'Enter' && go());
  app.replaceChildren(h('div', { class: 'card login' }, h('h3', {}, 'Sign in to SmartBiz'), err, u, p, h('button', { onclick: go }, 'Sign in'))); }
async function load(role, q = '') {
  try { location.hash = role; render(await api(`/api/dashboard/${role}?q=${encodeURIComponent(q)}`), q); }
  catch (e) { e.status === 401 ? loginView() : app.replaceChildren(h('div', { class: 'msg err' }, e.message)); } }
async function act(url, body) {
  try { flash = { t: (await api(url, body)).message }; } catch (e) { if (e.status === 401) return loginView(); flash = { t: e.message, err: 1 }; }
  load(location.hash.slice(1)); }
function render(d, q) {
  who.replaceChildren(`${d.name} · ${d.title} · `, h('a', { onclick: async () => { localStorage.removeItem('sb_token'); loginView(); } }, 'Logout'));
  const out = [];
  if (flash) { out.push(h('div', { class: 'msg' + (flash.err ? ' err' : '') }, flash.t)); flash = null; }
  if (d.nav.length) out.push(h('nav', {}, d.nav.map(n => h('a', { onclick: () => load(n.role) }, n.title))));
  out.push(h('div', { class: 'k' }, d.kpis.map(k => h('div', { class: 'card' }, h('span', {}, k.label), h('b', {}, String(k.value ?? 0))))));
  if (d.chart) out.push(h('div', { class: 'card' }, h('h4', {}, d.chart.title), h('canvas', { id: 'ch', height: 90 })));
  if (d.can_order) out.push(orderForm(d));
  if (d.search) { const i = h('input', { value: q, placeholder: 'Search product or category' });
    out.push(h('div', { class: 'card' }, i, ' ', h('button', { onclick: () => load(d.role, i.value) }, 'Search'))); }
  d.tables.forEach(t => out.push(h('div', { class: 'card' }, h('h4', {}, t.title), h('div', { class: 'w' }, t.rows.length
    ? h('table', {}, h('tr', {}, t.columns.map(c => h('th', {}, c)), t.actions.length ? h('th') : null),
        t.rows.map(r => h('tr', {}, r.map(v => h('td', {}, v ?? '')), t.actions.length ? h('td', {},
          t.actions.map(a => h('button', { onclick: () => act(a.url, { id: r[0] }) }, a.label))) : null)))
    : h('p', {}, 'Nothing here.')))));
  app.replaceChildren(...out);
  if (chart) chart.destroy();
  if (d.chart) chart = new Chart(document.getElementById('ch'), { type: 'bar', data: { labels: d.chart.rows.map(r => r.label),
    datasets: [{ data: d.chart.rows.map(r => Number(r.value)), backgroundColor: '#0f766e' }] }, options: { plugins: { legend: { display: false } } } }); }
function orderForm(d) {
  const sel = d.customers.length ? h('select', {}, d.customers.map(c => h('option', { value: c.customer_id }, c.name))) : null;
  const rows = [0, 1, 2].map(() => [h('input', { placeholder: 'Product ID (e.g. 29-205-1132)', size: 28 }), h('input', { type: 'number', min: 1, placeholder: 'Qty', style: 'width:80px' })]);
  return h('div', { class: 'card' }, h('h4', {}, 'New sales order'), sel && h('p', {}, sel), rows.map(r => h('p', {}, r[0], ' ', r[1])),
    h('button', { onclick: () => act('/api/so/new', { customer_id: sel && sel.value,
      lines: rows.map(r => ({ product_id: r[0].value, quantity: r[1].value })) }) }, 'Place order')); }
(async () => { if (!tok()) return loginView(); try { const m = await api('/api/me'); load(location.hash.slice(1) || m.role); } catch { loginView(); } })();
