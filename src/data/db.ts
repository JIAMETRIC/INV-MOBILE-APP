export * from './dbCore';

import type * as SQLite from 'expo-sqlite';
import { getDb } from './dbCore';

export async function withTx<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const db = await getDb();
  let out: T | undefined;
  await db.withExclusiveTransactionAsync(async () => {
    out = await fn(db);
  });
  return out as T;
}
