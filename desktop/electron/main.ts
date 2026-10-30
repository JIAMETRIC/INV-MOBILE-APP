// Invoice ERP Desktop (Electron). Starts the host with the encrypted
// database, shows the status page, and keeps running in the tray when the
// window is closed so phones can sync all day.
//   --hidden   started with Windows: tray only
//   --smoke    start, check, write <dataDir>/smoke.json, quit (build check)
// INVOICE_ERP_DATA overrides the data folder (default %APPDATA%\InvoiceERP).
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, Tray, dialog, ipcMain, nativeImage, nativeTheme, shell } from 'electron';
import QRCode from 'qrcode';
import { startHost, type Host } from '../host/app';
import { lanAddresses } from '../host/pairing';
import { isEncryptedFile, loadDbKey, openCipherEngine } from './cipherDb';

const SMOKE = process.argv.includes('--smoke');
const HIDDEN = process.argv.includes('--hidden');
const dataDir = process.env.INVOICE_ERP_DATA ?? path.join(app.getPath('appData'), 'InvoiceERP');
const asset = (...p: string[]) => path.join(app.getAppPath(), 'renderer', ...p);

let host: Host | null = null;
let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

function showWindow(): void {
  if (win) { win.show(); win.focus(); return; }
  win = new BrowserWindow({
    width: 1100, height: 780, minWidth: 380, minHeight: 560,
    title: 'Invoice ERP Desktop',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#000000' : '#ebeaea',
    autoHideMenuBar: true,
    icon: asset('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  // Closing the window keeps the host running in the tray.
  win.on('close', e => { if (!quitting) { e.preventDefault(); win?.hide(); } });
  win.on('closed', () => { win = null; });
  void win.loadFile(asset('index.html'));
}

function createTray(): Tray {
  const t = new Tray(nativeImage.createFromPath(asset('icon.png')).resize({ width: 16, height: 16 }));
  t.setToolTip(`Invoice ERP Desktop: phones sync on port ${host?.port}`);
  t.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Invoice ERP', click: showWindow },
    { type: 'separator' },
    { label: 'Quit (phones stop syncing)', click: () => { quitting = true; app.quit(); } },
  ]));
  t.on('click', showWindow);
  return t;
}

async function status() {
  const h = host!;
  const db = h.db;
  const devices = await db.getAllAsync(
    `SELECT device_id, name, series, app_version, paired_at, last_seen, last_ip, revoked FROM devices ORDER BY id`);
  const log = await db.getAllAsync(
    `SELECT l.id, l.kind, l.rows_in, l.rows_out, l.rejects_json, l.at, d.name, d.series
     FROM sync_log l LEFT JOIN devices d ON d.device_id = l.device_id ORDER BY l.id DESC LIMIT 30`);
  const counts = await db.getFirstAsync<Record<string, number>>(
    `SELECT (SELECT COUNT(*) FROM invoices WHERE status <> 'void') AS invoices,
            (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM devices WHERE revoked = 0) AS phones`);
  const company = await db.getFirstAsync<{ name: string }>('SELECT name FROM meta WHERE id = 1');
  return {
    hostName: h.info.host_name, company: company?.name ?? '', port: h.port, ips: lanAddresses(), dataDir,
    devices, log, counts, startWithWindows: app.getLoginItemSettings().openAtLogin,
    now: new Date().toISOString(),
  };
}

function registerIpc(): void {
  ipcMain.handle('host:status', status);
  ipcMain.handle('host:pair', async () => {
    const { uri, pairing } = await host!.newPairing();
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 280, errorCorrectionLevel: 'M' });
    return { uri, qr, expiresAt: pairing.expiresAt };
  });
  ipcMain.handle('host:block', (_e, deviceId: string, blocked: boolean) =>
    host!.exclusive(tx => tx.runAsync('UPDATE devices SET revoked = ? WHERE device_id = ?', blocked ? 1 : 0, deviceId)));
  ipcMain.handle('app:startWithWindows', (_e, on: boolean) => {
    app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('app:openData', () => shell.openPath(dataDir));
}

// Build check: the host starts on the encrypted database, a backup exists and
// is encrypted too, pairing works, the page's status call answers.
async function smoke(): Promise<void> {
  const h = host!;
  const { uri } = await h.newPairing();
  const s = await status();
  const backups = path.join(dataDir, 'backups');
  const backup = fs.readdirSync(backups).sort().pop();
  const out = {
    ok: true, electron: process.versions.electron, port: h.port,
    dbEncrypted: isEncryptedFile(path.join(dataDir, 'host.db')),
    backupEncrypted: backup ? isEncryptedFile(path.join(backups, backup)) : null,
    products: s.counts?.products, pairing: uri.startsWith('invoiceerp://pair?'),
  };
  fs.writeFileSync(path.join(dataDir, 'smoke.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
}

async function start(): Promise<void> {
  try {
    host = await startHost({ dataDir, engine: openCipherEngine, dbKeyHex: loadDbKey(dataDir) });
  } catch (e) {
    const msg = (e as NodeJS.ErrnoException).code === 'EADDRINUSE'
      ? 'Port 7420 is already in use. Is Invoice ERP Desktop (or the terminal host) already running?'
      : String((e as Error).message ?? e);
    if (SMOKE) { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(path.join(dataDir, 'smoke.json'), JSON.stringify({ ok: false, error: msg })); }
    else dialog.showErrorBox('Invoice ERP Desktop could not start', msg);
    app.exit(1);
    return;
  }
  registerIpc();
  if (SMOKE) {
    await smoke().catch(e => fs.writeFileSync(path.join(dataDir, 'smoke.json'), JSON.stringify({ ok: false, error: String(e) })));
    quitting = true;
    await host.stop();
    app.exit(0);
    return;
  }
  tray = createTray();
  if (!HIDDEN) showWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('window-all-closed', () => { /* stay in the tray */ });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', e => {
    if (!host) return;
    e.preventDefault();
    const h = host;
    host = null;
    void h.stop().finally(() => app.exit(0));
  });
  void app.whenReady().then(start);
}
