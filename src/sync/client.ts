// Phone side of a sync: collect what changed here, send it, apply the host's
// answer, then pull everything newer than the last pull. Pure database work
// over a SyncDb; the network and the encryption come in through a Transport.
import {
  PROTOCOL, countChanges, emptyChanges,
  type PairWelcome, type PullRequest, type PullResponse, type PushRequest, type PushResult,
  type SyncDb, type WireRow, type WireTable,
} from './protocol';
import { WIRE_ORDER, deleteWire, readMeta, readWire, writeMeta, writeUser, writeWire } from './wire';
import { formatInvoiceNo } from '../data/money';

export interface Transport {
  push(req: PushRequest): Promise<PushResult>;
  pull(req: PullRequest): Promise<PullResponse>;
}

// Runs fn inside one database transaction (the phone passes data/db.withTx).
export type Tx = <T>(fn: (db: SyncDb) => Promise<T>) => Promise<T>;

export interface SyncReport {
  pushed: number;
  accepted: number;
  rejected: PushResult['rejected'];
  pulled: number;
  usersChanged: boolean; // the desktop sent people: the lock may need to look again
}

async function setApplying(db: SyncDb, on: boolean): Promise<void> {
  await db.runAsync('UPDATE sync_state SET applying = ? WHERE id = 1', on ? 1 : 0);
}

export async function deviceId(db: SyncDb): Promise<string> {
  const r = await db.getFirstAsync<{ device_id: string }>('SELECT device_id FROM sync_state WHERE id = 1');
  if (!r) throw new Error('sync_state row missing');
  return r.device_id;
}

// Everything marked dirty = 1, with base_seq = the host version it started from.
export async function collectPush(db: SyncDb): Promise<PushRequest> {
  const changes = emptyChanges();
  for (const t of WIRE_ORDER) {
    changes[t] = (await readWire(db, t, 'dirty = 1')).map(({ server_seq, ...r }) => ({ ...r, base_seq: server_seq ?? null }));
  }
  const meta = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM meta WHERE id = 1');
  if (meta?.dirty === 1) {
    const m = await readMeta(db);
    if (m) { const { server_seq, ...r } = m; changes.meta = { ...r, base_seq: server_seq ?? null }; }
  }
  changes.deletes = await db.getAllAsync<{ tbl: WireTable; uid: string; user_uid: string }>(
    'SELECT tbl, uid, user_uid FROM sync_tombstones WHERE dirty = 1 ORDER BY id');
  return { protocol: PROTOCOL, device_id: await deviceId(db), changes };
}

// Clears what the host took. A row edited again while the push was in flight
// has a newer rev, so it stays dirty for the next push.
export async function applyPushResult(db: SyncDb, res: PushResult): Promise<void> {
  await setApplying(db, true);
  try {
    for (const a of res.accepted) {
      if (a.tbl === 'meta') {
        await db.runAsync('UPDATE meta SET dirty = 0, server_seq = ? WHERE id = 1 AND rev = ?', a.server_seq, a.rev);
      } else {
        await db.runAsync(`UPDATE ${a.tbl} SET dirty = 0, server_seq = ? WHERE uid = ? AND rev = ?`, a.server_seq, a.uid, a.rev);
      }
    }
    for (const r of res.rejected) {
      const table = r.tbl === 'meta' ? 'meta' : r.tbl;
      const where = r.tbl === 'meta' ? 'id = 1' : 'uid = ?';
      const whereArgs = r.tbl === 'meta' ? [] : [r.uid];
      const local = await db.getFirstAsync<{ rev: number }>(`SELECT rev FROM ${table} WHERE ${where}`, ...whereArgs);
      if (!local || local.rev !== r.rev) continue; // edited again since: push that next time
      if ((r.reason === 'host_wins' || r.reason === 'not_allowed') && r.current) {
        if (r.tbl === 'meta') await writeMeta(db, r.current, { dirty: 0, serverSeq: r.current.server_seq ?? null });
        else await writeWire(db, r.tbl, r.current, { dirty: 0, serverSeq: r.current.server_seq ?? null });
      } else if (r.reason === 'not_allowed' && r.tbl !== 'meta') {
        // Made by someone who may not, and the desktop never had it: it goes.
        // A dropped restock takes its stock with it.
        const product = r.tbl === 'restocks'
          ? (await db.getFirstAsync<{ product_id: number }>('SELECT product_id FROM restocks WHERE uid = ?', r.uid))?.product_id
          : undefined;
        await deleteWire(db, r.tbl, r.uid);
        if (product !== undefined) {
          await db.runAsync(
            'UPDATE products SET stock_qty = (SELECT COALESCE(SUM(delta), 0) FROM restocks WHERE product_id = ?) WHERE id = ?',
            product, product);
        }
      } else {
        // Needs a person (number or name already used on another device): kept
        // here, out of the push queue until it's edited.
        await db.runAsync(`UPDATE ${table} SET dirty = 2 WHERE ${where}`, ...whereArgs);
      }
    }
    for (const d of res.deleted) {
      await db.runAsync('DELETE FROM sync_tombstones WHERE tbl = ? AND uid = ?', d.tbl, d.uid);
    }
    // Deletes the person may not make: the row comes back.
    for (const d of res.undeleted ?? []) {
      await db.runAsync('DELETE FROM sync_tombstones WHERE tbl = ? AND uid = ?', d.tbl, d.uid);
      if (d.current) await writeWire(db, d.tbl, d.current, { dirty: 0, serverSeq: d.current.server_seq ?? null });
    }
  } finally {
    await setApplying(db, false);
  }
}

