// Turning local rows into wire rows (uids instead of ids) and back. Used by
// both sides: the phone reads to push and writes what it pulls; the host
// writes what it receives and reads to answer pulls.
import type { SqlArg, SyncDb, WireLine, WireRow, WireTable } from './protocol';

// Columns that travel, per table (besides uid). Local ids, dirty and rev never do.
export const WIRE_COLS: Record<WireTable, readonly string[]> = {
  products: ['sl_no', 'name', 'size', 'unit_paise', 'stock_qty', 'created_at', 'updated_at', 'origin_device', 'created_by', 'updated_by'],
  restocks: ['kind', 'delta', 'stock_after', 'unit_paise', 'note', 'created_at', 'origin_device', 'created_by'],
  invoices: [
    'invoice_no', 'status', 'invoice_date', 'due_date',
    'party_name', 'party_address', 'party_city', 'party_pincode', 'party_mobile', 'party_email',
    'gross_paise', 'discount_percent', 'discount_paise', 'round_off_paise', 'total_paise',
    'amount_in_words', 'upi_id', 'notes',
    'has_shipping', 'ship_name', 'ship_address', 'ship_city', 'ship_pincode', 'payment_mode',
    'created_at', 'updated_at', 'origin_device', 'created_by', 'updated_by',
  ],
  payments: ['payment_date', 'party_name', 'mode', 'reference_no', 'amount_paise', 'remarks', 'created_at', 'origin_device', 'created_by'],
  audit_logs: ['action', 'entity_type', 'entity_id', 'details_json', 'created_at', 'origin_device', 'created_by'],
};

// Company details the host owns (same list as the meta trigger in schema.ts).
export const META_COLS = [
  'name', 'subtitle', 'address', 'city', 'pincode', 'pan', 'contact', 'email',
  'bank_name', 'bank_branch', 'bank_ac_no', 'bank_ifsc', 'upi_id', 'updated_at', 'updated_by',
] as const;

// A person, as the desktop sends them to phones (never pushed back).
export const USER_COLS = ['name', 'role', 'perms', 'pin_salt', 'pin_hash', 'pin_len', 'active', 'updated_at'] as const;

export async function readUsers(db: SyncDb, where: string, ...args: SqlArg[]): Promise<WireRow[]> {
  return db.getAllAsync<WireRow>(`SELECT uid, server_seq, ${USER_COLS.join(', ')} FROM users WHERE ${where} ORDER BY id`, ...args);
}

// Phone: insert or update one person from a pull.
export async function writeUser(db: SyncDb, row: WireRow): Promise<void> {
  const vals = USER_COLS.map(c => row[c] as SqlArg);
  await db.runAsync(
    `INSERT INTO users (uid, ${USER_COLS.join(', ')}, dirty, server_seq) VALUES (?, ${USER_COLS.map(() => '?').join(', ')}, 0, ?)
     ON CONFLICT(uid) DO UPDATE SET ${USER_COLS.map(c => `${c} = excluded.${c}`).join(', ')}, dirty = 0, server_seq = excluded.server_seq`,
    row.uid, ...vals, (row.server_seq ?? null) as SqlArg);
}

// Push and pull order: what a row points at arrives before the row.
export const WIRE_ORDER: readonly WireTable[] = ['products', 'restocks', 'invoices', 'payments', 'audit_logs'];

type Local = { id: number; rev: number; server_seq: number | null } & Record<string, unknown>;

function select(t: WireTable): string {
  const extra = t === 'restocks' ? ', (SELECT p.uid FROM products p WHERE p.id = restocks.product_id) AS product_uid' : '';
  return `SELECT id, uid, rev, server_seq, ${WIRE_COLS[t].join(', ')}${extra} FROM ${t}`;
}

// Reads rows of one table as wire rows. `where` is a SQL condition on the table.
export async function readWire(db: SyncDb, t: WireTable, where: string, ...args: SqlArg[]): Promise<WireRow[]> {
  const rows = await db.getAllAsync<Local>(`${select(t)} WHERE ${where} ORDER BY id`, ...args);
  const out: WireRow[] = [];
  for (const r of rows) {
    const { id, ...rest } = r;
    const w = rest as WireRow;
    if (t === 'invoices') {
      w.lines = await db.getAllAsync<WireLine>(
        `SELECT li.sno, p.uid AS product_uid, li.description, li.size, li.qty, li.unit_paise, li.line_paise
         FROM invoice_items li LEFT JOIN products p ON p.id = li.product_id
         WHERE li.invoice_id = ? ORDER BY li.sno`, id);
    } else if (t === 'payments') {
      const links = await db.getAllAsync<{ uid: string }>(
        `SELECT i.uid FROM payment_invoices pi JOIN invoices i ON i.id = pi.invoice_id
         WHERE pi.payment_id = ? ORDER BY i.id`, id);
      w.invoice_uids = links.map(l => l.uid);
    }
    out.push(w);
  }
  return out;
}

