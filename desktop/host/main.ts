// Runs the host from a terminal until the Electron shell exists:
//   npm run host:start                 start, data in %APPDATA%\InvoiceERP
//   npm run host:start -- --pair       also print a pairing link (valid 10 minutes)
//   options: --data <dir>  --port <n>
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PORT } from '../../src/sync/protocol';
import { startHost } from './app';
import { lanAddresses } from './pairing';

function opt(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const appData = process.env.APPDATA ?? path.join(os.homedir(), '.config');
  const dataDir = opt('data') ?? path.join(appData, 'InvoiceERP');
  const host = await startHost({ dataDir, port: Number(opt('port') ?? DEFAULT_PORT) });
  console.log(`Invoice ERP host "${host.info.host_name}" listening on port ${host.port}`);
  console.log(`Data: ${dataDir}`);
  const ips = lanAddresses();
  console.log(ips.length ? `Phones connect to: ${ips.map(ip => `http://${ip}:${host.port}`).join('  ')}`
    : 'No LAN address found: connect this PC to the shop Wi-Fi or router.');
  if (process.argv.includes('--pair')) {
    const { uri, pairing } = await host.newPairing();
    console.log(`\nPairing link (one phone, until ${new Date(pairing.expiresAt).toLocaleTimeString()}):\n${uri}`);
  }
  const stop = () => { void host.stop().then(() => process.exit(0)); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(e => { console.error(e); process.exit(1); });
