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

// ---------- people (LAN_SYNC Phase 5) ----------

const PERM_WORDS = { products: 'Products', stock: 'Stock', delete: 'Delete', settings: 'Settings' };
// Same rule as the phone (components.initials): two words -> first letters, one word -> its first two.
const initialsOf = n => {
  const w = n.trim().split(/\s+/).filter(Boolean);
  return (w.length === 1 ? w[0].slice(0, 2) : w.slice(0, 2).map(x => x[0]).join('')).toUpperCase() || '?';
};
let editing = null; // the person being edited, or null for a new one
let role = 'staff';

function personRow(u) {
  const row = el('div', 'list-row device-row');
  row.append(el('div', u.role === 'admin' ? 'list-avatar' : 'list-avatar list-avatar--alt', initialsOf(u.name)));
  const text = el('div', 'list-text');
  text.append(el('span', 'list-title', u.name));
  const what = u.role === 'admin' ? 'Owner · may do everything'
    : `Staff · invoices, payments${u.perms.length ? ' + ' + u.perms.map(p => PERM_WORDS[p]).join(', ') : ''}`;
  text.append(el('span', 'list-sub', what));
  row.append(text);
  if (!u.active) row.append(el('span', 'badge badge--off', 'Switched off'));
  const btn = el('button', 'btn-glass', 'Edit');
  btn.setAttribute('aria-label', `Edit ${u.name}`);
  btn.addEventListener('click', () => openPerson(u));
  row.append(btn);
  return row;
}

async function loadPeople() {
  const list = await window.host.users();
  $('people').replaceChildren(...(list.length ? list.map(personRow)
    : [el('div', 'empty', 'Nobody yet: each phone opens with its own PIN. Add the people who use the phones; once a paired phone syncs, it asks who is using it and their PIN.')]));
}

function setRole(r) {
  role = r;
  for (const b of document.querySelectorAll('.segmented [data-role]')) b.setAttribute('aria-checked', String(b.dataset.role === r));
  $('pPerms').disabled = r === 'admin';
  $('pRoleHelp').textContent = r === 'admin' ? 'Owners may do everything, on every phone.' : 'Staff may make invoices and take payments, plus the switches below.';
}

function openPerson(u) {
  editing = u || null;
  $('personTitle').textContent = u ? `Edit ${u.name}` : 'Add a person';
  $('pName').value = u ? u.name : '';
  setRole(u ? u.role : 'staff');
  for (const c of $('pPerms').querySelectorAll('input')) c.checked = !!u && u.perms.includes(c.value);
  $('pPin').value = '';
  $('pPinLabel').textContent = u ? 'New PIN (leave empty to keep the current one)' : 'PIN (4 to 6 digits)';
  $('pActive').checked = u ? u.active : true;
  $('pActiveRow').hidden = !u;
  $('pError').textContent = '';
  $('personDialog').hidden = false;
  $('pName').focus();
}

function closePerson() { $('personDialog').hidden = true; $('addPerson').focus(); }

$('addPerson').addEventListener('click', () => openPerson(null));
$('pCancel').addEventListener('click', closePerson);
$('personDialog').addEventListener('click', e => { if (e.target === $('personDialog')) closePerson(); });
for (const b of document.querySelectorAll('.segmented [data-role]')) b.addEventListener('click', () => setRole(b.dataset.role));
$('personForm').addEventListener('submit', async e => {
  e.preventDefault();
  const pin = $('pPin').value.trim();
  if (pin && !/^\d{4,6}$/.test(pin)) { $('pError').textContent = 'The PIN must be 4 to 6 digits.'; return; }
  const res = await window.host.saveUser({
    uid: editing ? editing.uid : undefined,
    name: $('pName').value,
    role,
    perms: [...$('pPerms').querySelectorAll('input:checked')].map(c => c.value),
    active: editing ? $('pActive').checked : true,
    pin: pin || (editing ? undefined : ''),
  });
  if (!res.ok) { $('pError').textContent = res.error; return; }
  closePerson();
  loadPeople();
});

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
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('pairDialog').hidden) closePairing();
  if (!$('personDialog').hidden) closePerson();
});
$('openData').addEventListener('click', () => window.host.openDataFolder());
$('startWithWindows').addEventListener('change', async e => {
  e.target.checked = await window.host.setStartWithWindows(e.target.checked);
});

refresh();
loadPeople();
setInterval(refresh, 5000);
