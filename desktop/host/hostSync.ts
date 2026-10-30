// The host's half of a sync (LAN_SYNC_TRACKING.md § Conflict rules): take a
// phone's changes, settle conflicts, number every change (server_seq), and
// answer pulls. Each function runs inside one transaction (app.ts).
import {
  PULL_WINDOW, emptyChanges,
  type PullRequest, type PullResponse, type PushRequest, type PushResult, type SyncDb, type WireRow, type WireTable,
} from '../../src/sync/protocol';
import { WIRE_COLS, WIRE_ORDER, deleteWire, localId, readMeta, readWire, writeMeta, writeWire } from '../../src/sync/wire';

const STAMPED: readonly string[] = [...WIRE_ORDER, 'sync_tombstones'];

// Gives every row changed on the host since the last sweep (pushed rows and
// the admin's own edits: the schema triggers mark both dirty) the next change
// number. Clearing dirty in the same UPDATE keeps the triggers quiet.
export async function stampChanges(db: SyncDb): Promise<void> {
  let seq = (await db.getFirstAsync<{ seq: number }>('SELECT seq FROM host_state WHERE id = 1'))?.seq ?? 0;
  const start = seq;
  for (const t of STAMPED) {
    const ids = await db.getAllAsync<{ id: number }>(`SELECT id FROM ${t} WHERE dirty = 1 ORDER BY id`);
    for (const { id } of ids) {
      await db.runAsync(`UPDATE ${t} SET server_seq = ?, dirty = 0 WHERE id = ?`, ++seq, id);
    }
  }
  const meta = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM meta WHERE id = 1');
  if (meta?.dirty === 1) await db.runAsync('UPDATE meta SET server_seq = ?, dirty = 0 WHERE id = 1', ++seq);
  if (seq !== start) await db.runAsync('UPDATE host_state SET seq = ? WHERE id = 1', seq);
}

type HostRow = { id: number; server_seq: number | null; updated_at: string };

// The phone's edit wins when it started from the host's current version, or
// when it is at least as new (same-second ties go to the phone).
const phoneWins = (row: WireRow, host: HostRow) =>
  (row.base_seq ?? null) === host.server_seq || String(row.updated_at ?? '') >= host.updated_at;

async function current(db: SyncDb, t: WireTable, uid: string): Promise<WireRow | undefined> {
  return (await readWire(db, t, 'uid = ?', uid))[0];
}

// True when the pushed row says what the host already has (a push repeated
// after a lost reply). Stock is left out: the host derives it from the ledger.
async function unchanged(db: SyncDb, t: 'products' | 'invoices', row: WireRow): Promise<boolean> {
  const cur = await current(db, t, row.uid);
  if (!cur) return false;
  const keys = [...WIRE_COLS[t].filter(k => k !== 'stock_qty'), ...(t === 'invoices' ? ['lines'] : [])];
  return keys.every(k => JSON.stringify(cur[k] ?? null) === JSON.stringify(row[k] ?? null));
}

