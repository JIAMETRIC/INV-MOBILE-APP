// expo-sqlite's async API over Node's built-in SQLite, so the app's data code
// (src/data, src/sync) runs unchanged on the desktop. Same idea as the
// integration-test harness (scripts/run-integration-tests.mjs).
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

type Arg = string | number | null | undefined | boolean;

const norm = (args: Arg[]): SQLInputValue[] =>
  args.map(a => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a));

// node:sqlite gives BigInt rowids and null-prototype rows; expo-sqlite gives
// plain objects with numbers.
function row<T>(r: unknown): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r as object)) out[k] = typeof v === 'bigint' ? Number(v) : v ?? null;
  return out as T;
}

// execAsync takes no bind parameters here; the app only passes literals.
export class NodeSqliteDb {
  readonly databasePath: string;
  private readonly db: DatabaseSync;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.databasePath = path;
    this.db = new DatabaseSync(path);
  }

  // expo-sqlite runs statements one at a time in call order; so does this.
  private enqueue<T>(op: () => T): Promise<T> {
    const run = this.queue.then(op);
    this.queue = run.catch(() => undefined);
    return run;
  }

  execSync(sql: string): void { this.db.exec(sql); }

  execAsync(sql: string): Promise<void> {
    return this.enqueue(() => { this.db.exec(sql); });
  }

  getFirstAsync<T>(sql: string, ...args: Arg[]): Promise<T | null> {
    return this.enqueue(() => {
      const r = this.db.prepare(sql).get(...norm(args));
      return r ? row<T>(r) : null;
    });
  }

  getAllAsync<T>(sql: string, ...args: Arg[]): Promise<T[]> {
    return this.enqueue(() => this.db.prepare(sql).all(...norm(args)).map(r => row<T>(r)));
  }

  runAsync(sql: string, ...args: Arg[]): Promise<{ lastInsertRowId: number; changes: number }> {
    return this.enqueue(() => {
      const r = this.db.prepare(sql).run(...norm(args));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    });
  }

  // Like expo-sqlite: the callback's statements run inside BEGIN … COMMIT.
  // The host serialises every request (app.ts), so nothing else interleaves.
  async withExclusiveTransactionAsync(fn: (txn: NodeSqliteDb) => Promise<void>): Promise<void> {
    await this.queue.catch(() => undefined);
    this.db.exec('BEGIN IMMEDIATE');
    let err: unknown = null;
    try { await fn(this); } catch (e) { err = e; }
    await this.enqueue(() => {
      if (err) { try { this.db.exec('ROLLBACK'); } catch { /* already rolled back */ } }
      else this.db.exec('COMMIT');
    });
    if (err) throw err;
  }

  closeAsync(): Promise<void> {
    return this.enqueue(() => { this.db.close(); });
  }
}
