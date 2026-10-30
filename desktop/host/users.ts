// People (LAN_SYNC Phase 5), managed on the desktop and pulled by every phone.
// The PIN is stored the way the phone's app lock stores its own:
// SHA-256 hex of "<salt>:<pin>" with a 16-byte hex salt (src/auth/authStore.ts).
import crypto from 'node:crypto';
import type { SyncDb } from '../../src/sync/protocol';
import { USER_PERMS, type UserPerm } from '../../src/data/schema';

export interface User {
  uid: string;
  name: string;
  role: 'admin' | 'staff';
  perms: UserPerm[];
  active: boolean;
  hasPin: boolean;
  updated_at: string;
}

export const PIN_RULE = /^\d{4,6}$/;

export function hashPin(pin: string, salt = crypto.randomBytes(16).toString('hex')): { salt: string; hash: string } {
  return { salt, hash: crypto.createHash('sha256').update(`${salt}:${pin}`).digest('hex') };
}

export async function listUsers(db: SyncDb): Promise<User[]> {
  const rows = await db.getAllAsync<{ uid: string; name: string; role: 'admin' | 'staff'; perms: string; active: number; pin_len: number; updated_at: string }>(
    'SELECT uid, name, role, perms, active, pin_len, updated_at FROM users ORDER BY active DESC, name COLLATE NOCASE');
  return rows.map(r => ({
    uid: r.uid, name: r.name, role: r.role, active: !!r.active, hasPin: r.pin_len > 0, updated_at: r.updated_at,
    perms: r.perms.split(',').filter((p): p is UserPerm => (USER_PERMS as readonly string[]).includes(p)),
  }));
}

export interface UserInput {
  uid?: string; // missing = a new person
  name: string;
  role: 'admin' | 'staff';
  perms: UserPerm[];
  active: boolean;
  pin?: string; // required for a new person; given = reset
}

// Saves a person; dirty = 1 so the next stamp sweep numbers it and phones pull it.
// Run inside host.exclusive (one transaction). Throws a message for the page.
export async function saveUser(db: SyncDb, u: UserInput): Promise<string> {
  const name = u.name.trim();
  if (!name) throw new Error('Enter a name.');
  if (u.pin !== undefined && !PIN_RULE.test(u.pin)) throw new Error('The PIN must be 4 to 6 digits.');
  if (!u.uid && u.pin === undefined) throw new Error('A new person needs a PIN.');
  const clash = await db.getFirstAsync<{ uid: string }>(
    'SELECT uid FROM users WHERE name = ? COLLATE NOCASE AND uid <> ?', name, u.uid ?? '');
  if (clash) throw new Error(`There is already someone called ${name}.`);
  if (u.uid && !(u.role === 'admin' && u.active)) {
    // Keep at least one active owner, so someone can always change limits from a phone too.
    const owners = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) c FROM users WHERE role = 'admin' AND active = 1 AND uid <> ?", u.uid);
    const wasOwner = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) c FROM users WHERE uid = ? AND role = 'admin' AND active = 1", u.uid);
    if (wasOwner?.c && !owners?.c) throw new Error('Keep at least one active owner.');
  }
  const perms = u.role === 'admin' ? '' : u.perms.filter(p => (USER_PERMS as readonly string[]).includes(p)).join(',');
  const uid = u.uid ?? crypto.randomBytes(16).toString('hex');
  if (u.uid) {
    await db.runAsync(
      `UPDATE users SET name = ?, role = ?, perms = ?, active = ?, updated_at = datetime('now'), dirty = 1 WHERE uid = ?`,
      name, u.role, perms, u.active ? 1 : 0, uid);
  } else {
    await db.runAsync('INSERT INTO users (uid, name, role, perms, active, dirty) VALUES (?, ?, ?, ?, ?, 1)',
      uid, name, u.role, perms, u.active ? 1 : 0);
  }
  if (u.pin !== undefined) {
    const h = hashPin(u.pin);
    await db.runAsync(
      `UPDATE users SET pin_salt = ?, pin_hash = ?, pin_len = ?, updated_at = datetime('now'), dirty = 1 WHERE uid = ?`,
      h.salt, h.hash, u.pin.length, uid);
  }
  return uid;
}
