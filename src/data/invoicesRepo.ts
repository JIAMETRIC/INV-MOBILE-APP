import { getDb, withTx } from './db';
import { allocateInvoiceNo } from './settingsRepo';
import { numberToWordsIndian } from './money';
import type { Invoice, InvoiceForm, InvoiceLine, InvoiceTotals } from './types';

export interface InvoiceFilters {
  search?: string;
  from?: string; // ISO
  to?: string; // ISO
  status?: string;
  limit?: number;
  offset?: number;
}

export async function listInvoices(f: InvoiceFilters): Promise<Invoice[]> {
  const db = await getDb();
  const where: string[] = [];
  const args: (string | number | null)[] = [];
  if (f.search) {
    where.push('(invoice_no LIKE ? OR party_name LIKE ?)');
    args.push(`%${f.search}%`, `%${f.search}%`);
  }
  if (f.from) { where.push('invoice_date >= ?'); args.push(f.from); }
  if (f.to) { where.push('invoice_date <= ?'); args.push(f.to); }
  if (f.status) { where.push('status = ?'); args.push(f.status); }
  const sql = `
    SELECT * FROM invoices
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY invoice_date DESC, id DESC
    LIMIT ? OFFSET ?`;
  args.push(f.limit ?? 200, f.offset ?? 0);
  return db.getAllAsync<Invoice>(sql, ...args);
}

export async function getInvoice(id: number): Promise<Invoice | null> {
  const db = await getDb();
  return db.getFirstAsync<Invoice>('SELECT * FROM invoices WHERE id = ?', id);
}

export async function getInvoiceByNo(no: string): Promise<Invoice | null> {
  const db = await getDb();
  return db.getFirstAsync<Invoice>('SELECT * FROM invoices WHERE invoice_no = ?', no);
}

export async function getLines(invoiceId: number): Promise<InvoiceLine[]> {
  const db = await getDb();
  return db.getAllAsync<InvoiceLine>(
    'SELECT sno, product_id, description, qty, unit_paise, line_paise, id FROM invoice_items WHERE invoice_id = ? ORDER BY sno',
    invoiceId,
  );
}

export interface IssueResult {
  invoiceId: number;
  invoiceNo: string;
}

// Issue (or update) an invoice atomically: totals are recomputed server-side
// from the lines, never trusted from the form.
export async function saveInvoice(
  form: InvoiceForm,
  totals: InvoiceTotals,
  opts: { invoiceId?: number; invoiceNo?: string; status?: Invoice['status'] },
): Promise<IssueResult> {
  return withTx(async db => {
    const invoiceNo = opts.invoiceNo ?? await allocateInvoiceNo(db);
    const amountInWords = numberToWordsIndian(totals.total);
    const values = [
      invoiceNo,
      opts.status ?? 'issued',
      form.invoiceDate,
      null, // no due date: the Bill to card no longer asks for one
      form.party.party_name, '', form.party.party_city, // address is no longer asked for
      form.party.party_pincode, form.party.party_mobile, '', // email is no longer asked for
      totals.gross, form.discountPercent, totals.discount,
      totals.roundOff, totals.total,
      amountInWords, form.notes,
      form.hasShipping ? 1 : 0,
      form.ship.ship_name, form.ship.ship_address, form.ship.ship_city,
      form.ship.ship_pincode,
    ];

    let invoiceId = opts.invoiceId ?? 0;
    if (opts.invoiceId) {
      await db.runAsync(
        `UPDATE invoices SET
           invoice_no=?, status=?, invoice_date=?, due_date=?,
           party_name=?, party_address=?, party_city=?, party_pincode=?,
           party_mobile=?, party_email=?,
           gross_paise=?, discount_percent=?, discount_paise=?,
           round_off_paise=?, total_paise=?, amount_in_words=?, notes=?,
           has_shipping=?, ship_name=?, ship_address=?, ship_city=?, ship_pincode=?,
           updated_at=datetime('now')
         WHERE id=?`,
        ...values, opts.invoiceId,
      );
      invoiceId = opts.invoiceId;
      await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', invoiceId);
    } else {
      const r = await db.runAsync(
        `INSERT INTO invoices (
           invoice_no, status, invoice_date, due_date,
           party_name, party_address, party_city, party_pincode, party_mobile, party_email,
           gross_paise, discount_percent, discount_paise,
           round_off_paise, total_paise, amount_in_words, notes,
           has_shipping, ship_name, ship_address, ship_city, ship_pincode)
         VALUES (${Array(22).fill('?').join(',')})`,
        ...values,
      );
      invoiceId = r.lastInsertRowId;
    }

    let sno = 0;
    for (const l of form.lines) {
      sno += 1;
      await db.runAsync(
        `INSERT INTO invoice_items (invoice_id, sno, product_id, description, qty, unit_paise, line_paise)
         VALUES (?,?,?,?,?,?,?)`,
        invoiceId, sno, l.product_id, l.description, l.qty, l.unit_paise, l.line_paise,
      );
    }
    return { invoiceId, invoiceNo };
  });
}

export async function setStatus(id: number, status: Invoice['status']): Promise<void> {
  await withTx(async db => {
    await db.runAsync(
      `UPDATE invoices SET status=?, updated_at=datetime('now') WHERE id=?`,
      status, id,
    );
  });
}

export async function deleteInvoice(id: number): Promise<void> {
  await withTx(async db => {
    await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', id);
    await db.runAsync('DELETE FROM invoices WHERE id = ?', id);
  });
}
