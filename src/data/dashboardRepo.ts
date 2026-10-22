import { getDb } from './db';
import type { AgingRow, Invoice } from './types';

export interface Kpis {
  invoiceCount: number;
  billedPaise: number;
}

// Fiscal year on the desktop is April-March; KPIs scope to current FY.
export function currentFyStart(today = new Date()): string {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${y}-04-01`;
}

export async function getKpis(): Promise<Kpis> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    invoiceCount: number; billedPaise: number;
  }>(
    `SELECT COUNT(*) invoiceCount,
            COALESCE(SUM(total_paise),0) billedPaise
     FROM invoices
     WHERE status IN ('issued','partial','paid') AND invoice_date >= ?`,
    currentFyStart(),
  );
  return row ?? { invoiceCount: 0, billedPaise: 0 };
}

export async function recentInvoices(limit = 5): Promise<Invoice[]> {
  const db = await getDb();
  return db.getAllAsync<Invoice>(
    'SELECT * FROM invoices ORDER BY id DESC LIMIT ?', limit,
  );
}

export async function getAging(): Promise<AgingRow[]> {
  const db = await getDb();
  const open = await db.getAllAsync<{
    id: number; invoice_no: string; party_name: string; due_date: string | null;
    total_paise: number;
  }>(
    `SELECT id, invoice_no, party_name, due_date, total_paise
     FROM invoices WHERE status IN ('issued','partial')
     ORDER BY COALESCE(due_date, invoice_date)`,
  );
  const rows: AgingRow[] = [];
  for (const o of open) {
    const paid = await db.getFirstAsync<{ n: number }>(
      `SELECT COALESCE(SUM(amount_paise),0) n FROM payments WHERE ',' || invoice_ids || ',' LIKE '%,' || ? || ',%'`,
      String(o.id),
    );
    rows.push({
      invoice_id: o.id,
      party_name: o.party_name,
      invoice_no: o.invoice_no,
      due_date: o.due_date,
      total_paise: o.total_paise,
      paid_paise: paid?.n ?? 0,
    });
  }
  return rows;
}