// Paid / partial follow the payments, as in paymentsRepo.recordPayment; void
// and draft are left alone. Doesn't touch updated_at, so it never wins a tie.
async function refreshStatus(db: SyncDb, invoiceId: number): Promise<void> {
  const inv = await db.getFirstAsync<{ status: string; total_paise: number }>(
    'SELECT status, total_paise FROM invoices WHERE id = ?', invoiceId);
  if (!inv || inv.status === 'void' || inv.status === 'draft') return;
  const paid = (await db.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(SUM(p.amount_paise), 0) n FROM payments p
     JOIN payment_invoices pi ON pi.payment_id = p.id WHERE pi.invoice_id = ?`, invoiceId))?.n ?? 0;
  const status = paid <= 0 ? inv.status : paid >= inv.total_paise ? 'paid' : 'partial';
  if (status !== inv.status) await db.runAsync('UPDATE invoices SET status = ? WHERE id = ?', status, invoiceId);
}

// Stock is the restock ledger, whatever the phone's balance said.
async function refreshStock(db: SyncDb, productId: number): Promise<void> {
  await db.runAsync(
    `UPDATE products SET stock_qty = (SELECT COALESCE(SUM(delta), 0) FROM restocks WHERE product_id = products.id)
     WHERE id = ? AND abs(stock_qty - (SELECT COALESCE(SUM(delta), 0) FROM restocks WHERE product_id = products.id)) > 1e-9`,
    productId);
}

export async function handlePush(db: SyncDb, req: PushRequest): Promise<PushResult> {
  await stampChanges(db); // so a host_wins reply carries the right server_seq
  const res: PushResult = { accepted: [], rejected: [], deleted: [] };
  const ok: { tbl: WireTable | 'meta'; uid: string; rev: number }[] = [];
  const reject = (tbl: WireTable | 'meta', row: WireRow, reason: PushResult['rejected'][number]['reason'], cur?: WireRow) =>
    res.rejected.push({ tbl, uid: row.uid, rev: row.rev ?? 0, reason, ...(cur ? { current: cur } : {}) });
  const stock = new Set<number>();
  const status = new Set<number>();
  const c = req.changes;

  for (const row of c.products) {
    const host = await db.getFirstAsync<HostRow>('SELECT id, server_seq, updated_at FROM products WHERE uid = ?', row.uid);
    const clash = await db.getFirstAsync<{ uid: string }>(
      'SELECT uid FROM products WHERE name = ? COLLATE NOCASE AND uid <> ?', String(row.name ?? ''), row.uid);
    if (clash) { reject('products', row, 'name_taken'); continue; }
    if (host && await unchanged(db, 'products', row)) { ok.push({ tbl: 'products', uid: row.uid, rev: row.rev ?? 0 }); continue; }
    if (host && !phoneWins(row, host)) { reject('products', row, 'host_wins', await current(db, 'products', row.uid)); continue; }
    const id = await writeWire(db, 'products', row, { dirty: 1 });
    if (id !== null) stock.add(id);
    ok.push({ tbl: 'products', uid: row.uid, rev: row.rev ?? 0 });
  }

  // Restocks, payments and log entries never change once made: a repeat is
  // simply acknowledged again.
  for (const row of c.restocks) {
    if (await localId(db, 'restocks', row.uid) === null) {
      const id = await writeWire(db, 'restocks', row, { dirty: 1 });
      if (id === null) { reject('restocks', row, 'missing_product'); continue; }
      const p = await db.getFirstAsync<{ product_id: number }>('SELECT product_id FROM restocks WHERE id = ?', id);
      if (p) stock.add(p.product_id);
    }
    ok.push({ tbl: 'restocks', uid: row.uid, rev: row.rev ?? 0 });
  }

  for (const row of c.invoices) {
    const taken = await db.getFirstAsync<{ uid: string }>(
      'SELECT uid FROM invoices WHERE invoice_no = ? AND uid <> ?', String(row.invoice_no ?? ''), row.uid);
    if (taken) { reject('invoices', row, 'number_taken'); continue; }
    const host = await db.getFirstAsync<HostRow & { status: string }>(
      'SELECT id, server_seq, updated_at, status FROM invoices WHERE uid = ?', row.uid);
    if (host && await unchanged(db, 'invoices', row)) { ok.push({ tbl: 'invoices', uid: row.uid, rev: row.rev ?? 0 }); continue; }
    // A void made on the desktop always stands.
    if (host && ((host.status === 'void' && row.status !== 'void') || !phoneWins(row, host))) {
      reject('invoices', row, 'host_wins', await current(db, 'invoices', row.uid));
      continue;
    }
    const id = await writeWire(db, 'invoices', row, { dirty: 1 });
    if (id !== null) status.add(id);
    ok.push({ tbl: 'invoices', uid: row.uid, rev: row.rev ?? 0 });
  }

  for (const row of c.payments) {
    if (await localId(db, 'payments', row.uid) === null) await writeWire(db, 'payments', row, { dirty: 1 });
    for (const u of (row.invoice_uids as string[] | undefined) ?? []) {
      const inv = await localId(db, 'invoices', u);
      if (inv !== null) status.add(inv);
    }
    ok.push({ tbl: 'payments', uid: row.uid, rev: row.rev ?? 0 });
  }

  for (const row of c.audit_logs) {
    if (await localId(db, 'audit_logs', row.uid) === null) await writeWire(db, 'audit_logs', row, { dirty: 1 });
    ok.push({ tbl: 'audit_logs', uid: row.uid, rev: row.rev ?? 0 });
  }

  // Company details belong to the desktop. The only exception is the first
  // phone filling an empty desktop (D6).
  if (c.meta) {
    const host = await db.getFirstAsync<{ name: string }>('SELECT name FROM meta WHERE id = 1');
    if (!host?.name) {
      await writeMeta(db, c.meta, { dirty: 1 });
      ok.push({ tbl: 'meta', uid: 'meta', rev: c.meta.rev ?? 0 });
    } else {
      reject('meta', c.meta, 'host_wins', (await readMeta(db)) ?? undefined);
    }
  }

  for (const d of c.deletes) {
    await deleteWire(db, d.tbl, d.uid); // the host's own tombstone tells the other phones
    res.deleted.push(d);
  }

  for (const id of stock) await refreshStock(db, id);
  for (const id of status) await refreshStatus(db, id);
  await stampChanges(db);

  for (const a of ok) {
    const r = a.tbl === 'meta'
      ? await db.getFirstAsync<{ s: number }>('SELECT server_seq s FROM meta WHERE id = 1')
      : await db.getFirstAsync<{ s: number }>(`SELECT server_seq s FROM ${a.tbl} WHERE uid = ?`, a.uid);
    res.accepted.push({ ...a, server_seq: r?.s ?? 0 });
  }
  return res;
}

// Everything numbered after `since`, up to PULL_WINDOW numbers at a time.
// Log entries stay on the desktop (phones don't show other users' activity).
export async function handlePull(db: SyncDb, req: PullRequest): Promise<PullResponse> {
  await stampChanges(db);
  const top = (await db.getFirstAsync<{ seq: number }>('SELECT seq FROM host_state WHERE id = 1'))?.seq ?? 0;
  const since = Math.max(0, Math.min(req.since, top));
  const upto = Math.min(top, since + PULL_WINDOW);
  const changes = emptyChanges();
  for (const t of WIRE_ORDER) {
    if (t === 'audit_logs') continue;
    changes[t] = await readWire(db, t, 'server_seq > ? AND server_seq <= ?', since, upto);
  }
  const meta = await readMeta(db);
  if (meta && meta.server_seq != null && meta.server_seq > since && meta.server_seq <= upto) changes.meta = meta;
  changes.deletes = await db.getAllAsync<{ tbl: WireTable; uid: string }>(
    'SELECT tbl, uid FROM sync_tombstones WHERE server_seq > ? AND server_seq <= ? ORDER BY server_seq', since, upto);
  return { changes, upto, more: upto < top };
}