// A pulled row that clashes with a different local row on a unique column:
// the local row gives way, and is pushed again afterwards (dirty = 1).
// - product, same name: the same product made on both sides. The local row
//   takes the host's uid, so its invoice lines and restocks follow it.
// - invoice, same number: only happens when a phone that already had
//   invoices is paired after the first one (D6). The local invoice moves to
//   this device's series, and the change is logged.
async function giveWay(db: SyncDb, t: WireTable, row: WireRow): Promise<void> {
  if (t === 'products') {
    const p = await db.getFirstAsync<{ id: number; dirty: number }>(
      'SELECT id, dirty FROM products WHERE name = ? COLLATE NOCASE AND uid <> ?', String(row.name ?? ''), row.uid);
    if (!p) return;
    await db.runAsync('UPDATE products SET uid = ?, dirty = ? WHERE id = ?', row.uid, p.dirty === 0 ? 0 : 1, p.id);
    // What points at it went up under the old uid: send it again.
    await db.runAsync('UPDATE restocks SET dirty = 1 WHERE product_id = ? AND dirty <> 0', p.id);
    await db.runAsync(
      'UPDATE invoices SET dirty = 1 WHERE id IN (SELECT invoice_id FROM invoice_items WHERE product_id = ?)', p.id);
  } else if (t === 'invoices') {
    const inv = await db.getFirstAsync<{ id: number; invoice_no: string }>(
      'SELECT id, invoice_no FROM invoices WHERE invoice_no = ? AND uid <> ?', String(row.invoice_no ?? ''), row.uid);
    if (!inv) return;
    const m = await db.getFirstAsync<{ invoice_prefix: string; next_seq: number }>(
      'SELECT invoice_prefix, next_seq FROM meta WHERE id = 1');
    if (!m) return;
    const no = formatInvoiceNo(m.invoice_prefix, m.next_seq);
    await db.runAsync('UPDATE meta SET next_seq = next_seq + 1 WHERE id = 1');
    await db.runAsync('UPDATE invoices SET invoice_no = ?, dirty = 1, rev = rev + 1 WHERE id = ?', no, inv.id);
    await db.runAsync(
      `INSERT INTO audit_logs (action, entity_type, entity_id, details_json) VALUES ('invoice.renumber', 'invoice', ?, ?)`,
      no, JSON.stringify({ from: inv.invoice_no, reason: 'number used on the desktop' }));
  }
}

