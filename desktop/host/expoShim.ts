// Stand-ins for the Expo modules src/data imports, so the phone's data layer
// runs on the desktop. Must be installed before any src/data module loads.
import Module from 'node:module';
import crypto from 'node:crypto';
import { NodeSqliteDb } from './nodeSqlite';

let nextPaths: string[] = [];

// The path for the next database the app code opens (':memory:' when none is
// queued). The host queues its file; the sync test opens several in turn.
export function queueDbPath(path: string): void { nextPaths.push(path); }

const store = new Map<string, string>();

const shims: Record<string, unknown> = {
  'expo-sqlite': {
    openDatabaseAsync: async () => new NodeSqliteDb(nextPaths.shift() ?? ':memory:'),
  },
  // The database key is only used by SQLCipher, which node:sqlite doesn't
  // have (PRAGMA key is ignored), so an in-memory store is enough here.
  'expo-secure-store': {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockThisDeviceOnly',
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => { store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); },
  },
  'expo-crypto': {
    getRandomBytesAsync: async (n: number) => new Uint8Array(crypto.randomBytes(n)),
    randomUUID: () => crypto.randomUUID(),
  },
};

let installed = false;

export function installExpoShims(): void {
  if (installed) return;
  installed = true;
  const m = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
  const load = m._load;
  m._load = function (request: string, ...rest: unknown[]) {
    if (request in shims) return shims[request];
    return load.call(this, request, ...rest);
  };
}
