// The app lock's secrets: the PIN, the recovery code, the fingerprint switch and
// the failed-attempt counter, all in expo-secure-store (Android Keystore), next to
// the database key (data/dbKey.ts). The PIN and the recovery code are stored only
// as salted SHA-256 hashes; the lock gates the UI, the database key is unchanged.
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { logAudit } from '../data/auditRepo';

const KEY = {
  pin: 'auth_pin_v1', // { salt, hash, len }
  recovery: 'auth_recovery_v1', // { salt, hash }
  bio: 'auth_bio_v1', // '1' = fingerprint / face unlock on
  fails: 'auth_fails_v1', // { count, until }
} as const;
const OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const PIN = { min: 4, max: 6 } as const;
// After `freeTries` wrong entries in a row, each further one waits twice as long
// (30 s, 1 min, 2 min … up to 15 min). The counter survives restarts.
export const LOCKOUT = { freeTries: 5, baseMs: 30_000, maxMs: 15 * 60_000 } as const;
// Recovery code: 12 characters from 32 that can't be confused (no I, O, 0, 1).
const CODE = { alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', length: 12, group: 4 } as const;

type Hashed = { salt: string; hash: string };
type Fails = { count: number; until: number };
export type Attempt = { ok: true } | { ok: false; waitMs: number; triesLeft: number };

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
const writeJson = (key: string, v: unknown) => SecureStore.setItemAsync(key, JSON.stringify(v), OPTS);

async function randomHex(bytes: number): Promise<string> {
  const b = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

async function hashed(secret: string, salt?: string): Promise<Hashed> {
  const s = salt ?? await randomHex(16);
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${s}:${secret}`);
  return { salt: s, hash };
}

// Same-length hex strings compared without an early exit.
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// The PIN's length (the unlock screen shows that many dots), or null before setup.
export async function pinLength(): Promise<number | null> {
  return (await readJson<Hashed & { len: number }>(KEY.pin))?.len ?? null;
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d+$/.test(pin) || pin.length < PIN.min || pin.length > PIN.max) throw new Error('PIN must be 4 to 6 digits');
  await writeJson(KEY.pin, { ...(await hashed(pin)), len: pin.length });
  await SecureStore.deleteItemAsync(KEY.fails);
}

// A new recovery code, "ABCD-EFGH-JKLM"; the old one stops working. Shown once.
export async function newRecoveryCode(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(CODE.length);
  // 256 is a multiple of 32, so `& 31` picks every character equally often.
  const raw = Array.from(bytes, b => CODE.alphabet[b & 31]).join('');
  await writeJson(KEY.recovery, await hashed(raw));
  return raw.match(new RegExp(`.{1,${CODE.group}}`, 'g'))!.join('-');
}

// What the owner typed, as stored: upper case, the code's characters only.
export function normaliseCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export const CODE_LENGTH = CODE.length;

export async function lockoutRemaining(): Promise<number> {
  const f = await readJson<Fails>(KEY.fails);
  return f ? Math.max(0, f.until - Date.now()) : 0;
}

async function check(key: string, secret: string): Promise<Attempt> {
  const wait = await lockoutRemaining();
  const f = (await readJson<Fails>(KEY.fails)) ?? { count: 0, until: 0 };
  if (wait > 0) return { ok: false, waitMs: wait, triesLeft: 0 };
  const rec = await readJson<Hashed>(key);
  const what = key === KEY.pin ? 'pin' : 'recovery';
  if (rec && sameHex((await hashed(secret, rec.salt)).hash, rec.hash)) {
    await SecureStore.deleteItemAsync(KEY.fails);
    if (what === 'recovery') await logAudit('auth.recovered', 'auth', what);
    return { ok: true };
  }
  const count = f.count + 1;
  const over = count - LOCKOUT.freeTries;
  const waitMs = over >= 0 ? Math.min(LOCKOUT.maxMs, LOCKOUT.baseMs * 2 ** over) : 0;
  await writeJson(KEY.fails, { count, until: Date.now() + waitMs });
  // Wrong PINs are on the Activity log's watch list (A3).
  await logAudit(waitMs > 0 ? 'auth.locked' : 'auth.failed', 'auth', what, { count, waitMs });
  return { ok: false, waitMs, triesLeft: Math.max(0, LOCKOUT.freeTries - count) };
}

export const checkPin = (pin: string) => check(KEY.pin, pin);
export const checkRecoveryCode = (code: string) => check(KEY.recovery, normaliseCode(code));

export async function getBioEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY.bio)) === '1';
}
export async function setBioEnabled(on: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY.bio, on ? '1' : '0', OPTS);
}
