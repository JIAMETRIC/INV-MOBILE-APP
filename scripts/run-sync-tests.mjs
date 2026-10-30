// LAN sync end to end (LAN_SYNC Phase 2): the real desktop host (desktop/host)
// on a local port, and three simulated phones, each running the app's own
// data layer (src/data) and sync engine (src/sync) on its own in-memory
// database. Phones talk to the host over HTTP with sealed bodies, as on Wi-Fi.
// Run from the project root: npm run test:sync
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const tmp = path.join(root, '.tmp-sync');
const build = path.join(tmp, 'build');
rmSync(tmp, { recursive: true, force: true });

execFileSync('npx', ['tsc', '--ignoreConfig',
  'desktop/host/app.ts', 'src/sync/client.ts',
  'src/data/settingsRepo.ts', 'src/data/productsRepo.ts', 'src/data/invoicesRepo.ts',
  'src/data/paymentsRepo.ts', 'src/data/syncRepo.ts',
  '--outDir', build, '--rootDir', '.', '--module', 'nodenext', '--moduleResolution', 'nodenext',
  '--target', 'es2022', '--types', 'node', '--skipLibCheck', '--esModuleInterop', '--strict'],
{ stdio: 'inherit', shell: true });

// Each phone gets its own copy of the compiled code, so each has its own
// getDb() singleton and therefore its own database.
for (const p of ['phoneA', 'phoneB', 'phoneC']) cpSync(build, path.join(tmp, p), { recursive: true });

const shim = require(path.join(build, 'desktop', 'host', 'expoShim.js'));
shim.installExpoShims();
const { seal, open } = require(path.join(build, 'desktop', 'host', 'seal.js'));
const { startHost } = require(path.join(build, 'desktop', 'host', 'app.js'));

let failed = 0;
const t = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', e.stack ?? e.message); }
};

// ---------- host ----------

const hostDir = path.join(tmp, 'host');
const host = await startHost({ dataDir: hostDir, port: 0, bind: '127.0.0.1' });
const url = `http://127.0.0.1:${host.port}`;
const hq = (sql, ...a) => host.db.getAllAsync(sql, ...a);
const h1 = async (sql, ...a) => (await host.db.getFirstAsync(sql, ...a));

// ---------- phones ----------

function makePhone(name) {
  const dir = path.join(tmp, name);
  const r = p => require(path.join(dir, p));
  const db = r('src/data/db.js');
  const p = {
    name, key: null, device: null, series: null,
    inv: r('src/data/invoicesRepo.js'), pay: r('src/data/paymentsRepo.js'),
    prod: r('src/data/productsRepo.js'), settings: r('src/data/settingsRepo.js'),
    syncRepo: r('src/data/syncRepo.js'), money: r('src/data/money.js'), client: r('src/sync/client.js'),
    tx: fn => db.withTx(fn),
    q: async (sql, ...a) => (await db.getDb()).getAllAsync(sql, ...a),
    one: async (sql, ...a) => (await db.getDb()).getFirstAsync(sql, ...a),
  };
  p.post = async (route, msg) => {
    const res = await fetch(url + route, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device: p.device, ...seal(p.key, route, msg) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${body.error}`);
    return open(p.key, route, body);
  };
  p.transport = { push: m => p.post('/sync/push', m), pull: m => p.post('/sync/pull', m) };
  p.pair = async () => {
    const { pairing } = await host.newPairing();
    p.device = await p.client.deviceId(await db.getDb());
    const hello = { device_id: p.device, device_name: name, app_version: 'test' };
    const res = await fetch(`${url}/pair`, {
      method: 'POST', body: JSON.stringify({ pid: pairing.pid, ...seal(pairing.secret, '/pair', hello) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${body.error}`);
    const welcome = open(pairing.secret, '/pair', body);
    p.key = welcome.device_key;
    p.series = welcome.series;
    await p.tx(d => p.client.applyPairing(d, welcome, url));
    return { pairing, welcome };
  };
  p.sync = () => p.client.syncOnce(p.tx, p.transport);
  p.issue = async (lines, party = 'Acme Co') => {
    const L = lines.map(([desc, qty, unit, pid], i) => ({
      sno: i + 1, product_id: pid ?? null, description: desc, size: 'M', qty,
      unit_paise: unit, line_paise: p.money.linePaise(qty, unit),
    }));
    const form = {
      party: { party_name: party, party_address: '', party_city: 'Tirupur', party_pincode: '641607', party_mobile: '9', party_email: '' },
      invoiceDate: '2026-10-30', dueDate: '', discountPercent: 0, lines: L, notes: '', hasShipping: false,
      ship: { ship_name: '', ship_address: '', ship_city: '', ship_pincode: '' }, paymentMode: 'Cash',
    };
    return p.inv.saveInvoice(form, p.money.computeTotals(L, 0), {});
  };
  p.product = async n => (await p.prod.listProducts(n)).find(x => x.name === n);
  return p;
}

