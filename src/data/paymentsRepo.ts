import { getDb, withTx } from './db';
import type { Payment } from './types';

export async function listPayments(limit = 200): Promise<Payment[]> {
  const db = await getDb();
  return db.getAllAsync<Payment>(
    'SELECT * FROM payments ORDER BY payment_date DESC, id DESC LIMIT ?', limit,
  );
}

export interface PaymentInput {
  payment_date: string;
  party_name: string;
  invoiceIds: number[];
  mode: string;
  reference_no: string;
  amount_paise: number;
  remarks: string;
}

// Recording a payment re-derives each linked invoice's status from the paid
// ratio: paid >= total -> paid, any payment -> partial. Void invoices ignored.
export async function recordPayment(input: PaymentInput): Promise<Payment> {
  const payment = await withTx(async db => {
    const r = await db.runAsync(
      `INSERT INTO payments (payment_date, party_name, invoice_ids, mode, reference_no, amount_paise, remarks)
       VALUES (?,?,?,?,?,?,?)`,
      input.payment_date, input.party_name,
      input.invoiceIds.join(','), input.mode, input.reference_no,
      input.amount_paise, input.remarks,
    );
    for (const invId of input.invoiceIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO payment_invoices (payment_id, invoice_id) VALUES (?, ?)',
        r.lastInsertRowId, invId,
      );
    }
    for (const invId of input.invoiceIds) {
      const inv = await db.getFirstAsync<{ total_paise: number; status: string }>(
        'SELECT total_paise, status FROM invoices WHERE id = ?', invId,
      );
      if (!inv || inv.status === 'void') continue;
      const paid = await db.getFirstAsync<{ n: number }>(
        `SELECT COALESCE(SUM(p.amount_paise),0) n FROM payments p
         JOIN payment_invoices pi ON pi.payment_id = p.id WHERE pi.invoice_id = ?`,
        invId,
      );
      const paidPaise = paid?.n ?? 0;
      const status = paidPaise >= inv.total_paise ? 'paid' : 'partial';
      await db.runAsync(
        `UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?`,
        status, invId,
      );
    }
    return (await db.getFirstAsync<Payment>('SELECT * FROM payments WHERE id = ?', r.lastInsertRowId))!;
  });
  return payment;
}

export async function paidPaiseForInvoice(invoiceId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COALESCE(SUM(p.amount_paise),0) n FROM payments p
     JOIN payment_invoices pi ON pi.payment_id = p.id WHERE pi.invoice_id = ?`,
    invoiceId,
  );
  return row?.n ?? 0;
}
