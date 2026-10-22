import { getDb, withTx } from './db';
import { productSeedSql } from './schema';
import type { Product, ProductRow, Restock } from './types';

// Sold is computed, not stored: Σ qty across invoice lines that referenced
// this product, excluding void invoices. Avl = stock − sold.
const SOLD_SQL = `(
  SELECT COALESCE(SUM(li.qty), 0) FROM invoice_items li
  JOIN invoices i ON i.id = li.invoice_id AND i.status != 'void'
  WHERE li.product_id = products.id)`;

const SELECT_ROW = `SELECT products.*, ${SOLD_SQL} AS sold_qty,
  products.stock_qty - ${SOLD_SQL} AS avl_qty FROM products`;

// Migration seeds the catalog at schema build; if the table is somehow empty
// (older bundle, partial build) re-apply the idempotent seed once per process.
let seedChecked = false;
async function ensureSeeded(db: { execAsync: (sql: string) => Promise<void>; getFirstAsync: <T>(sql: string) => Promise<T | null> }): Promise<void> {
  if (seedChecked) return;
  seedChecked = true;
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM products');
  if (!row || row.c === 0) await db.execAsync(productSeedSql());
}

export async function listProducts(search = ''): Promise<ProductRow[]> {
  const db = await getDb();
  await ensureSeeded(db);
  if (search) {
    return db.getAllAsync<ProductRow>(
      `${SELECT_ROW} WHERE name LIKE ? OR size LIKE ?
       ORDER BY name COLLATE NOCASE, size, id`,
      `%${search}%`, `%${search}%`,
    );
  }
  return db.getAllAsync<ProductRow>(`${SELECT_ROW} ORDER BY name COLLATE NOCASE, size, id`);
}

// Catalog-wide totals for the Dashboard stock KPIs. Same sold/avl rules as the
// per-product rows, so the tiles always add up to the Products table.
export async function getStockTotals(): Promise<{ stockQty: number; soldQty: number; avlQty: number }> {
  const db = await getDb();
  await ensureSeeded(db);
  const row = await db.getFirstAsync<{ stockQty: number; soldQty: number }>(
    `SELECT COALESCE(SUM(stock_qty), 0) stockQty, COALESCE(SUM(${SOLD_SQL}), 0) soldQty FROM products`,
  );
  const stockQty = row?.stockQty ?? 0;
  const soldQty = row?.soldQty ?? 0;
  return { stockQty, soldQty, avlQty: stockQty - soldQty };
}

export async function getProduct(id: number): Promise<ProductRow | null> {
  const db = await getDb();
  return db.getFirstAsync<ProductRow>(`${SELECT_ROW} WHERE products.id = ?`, id);
}

export type ProductInput = Pick<Product, 'name' | 'size' | 'unit_paise' | 'stock_qty'>;

export async function upsertProduct(input: ProductInput, id?: number): Promise<Product> {
  return withTx(async db => {
    if (id) {
      const before = await db.getFirstAsync<Product>('SELECT * FROM products WHERE id=?', id);
      await db.runAsync(
        `UPDATE products SET name=?, size=?, unit_paise=?, stock_qty=?,
           updated_at=datetime('now') WHERE id=?`,
        input.name, input.size, input.unit_paise, input.stock_qty, id,
      );
      if (before && before.stock_qty !== input.stock_qty) {
        // Editor changes are absolute corrections; keep the ledger honest with
        // the delta so Stock always equals Σ restocks rows.
        await db.runAsync(
          `INSERT INTO restocks (product_id, kind, delta, stock_after, unit_paise, note)
           VALUES (?, 'edit', ?, ?, ?, 'Stock set in editor')`,
          id, input.stock_qty - before.stock_qty, input.stock_qty, input.unit_paise,
        );
      }
      return (await db.getFirstAsync<Product>('SELECT * FROM products WHERE id=?', id))!;
    }
    const sl = (await db.getFirstAsync<{ n: number }>('SELECT COALESCE(MAX(sl_no),0)+1 n FROM products'))?.n ?? 1;
    const r = await db.runAsync(
      `INSERT INTO products (sl_no, name, size, unit_paise, stock_qty) VALUES (?,?,?,?,?)`,
      sl, input.name, input.size, input.unit_paise, input.stock_qty,
    );
    if (input.stock_qty !== 0) {
      await db.runAsync(
        `INSERT INTO restocks (product_id, kind, delta, stock_after, unit_paise, note)
         VALUES (?, 'edit', ?, ?, ?, 'Opening stock')`,
        r.lastInsertRowId, input.stock_qty, input.stock_qty, input.unit_paise,
      );
    }
    return (await db.getFirstAsync<Product>('SELECT * FROM products WHERE id=?', r.lastInsertRowId))!;
  });
}

// Receipt: adds qty to the running balance and appends a ledger row. An
// optional new price (in paise, > 0) re-prices the product at the same time.
export async function restockProduct(
  id: number, qty: number, newPricePaise = 0, note = '',
): Promise<ProductRow | null> {
  return withTx(async db => {
    const p = await db.getFirstAsync<Product>('SELECT * FROM products WHERE id=?', id);
    if (!p) return null;
    const price = newPricePaise > 0 ? newPricePaise : p.unit_paise;
    await db.runAsync(
      `UPDATE products SET stock_qty = stock_qty + ?, unit_paise = ?,
         updated_at = datetime('now') WHERE id = ?`,
      qty, price, id,
    );
    await db.runAsync(
      `INSERT INTO restocks (product_id, kind, delta, stock_after, unit_paise, note)
       VALUES (?, 'restock', ?, ?, ?, ?)`,
      id, qty, p.stock_qty + qty, price, note,
    );
    return db.getFirstAsync<ProductRow>(`${SELECT_ROW} WHERE products.id = ?`, id);
  });
}

export async function listRestocks(productId: number, limit = 50): Promise<Restock[]> {
  const db = await getDb();
  return db.getAllAsync<Restock>(
    `SELECT * FROM restocks WHERE product_id = ? ORDER BY id DESC LIMIT ?`,
    productId, limit,
  );
}

export async function deleteProduct(id: number): Promise<void> {
  await withTx(async db => {
    await db.runAsync('UPDATE invoice_items SET product_id = NULL WHERE product_id = ?', id);
    await db.runAsync('DELETE FROM products WHERE id = ?', id);
  });
}
