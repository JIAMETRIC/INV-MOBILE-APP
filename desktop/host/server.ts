// The host's HTTP API for phones on the LAN.
//   GET  /health      who this is (no secrets)
//   POST /pair        { pid, iv, ct } sealed with the QR secret -> PairWelcome
//   POST /sync/push   { device, iv, ct } sealed with the device key -> PushResult
//   POST /sync/pull   { device, iv, ct } -> PullResponse
// Every sealed body is opened with the key of the device it names; a body
// that doesn't open is refused, so the key is the device's credential.
import http from 'node:http';
import {
  PROTOCOL, countChanges,
  type Envelope, type PairHello, type PullRequest, type PushRequest, type SyncDb,
} from '../../src/sync/protocol';
import { handlePull, handlePush } from './hostSync';
import { completePairing, pairingSecret } from './pairing';
import { open, seal } from './seal';
import type { HostInfo } from './hostSchema';

const MAX_BODY = 20 * 1024 * 1024;

export interface ServerDeps {
  db: SyncDb;
  host: HostInfo;
  // Runs fn alone and inside one transaction (app.ts).
  exclusive: <T>(fn: (db: SyncDb) => Promise<T>) => Promise<T>;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    let size = 0;
    req.on('data', (b: Buffer) => {
      size += b.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'too_large')); req.destroy(); return; }
      parts.push(b);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8'))); }
      catch { reject(new HttpError(400, 'bad_json')); }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s) });
  res.end(s);
}

function isEnvelope(b: unknown): b is Envelope & Record<string, unknown> {
  return !!b && typeof (b as Envelope).iv === 'string' && typeof (b as Envelope).ct === 'string';
}

export function createServer(deps: ServerDeps): http.Server {
  const { db, host, exclusive } = deps;

  // The device's key, if it is paired and not blocked.
  async function deviceKey(id: string): Promise<string> {
    const d = await db.getFirstAsync<{ key: string; revoked: number }>('SELECT key, revoked FROM devices WHERE device_id = ?', id);
    if (!d) throw new HttpError(401, 'unknown_device');
    if (d.revoked) throw new HttpError(403, 'revoked');
    return d.key;
  }

  function openOr401<T>(key: string, path: string, env: Envelope): T {
    try { return open<T>(key, path, env); } catch { throw new HttpError(401, 'bad_seal'); }
  }

  async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const ip = req.socket.remoteAddress ?? '';
    if (req.method === 'GET' && path === '/health') {
      send(res, 200, { app: 'invoice-erp-host', protocol: PROTOCOL, host_id: host.host_id, host_name: host.host_name });
      return;
    }
    if (req.method !== 'POST') throw new HttpError(404, 'not_found');
    const body = await readBody(req);
    if (!isEnvelope(body)) throw new HttpError(400, 'not_sealed');

    if (path === '/pair') {
      const pid = String(body.pid ?? '');
      const welcome = await exclusive(async tx => {
        const secret = await pairingSecret(tx, pid);
        if (!secret) throw new HttpError(401, 'pairing_expired');
        const hello = openOr401<PairHello>(secret, path, body);
        return { secret, welcome: await completePairing(tx, pid, hello, host, ip) };
      });
      send(res, 200, seal(welcome.secret, path, welcome.welcome));
      return;
    }

    if (path !== '/sync/push' && path !== '/sync/pull') throw new HttpError(404, 'not_found');
    const device = String(body.device ?? '');
    const key = await deviceKey(device);
    const msg = openOr401<PushRequest | PullRequest>(key, path, body);
    if (msg.device_id !== device) throw new HttpError(401, 'device_mismatch');
    if (msg.protocol !== PROTOCOL) throw new HttpError(409, 'protocol');

    const reply = await exclusive(async tx => {
      await tx.runAsync(`UPDATE devices SET last_seen = datetime('now'), last_ip = ? WHERE device_id = ?`, ip, device);
      if (path === '/sync/push') {
        const r = await handlePush(tx, msg as PushRequest);
        await tx.runAsync(
          "INSERT INTO sync_log (device_id, kind, rows_in, rejects_json) VALUES (?, 'push', ?, ?)",
          device, countChanges((msg as PushRequest).changes),
          r.rejected.length ? JSON.stringify(r.rejected.map(({ tbl, uid, reason }) => ({ tbl, uid, reason }))) : '');
        return r;
      }
      const r = await handlePull(tx, msg as PullRequest);
      const out = countChanges(r.changes);
      if (out > 0) await tx.runAsync("INSERT INTO sync_log (device_id, kind, rows_out) VALUES (?, 'pull', ?)", device, out);
      return r;
    });
    send(res, 200, seal(key, path, reply));
  }

  return http.createServer((req, res) => {
    route(req, res).catch((e: unknown) => {
      if (e instanceof HttpError) send(res, e.status, { error: e.code });
      else { console.error('[host]', e); send(res, 500, { error: 'server' }); }
    });
  });
}