// Writes the host's rows here without marking them for push. A row with a
// local edit still waiting (dirty <> 0) is left alone: the next push decides.
export async function applyPull(db: SyncDb, res: PullResponse): Promise<number> {
  let n = 0;
  await setApplying(db, true);
  try {
    for (const t of WIRE_ORDER) {
      const immutable = t === 'restocks' || t === 'payments' || t === 'audit_logs';
      for (const row of res.changes[t]) {
        const local = await db.getFirstAsync<{ dirty: number }>(`SELECT dirty FROM ${t} WHERE uid = ?`, row.uid);
        if (local && (immutable || local.dirty !== 0)) continue;
        if (!local) {
          await giveWay(db, t, row);
          // A product that took the host's uid may still have its own edit waiting.
          const merged = await db.getFirstAsync<{ dirty: number }>(`SELECT dirty FROM ${t} WHERE uid = ?`, row.uid);
          if (merged && merged.dirty !== 0) continue;
        }
        await writeWire(db, t, row, { dirty: 0, serverSeq: row.server_seq ?? null });
        n++;
      }
    }
    for (const u of res.changes.users ?? []) { await writeUser(db, u); n++; }
    if (res.changes.meta) {
      const local = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM meta WHERE id = 1');
      if (local?.dirty === 0) { await writeMeta(db, res.changes.meta, { dirty: 0, serverSeq: res.changes.meta.server_seq ?? null }); n++; }
    }
    for (const d of res.changes.deletes) {
      await deleteWire(db, d.tbl, d.uid);
      n++;
    }
    await db.runAsync(
      `UPDATE sync_state SET last_pull_seq = ?, last_sync_at = datetime('now') WHERE id = 1`, res.upto);
  } finally {
    await setApplying(db, false);
  }
  return n;
}

// One full round: push, then pull until the host has nothing newer.
export async function syncOnce(tx: Tx, transport: Transport): Promise<SyncReport> {
  const req = await tx(db => collectPush(db));
  const report: SyncReport = { pushed: countChanges(req.changes), accepted: 0, rejected: [], pulled: 0, usersChanged: false };
  if (report.pushed > 0) {
    const res = await transport.push(req);
    await tx(db => applyPushResult(db, res));
    report.accepted = res.accepted.length + res.deleted.length;
    report.rejected = res.rejected;
  }
  for (;;) {
    const since = await tx(async db =>
      (await db.getFirstAsync<{ s: number }>('SELECT last_pull_seq s FROM sync_state WHERE id = 1'))?.s ?? 0);
    const res = await transport.pull({ protocol: PROTOCOL, device_id: req.device_id, since });
    report.pulled += await tx(db => applyPull(db, res));
    if (res.changes.users?.length) report.usersChanged = true;
    if (!res.more) break;
  }
  return report;
}

// After pairing: remember the host and switch new invoices to this device's
// series (INV-A001 …). Invoices already issued keep their numbers.
// A different desktop than before (new PC, or its database was replaced) has
// none of this phone's data and numbers its changes from 1 again: send
// everything again and pull from the start.
export async function applyPairing(db: SyncDb, welcome: PairWelcome, hostUrl: string): Promise<void> {
  const before = await db.getFirstAsync<{ host_id: string }>('SELECT host_id FROM sync_state WHERE id = 1');
  if (before?.host_id && before.host_id !== welcome.host_id) {
    await setApplying(db, true);
    try {
      for (const t of WIRE_ORDER) await db.runAsync(`UPDATE ${t} SET dirty = 1, server_seq = NULL`);
      await db.runAsync('UPDATE sync_tombstones SET dirty = 1, server_seq = NULL');
      await db.runAsync('UPDATE sync_state SET last_pull_seq = 0 WHERE id = 1');
    } finally {
      await setApplying(db, false);
    }
  }
  await db.runAsync('UPDATE sync_state SET host_url = ?, host_id = ?, host_name = ? WHERE id = 1',
    hostUrl, welcome.host_id, welcome.host_name);
  const prefix = `INV-${welcome.series}`;
  const cur = await db.getFirstAsync<{ invoice_prefix: string }>('SELECT invoice_prefix FROM meta WHERE id = 1');
  if (cur?.invoice_prefix !== prefix) {
    await db.runAsync('UPDATE meta SET invoice_prefix = ?, next_seq = 1 WHERE id = 1', prefix);
  }
}
