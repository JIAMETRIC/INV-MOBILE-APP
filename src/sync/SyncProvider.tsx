// Runs sync with the desktop in the background once the phone is paired:
// when the app opens or comes back, every SYNC.everyMs while it is open, and
// within SYNC.pendingCheckMs of a save on any screen (a cheap local check for
// changes waiting, skipped while the desktop is unreachable). When a pull
// brought changes, the screens reload. Settings → Sync (S6.7) shows
// the status and offers Pair / Sync now / Unpair through useSync().
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useNav } from '../shell/navigation';
import appVersion from '../../app-version.json';
import {
  SyncError, hasPending, pair as pairWithDesktop, syncNow, syncStatus, unpair as forgetDesktop, type SyncStatus,
} from './service';
import type { SyncReport } from './client';

export const SYNC = {
  everyMs: 60_000, // while the app is open
  pendingCheckMs: 5_000, // look for unsent changes this often
} as const;

type SyncApi = {
  status: SyncStatus | null;
  busy: boolean;
  lastError: string; // '' after a sync that worked
  lastReport: SyncReport | null;
  syncNow: () => Promise<SyncReport | null>;
  pair: (code: string) => Promise<void>;
  unpair: () => Promise<void>;
};

const SyncContext = createContext<SyncApi | null>(null);

export function useSync(): SyncApi {
  const v = useContext(SyncContext);
  if (!v) throw new Error('useSync outside SyncProvider');
  return v;
}

// What the desktop's phone list shows for this phone, e.g. "Xiaomi Redmi Note 13".
function deviceName(): string {
  const c = Platform.constants as { Brand?: string; Model?: string };
  const brand = c.Brand ? c.Brand[0]!.toUpperCase() + c.Brand.slice(1) : '';
  const model = c.Model ?? '';
  return (model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`).trim() || 'Phone';
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const nav = useNav();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState('');
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const running = useRef<Promise<SyncReport | null> | null>(null);
  const paired = useRef(false);
  const failed = useRef(false); // last round failed: leave retries to the SYNC.everyMs tick

  const readStatus = useCallback(async () => {
    const s = await syncStatus();
    paired.current = s.paired;
    setStatus(s);
    return s;
  }, []);

  // One round at a time; a second caller gets the round already running.
  const run = useCallback((): Promise<SyncReport | null> => {
    if (running.current) return running.current;
    const p = (async () => {
      setBusy(true);
      try {
        const report = await syncNow();
        setLastReport(report);
        setLastError('');
        failed.current = false;
        if (report.pulled > 0) nav.refresh();
        return report;
      } catch (e) {
        failed.current = true;
        setLastError(e instanceof Error ? e.message : String(e));
        if (!(e instanceof SyncError)) console.warn('[sync]', e);
        return null;
      } finally {
        await readStatus().catch(() => undefined);
        setBusy(false);
        running.current = null;
      }
    })();
    running.current = p;
    return p;
  }, [nav, readStatus]);

  const runIfPaired = useCallback(async () => {
    const s = await readStatus().catch(() => null);
    if (s?.paired) await run();
  }, [readStatus, run]);

  // On open, on coming back, and every SYNC.everyMs while open.
  useEffect(() => {
    void runIfPaired();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void runIfPaired(); }, SYNC.everyMs);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') void runIfPaired(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [runIfPaired]);

  // A save on any screen: send it within SYNC.pendingCheckMs.
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || !paired.current || failed.current || running.current) return;
      void hasPending().then(p => { if (p) void run(); }).catch(() => undefined);
    }, SYNC.pendingCheckMs);
    return () => clearInterval(timer);
  }, [run]);

  const pair = useCallback(async (code: string) => {
    await pairWithDesktop(code, deviceName(), `${appVersion.version} (${appVersion.versionCode})`);
    failed.current = false;
    nav.refresh(); // the invoice prefix changed
    await run();
  }, [nav, run]);

  const unpair = useCallback(async () => {
    await forgetDesktop();
    setLastError('');
    setLastReport(null);
    await readStatus();
  }, [readStatus]);

  const api = useMemo<SyncApi>(() => ({ status, busy, lastError, lastReport, syncNow: run, pair, unpair }),
    [status, busy, lastError, lastReport, run, pair, unpair]);

  return <SyncContext.Provider value={api}>{children}</SyncContext.Provider>;
}
