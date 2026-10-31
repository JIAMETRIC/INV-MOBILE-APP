import { getDb, withTx } from './db';
import { logAudit } from './auditRepo';
import { formatInvoiceNo } from './money';
import type { Settings } from './types';

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const row = await db.getFirstAsync<Settings>('SELECT * FROM meta WHERE id = 1');
  if (!row) throw new Error('meta row missing');
  return row;
}

const EDITABLE: ReadonlyArray<keyof Settings> = [
  'name', 'subtitle', 'address', 'city', 'pincode', 'pan',
  'contact', 'email', 'bank_name', 'bank_branch', 'bank_ac_no', 'bank_ifsc',
  'upi_id', 'invoice_prefix',
];

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const cols = EDITABLE.filter(k => patch[k] !== undefined);
  const saved = await withTx(async db => {
    if (cols.length > 0) {
      const set = cols.map(k => `${k} = ?`).join(', ');
      await db.runAsync(
        `UPDATE meta SET ${set}, updated_at = datetime('now') WHERE id = 1`,
        ...cols.map(k => patch[k] as string | number),
      );
    }
    return (await db.getFirstAsync<Settings>('SELECT * FROM meta WHERE id = 1'))!;
  });
  // After the transaction: logAudit uses its own statement.
  if (cols.length > 0) await logAudit('settings.update', 'settings', 'company', { fields: cols });
  return saved;
}

// Port of desktop RecordService.sync_next_invoice_sequence: next_seq must be
// above the highest suffix ever issued for the current prefix.
export async function syncNextSeq(): Promise<void> {
  await withTx(async db => {
    const s = await db.getFirstAsync<Settings>('SELECT * FROM meta WHERE id = 1');
    if (!s) return;
    const rows = await db.getAllAsync<{ invoice_no: string }>(
      `SELECT invoice_no FROM invoices WHERE invoice_no LIKE ?`,
      `${s.invoice_prefix}%`,
    );
    let max = 0;
    for (const r of rows) {
      const m = new RegExp(`^${s.invoice_prefix}(\\d+)$`).exec(r.invoice_no);
      if (m?.[1]) max = Math.max(max, Number(m[1]));
    }
    const next = Math.max(s.next_seq, max + 1);
    if (next !== s.next_seq) {
      await db.runAsync('UPDATE meta SET next_seq = ? WHERE id = 1', next);
    }
  });
}

export async function allocateInvoiceNo(db: import('expo-sqlite').SQLiteDatabase): Promise<string> {
  const s = await db.getFirstAsync<Settings>('SELECT * FROM meta WHERE id = 1');
  if (!s) throw new Error('meta row missing');
  const no = formatInvoiceNo(s.invoice_prefix, s.next_seq);
  await db.runAsync('UPDATE meta SET next_seq = next_seq + 1 WHERE id = 1');
  return no;
}

export async function resetSequenceTo1(): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE meta SET next_seq = 1 WHERE id = 1');
}
