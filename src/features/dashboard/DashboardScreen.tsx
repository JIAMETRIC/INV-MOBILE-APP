import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Button, Card, EmptyState, FAB, ListItem, MoneyText, SectionTitle, StatusGlyph, TopAppBar, type IconName,
} from '../../ui/components';
import { space, type, maxReadWidth } from '../../ui/tokens';
import { formatPaise, formatDateDisplay } from '../../data/money';
import { getAging, getKpis, recentInvoices } from '../../data/dashboardRepo';
import { getStockTotals } from '../../data/productsRepo';
import type { AgingRow, Invoice } from '../../data/types';
import type { Theme } from '../../ui/tokens';

type Kpi = { label: string; value: string; icon: IconName };

function fyLabel(d = new Date()): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${start}–${String((start + 1) % 100).padStart(2, '0')} overview`;
}

// `compact` (3 across on phones): icon above a 2-line label, tighter padding.
function KpiTile({ kpi, compact, theme }: { kpi: Kpi; compact: boolean; theme: Theme }) {
  return (
    <Card theme={theme} variant="filled" style={{
      flexGrow: 1, minHeight: 104, gap: space[2], backgroundColor: theme.kpiSurface,
      ...(compact ? { padding: space[3] } : null),
    }}>
      <View style={compact
        ? { gap: space[1] }
        : { flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Ionicons name={kpi.icon} size={18} color={theme.accent} />
        <Text style={[type.labelMedium, { color: theme.textMuted }, compact ? null : { flex: 1 }]}
          numberOfLines={compact ? 2 : 1}>
          {kpi.label}
        </Text>
      </View>
      <Text
        style={[type.title, { color: theme.text, fontVariant: ['tabular-nums'] }]}
        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
      >
        {kpi.value}
      </Text>
    </Card>
  );
}

export function DashboardScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const [kpis, setKpis] = useState({ invoiceCount: 0, billedPaise: 0 });
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [aging, setAging] = useState<AgingRow[]>([]);
  const [stock, setStock] = useState({ stockQty: 0, soldQty: 0, avlQty: 0 });

  const load = useCallback(async () => {
    const [k, r, a, st] = await Promise.all([getKpis(), recentInvoices(5), getAging(), getStockTotals()]);
    setKpis(k); setRecent(r); setAging(a.slice(0, 10)); setStock(st);
  }, []);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  // Row 1: billing (this FY). Row 2: stock across the whole catalog, all time,
  // using the same Stock / Sold / Avl figures as the Products screen.
  const qty = (n: number) => String(Math.round(n));
  const rows: Kpi[][] = [
    [
      { label: 'Invoices (FY)', value: String(kpis.invoiceCount), icon: 'document-text-outline' },
      { label: 'Total billed', value: `₹${formatPaise(kpis.billedPaise)}`, icon: 'trending-up-outline' },
    ],
    [
      { label: 'Products Sold', value: qty(stock.soldQty), icon: 'cart-outline' },
      { label: 'Balance Stock', value: qty(stock.avlQty), icon: 'cube-outline' },
      { label: 'Actual Stock', value: qty(stock.stockQty), icon: 'layers-outline' },
    ],
  ];

  return (
    <View style={{ flex: 1 }}>
      <TopAppBar title="Dashboard" subtitle={fyLabel()} theme={theme} large />
      <ScrollView
        contentContainerStyle={{
          padding: bp.margin, paddingBottom: 96,
          maxWidth: Math.max(maxReadWidth, bp.width * 0.9), flexGrow: 1,
        }}
      >
        <View style={{ margin: -space[1] }}>
          {rows.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row' }}>
              {row.map(c => (
                <View key={c.label} style={{ width: `${100 / row.length}%`, padding: space[1] }}>
                  <KpiTile kpi={c} compact={bp.isPhone && row.length > 2} theme={theme} />
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={{
          flexDirection: bp.atLeast('lg') ? 'row' : 'column',
          marginTop: space[5], gap: space[5],
        }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SectionTitle title="Recent invoices" theme={theme}
              right={recent.length > 0
                ? <Button label="See all" variant="ghost" theme={theme} onPress={() => nav.goTab('invoices')} />
                : undefined} />
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {recent.length === 0
                ? (
                  <EmptyState
                    icon="receipt-outline" title="No invoices yet"
                    text="Create your first invoice to see it here." theme={theme}
                  />
                )
                : recent.map((inv, i) => (
                  <ListItem
                    key={inv.id}
                    theme={theme}
                    divider={i < recent.length - 1}
                    title={inv.party_name || '(no party)'}
                    subtitle={`${inv.invoice_no} · ${formatDateDisplay(inv.invoice_date)}`}
                    onPress={() => nav.showInvoice(inv.id, bp.isPhone)}
                    trailing={(
                      <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                        <MoneyText paiseText={`₹${formatPaise(inv.total_paise)}`} theme={theme} small />
                        <StatusGlyph status={inv.status} theme={theme} />
                      </View>
                    )}
                  />
                ))}
            </Card>
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <SectionTitle title="Outstanding (aging)" theme={theme} />
            <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
              {aging.length === 0
                ? <EmptyState icon="checkmark-done-outline" title="All settled" text="Nothing outstanding." theme={theme} />
                : aging.map((a, i) => (
                  <ListItem
                    key={a.invoice_id}
                    theme={theme}
                    divider={i < aging.length - 1}
                    title={a.party_name || '(no party)'}
                    subtitle={`${a.invoice_no} · due ${formatDateDisplay(a.due_date)}`}
                    onPress={() => nav.showInvoice(a.invoice_id, bp.isPhone)}
                    trailing={<MoneyText paiseText={`₹${formatPaise(a.total_paise - a.paid_paise)}`} theme={theme} small />}
                  />
                ))}
            </Card>
          </View>
        </View>
      </ScrollView>
      {bp.isPhone ? <FAB icon="add" label="New invoice" onPress={() => nav.openCreate()} theme={theme} /> : null}
    </View>
  );
}
