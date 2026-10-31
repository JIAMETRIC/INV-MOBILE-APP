// Pairing a phone: the desktop shows a one-time QR code (pid + secret); the
// phone answers with a hello sealed by that secret and gets its own device key
// and invoice series back, sealed the same way. Nothing secret travels in clear.
import crypto from 'node:crypto';
import os from 'node:os';
import { DEFAULT_PORT, PROTOCOL, type PairHello, type PairWelcome, type SyncDb } from '../../src/sync/protocol';
import { newKey } from './seal';
import type { HostInfo } from './hostSchema';

export const PAIRING_TTL_MS = 10 * 60_000;

export interface Pairing { pid: string; secret: string; expiresAt: number }

export async function createPairing(db: SyncDb, ttlMs = PAIRING_TTL_MS): Promise<Pairing> {
  const p = { pid: crypto.randomBytes(8).toString('hex'), secret: newKey(), expiresAt: Date.now() + ttlMs };
  await db.runAsync('DELETE FROM pairings WHERE used = 1 OR expires_at < ?', Date.now());
  await db.runAsync('INSERT INTO pairings (pid, secret, expires_at) VALUES (?, ?, ?)', p.pid, p.secret, p.expiresAt);
  return p;
}

// What the QR code holds. The phone tries each address until /health answers.
export function pairingUri(p: Pairing, port = DEFAULT_PORT, ips = lanAddresses()): string {
  const q = new URLSearchParams({ h: ips.join(','), p: String(port), i: p.pid, s: p.secret });
  return `invoiceerp://pair?${q.toString()}`;
}

// Private IPv4 addresses of this PC (the ones phones on the shop Wi-Fi can reach).
export function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) out.push(a.address);
    }
  }
  return out;
}

export async function pairingSecret(db: SyncDb, pid: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ secret: string }>(
    'SELECT secret FROM pairings WHERE pid = ? AND used = 0 AND expires_at >= ?', pid, Date.now());
  return r?.secret ?? null;
}

// Series letters in pairing order: A … Z, then AA, AB … The desktop itself
// keeps the plain INV- series (it continues the numbers the first phone brought).
function seriesName(n: number): string {
  let s = '';
  for (let i = n; i >= 0; i = Math.floor(i / 26) - 1) s = String.fromCharCode(65 + (i % 26)) + s;
  return s;
}

// A phone pairing again (reinstalled app, new QR) keeps its series letter.
export async function completePairing(db: SyncDb, pid: string, hello: PairHello, host: HostInfo, ip: string): Promise<PairWelcome> {
  await db.runAsync('UPDATE pairings SET used = 1 WHERE pid = ?', pid);
  const key = newKey();
  const known = await db.getFirstAsync<{ series: string }>('SELECT series FROM devices WHERE device_id = ?', hello.device_id);
  let series = known?.series;
  if (series) {
    await db.runAsync(
      `UPDATE devices SET key = ?, name = ?, app_version = ?, revoked = 0, paired_at = datetime('now'), last_ip = ?
       WHERE device_id = ?`, key, hello.device_name, hello.app_version, ip, hello.device_id);
  } else {
    const n = (await db.getFirstAsync<{ c: number }>('SELECT series_count c FROM host_state WHERE id = 1'))?.c ?? 0;
    series = seriesName(n);
    await db.runAsync('UPDATE host_state SET series_count = ? WHERE id = 1', n + 1);
    await db.runAsync(
      'INSERT INTO devices (device_id, name, key, series, app_version, last_ip) VALUES (?, ?, ?, ?, ?, ?)',
      hello.device_id, hello.device_name, key, series, hello.app_version, ip);
  }
  await db.runAsync("INSERT INTO sync_log (device_id, kind) VALUES (?, 'pair')", hello.device_id);
  return { host_id: host.host_id, host_name: host.host_name, device_key: key, series, protocol: PROTOCOL };
}
