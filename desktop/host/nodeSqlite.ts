// expo-sqlite's async API over a synchronous SQLite engine, so the app's data
// code (src/data, src/sync) runs unchanged on the desktop. The engine is
// Node's built-in SQLite (terminal host, tests) or, in the Electron app,
// better-sqlite3-multiple-ciphers (encrypted). Both have this shape.
import type { DatabaseSync } from 'node:sqlite';

type Arg = string | number | null | undefined | boolean;
type Value = string | number | null;

export interface SqlEngine {
  exec(sql: string): unknown;
  prepare(sql: string): {
    get(...args: Value[]): unknown;
    all(...args: Value[]): unknown[];
    run(...args: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  };
  close(): unknown;
}

const norm = (args: Arg[]): Value[] =>
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
  private readonly db: SqlEngine;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(path: string, engine?: SqlEngine) {
    this.databasePath = path;
    // Loaded only when used: the Electron app passes its own engine.
    const Sync = engine ? null : (require('node:sqlite') as { DatabaseSync: typeof DatabaseSync }).DatabaseSync;
    this.db = engine ?? (new Sync!(path) as unknown as SqlEngine);
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
