import { getDb } from './db';

export type AuditAction =
  | 'invoice.issue' | 'invoice.update' | 'invoice.void' | 'invoice.delete'
  | 'payment.record' | 'product.upsert' | 'product.restock'
  | 'settings.update' | 'backup.export' | 'backup.import' | 'app.reset'
  | 'auth.signin' | 'auth.failed' | 'auth.locked' | 'auth.recovered'
  | 'invoice.renumber';

export async function logAudit(
  action: AuditAction,
  entityType: string,
  entityId: string | number,
  details?: unknown,
): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO audit_logs (action, entity_type, entity_id, details_json) VALUES (?,?,?,?)',
      action, entityType, String(entityId), details === undefined ? '' : JSON.stringify(details),
    );
  } catch {
    // Audit must never break the user action it records.
  }
}

export async function recentAudit(limit = 100) {
  const db = await getDb();
  return db.getAllAsync<{
    id: number; action: string; entity_type: string;
    entity_id: string; created_at: string; created_by: string; origin_device: string;
  }>(
    `SELECT id, action, entity_type, entity_id, created_at, created_by, origin_device
     FROM audit_logs ORDER BY id DESC LIMIT ?`, limit);
}
