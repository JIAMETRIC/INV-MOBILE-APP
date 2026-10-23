// S1 — Dashboard. Read top to bottom:
//   STOCK_TILES, S1       the text and the numbers you are most likely to edit
//   fyLabel()             "FY 2026–27 overview"
//   useDashboard()        all state and data (no JSX)
//   DashboardScreen()     the screen, built on <Screen>
//   Header … StatTile     one function per region, in the order they appear on screen
// IDs (S1.0 …) are from SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { Screen, useMainInset } from '../../ui/Screen';
import {
  Badge, Card, FAB, IconChip, TopAppBar, type IconName,
} from '../../ui/components';
import { font, layout, space, type, maxReadWidth } from '../../ui/tokens';
import { formatPaise } from '../../data/money';
import { getKpis } from '../../data/dashboardRepo';
import { getStockTotals } from '../../data/productsRepo';
import type { Theme } from '../../ui/tokens';

// S1.2 — the three stock tiles, in order: label · icon · which stock figure.
// Sold = Σ qty on product-linked lines of non-void invoices; Actual = Σ stock_qty;
// Balance = Actual − Sold: the same Stock / Sold / Avl figures as the Products screen.
const STOCK_TILES: ReadonlyArray<{ label: string; icon: IconName; key: 'soldQty' | 'avlQty' | 'stockQty' }> = [
  { label: 'Products Sold', icon: 'shopping-cart', key: 'soldQty' },
  { label: 'Balance Stock', icon: 'box', key: 'avlQty' },
  { label: 'Actual Stock', icon: 'layers', key: 'stockQty' },
];

// Every number that is specific to this screen. Shared spacing comes from
// tokens.ts (layout.side 20, layout.gap 16, layout.grid 12).
const S1 = {
  heroPadding: 20, // S1.1: the kit's hero card padding
  heroGap: 6, // S1.1: between the overline row and the figure
  tileGap: 10, // S1.2: inside a stat tile (chip · label · value)
  tileLabelHeight: 36, // S1.2: two-line label floor, so the three values line up
  figureMinScale: 0.6, // S1.1 / S1.2: how far a figure may shrink to fit on one line
  readShare: 0.9, // the scroll content's max width: max(720, 90 % of the window)
} as const;

type Kpi = { label: string; value: string; icon: IconName };

function fyLabel(d = new Date()): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${start}–${String((start + 1) % 100).padStart(2, '0')} overview`;
}

// ---------------------------------------------------------------------------
// State and data: the FY figures and the stock totals, reloaded on every refresh.
// ---------------------------------------------------------------------------
function useDashboard() {
  const nav = useNav();
  const [kpis, setKpis] = useState({ invoiceCount: 0, billedPaise: 0 });
  const [stock, setStock] = useState({ stockQty: 0, soldQty: 0, avlQty: 0 });

  const load = useCallback(async () => {
    const [k, st] = await Promise.all([getKpis(), getStockTotals()]);
    setKpis(k); setStock(st);
  }, []);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  const tiles: Kpi[] = STOCK_TILES.map(t => ({ label: t.label, icon: t.icon, value: String(Math.round(stock[t.key])) }));
  return { kpis, tiles };
}
type Dashboard = ReturnType<typeof useDashboard>;

// ---------------------------------------------------------------------------
// The screen: header + the scrolling body; the FAB floats on phones (S1.5).
// ---------------------------------------------------------------------------
export function DashboardScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const d = useDashboard();
  return (
    <Screen
      header={<Header theme={theme} />}
      fab={bp.isPhone ? <FAB icon="plus" label="New invoice" onPress={() => nav.openCreate()} theme={theme} /> : null}
    >
      <DashboardMain d={d} theme={theme} />
    </Screen>
  );
}

// S1.0 — "FY 2026–27 overview" caption above the "Dashboard" title.
function Header({ theme }: { theme: Theme }) {
  return <TopAppBar title="Dashboard" subtitle={fyLabel()} theme={theme} large />;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// S1.1 + S1.2 — the one scroller: the hero card, then the row of three stat tiles.
function DashboardMain({ d, theme }: { d: Dashboard; theme: Theme }) {
  const bp = useBreakpoint();
  const bottomInset = useMainInset();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: layout.side, paddingTop: space[1], paddingBottom: bottomInset, gap: layout.gap,
        maxWidth: Math.max(maxReadWidth, bp.width * S1.readShare), flexGrow: 1,
      }}
    >
      <HeroCard d={d} theme={theme} />
      <StatTilesRow d={d} theme={theme} />
    </ScrollView>
  );
}

// S1.1 — kit "Revenue" card: overline "Total billed · FY" + "N invoices" badge, then the ₹ hero figure.
function HeroCard({ d, theme }: { d: Dashboard; theme: Theme }) {
  const { kpis } = d;
  return (
    <Card theme={theme} style={{ padding: S1.heroPadding, gap: S1.heroGap }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[type.overline, { color: theme.textMuted }]}>Total billed · FY</Text>
        <Badge
          label={`${kpis.invoiceCount} ${kpis.invoiceCount === 1 ? 'invoice' : 'invoices'}`}
          tone="info" theme={theme}
        />
      </View>
      <Text style={[type.hero, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={S1.figureMinScale}>
        ₹{formatPaise(kpis.billedPaise)}
      </Text>
    </Card>
  );
}

// S1.2 — one row, three equal columns (never stacks: the kit's 3-across tiles; labels wrap to 2 lines).
function StatTilesRow({ d, theme }: { d: Dashboard; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', gap: layout.grid }}>
      {d.tiles.map(k => (
        <View key={k.label} style={{ flex: 1, minWidth: 0 }}>
          <StatTile kpi={k} theme={theme} />
        </View>
      ))}
    </View>
  );
}

// S1.2 tile — kit stat tile: small glass card, padding 16: icon chip · 13 label (2 lines) · KPI value.
function StatTile({ kpi, theme }: { kpi: Kpi; theme: Theme }) {
  return (
    <Card theme={theme} small style={{ flexGrow: 1, gap: S1.tileGap }}>
      <IconChip icon={kpi.icon} theme={theme} />
      <Text style={[type.labelMedium, { fontFamily: font.regular, color: theme.textMuted, minHeight: S1.tileLabelHeight }]} numberOfLines={2}>
        {kpi.label}
      </Text>
      <Text style={[type.figure, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={S1.figureMinScale}>
        {kpi.value}
      </Text>
    </Card>
  );
}
