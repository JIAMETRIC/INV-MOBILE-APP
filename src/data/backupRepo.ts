import { File } from 'expo-file-system';
import { docsDir, isWeb } from '../export/pdf';
import { checkpointAndClose, getDb } from './db';
import { logAudit } from './auditRepo';

async function dbFilePath(): Promise<string> {
  const db = await getDb();
  return db.databasePath;
}

async function dbFileUri(): Promise<string> {
  const p = await dbFilePath();
  return p.startsWith('file:') ? p : `file://${p}`;
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function logBackup(file: File, kind: string, note: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO backup_logs (file_name, kind, size_bytes, note) VALUES (?,?,?,?)',
    file.name, kind, file.size, note,
  );
}

// The DB file is SQLCipher-encrypted, so a plain file copy is already an
// encrypted export (plan §9).
export async function exportDbBackup(note = 'manual'): Promise<File> {
  if (isWeb) throw new Error('Backup export is Android-only');
  const uri = await dbFileUri();
  await checkpointAndClose();
  const src = new File(uri);
  const file = new File(docsDir('Backups'), `invoices_${stamp()}.db`);
  src.copySync(file);
  await getDb();
  await logBackup(file, 'manual', note);
  await logAudit('backup.export', 'backup', file.name);
  return file;
}

export async function restoreDbBackup(pickedUri: string): Promise<void> {
  if (isWeb) throw new Error('Backup restore is Android-only');
  const curUri = await dbFileUri();
  await checkpointAndClose();
  const cur = new File(curUri);
  const safety = new File(docsDir('Backups'), `pre_restore_${stamp()}.db`);
  cur.copySync(safety);
  await logBackup(safety, 'pre_restore', 'automatic safety copy');
  new File(pickedUri).copySync(cur);
  await getDb();
  const db = await getDb();
  const ok = await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (ok?.integrity_check !== 'ok') throw new Error('Imported database failed integrity check');
  await logAudit('backup.import', 'backup', pickedUri);
}

export async function listBackups(): Promise<Array<{
  id: number; file_name: string; kind: string; size_bytes: number; note: string; created_at: string;
}>> {
  const db = await getDb();
  return db.getAllAsync(
    'SELECT id, file_name, kind, size_bytes, note, created_at FROM backup_logs ORDER BY id DESC LIMIT 100',
  );
}

// Desktop parity: auto end-of-day backup, keep 7 days.
export async function ensureDailyBackup(): Promise<void> {
  const db = await getDb();
  const today = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) n FROM backup_logs WHERE kind = 'auto' AND date(created_at) = date('now')`,
  );
  if ((today?.n ?? 0) === 0) {
    const uri = await dbFileUri();
    await checkpointAndClose();
    const src = new File(uri);
    const file = new File(docsDir('Backups'), `invoices_auto_${stamp()}.db`);
    src.copySync(file);
    await getDb();
    await logBackup(file, 'auto', 'end-of-day');
    const old = await db.getAllAsync<{ id: number; file_name: string }>(
      `SELECT id, file_name FROM backup_logs WHERE kind = 'auto'
       ORDER BY created_at DESC LIMIT -1 OFFSET 7`,
    );
    for (const o of old) {
      new File(docsDir('Backups'), o.file_name).delete();
      await db.runAsync('DELETE FROM backup_logs WHERE id = ?', o.id);
    }
  }
}