const A = makePhone('phoneA');
const B = makePhone('phoneB');
const C = makePhone('phoneC');

// Comparable picture of a database (uids, not local ids).
async function picture(q) {
  return {
    products: await q(`SELECT uid, name, unit_paise, stock_qty FROM products ORDER BY uid`),
    restocks: (await q('SELECT uid FROM restocks ORDER BY uid')).map(r => r.uid),
    invoices: await q(`SELECT i.uid, i.invoice_no, i.status, i.total_paise,
      (SELECT COUNT(*) FROM invoice_items li WHERE li.invoice_id = i.id) AS lines,
      (SELECT group_concat(p.uid) FROM invoice_items li LEFT JOIN products p ON p.id = li.product_id WHERE li.invoice_id = i.id) AS line_products
      FROM invoices i ORDER BY i.uid`),
    payments: await q(`SELECT p.uid, p.amount_paise,
      (SELECT group_concat(i.uid) FROM payment_invoices pi JOIN invoices i ON i.id = pi.invoice_id WHERE pi.payment_id = p.id) AS inv
      FROM payments p ORDER BY p.uid`),
    company: (await q('SELECT name, upi_id FROM meta'))[0],
  };
}

// ---------- scenario ----------

let a1, a2;
await t('host starts: health answers, seeded catalog numbered, backup written', async () => {
  const h = await (await fetch(url + '/health')).json();
  assert.equal(h.app, 'invoice-erp-host');
  assert.equal(h.host_id, host.info.host_id);
  const seeded = await hq('SELECT uid, server_seq FROM products');
  assert.equal(seeded.length, 12);
  assert.ok(seeded.every(r => r.server_seq > 0));
  assert.ok(existsSync(path.join(hostDir, 'backups')) && readdirSync(path.join(hostDir, 'backups')).length === 1);
});

await t('phone A has data before pairing (the shop\'s existing phone, D6)', async () => {
  await A.settings.updateSettings({ name: 'Barathy Garments', upi_id: 'barathy@upi' });
  const hoodie = await A.product('Hoodie');
  await A.prod.restockProduct(hoodie.id, 40, 50000, 'Lot 1');
  a1 = await A.issue([['Hoodie', 10, 50000, hoodie.id]]);
  a2 = await A.issue([['Hoodie', 5, 50000, hoodie.id], ['Polo T-Shirt', 2, 30000]]);
  assert.equal(a1.invoiceNo, 'INV-001');
  const inv = await A.inv.getInvoice(a1.invoiceId);
  await A.pay.recordPayment({
    payment_date: '2026-10-30', party_name: 'Acme Co', invoiceIds: [a1.invoiceId],
    mode: 'UPI', reference_no: 'u1', amount_paise: inv.total_paise, remarks: '',
  });
});

await t('pairing: series A and B, one-time QR, wrong secret and unknown device refused', async () => {
  const { pairing } = await A.pair();
  assert.equal(A.series, 'A');
  assert.equal((await A.settings.getSettings()).invoice_prefix, 'INV-A');
  // The same QR again: refused.
  const again = await fetch(`${url}/pair`, { method: 'POST', body: JSON.stringify({ pid: pairing.pid, ...seal(pairing.secret, '/pair', {}) }) });
  assert.equal(again.status, 401);
  // A fresh QR opened with the wrong secret: refused, and the QR stays usable.
  const { pairing: p2 } = await host.newPairing();
  const wrong = await fetch(`${url}/pair`, { method: 'POST', body: JSON.stringify({ pid: p2.pid, ...seal(A.key, '/pair', {}) }) });
  assert.equal(wrong.status, 401);
  assert.equal((await h1('SELECT used FROM pairings WHERE pid = ?', p2.pid)).used, 0);
  await B.pair();
  assert.equal(B.series, 'B');
  // Not paired: refused.
  const res = await fetch(url + '/sync/pull', { method: 'POST', body: JSON.stringify({ device: 'nobody', ...seal(A.key, '/sync/pull', {}) }) });
  assert.equal(res.status, 401);
  // A body sealed for /sync/pull can't be replayed on /sync/push.
  const body = JSON.stringify({ device: A.device, ...seal(A.key, '/sync/pull', { protocol: 1, device_id: A.device, since: 0 }) });
  assert.equal((await fetch(url + '/sync/push', { method: 'POST', body })).status, 401);
  // Pairing the same phone again keeps its letter.
  await A.pair();
  assert.equal(A.series, 'A');
  assert.equal((await h1('SELECT COUNT(*) c FROM devices')).c, 2);
});

