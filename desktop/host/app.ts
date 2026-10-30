// Starts the desktop host: the master database (the app's own schema and
// data code, through the Expo shims), the host tables, the LAN server and the
// daily backup. The Electron shell (next step) and the CLI (main.ts) call this.
import fs from 'node:fs';
import path from 'node:path';
import type http from 'node:http';
import { DEFAULT_PORT, type SyncDb } from '../../src/sync/protocol';
import { installExpoShims, queueDbPath } from './expoShim';
import { ensureHostSchema, type HostInfo } from './hostSchema';
import { stampChanges } from './hostSync';
import { createPairing, pairingUri, type Pairing } from './pairing';
import { createServer } from './server';
import { dailyBackup } from './backup';

export interface HostOptions {
  dataDir: string; // holds host.db and backups/
  port?: number; // 0 = any free port (tests)
  bind?: string; // default all interfaces, so phones on the LAN can connect
  dbFile?: string; // default <dataDir>/host.db
}

export interface Host {
  info: HostInfo;
  port: number;
  db: SyncDb;
  // Runs fn alone (one at a time with every phone request) inside a transaction.
  exclusive: <T>(fn: (db: SyncDb) => Promise<T>) => Promise<T>;
  newPairing: () => Promise<{ pairing: Pairing; uri: string }>;
  backupNow: () => Promise<string | null>;
  stop: () => Promise<void>;
}

const DAY_MS = 24 * 60 * 60_000;

export async function startHost(o: HostOptions): Promise<Host> {
  installExpoShims();
  fs.mkdirSync(o.dataDir, { recursive: true });
  queueDbPath(o.dbFile ?? path.join(o.dataDir, 'host.db'));
  // Loaded only now, after the shims: dbCore imports expo-sqlite.
  const { getDb, closeDb } = require('../../src/data/db') as typeof import('../../src/data/db');
  const db = (await getDb()) as unknown as SyncDb;
  const info = await ensureHostSchema(db);

  // One request at a time: sync requests and admin actions never interleave.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn);
    chain = run.catch(() => undefined);
    return run;
  };
  const exclusive = <T>(fn: (tx: SyncDb) => Promise<T>): Promise<T> => serial(async () => {
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      const out = await fn(db);
      await db.execAsync('COMMIT');
      return out;
    } catch (e) {
      await db.execAsync('ROLLBACK');
      throw e;
    }
  });

  await exclusive(stampChanges); // number the seeded catalog before the first pull

  const server: http.Server = createServer({ db, host: info, exclusive });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port ?? DEFAULT_PORT, o.bind ?? '0.0.0.0', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : (o.port ?? DEFAULT_PORT);

  const backupNow = () => serial(() => dailyBackup(db, o.dataDir));
  await backupNow();
  const timer = setInterval(() => { backupNow().catch(e => console.error('[host] backup', e)); }, DAY_MS / 4);
  timer.unref();

  return {
    info, port, db, exclusive, backupNow,
    newPairing: async () => {
      const pairing = await exclusive(tx => createPairing(tx));
      return { pairing, uri: pairingUri(pairing, port) };
    },
    stop: async () => {
      clearInterval(timer);
      await new Promise<void>(r => server.close(() => r()));
      await serial(() => closeDb());
    },
  };
}
