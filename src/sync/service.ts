// The phone's sync with Invoice ERP Desktop: pairing from the desktop's QR
// code, one sync round, status, unpairing. The database work is in client.ts;
// this file adds the network, the sealing and the stored device key.
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getDb, withTx } from '../data/db';
import {
  DEFAULT_PORT, PROTOCOL,
  type Envelope, type PairHello, type PairWelcome, type PullRequest, type PullResponse,
  type PushRequest, type PushResult, type SyncDb,
} from './protocol';
import { applyPairing, deviceId, syncOnce, type SyncReport, type Transport, type Tx } from './client';
import { SYNC_TABLES } from '../data/schema';
import { open, seal } from './seal';

const KEY = 'sync_device_key_v1'; // the device key from pairing, in the Android Keystore
const PROBE_MS = 3_000; // "is the desktop there?"
const CALL_MS = 60_000; // a push or pull (the first one can carry the whole shop)

// Every failure the person can act on, with the words to show.
export type SyncErrorCode =
  | 'not_paired' | 'offline' | 'other_host' | 'revoked' | 'forgotten' | 'pairing_expired'
  | 'bad_code' | 'protocol' | 'server';

const MESSAGES: Record<SyncErrorCode, string> = {
  not_paired: 'This phone is not paired with a desktop yet.',
  offline: 'Desktop not reachable. Check that this phone is on the shop Wi-Fi and Invoice ERP Desktop is running.',
  other_host: 'A different desktop is answering at this address. Pair again with your desktop.',
  revoked: 'This phone was blocked on the desktop. Ask the owner to unblock it.',
  forgotten: 'The desktop no longer knows this phone. Pair again.',
  pairing_expired: 'That pairing code was already used or has expired. Show a new code on the desktop.',
  bad_code: 'That is not an Invoice ERP pairing code.',
  protocol: 'The app and the desktop use different sync versions. Update the older one.',
  server: 'The desktop had a problem with this sync. Try again; if it keeps happening, check the desktop.',
};

export class SyncError extends Error {
  constructor(readonly code: SyncErrorCode) { super(MESSAGES[code]); }
}

const HTTP_CODES: Record<string, SyncErrorCode> = {
  unknown_device: 'forgotten', bad_seal: 'forgotten', device_mismatch: 'forgotten',
  revoked: 'revoked', pairing_expired: 'pairing_expired', protocol: 'protocol',
};

