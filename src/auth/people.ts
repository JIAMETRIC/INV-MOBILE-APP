// People on this phone (LAN_SYNC Phase 5). They are made on Invoice ERP
// Desktop and arrive with sync (the users table); the phone only reads them.
// Once this phone is paired and the desktop has at least one active person,
// the lock asks "who's using" and that person's PIN instead of the device PIN,
// and the signed-in person (sync_state.user_uid) is stamped on every change.
import { getDb } from '../data/db';
import { USER_PERMS, type UserPerm } from '../data/schema';
import { checkHashed, type Attempt } from './authStore';

export interface Person {
  uid: string;
  name: string;
  role: 'admin' | 'staff';
  perms: UserPerm[];
  pinLen: number;
}

type Row = { uid: string; name: string; role: 'admin' | 'staff'; perms: string; pin_len: number };

const toPerson = (r: Row): Person => ({
  uid: r.uid, name: r.name, role: r.role, pinLen: r.pin_len,
  perms: r.perms.split(',').filter((p): p is UserPerm => (USER_PERMS as readonly string[]).includes(p)),
});

// Who may sign in here: active people with a PIN.
export async function listPeople(): Promise<Person[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>(
    'SELECT uid, name, role, perms, pin_len FROM users WHERE active = 1 AND pin_len > 0 ORDER BY name COLLATE NOCASE');
  return rows.map(toPerson);
}

// People mode: paired, and the desktop has someone who can sign in.
export async function peopleMode(): Promise<boolean> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ on: number }>(
    `SELECT (SELECT host_url FROM sync_state WHERE id = 1) <> ''
        AND EXISTS (SELECT 1 FROM users WHERE active = 1 AND pin_len > 0) AS "on"`);
  return !!r?.on;
}

export async function checkPersonPin(uid: string, pin: string): Promise<Attempt> {
  const db = await getDb();
  const u = await db.getFirstAsync<{ pin_salt: string; pin_hash: string; name: string }>(
    'SELECT pin_salt, pin_hash, name FROM users WHERE uid = ? AND active = 1', uid);
  return checkHashed(u ? { salt: u.pin_salt, hash: u.pin_hash } : null, pin, `person ${u?.name ?? uid}`);
}

// From now on, new and changed rows record this person ('' = the phone's owner).
export async function signIn(uid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sync_state SET user_uid = ? WHERE id = 1', uid);
}

// The signed-in person, or null: nobody (owner mode) or someone switched off since.
export async function currentPerson(): Promise<Person | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<Row>(
    `SELECT u.uid, u.name, u.role, u.perms, u.pin_len FROM users u
     JOIN sync_state s ON s.id = 1 AND s.user_uid = u.uid WHERE u.active = 1`);
  return r ? toPerson(r) : null;
}

// D4: everyone may bill and take payments; the rest needs the switch (or owner).
// No person (owner mode, before people) may do everything, as before Phase 5.
export function may(person: Person | null, perm: UserPerm): boolean {
  return !person || person.role === 'admin' || person.perms.includes(perm);
}
