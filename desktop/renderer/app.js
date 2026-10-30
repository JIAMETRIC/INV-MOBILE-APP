// Status page of the desktop host. Talks to the main process only through
// window.host (preload.ts). Phone names come from the phones, so all text is
// set with textContent, never as HTML.
'use strict';

const $ = id => document.getElementById(id);
const ONLINE_MS = 2 * 60_000; // seen within two minutes = online

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// SQLite datetime('now') is UTC "YYYY-MM-DD HH:MM:SS".
function sqlTime(s) { return s ? new Date(s.replace(' ', 'T') + 'Z') : null; }

function ago(d, now) {
  if (!d) return 'never';
  const s = Math.max(0, Math.round((now - d) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return d.toLocaleDateString();
}

const fmt = n => (n ?? 0).toLocaleString('en-IN');

function deviceRow(d, now) {
  const row = el('div', 'list-row device-row');
  const seen = sqlTime(d.last_seen);
  const blocked = !!d.revoked;
  const online = !blocked && seen && now - seen < ONLINE_MS;
  row.append(el('div', blocked ? 'list-avatar list-avatar--alt' : 'list-avatar', d.series));
  const text = el('div', 'list-text');
  text.append(el('span', 'list-title', d.name || 'Phone'));
  const bits = [`INV-${d.series}`, `last sync ${ago(seen, now)}`];
  if (d.last_ip) bits.push(d.last_ip.replace(/^::ffff:/, ''));
  if (d.app_version) bits.push(`app ${d.app_version}`);
  text.append(el('span', 'list-sub', bits.join(' · ')));
  row.append(text);
  row.append(el('span', blocked ? 'badge badge--red' : online ? 'badge' : 'badge badge--off',
    blocked ? 'Blocked' : online ? 'Online' : 'Offline'));
  const btn = el('button', 'btn-glass', blocked ? 'Unblock' : 'Block');
  btn.setAttribute('aria-label', `${blocked ? 'Unblock' : 'Block'} ${d.name || 'phone'}`);
  btn.addEventListener('click', async () => {
    if (!blocked && !confirm(`Block ${d.name || 'this phone'}? It stops syncing until you unblock it.`)) return;
    await window.host.setBlocked(d.device_id, !blocked);
    refresh();
  });
  row.append(btn);
  return row;
}

function logRow(l, now) {
  const row = el('div', 'list-row');
  row.append(el('div', 'list-avatar list-avatar--alt', l.series || '?'));
  const text = el('div', 'list-text');
  const who = l.name || 'A phone';
  const what = l.kind === 'pair' ? `${who} paired`
    : l.kind === 'push' ? `${who} sent ${fmt(l.rows_in)} change${l.rows_in === 1 ? '' : 's'}`
    : `${who} received ${fmt(l.rows_out)} change${l.rows_out === 1 ? '' : 's'}`;
  text.append(el('span', 'list-title', what));
  text.append(el('span', 'list-sub', ago(sqlTime(l.at), now)));
  row.append(text);
  if (l.rejects_json) {
    let n = 0, why = '';
    try { const r = JSON.parse(l.rejects_json); n = r.length; why = r.map(x => `${x.tbl}: ${x.reason}`).join('\n'); } catch { /* keep 0 */ }
    if (n) { const b = el('span', 'badge badge--red', `${n} refused`); b.title = why; row.append(b); }
  }
  return row;
}

function render(s) {
  const now = Date.parse(s.now);
  $('hostLine').textContent = `Desktop host · ${s.hostName}`;
  $('company').textContent = s.company || 'Invoice ERP';
  $('state').textContent = `Running · port ${s.port}`;
  $('state').className = 'badge';
  $('address').textContent = s.ips.length
    ? `Phones connect to ${s.ips.map(ip => `${ip}:${s.port}`).join('  or  ')}`
    : 'No network found: connect this PC to the shop Wi-Fi or router.';
  $('kPhones').textContent = fmt(s.counts.phones);
  $('kInvoices').textContent = fmt(s.counts.invoices);
  $('kProducts').textContent = fmt(s.counts.products);

  const dev = $('devices');
  dev.replaceChildren(...(s.devices.length ? s.devices.map(d => deviceRow(d, now))
    : [el('div', 'empty', 'No phones yet. Choose Add phone, then scan the code with the phone.')]));
  const log = $('log');
  log.replaceChildren(...(s.log.length ? s.log.map(l => logRow(l, now))
    : [el('div', 'empty', 'Nothing yet. Each pairing and sync shows here.')]));

  $('startWithWindows').checked = s.startWithWindows;
  $('dataDir').textContent = `Data and daily backups: ${s.dataDir}`;
}

async function refresh() {
  try { render(await window.host.status()); }
  catch (e) { $('state').textContent = 'Not running'; $('state').className = 'badge badge--red'; console.error(e); }
}

// ---------- pairing dialog ----------

let expiryTimer = null;

async function showPairing() {
  const p = await window.host.pair();
  $('qr').src = p.qr;
  $('pairUri').textContent = p.uri;
  clearInterval(expiryTimer);
  const tick = () => {
    const left = Math.max(0, p.expiresAt - Date.now());
    $('pairExpiry').textContent = left > 0
      ? `Code works once, for ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} more`
      : 'Code expired: choose New code.';
    if (!left) clearInterval(expiryTimer);
  };
  tick();
  expiryTimer = setInterval(tick, 1000);
  $('pairDialog').hidden = false;
  $('pairDone').focus();
}

function closePairing() {
  clearInterval(expiryTimer);
  $('pairDialog').hidden = true;
  $('addPhone').focus();
  refresh();
}

$('addPhone').addEventListener('click', showPairing);
$('newCode').addEventListener('click', showPairing);
$('pairDone').addEventListener('click', closePairing);
$('pairDialog').addEventListener('click', e => { if (e.target === $('pairDialog')) closePairing(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('pairDialog').hidden) closePairing(); });
$('openData').addEventListener('click', () => window.host.openDataFolder());
$('startWithWindows').addEventListener('change', async e => {
  e.target.checked = await window.host.setStartWithWindows(e.target.checked);
});

refresh();
setInterval(refresh, 5000);
