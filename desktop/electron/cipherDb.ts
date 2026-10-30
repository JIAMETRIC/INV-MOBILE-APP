// The desktop's encrypted database: SQLite3 Multiple Ciphers set to the
// SQLCipher 4 format, the same format the phone's database uses. The key
// itself is sent by the app's own dbCore (PRAGMA key) right after opening.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { SqlEngine } from '../host/nodeSqlite';

export function openCipherEngine(file: string): SqlEngine {
  const Database = require('better-sqlite3-multiple-ciphers') as new (file: string) => SqlEngine & { pragma(sql: string): unknown };
  const db = new Database(file);
  db.pragma("cipher = 'sqlcipher'");
  db.pragma('legacy = 4');
  return db;
}

// Windows data protection (DPAPI, this user account) through the PowerShell
// that ships with Windows. Not Electron's safeStorage: that one depends on a
// key Chromium writes to "Local State" only on a clean shutdown, so a crash
// on the first day would leave host.key undecryptable. The secret travels in
// an environment variable, never on a command line.
function dpapi(op: 'Protect' | 'Unprotect', input: string): string {
  const script = op === 'Protect'
    ? '[Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($env:ERP_IN), $null, "CurrentUser"))'
    : '[Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($env:ERP_IN), $null, "CurrentUser"))';
  return execFileSync('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -AssemblyName System.Security; ${script}`],
    { env: { ...process.env, ERP_IN: input }, encoding: 'utf8', windowsHide: true }).trim();
}

// The database key (64 hex chars), kept in <dataDir>/host.key protected by
// Windows for this user account. Made on the first start, read back and
// checked before it is used. A database without its key can't be opened, so a
// missing key next to an existing database is an error, not a reason to make
// a new one.
export function loadDbKey(dataDir: string): string {
  if (process.platform !== 'win32') throw new Error('Invoice ERP Desktop runs on Windows only.');
  const keyFile = path.join(dataDir, 'host.key');
  if (fs.existsSync(keyFile)) {
    const saved = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as { v: number; dpapi: string };
    return dpapi('Unprotect', saved.dpapi);
  }
  if (fs.existsSync(path.join(dataDir, 'host.db'))) {
    throw new Error(`host.key is missing next to the database in ${dataDir}. Restore it from where it was copied, or move host.db away to start empty (the phones still hold their data).`);
  }
  const hex = crypto.randomBytes(32).toString('hex');
  const sealed = dpapi('Protect', hex);
  if (dpapi('Unprotect', sealed) !== hex) throw new Error('Windows data protection did not give the key back.');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyFile, JSON.stringify({ v: 1, dpapi: sealed }));
  return hex;
}

// True when the file does not start with the plain SQLite header.
export function isEncryptedFile(file: string): boolean {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    return head.toString('latin1') !== 'SQLite format 3\0';
  } finally {
    fs.closeSync(fd);
  }
}
