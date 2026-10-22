// Web preview tier: expo-sqlite's wa-sqlite driver supports no transactions
// (withExclusiveTransactionAsync throws). Statements still execute in order,
// which is correct for single-tab previewing; atomicity is Android-only.
export * from './dbCore';

import type * as SQLite from 'expo-sqlite';
import { getDb } from './dbCore';

export async function withTx<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  return fn(await getDb());
}