await t('phone A seeds the desktop: invoices, stock, payment, company details', async () => {
  const rep = await A.sync();
  assert.deepEqual(rep.rejected, []);
  assert.ok(rep.pushed >= 12 + 1 + 2 + 1); // catalog, restock, invoices, payment (+ log, company)
  assert.equal((await hq('SELECT COUNT(*) c FROM products'))[0].c, 12, 'same catalog, no duplicates');
  assert.equal((await h1("SELECT stock_qty FROM products WHERE name = 'Hoodie'")).stock_qty, 40);
  assert.equal((await h1("SELECT status FROM invoices WHERE invoice_no = 'INV-001'")).status, 'paid');
  assert.equal((await h1('SELECT name FROM meta')).name, 'Barathy Garments');
  const p = await A.syncRepo.pendingChanges();
  assert.deepEqual(Object.values(p).filter(n => n > 0), [], 'nothing left to push on A');
  // A's activity reached the desktop, tagged with A's device.
  const log = await hq('SELECT action FROM audit_logs WHERE origin_device = ?', A.device);
  assert.ok(log.some(r => r.action === 'settings.update'));
});

await t('phone B downloads everything', async () => {
  await B.sync();
  assert.deepEqual(await picture(B.q), await picture(hq));
  const hoodie = await B.product('Hoodie');
  assert.equal(hoodie.sold_qty, 15);
  assert.equal(hoodie.avl_qty, 25);
  // Other users' activity stays on the desktop.
  assert.equal((await B.one('SELECT COUNT(*) c FROM audit_logs WHERE origin_device = ?', A.device)).c, 0);
});

let b1;
await t('both phones work offline, then converge: B invoice + payment on A\'s invoice, two restocks add up', async () => {
  const hoodieB = await B.product('Hoodie');
  b1 = await B.issue([['Hoodie', 3, 50000, hoodieB.id]], 'Delhi Trader');
  assert.equal(b1.invoiceNo, 'INV-B001');
  const a2onB = await B.one('SELECT id, total_paise FROM invoices WHERE invoice_no = ?', 'INV-002');
  await B.pay.recordPayment({
    payment_date: '2026-10-30', party_name: 'Acme Co', invoiceIds: [a2onB.id],
    mode: 'Cash', reference_no: '', amount_paise: a2onB.total_paise, remarks: 'paid at shop',
  });
  await B.prod.restockProduct(hoodieB.id, 10, 0, 'Lot B');
  const hoodieA = await A.product('Hoodie');
  await A.prod.restockProduct(hoodieA.id, 5, 0, 'Lot A2');
  await B.sync(); await A.sync(); await B.sync();
  const host = await picture(hq);
  assert.deepEqual(await picture(A.q), host);
  assert.deepEqual(await picture(B.q), host);
  assert.equal(host.products.find(p => p.name === 'Hoodie').stock_qty, 55, '40 + 10 + 5');
  assert.equal(host.invoices.find(i => i.invoice_no === 'INV-002').status, 'paid');
  assert.equal((await A.product('Hoodie')).sold_qty, 18);
});