async function call(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch {
    throw new SyncError('offline');
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url: string, body: unknown, ms: number): Promise<unknown> {
  const res = await call(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, ms);
  const json = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new SyncError(HTTP_CODES[json.error ?? ''] ?? 'server');
  return json;
}

interface Health { app: string; protocol: number; host_id: string; host_name: string }

async function health(base: string): Promise<Health | null> {
  try {
    const res = await call(`${base}/health`, {}, PROBE_MS);
    const h = await res.json() as Health;
    return h.app === 'invoice-erp-host' ? h : null;
  } catch {
    return null;
  }
}

const iv = () => Crypto.getRandomBytes(12);

// ---------- pairing ----------

export interface PairingCode { hosts: string[]; port: number; pid: string; secret: string }

// invoiceerp://pair?h=<ip>[,<ip>…]&p=<port>&i=<pairing id>&s=<secret> (desktop/host/pairing.ts).
export function parsePairingCode(text: string): PairingCode | null {
  const m = /^invoiceerp:\/\/pair\?(.+)$/.exec(text.trim());
  if (!m?.[1]) return null;
  const q: Record<string, string> = {};
  for (const part of m[1].split('&')) {
    const [k, v = ''] = part.split('=');
    if (k) q[k] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  const hosts = (q.h ?? '').split(',').map(h => h.trim()).filter(Boolean);
  const port = Number(q.p ?? DEFAULT_PORT);
  if (!hosts.length || !q.i || !q.s || !Number.isInteger(port)) return null;
  return { hosts, port, pid: q.i, secret: q.s };
}

// Tries the desktop's addresses together; the first that answers wins.
async function reachable(hosts: string[], port: number): Promise<string> {
  const found = await Promise.all(hosts.map(async h => {
    const base = `http://${h}:${port}`;
    return (await health(base)) ? base : null;
  }));
  const base = found.find(Boolean);
  if (!base) throw new SyncError('offline');
  return base;
}

export async function pair(codeText: string, deviceName: string, appVersion: string): Promise<PairWelcome> {
  const code = parsePairingCode(codeText);
  if (!code) throw new SyncError('bad_code');
  const base = await reachable(code.hosts, code.port);
  const db = await getDb() as unknown as SyncDb;
  const hello: PairHello = { device_id: await deviceId(db), device_name: deviceName, app_version: appVersion };
  const env = await postJson(`${base}/pair`, { pid: code.pid, ...seal(code.secret, '/pair', hello, iv()) }, CALL_MS) as Envelope;
  let welcome: PairWelcome;
  try { welcome = open<PairWelcome>(code.secret, '/pair', env); } catch { throw new SyncError('bad_code'); }
  if (welcome.protocol !== PROTOCOL) throw new SyncError('protocol');
  await SecureStore.setItemAsync(KEY, welcome.device_key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  await withTx(d => applyPairing(d as unknown as SyncDb, welcome, base));
  return welcome;
}

// Forgets the desktop here (the desktop keeps this phone in its list until
// the owner blocks it). Data and the invoice series stay.
export async function unpair(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
  const db = await getDb();
  await db.runAsync("UPDATE sync_state SET host_url = '' WHERE id = 1");
}

// ---------- sync ----------

interface State { device_id: string; host_url: string; host_id: string; host_name: string; last_sync_at: string }

async function state(): Promise<State> {
  const db = await getDb();
  const s = await db.getFirstAsync<State>(
    'SELECT device_id, host_url, host_id, host_name, last_sync_at FROM sync_state WHERE id = 1');
  if (!s) throw new Error('sync_state row missing');
  return s;
}

const tx: Tx = fn => withTx(d => fn(d as unknown as SyncDb));

// One full round (push, then pull until nothing is newer).
export async function syncNow(): Promise<SyncReport> {
  const s = await state();
  const key = await SecureStore.getItemAsync(KEY);
  if (!s.host_url || !key) throw new SyncError('not_paired');
  const h = await health(s.host_url);
  if (!h) throw new SyncError('offline');
  if (h.host_id !== s.host_id) throw new SyncError('other_host');
  const post = async <T>(path: string, msg: unknown): Promise<T> =>
    open<T>(key, path, await postJson(`${s.host_url}${path}`, { device: s.device_id, ...seal(key, path, msg, iv()) }, CALL_MS) as Envelope);
  const transport: Transport = {
    push: (req: PushRequest) => post<PushResult>('/sync/push', req),
    pull: (req: PullRequest) => post<PullResponse>('/sync/pull', req),
  };
  return syncOnce(tx, transport);
}

// Cheap check, run every few seconds: is any change waiting to be sent?
export async function hasPending(): Promise<boolean> {
  const db = await getDb();
  const parts = [...SYNC_TABLES, 'sync_tombstones', 'meta'].map(t => `EXISTS (SELECT 1 FROM ${t} WHERE dirty = 1)`);
  const r = await db.getFirstAsync<{ p: number }>(`SELECT ${parts.join(' OR ')} AS p`);
  return !!r?.p;
}

export interface SyncStatus {
  paired: boolean;
  hostName: string;
  series: string; // this phone's invoice prefix, e.g. INV-A
  lastSyncAt: string; // UTC 'YYYY-MM-DD HH:MM:SS', '' = never
  pending: number; // changes waiting to be sent
  attention: number; // changes the desktop refused that need a person (dirty = 2)
}

export async function syncStatus(): Promise<SyncStatus> {
  const s = await state();
  const db = await getDb();
  const key = await SecureStore.getItemAsync(KEY);
  let pending = 0;
  let attention = 0;
  for (const t of SYNC_TABLES) {
    const r = await db.getFirstAsync<{ p: number; a: number }>(
      `SELECT SUM(dirty = 1) p, SUM(dirty = 2) a FROM ${t}`);
    pending += r?.p ?? 0;
    attention += r?.a ?? 0;
  }
  pending += (await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) c FROM sync_tombstones WHERE dirty = 1'))?.c ?? 0;
  const meta = await db.getFirstAsync<{ invoice_prefix: string; dirty: number }>('SELECT invoice_prefix, dirty FROM meta WHERE id = 1');
  if (meta?.dirty === 1) pending++;
  return {
    paired: !!s.host_url && !!key, hostName: s.host_name, series: meta?.invoice_prefix ?? '',
    lastSyncAt: s.last_sync_at, pending, attention,
  };
}