export async function readMeta(db: SyncDb): Promise<WireRow | null> {
  const r = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT rev, server_seq, ${META_COLS.join(', ')} FROM meta WHERE id = 1`);
  return r ? { uid: 'meta', ...r } as WireRow : null;
}

export async function localId(db: SyncDb, t: WireTable, uid: string | null | undefined): Promise<number | null> {
  if (!uid) return null;
  const r = await db.getFirstAsync<{ id: number }>(`SELECT id FROM ${t} WHERE uid = ?`, uid);
  return r?.id ?? null;
}

const arg = (v: unknown): SqlArg => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v as SqlArg);

export interface WriteOpts {
  dirty: 0 | 1; // phone: 0 (a pulled row is clean); host: 1 (so the stamp sweep numbers it)
  serverSeq?: number | null; // phone: the host's number for this version
}

// Inserts or updates one wire row by uid, with its lines / links. Returns the
// local id, or null when a restock's product is unknown here.
export async function writeWire(db: SyncDb, t: WireTable, row: WireRow, o: WriteOpts): Promise<number | null> {
  // A column the sender didn't send keeps its default (insert) or value (update).
  const cols = WIRE_COLS[t].filter(c => row[c] !== undefined);
  const vals: SqlArg[] = cols.map(c => arg(row[c]));
  if (t === 'restocks') {
    const pid = await localId(db, 'products', row.product_uid as string | null);
    if (pid === null) return null;
    cols.push('product_id'); vals.push(pid);
  }
  cols.push('dirty'); vals.push(o.dirty);
  if (o.serverSeq !== undefined) { cols.push('server_seq'); vals.push(o.serverSeq); }

  let id = await localId(db, t, row.uid);
  if (id === null) {
    const r = await db.runAsync(
      `INSERT INTO ${t} (uid, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`,
      row.uid, ...vals);
    id = r.lastInsertRowId;
  } else {
    await db.runAsync(`UPDATE ${t} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`, ...vals, id);
  }

  if (t === 'invoices' && Array.isArray(row.lines)) {
    await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', id);
    for (const l of row.lines as WireLine[]) {
      await db.runAsync(
        `INSERT INTO invoice_items (invoice_id, sno, product_id, description, size, qty, unit_paise, line_paise)
         VALUES (?,?,?,?,?,?,?,?)`,
        id, l.sno, await localId(db, 'products', l.product_uid), l.description, l.size ?? '', l.qty, l.unit_paise, l.line_paise);
    }
  }
  if (t === 'payments' && Array.isArray(row.invoice_uids)) {
    await db.runAsync('DELETE FROM payment_invoices WHERE payment_id = ?', id);
    const ids: number[] = [];
    for (const u of row.invoice_uids as string[]) {
      const inv = await localId(db, 'invoices', u);
      if (inv === null) continue;
      ids.push(inv);
      await db.runAsync('INSERT OR IGNORE INTO payment_invoices (payment_id, invoice_id) VALUES (?, ?)', id, inv);
    }
    // invoice_ids is kept for display and old backups: local ids, comma-separated.
    await db.runAsync('UPDATE payments SET invoice_ids = ? WHERE id = ?', ids.join(','), id);
  }
  return id;
}

export async function writeMeta(db: SyncDb, row: WireRow, o: WriteOpts): Promise<void> {
  const cols: string[] = META_COLS.filter(c => row[c] !== undefined);
  const vals: SqlArg[] = cols.map(c => arg(row[c]));
  if (o.serverSeq !== undefined) { cols.push('server_seq'); vals.push(o.serverSeq); }
  cols.push('dirty'); vals.push(o.dirty);
  await db.runAsync(`UPDATE meta SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = 1`, ...vals);
}

// Deletes one row by uid the way the app does: a product's invoice lines
// keep their text but lose the link; an invoice's lines go with it.
export async function deleteWire(db: SyncDb, t: WireTable, uid: string): Promise<void> {
  const id = await localId(db, t, uid);
  if (id === null) return;
  if (t === 'products') await db.runAsync('UPDATE invoice_items SET product_id = NULL WHERE product_id = ?', id);
  if (t === 'invoices') await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', id);
  await db.runAsync(`DELETE FROM ${t} WHERE id = ?`, id);
}
