import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { useContentInset } from '../../ui/navMetrics';
import {
  Badge, Button, Card, EmptyState, FAB, IconChip, ListItem, MoneyText, SectionTitle, StatusGlyph, TopAppBar,
  initials, type IconName,
} from '../../ui/components';
import { font, layout, space, type, maxReadWidth } from '../../ui/tokens';
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

// Kit stat tile: small glass card, padding 16, gap 10: icon chip, 13 label, KPI value.
function StatTile({ kpi, theme }: { kpi: Kpi; theme: Theme }) {
  return (
    <Card theme={theme} small style={{ flexGrow: 1, gap: 10 }}>
      <IconChip icon={kpi.icon} theme={theme} />
      <Text style={[type.labelMedium, { fontFamily: font.regular, color: theme.textMuted, minHeight: 36 }]} numberOfLines={2}>
        {kpi.label}
      </Text>
      <Text style={[type.figure, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {kpi.value}
      </Text>
    </Card>
  );
}

export function DashboardScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const bottomInset = useContentInset(bp.isPhone);
  const [kpis, setKpis] = useState({ invoiceCount: 0, billedPaise: 0 });
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [aging, setAging] = useState<AgingRow[]>([]);
  const [stock, setStock] = useState({ stockQty: 0, soldQty: 0, avlQty: 0 });

  const load = useCallback(async () => {
    const [k, r, a, st] = await Promise.all([getKpis(), recentInvoices(5), getAging(), getStockTotals()]);
    setKpis(k); setRecent(r); setAging(a.slice(0, 10)); setStock(st);
  }, []);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  // Stock across the whole catalog, all time, using the same Stock / Sold / Avl
  // figures as the Products screen.
  const qty = (n: number) => String(Math.round(n));
  const stockTiles: Kpi[] = [
    { label: 'Products Sold', value: qty(stock.soldQty), icon: 'shopping-cart' },
    { label: 'Balance Stock', value: qty(stock.avlQty), icon: 'box' },
    { label: 'Actual Stock', value: qty(stock.stockQty), icon: 'layers' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <TopAppBar title="Dashboard" subtitle={fyLabel()} theme={theme} large />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.side, paddingTop: space[1], paddingBottom: bottomInset, gap: layout.gap,
          maxWidth: Math.max(maxReadWidth, bp.width * 0.9), flexGrow: 1,
        }}
      >
        {/* Kit revenue card: overline + badge, then the hero figure. */}
        <Card theme={theme} style={{ padding: 20, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[type.overline, { color: theme.textMuted }]}>Total billed · FY</Text>
            <Badge
              label={`${kpis.invoiceCount} ${kpis.invoiceCount === 1 ? 'invoice' : 'invoices'}`}
              tone="info" theme={theme}
            />
          </View>
          <Text style={[type.hero, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            ₹{formatPaise(kpis.billedPaise)}
          </Text>
        </Card>

        <View style={{ flexDirection: 'row', gap: layout.grid }}>
          {stockTiles.map(k => (
            <View key={k.label} style={{ flex: 1, minWidth: 0 }}>
              <StatTile kpi={k} theme={theme} />
            </View>
          ))}
        </View>

        <View style={{ flexDirection: bp.atLeast('lg') ? 'row' : 'column', gap: layout.gap }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <SectionTitle title="Recent invoices" theme={theme}
              right={recent.length > 0
                ? <Button label="See all" variant="ghost" theme={theme} onPress={() => nav.goTab('invoices')} />
                : undefined} />
            <Card theme={theme} list>
              {recent.length === 0
                ? (
                  <EmptyState
                    icon="file-text" title="No invoices yet"
                    text="Create your first invoice to see it here." theme={theme}
                  />
                )
                : recent.map((inv, i) => (
                  <ListItem
                    key={inv.id}
                    theme={theme}
                    flush
                    leadingText={initials(inv.party_name)}
                    leadingAlt={i % 2 === 1}
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
            <Card theme={theme} list>
              {aging.length === 0
                ? <EmptyState icon="check-circle" title="All settled" text="Nothing outstanding." theme={theme} />
                : aging.map((a, i) => (
                  <ListItem
                    key={a.invoice_id}
                    theme={theme}
                    flush
                    leadingText={initials(a.party_name)}
                    leadingAlt={i % 2 === 1}
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
      {bp.isPhone ? <FAB icon="plus" label="New invoice" onPress={() => nav.openCreate()} theme={theme} /> : null}
    </View>
  );
}
