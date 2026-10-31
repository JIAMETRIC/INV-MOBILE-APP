// AES-256-GCM sealing of request and reply bodies (format in src/sync/protocol.ts:
// Envelope). The request path is the additional data.
import crypto from 'node:crypto';
import type { Envelope } from '../../src/sync/protocol';

export function newKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

export function seal(keyB64: string, path: string, body: unknown): Envelope {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), iv);
  c.setAAD(Buffer.from(path));
  const ct = Buffer.concat([c.update(JSON.stringify(body), 'utf8'), c.final(), c.getAuthTag()]);
  return { iv: iv.toString('base64'), ct: ct.toString('base64') };
}

// Throws when the key, the path or the bytes don't match.
export function open<T>(keyB64: string, path: string, env: Envelope): T {
  const raw = Buffer.from(env.ct, 'base64');
  if (raw.length < 16) throw new Error('sealed body too short');
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyB64, 'base64'), Buffer.from(env.iv, 'base64'));
  d.setAAD(Buffer.from(path));
  d.setAuthTag(raw.subarray(raw.length - 16));
  const pt = Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}
