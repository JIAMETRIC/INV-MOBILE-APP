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
import type { AgingRow, Invoice } from '../../data/types';

function fyLabel(d = new Date()): string {
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${start}–${String((start + 1) % 100).padStart(2, '0')} overview`;
}

export function DashboardScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const [kpis, setKpis] = useState({ invoiceCount: 0, billedPaise: 0 });
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [aging, setAging] = useState<AgingRow[]>([]);

  const load = useCallback(async () => {
    const [k, r, a] = await Promise.all([getKpis(), recentInvoices(5), getAging()]);
    setKpis(k); setRecent(r); setAging(a.slice(0, 10));
  }, []);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  const outstandingPaise = aging.reduce((s, a) => s + (a.total_paise - a.paid_paise), 0);
  const cards: Array<{ label: string; value: string; icon: IconName }> = [
    { label: 'Invoices (FY)', value: String(kpis.invoiceCount), icon: 'document-text-outline' },
    { label: 'Total billed', value: `₹${formatPaise(kpis.billedPaise)}`, icon: 'trending-up-outline' },
    { label: 'Outstanding', value: `₹${formatPaise(outstandingPaise)}`, icon: 'hourglass-outline' },
    { label: 'Open invoices', value: String(aging.length), icon: 'alert-circle-outline' },
  ];
  const perRow = bp.isPhone ? 2 : 4;

  return (
    <View style={{ flex: 1 }}>
      <TopAppBar title="Dashboard" subtitle={fyLabel()} theme={theme} large />
      <ScrollView
        contentContainerStyle={{
          padding: bp.margin, paddingBottom: 96,
          maxWidth: Math.max(maxReadWidth, bp.width * 0.9), flexGrow: 1,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -space[1] }}>
          {cards.map(c => (
            <View key={c.label} style={{ width: `${100 / perRow}%`, padding: space[1] }}>
              <Card theme={theme} variant="filled" style={{ minHeight: 104, gap: space[2] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Ionicons name={c.icon} size={18} color={theme.accent} />
                  <Text style={[type.labelMedium, { color: theme.textMuted, flex: 1 }]} numberOfLines={1}>{c.label}</Text>
                </View>
                <Text
                  style={[type.title, { color: theme.text, fontVariant: ['tabular-nums'] }]}
                  numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}
                >
                  {c.value}
                </Text>
              </Card>
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