await t('a void made on the desktop beats an offline edit on the phone', async () => {
  await host.exclusive(tx => tx.runAsync(
    "UPDATE invoices SET status = 'void', updated_at = datetime('now') WHERE invoice_no = 'INV-B001'"));
  const hoodieB = await B.product('Hoodie');
  const L = [{ sno: 1, product_id: hoodieB.id, description: 'Hoodie', size: 'L', qty: 4, unit_paise: 50000, line_paise: 200000 }];
  await B.inv.saveInvoice({
    party: { party_name: 'Delhi Trader', party_address: '', party_city: '', party_pincode: '', party_mobile: '', party_email: '' },
    invoiceDate: '2026-10-30', dueDate: '', discountPercent: 0, lines: L, notes: 'edited', hasShipping: false,
    ship: { ship_name: '', ship_address: '', ship_city: '', ship_pincode: '' }, paymentMode: 'Cash',
  }, B.money.computeTotals(L, 0), { invoiceId: b1.invoiceId, invoiceNo: b1.invoiceNo });
  const rep = await B.sync();
  assert.deepEqual(rep.rejected.map(r => r.reason), ['host_wins']);
  const inv = await B.inv.getInvoice(b1.invoiceId);
  assert.equal(inv.status, 'void');
  assert.equal(inv.notes, '', 'desktop version taken');
  assert.equal(inv.dirty, 0);
  await A.sync();
  assert.deepEqual(await picture(A.q), await picture(hq));
});

await t('price edits: a stale phone edit loses to a newer desktop edit; an edit on the latest version wins', async () => {
  const hoodieA = await A.product('Hoodie');
  // Desktop re-prices a minute "later" than the phone's offline edit.
  await host.exclusive(tx => tx.runAsync(
    "UPDATE products SET unit_paise = 61000, updated_at = datetime('now', '+1 minute') WHERE name = 'Hoodie'"));
  await A.prod.upsertProduct({ name: 'Hoodie', unit_paise: 59000, stock_qty: hoodieA.stock_qty }, hoodieA.id);
  let rep = await A.sync();
  assert.deepEqual(rep.rejected.map(r => r.reason), ['host_wins']);
  assert.equal((await A.product('Hoodie')).unit_paise, 61000);
  // Now A edits on top of what it has: that edit goes through.
  await A.prod.upsertProduct({ name: 'Hoodie', unit_paise: 62000, stock_qty: (await A.product('Hoodie')).stock_qty }, hoodieA.id);
  rep = await A.sync();
  assert.deepEqual(rep.rejected, []);
  assert.equal((await h1("SELECT unit_paise FROM products WHERE name = 'Hoodie'")).unit_paise, 62000);
  await B.sync();
  assert.equal((await B.product('Hoodie')).unit_paise, 62000);
});

await t('a delete on one phone reaches the desktop and the other phone', async () => {
  const x = await A.issue([['Sample', 1, 100]], 'Walk-in');
  await A.sync(); await B.sync();
  assert.ok(await B.one('SELECT id FROM invoices WHERE invoice_no = ?', x.invoiceNo));
  await A.inv.deleteInvoice(x.invoiceId);
  await A.sync(); await B.sync();
  assert.equal(await h1('SELECT id FROM invoices WHERE invoice_no = ?', x.invoiceNo), null);
  assert.equal(await B.one('SELECT id FROM invoices WHERE invoice_no = ?', x.invoiceNo), null);
  assert.equal((await A.one("SELECT COUNT(*) c FROM sync_tombstones")).c, 0, 'tombstone cleared once the host took it');
  assert.deepEqual(await picture(A.q), await picture(B.q));
});

await t('a second phone that already has its own INV-001: refused, then moved to its own series', async () => {
  const c1 = await C.issue([['Track Pant Cotton', 1, 40000]], 'Old customer');
  assert.equal(c1.invoiceNo, 'INV-001');
  await C.pair();
  assert.equal(C.series, 'C');
  // The push is refused (the desktop's INV-001 is A's) ...
  const rep = await C.sync();
  assert.deepEqual(rep.rejected.map(r => [r.tbl, r.reason]), [['invoices', 'number_taken']]);
  // ... the pull brings the desktop's INV-001, so C's own moves to its series.
  const row = await C.inv.getInvoice(c1.invoiceId);
  assert.equal(row.invoice_no, 'INV-C001');
  assert.equal(row.party_name, 'Old customer');
  assert.equal(row.dirty, 1, 'waiting for the next push');
  const log = await C.one("SELECT entity_id, details_json FROM audit_logs WHERE action = 'invoice.renumber'");
  assert.equal(log.entity_id, 'INV-C001');
  assert.equal(JSON.parse(log.details_json).from, 'INV-001');
  assert.deepEqual((await C.sync()).rejected, []);
  assert.equal((await h1("SELECT party_name FROM invoices WHERE invoice_no = 'INV-001'")).party_name, 'Acme Co');
  assert.equal((await h1("SELECT party_name FROM invoices WHERE invoice_no = 'INV-C001'")).party_name, 'Old customer');
  assert.deepEqual(await picture(C.q), await picture(hq));
  await A.sync(); await B.sync();
});

