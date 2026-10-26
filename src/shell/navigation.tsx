import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import type { Tab } from '../ui/Nav';

export type Overlay =
  | { k: 'create-invoice'; invoiceId?: number }
  | { k: 'invoice-detail'; id: number }
  | null;

// Returns true when it consumed the Back press.
type BackInterceptor = () => boolean;

export interface NavApi {
  tab: Tab;
  goTab: (t: Tab) => void;
  overlay: Overlay;
  openCreate: (opts?: { invoiceId?: number }) => void;
  closeOverlay: () => void;
  selectedInvoiceId: number | null;
  selectInvoice: (id: number | null) => void;
  isPhone: boolean;
  showInvoice: (id: number, phone: boolean) => void;
  refreshKey: number;
  refresh: () => void;
  pushBack: (fn: BackInterceptor) => () => void;
}

const NavContext = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const v = useContext(NavContext);
  if (!v) throw new Error('NavContext missing');
  return v;
}

// Lets a screen claim system Back while mounted (stepper step-back, drill-in pane).
// The interceptor sees the latest closure via a ref, so callers need not memoise it.
export function useBackIntercept(fn: BackInterceptor) {
  const nav = useNav();
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => nav.pushBack(() => ref.current()), [nav.pushBack]);
}

export function NavProvider({ children, isPhone }: { children: React.ReactNode; isPhone: boolean }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const interceptors = useRef<BackInterceptor[]>([]);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);
  const goTab = useCallback((t: Tab) => { setTab(t); setOverlay(null); }, []);
  const openCreate = useCallback((opts?: { invoiceId?: number }) => {
    setOverlay({ k: 'create-invoice', ...opts });
  }, []);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const showInvoice = useCallback((id: number, phone: boolean) => {
    if (phone) setOverlay({ k: 'invoice-detail', id });
    else { setTab('invoices'); setSelectedInvoiceId(id); }
  }, []);
  const pushBack = useCallback((fn: BackInterceptor) => {
    interceptors.current.push(fn);
    return () => { interceptors.current = interceptors.current.filter(f => f !== fn); };
  }, []);

  // Android Back: innermost screen interceptor → close overlay → return to the
  // start destination (Home) → let the system leave the app.
  const state = useRef({ tab, overlay });
  state.current = { tab, overlay };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      for (let i = interceptors.current.length - 1; i >= 0; i--) {
        if (interceptors.current[i]!()) return true;
      }
      if (state.current.overlay) { setOverlay(null); return true; }
      if (state.current.tab !== 'dashboard') { setTab('dashboard'); return true; }
      return false;
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<NavApi>(() => ({
    tab, goTab, overlay, openCreate, closeOverlay,
    selectedInvoiceId, selectInvoice: setSelectedInvoiceId,
    isPhone, showInvoice, refreshKey, refresh, pushBack,
  }), [tab, goTab, overlay, openCreate, closeOverlay, selectedInvoiceId, isPhone, showInvoice, refreshKey, refresh, pushBack]);

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}
