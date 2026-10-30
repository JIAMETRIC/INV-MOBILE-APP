// Stand-ins for the Expo modules src/data imports, so the phone's data layer
// runs on the desktop. Must be installed before any src/data module loads.
import Module from 'node:module';
import crypto from 'node:crypto';
import { NodeSqliteDb, type SqlEngine } from './nodeSqlite';

let nextPaths: string[] = [];
let engineFor: ((path: string) => SqlEngine) | null = null;

// The Electron app opens its database with an encrypting engine instead of
// node:sqlite (desktop/electron/cipherDb.ts).
export function useEngine(open: (path: string) => SqlEngine): void { engineFor = open; }

// The path for the next database the app code opens (':memory:' when none is
// queued). The host queues its file; the sync test opens several in turn.
export function queueDbPath(path: string): void { nextPaths.push(path); }

const store = new Map<string, string>();

// The database key for the encrypting engine: src/data/dbKey.ts reads it from
// "secure storage" and dbCore sends PRAGMA key. The Electron app keeps the key
// protected by Windows (safeStorage) and puts it here before the first open.
export function setSecureItem(key: string, value: string): void { store.set(key, value); }

const shims: Record<string, unknown> = {
  'expo-sqlite': {
    openDatabaseAsync: async () => {
      const path = nextPaths.shift() ?? ':memory:';
      return new NodeSqliteDb(path, engineFor?.(path));
    },
  },
  // node:sqlite ignores PRAGMA key, so without setSecureItem a random key
  // is made and forgotten, which is harmless there.
  'expo-secure-store': {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockThisDeviceOnly',
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => { store.set(k, v); },
    deleteItemAsync: async (k: string) => { store.delete(k); },
  },
  'expo-crypto': {
    getRandomBytesAsync: async (n: number) => new Uint8Array(crypto.randomBytes(n)),
    getRandomBytes: (n: number) => new Uint8Array(crypto.randomBytes(n)),
    // The app lock and people PINs hash with SHA-256 (lowercase hex, like expo-crypto).
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_alg: string, s: string) => crypto.createHash('sha256').update(s).digest('hex'),
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