await t('the same product name made on two devices becomes one product', async () => {
  // Rename-then-recreate gives "Shorts" a random uid on A; B makes "shorts" too.
  const a = await A.prod.upsertProduct({ name: 'Shorts', unit_paise: 20000, stock_qty: 0 });
  await A.prod.upsertProduct({ name: 'Shorts Old', unit_paise: 20000, stock_qty: 0 }, a.id);
  await A.prod.upsertProduct({ name: 'Shorts', unit_paise: 21000, stock_qty: 0 });
  await A.sync();
  const s = await B.prod.upsertProduct({ name: 'shorts', unit_paise: 22000, stock_qty: 0 });
  await B.prod.restockProduct(s.id, 7, 0, 'B shorts');
  const x = await B.issue([['Shorts', 2, 22000, s.id]]);
  const rep = await B.sync();
  assert.deepEqual(rep.rejected.map(r => r.reason), ['name_taken', 'missing_product'],
    'first push: the desktop already has Shorts, so B\'s restock has no product there yet');
  // The pull in that same round re-keyed B's product, so the next push merges.
  assert.deepEqual((await B.sync()).rejected, []);
  await A.sync();
  const h = await picture(hq);
  assert.deepEqual(await picture(A.q), h);
  assert.deepEqual(await picture(B.q), h);
  assert.equal(h.products.filter(p => p.name.toLowerCase() === 'shorts').length, 1);
  const line = await h1(`SELECT p.name FROM invoice_items li JOIN invoices i ON i.id = li.invoice_id
    JOIN products p ON p.id = li.product_id WHERE i.invoice_no = ?`, x.invoiceNo);
  assert.equal(line.name.toLowerCase(), 'shorts', "B's invoice line points at the merged product");
  assert.equal(h.products.find(p => p.name.toLowerCase() === 'shorts').stock_qty, 7, "B's restock followed");
});

await t('repeating a push changes nothing (Wi-Fi dropped before the reply)', async () => {
  const hoodie = await A.product('Hoodie');
  await A.prod.restockProduct(hoodie.id, 1, 0, 'retry');
  const req = await A.tx(d => A.client.collectPush(d));
  const first = await A.transport.push(req);
  const before = await picture(hq);
  const second = await A.transport.push(req);
  assert.deepEqual(second.accepted, first.accepted);
  assert.deepEqual(await picture(hq), before);
  await A.tx(d => A.client.applyPushResult(d, second));
  await A.sync();
  assert.equal((await A.product('Hoodie')).stock_qty, (await h1("SELECT stock_qty FROM products WHERE name = 'Hoodie'")).stock_qty);
});

await t('a blocked phone is refused', async () => {
  await host.exclusive(tx => tx.runAsync('UPDATE devices SET revoked = 1 WHERE device_id = ?', C.device));
  await assert.rejects(C.sync(), /403 revoked/);
});

await t('final state: A, B and the desktop agree; sync log written', async () => {
  await A.sync(); await B.sync();
  const h = await picture(hq);
  assert.deepEqual(await picture(A.q), h);
  assert.deepEqual(await picture(B.q), h);
  for (const p of [A, B]) {
    const pend = await p.syncRepo.pendingChanges();
    assert.deepEqual(Object.values(pend).filter(n => n > 0), [], `${p.name} has nothing waiting`);
  }
  const log = await hq('SELECT kind, COUNT(*) c FROM sync_log GROUP BY kind ORDER BY kind');
  assert.deepEqual(log.map(r => r.kind), ['pair', 'pull', 'push']);
  const ledger = await hq(`SELECT p.name FROM products p
    WHERE abs(p.stock_qty - COALESCE((SELECT SUM(delta) FROM restocks r WHERE r.product_id = p.id), 0)) > 1e-9`);
  assert.deepEqual(ledger, [], 'desktop stock = ledger');
});

await host.stop();
rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `${failed} sync test(s) failed` : 'All sync tests passed.');
process.exit(failed ? 1 : 0);
