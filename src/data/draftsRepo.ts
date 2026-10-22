import { getDb, withTx } from './db';
import type { Draft, InvoiceForm } from './types';

export interface DraftPayload {
  form: InvoiceForm;
  invoiceNo: string; // preview number, re-allocated at issue time
}

export async function listDrafts(): Promise<Draft[]> {
  const db = await getDb();
  return db.getAllAsync<Draft>('SELECT * FROM drafts ORDER BY updated_at DESC');
}

export async function getDraft(id: number): Promise<Draft | null> {
  const db = await getDb();
  return db.getFirstAsync<Draft>('SELECT * FROM drafts WHERE id = ?', id);
}

// Autosave target (plan §7 rule 3): one row per in-progress form, overwritten
// on field blur, with DRAFT-### assigned once.
export async function saveDraft(
  id: number | null,
  payload: DraftPayload,
  totalPaise: number,
): Promise<number> {
  return withTx(async db => {
    if (id) {
      await db.runAsync(
        `UPDATE drafts SET payload_json=?, party_name=?, total_paise=?, items_count=?,
           updated_at=datetime('now') WHERE id=?`,
        JSON.stringify(payload), payload.form.party.party_name, totalPaise,
        payload.form.lines.length, id,
      );
      return id;
    }
    const recent = await db.getAllAsync<{ draft_no: string }>(
      'SELECT draft_no FROM drafts ORDER BY id DESC LIMIT 50',
    );
    let max = 0;
    for (const d of recent) {
      const m = /^DRAFT-(\d+)$/.exec(d.draft_no);
      if (m?.[1]) max = Math.max(max, Number(m[1]));
    }
    const r = await db.runAsync(
      `INSERT INTO drafts (draft_no, party_name, total_paise, items_count, payload_json)
       VALUES (?,?,?,?,?)`,
      `DRAFT-${String(max + 1).padStart(3, '0')}`,
      payload.form.party.party_name, totalPaise, payload.form.lines.length,
      JSON.stringify(payload),
    );
    return r.lastInsertRowId;
  });
}

export async function deleteDraft(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM drafts WHERE id = ?', id);
}
