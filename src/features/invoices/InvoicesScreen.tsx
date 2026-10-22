import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Chip, EmptyState, FAB, Input, ListItem, MoneyText, SearchField, StatusGlyph, TopAppBar,
} from '../../ui/components';
import { alert } from '../../ui/alert';
import { space, type } from '../../ui/tokens';
import { formatPaise, formatDateDisplay } from '../../data/money';
import { listInvoices } from '../../data/invoicesRepo';
import { exportInvoicesXlsx, exportConsolidatedRegister } from '../../export/xlsx';
import { shareFile } from '../../export/pdf';
import { InvoiceDetail } from './InvoiceDetail';
import type { Invoice, InvoiceStatus } from '../../data/types';

const STATUSES: Array<InvoiceStatus | 'all'> = ['all', 'issued', 'partial', 'paid', 'void'];

export function InvoicesScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatusF] = useState<InvoiceStatus | 'all'>('all');
  const [dateOpen, setDateOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<'list' | 'register' | null>(null);

  const load = useCallback(async () => {
    setRows(await listInvoices({
      search: search.trim(), status: status === 'all' ? undefined : status,
      from: from || undefined, to: to || undefined, limit: 500,
    }));
  }, [search, status, from, to]);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  const runExport = (kind: 'list' | 'register') => {
    setBusy(kind);
    const job = kind === 'list' ? exportInvoicesXlsx(rows) : exportConsolidatedRegister();
    void job.then(f => shareFile(f.uri))
      .catch(e => alert('Export failed', e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };

  const selected = rows.find(r => r.id === nav.selectedInvoiceId) ?? null;
  const filtered = status !== 'all' || !!search || !!from || !!to;

  const listPane = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
        <SearchField value={search} onChange={setSearch} placeholder="Search invoice no or party" theme={theme} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space[1] }}>
          <View style={{ flexDirection: 'row' }}>
            {STATUSES.map(s => (
              <Chip key={s} label={s === 'all' ? 'All' : s[0]!.toUpperCase() + s.slice(1)}
                active={status === s} onPress={() => setStatusF(s)} theme={theme} />
            ))}
            <Chip label={from || to ? 'Dates set' : 'Date range'} icon="calendar-outline"
              active={dateOpen || !!from || !!to} onPress={() => setDateOpen(o => !o)} theme={theme} />
          </View>
        </ScrollView>
        {dateOpen ? (
          <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[2] }}>
            <View style={{ flex: 1 }}>
              <Input label="From" value={from} onChange={setFrom} placeholder="YYYY-MM-DD"
                theme={theme} tabular keyboardType="numeric" maxLength={10} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="To" value={to} onChange={setTo} placeholder="YYYY-MM-DD"
                theme={theme} tabular keyboardType="numeric" maxLength={10} />
            </View>
          </View>
        ) : null}
        <Text style={[type.labelMedium, { color: theme.textMuted, paddingVertical: space[2] }]}>
          {rows.length} {rows.length === 1 ? 'invoice' : 'invoices'}
        </Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => String(r.id)}
        contentContainerStyle={{ paddingBottom: 96 }}
        ListEmptyComponent={filtered
          ? <EmptyState icon="search-outline" title="No matches" text="Try a different search or clear the filters." theme={theme} />
          : <EmptyState icon="receipt-outline" title="No invoices yet" text="Tap New invoice to create the first one." theme={theme} />}
        renderItem={({ item }) => (
          <ListItem
            theme={theme}
            selected={!bp.isPhone && item.id === nav.selectedInvoiceId}
            title={item.party_name || '(no party)'}
            subtitle={`${item.invoice_no} · ${formatDateDisplay(item.invoice_date)}`}
            onPress={() => bp.isPhone ? nav.showInvoice(item.id, true) : nav.selectInvoice(item.id)}
            trailing={(
              <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                <MoneyText paiseText={`₹${formatPaise(item.total_paise)}`} theme={theme} small />
                <StatusGlyph status={item.status} theme={theme} />
              </View>
            )}
          />
        )}
      />
      {bp.isPhone ? <FAB icon="add" label="New invoice" onPress={() => nav.openCreate()} theme={theme} /> : null}
    </View>
  );

  const appBar = (
    <TopAppBar
      title="Invoices"
      theme={theme}
      actions={[
        { icon: 'download-outline', label: 'Export list to Excel', onPress: () => runExport('list'), busy: busy === 'list' },
        { icon: 'albums-outline', label: 'Export consolidated register', onPress: () => runExport('register'), busy: busy === 'register' },
      ]}
    />
  );

  if (bp.isPhone) return <View style={{ flex: 1 }}>{appBar}{listPane}</View>;

  return (
    <View style={{ flex: 1 }}>
      {appBar}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {listPane}
        <View
          style={{
            width: bp.panes === 3 ? '42%' : '50%',
            borderLeftWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          }}
        >
          {selected
            ? <InvoiceDetail key={selected.id} invoiceId={selected.id} />
            : <EmptyState icon="document-text-outline" title="No invoice selected" text="Pick an invoice from the list to see it here." theme={theme} />}
        </View>
        {bp.panes === 3 && selected ? (
          <View style={{ width: '26%', borderLeftWidth: 1, borderColor: theme.border, padding: space[4] }}>
            <Text style={[type.labelMedium, { color: theme.textMuted, marginBottom: space[2] }]}>ACTIVITY</Text>
            <Text style={[type.body, { color: theme.text }]}>
              {selected.invoice_no} · {selected.status}
            </Text>
            <Text style={[type.caption, { color: theme.textMuted, marginTop: space[1] }]}>
              Issued {formatDateDisplay(selected.invoice_date)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
