import { File } from 'expo-file-system';
import { docsDir, isWeb, webBlobDownload } from './pdf';
import { getDb } from '../data/db';
import type { Invoice } from '../data/types';
import { buildXlsx, type XlsxSheet } from './xlsxWriter';

const BATCH = 500;
const MAX_ROWS = 50000;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function rupees(paise: number): number {
  return paise / 100;
}

function saveXlsx(sheets: XlsxSheet[], filename: string): File {
  const bytes = buildXlsx(sheets);
  if (isWeb) {
    const url = webBlobDownload(new Blob([bytes as unknown as BlobPart], { type: XLSX_MIME }), filename);
    return { uri: url, name: filename } as unknown as File;
  }
  const file = new File(docsDir('Exports'), filename);
  file.create({ overwrite: true });
  file.writeSync(bytes);
  return file;
}

interface RegisterRow {
  invoice_no: string;
  invoice_date: string;
  party_name: string;
  total_paise: number;
  status: string;
  sno: number | null;
  description: string | null;
  qty: number | null;
  unit_paise: number | null;
  line_paise: number | null;
}

export async function exportInvoicesXlsx(rows: Invoice[]): Promise<File> {
  const sheet: XlsxSheet = {
    name: 'Invoices_Register',
    columns: [
      { header: 'Invoice No', width: 12 },
      { header: 'Date', width: 12 },
      { header: 'Status', width: 10 },
      { header: 'Party', width: 28 },
      { header: 'Round Off', width: 10, money: true },
      { header: 'Total', width: 14, money: true },
    ],
    rows: rows.slice(0, MAX_ROWS).map(r => [
      r.invoice_no, r.invoice_date, r.status, r.party_name,
      rupees(r.round_off_paise), rupees(r.total_paise),
    ]),
  };
  return saveXlsx([sheet], `invoices_${Date.now()}.xlsx`);
}

type CellRow = (string | number | null)[];

// Rows for the two register sheets: one per invoice, one per line item.
// Exported for the integration test; the export below wraps it.
export async function collectRegisterRows(): Promise<{ register: CellRow[]; lineItems: CellRow[] }> {
  const db = await getDb();
  const register: CellRow[] = [];
  const lineItems: CellRow[] = [];

  // The join yields one row per line item, so an invoice with n items comes
  // back n times (once with nulls when it has none). Rows of one invoice are
  // contiguous (ordered by i.id), so a register row is pushed only when the
  // invoice_no changes; the marker survives a batch boundary.
  let lastInvoiceNo: string | null = null;
  let offset = 0;
  for (;;) {
    const batch = await db.getAllAsync<RegisterRow>(
      `SELECT i.invoice_no, i.invoice_date, i.party_name, i.total_paise, i.status,
              li.sno, li.description, li.qty, li.unit_paise, li.line_paise
       FROM invoices i LEFT JOIN invoice_items li ON li.invoice_id = i.id
       ORDER BY i.id DESC, li.sno LIMIT ? OFFSET ?`,
      BATCH, offset,
    );
    if (batch.length === 0) break;
    for (const r of batch) {
      if (register.length >= MAX_ROWS) break;
      if (r.invoice_no !== lastInvoiceNo) {
        register.push([r.invoice_no, r.invoice_date, r.party_name, rupees(r.total_paise), r.status]);
        lastInvoiceNo = r.invoice_no;
      }
      if (r.sno != null) {
        lineItems.push([
          r.invoice_no, r.sno, r.description, r.qty,
          rupees(r.unit_paise ?? 0), rupees(r.line_paise ?? 0),
        ]);
      }
    }
    offset += BATCH;
    if (batch.length < BATCH || register.length >= MAX_ROWS) break;
  }
  return { register, lineItems };
}

export async function exportConsolidatedRegister(): Promise<File> {
  const { register, lineItems } = await collectRegisterRows();
  return saveXlsx([
    {
      name: 'Invoices_Register',
      columns: [
        { header: 'Invoice No', width: 12 },
        { header: 'Date', width: 12 },
        { header: 'Party', width: 28 },
        { header: 'Total', width: 14, money: true },
        { header: 'Status', width: 10 },
      ],
      rows: register,
    },
    {
      name: 'All_Line_Items',
      columns: [
        { header: 'Invoice No', width: 12 },
        { header: 'Sno', width: 6 },
        { header: 'Item', width: 34 },
        { header: 'Qty', width: 8 },
        { header: 'Rate', width: 12, money: true },
        { header: 'Amount', width: 14, money: true },
      ],
      rows: lineItems,
    },
  ], `register_${Date.now()}.xlsx`);
}

export async function exportProductsXlsx(): Promise<File> {
  const db = await getDb();
  const products = await db.getAllAsync<{
    name: string; size: string; unit_paise: number; stock_qty: number;
    sold_qty: number; avl_qty: number;
  }>(
    `SELECT p.*,
       (SELECT COALESCE(SUM(li.qty),0) FROM invoice_items li
        JOIN invoices i ON i.id = li.invoice_id AND i.status != 'void'
        WHERE li.product_id = p.id) AS sold_qty,
       p.stock_qty - (SELECT COALESCE(SUM(li.qty),0) FROM invoice_items li
        JOIN invoices i ON i.id = li.invoice_id AND i.status != 'void'
        WHERE li.product_id = p.id) AS avl_qty
     FROM products p ORDER BY p.name COLLATE NOCASE, p.size, p.id`,
  );
  const sheet: XlsxSheet = {
    name: 'Products',
    columns: [
      { header: 'Name', width: 30 },
      { header: 'Size', width: 8 },
      { header: 'Price', width: 12, money: true },
      { header: 'Stock', width: 10 },
      { header: 'Sold', width: 10 },
      { header: 'Avl-Stock', width: 12 },
    ],
    rows: products.map(it => [
      it.name, it.size, rupees(it.unit_paise), it.stock_qty, it.sold_qty, it.avl_qty,
    ]),
  };
  return saveXlsx([sheet], `products_${Date.now()}.xlsx`);
}
