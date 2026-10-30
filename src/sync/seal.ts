// AES-256-GCM sealing on the phone, in pure JavaScript (@noble/ciphers), the
// same format as the desktop's node:crypto version (desktop/host/seal.ts):
// 12-byte IV, ciphertext with the 16-byte tag appended, the request path as
// additional data, base64 for both.
import { gcm } from '@noble/ciphers/aes.js';
import { Buffer } from 'buffer';
import type { Envelope } from './protocol';

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, 'base64'));
const utf8 = (s: string) => new Uint8Array(Buffer.from(s, 'utf8'));
const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');

// iv: 12 fresh random bytes per message (expo-crypto getRandomBytes on the phone).
export function seal(keyB64: string, path: string, body: unknown, iv: Uint8Array): Envelope {
  const ct = gcm(bytes(keyB64), iv, utf8(path)).encrypt(utf8(JSON.stringify(body)));
  return { iv: b64(iv), ct: b64(ct) };
}

// Throws when the key, the path or the bytes don't match.
export function open<T>(keyB64: string, path: string, env: Envelope): T {
  const pt = gcm(bytes(keyB64), bytes(env.iv), utf8(path)).decrypt(bytes(env.ct));
  return JSON.parse(Buffer.from(pt).toString('utf8')) as T;
}
