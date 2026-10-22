import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, useTheme } from './providers';
import { NavProvider, useNav } from './navigation';
import { useBreakpoint } from '../ui/useBreakpoint';
import { BottomTabs, NAV_BAR_HEIGHT, Rail } from '../ui/Nav';
import { space, type } from '../ui/tokens';
import { getDb } from '../data/db';
import { syncNextSeq } from '../data/settingsRepo';
import { ensureDailyBackup } from '../data/backupRepo';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { InvoicesScreen } from '../features/invoices/InvoicesScreen';
import { InvoiceDetail } from '../features/invoices/InvoiceDetail';
import { CreateInvoiceScreen } from '../features/invoices/CreateInvoiceScreen';
import { ProductsScreen } from '../features/products/ProductsScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { TopAppBar } from '../ui/components';
import { SnackbarProvider } from '../ui/Snackbar';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Every screen opens on the navy brand app bar, so status icons are light in both themes. */}
        <StatusBar style="light" />
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const theme = useTheme();
  const bp = useBreakpoint();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        await getDb();
        await syncNextSeq();
        setState('ready');
        void ensureDailyBackup().catch(() => undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
  }, []);

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: space[3] }}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={[type.title, { color: theme.text }]}>Invoice ERP</Text>
        <Text style={[type.bodyMedium, { color: theme.textMuted }]}>Unlocking database…</Text>
      </View>
    );
  }
  if (state === 'error') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: space[5], gap: space[2] }}>
        <StatusBar style={theme.dark ? 'light' : 'dark'} />
        <Ionicons name="alert-circle-outline" size={40} color={theme.error} />
        <Text style={[type.heading, { color: theme.text }]}>Cannot open the database</Text>
        <Text style={[type.bodyMedium, { color: theme.textMuted, textAlign: 'center' }]}>{error}</Text>
      </View>
    );
  }

  return (
    <NavProvider isPhone={bp.isPhone}>
      {/* Phones: clear the nav bar and the 56dp FAB (+16dp margin), so snackbars never cover it. */}
      <SnackbarProvider theme={theme} bottomOffset={bp.isPhone ? NAV_BAR_HEIGHT + 72 : 0}>
        <Shell />
      </SnackbarProvider>
    </NavProvider>
  );
}

function Shell() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();

  const tabContent = (() => {
    switch (nav.tab) {
      case 'dashboard': return <DashboardScreen />;
      case 'invoices': return <InvoicesScreen />;
      case 'products': return <ProductsScreen />;
      case 'settings': return <SettingsScreen />;
    }
  })();

  const overlay = nav.overlay;

  // Edge-to-edge: app bars pad themselves by the status-bar inset and the nav
  // bar by the gesture inset, so the shell only owns the side insets.
  if (bp.isPhone) {
    if (overlay?.k === 'create-invoice') {
      return (
        <View style={{ flex: 1, backgroundColor: theme.bg }}>
          <CreateInvoiceScreen draftId={overlay.draftId} invoiceId={overlay.invoiceId} />
        </View>
      );
    }
    if (overlay?.k === 'invoice-detail') {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['bottom']}>
          <TopAppBar title="Invoice" theme={theme} onBack={nav.closeOverlay} />
          <InvoiceDetail invoiceId={overlay.id} />
        </SafeAreaView>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={{ flex: 1 }}>{tabContent}</View>
        <BottomTabs active={nav.tab} onSelect={nav.goTab} theme={theme} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['left', 'right']}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Rail
          active={nav.tab}
          onSelect={nav.goTab}
          theme={theme}
          labels={bp.atLeast('xl')}
          onNew={() => nav.openCreate()}
        />
        <SafeAreaView style={{ flex: 1, minWidth: 0 }} edges={['bottom']}>
          {overlay?.k === 'create-invoice'
            ? <CreateInvoiceScreen draftId={overlay.draftId} invoiceId={overlay.invoiceId} />
            : tabContent}
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
}
