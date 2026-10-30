// LAN sync protocol (LAN_SYNC). Shared by the phone and the desktop host, so
// it imports nothing platform-specific. Rows travel with uids, never local ids.

export const PROTOCOL = 1;
export const DEFAULT_PORT = 7420;
// A pull returns at most this many server_seq numbers; `more` says to ask again.
export const PULL_WINDOW = 2000;

// The part of expo-sqlite's SQLiteDatabase the sync code uses. The host passes
// a node:sqlite wrapper with the same shape.
export type SqlArg = string | number | null;
export interface SyncDb {
  getFirstAsync<T>(sql: string, ...args: SqlArg[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...args: SqlArg[]): Promise<T[]>;
  runAsync(sql: string, ...args: SqlArg[]): Promise<{ lastInsertRowId: number; changes: number }>;
  execAsync(sql: string): Promise<void>;
}

export type WireTable = 'products' | 'restocks' | 'invoices' | 'payments' | 'audit_logs';

// Every pushed or pulled row carries these next to its own columns.
export interface WireMeta {
  uid: string;
  rev?: number; // push: the local edit counter, echoed back in the ack
  base_seq?: number | null; // push: the host version this edit started from
  server_seq?: number | null; // pull: the host's change number
}
export type WireRow = WireMeta & Record<string, unknown>;

export interface WireLine {
  sno: number;
  product_uid: string | null;
  description: string;
  size: string;
  qty: number;
  unit_paise: number;
  line_paise: number;
}

export type Changes = { [T in WireTable]: WireRow[] } & {
  meta: WireRow | null; // company details (uid is always 'meta')
  deletes: { tbl: WireTable; uid: string }[];
};

export interface PushRequest {
  protocol: number;
  device_id: string;
  changes: Changes;
}

// host_wins: the host kept its version; `current` is it, so the phone takes it.
// The other reasons leave the row on the phone, marked for attention (dirty = 2).
export type RejectReason = 'host_wins' | 'number_taken' | 'name_taken' | 'missing_product' | 'not_allowed';

export interface PushResult {
  accepted: { tbl: WireTable | 'meta'; uid: string; rev: number; server_seq: number }[];
  rejected: { tbl: WireTable | 'meta'; uid: string; rev: number; reason: RejectReason; current?: WireRow }[];
  deleted: { tbl: WireTable; uid: string }[];
}

export interface PullRequest {
  protocol: number;
  device_id: string;
  since: number;
}

export interface PullResponse {
  changes: Changes;
  upto: number; // store as last_pull_seq
  more: boolean;
}

// POST bodies and replies after pairing: AES-256-GCM, ciphertext with the
// 16-byte tag appended (the layout WebCrypto and @noble/ciphers use), the
// request path as additional data so a body can't be replayed on another route.
export interface Envelope {
  device?: string;
  iv: string; // base64, 12 bytes
  ct: string; // base64
}

// Pairing: the desktop shows a QR code with the pairing id and secret; the
// phone sends PairHello sealed with the secret and gets PairWelcome back.
export interface PairHello { device_id: string; device_name: string; app_version: string }
export interface PairWelcome {
  host_id: string;
  host_name: string;
  device_key: string; // base64, 32 bytes: seals every later request
  series: string; // invoice series letter, e.g. 'A' -> prefix INV-A
  protocol: number;
}

export function emptyChanges(): Changes {
  return { products: [], restocks: [], invoices: [], payments: [], audit_logs: [], meta: null, deletes: [] };
}

export function countChanges(c: Changes): number {
  return c.products.length + c.restocks.length + c.invoices.length + c.payments.length
    + c.audit_logs.length + (c.meta ? 1 : 0) + c.deletes.length;
}
