import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { useNavInset } from '../../ui/navMetrics';
import {
  Card, EmptyState, FAB, IconButton, Input, ListItem, MoneyText, SearchField, SegmentedControl, StatusGlyph,
  TopAppBar, initials,
} from '../../ui/components';
import { alert } from '../../ui/alert';
import { layout, space, type } from '../../ui/tokens';
import { formatPaise, formatDateDisplay } from '../../data/money';
import { listInvoices } from '../../data/invoicesRepo';
import { exportInvoicesXlsx, exportConsolidatedRegister } from '../../export/xlsx';
import { shareFile } from '../../export/pdf';
import { InvoiceDetail } from './InvoiceDetail';
import type { Invoice, InvoiceStatus } from '../../data/types';

const STATUSES: ReadonlyArray<{ value: InvoiceStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'issued', label: 'Issued' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

export function InvoicesScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const navInset = useNavInset();
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
  const datesSet = !!from || !!to;

  const listPane = (
    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: layout.side, gap: layout.gap }}>
      <View style={{ flexDirection: 'row', gap: 10, paddingTop: space[1] }}>
        <SearchField value={search} onChange={setSearch} placeholder="Search invoice no or party" theme={theme} style={{ flex: 1 }} />
        <IconButton glass icon="calendar" label={datesSet ? 'Date range (set)' : 'Date range'}
          selected={dateOpen || datesSet} color={datesSet ? theme.accent : undefined}
          onPress={() => setDateOpen(o => !o)} theme={theme} />
      </View>
      <SegmentedControl label="Status" options={STATUSES} value={status} onChange={setStatusF} theme={theme} />
      {dateOpen ? (
        <View style={{ flexDirection: 'row', gap: layout.grid, marginBottom: -space[4] }}>
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
      <Card theme={theme} list style={{ flexShrink: 1, marginBottom: navInset, overflow: 'hidden' }}>
        <FlatList
          data={rows}
          keyExtractor={r => String(r.id)}
          style={{ flexGrow: 0 }}
          // Phones, long lists: keep the last row clear of the New invoice button.
          contentContainerStyle={{ paddingBottom: bp.isPhone && rows.length > 6 ? 52 + layout.gap : 0 }}
          ListEmptyComponent={filtered
            ? <EmptyState icon="search" title="No matches" text="Try a different search or clear the filters." theme={theme} />
            : <EmptyState icon="file-text" title="No invoices yet" text="Tap New invoice to create the first one." theme={theme} />}
          renderItem={({ item, index }) => (
            <ListItem
              theme={theme}
              flush
              leadingText={initials(item.party_name)}
              leadingAlt={index % 2 === 1}
              divider={index < rows.length - 1}
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
      </Card>
      {bp.isPhone ? <FAB icon="plus" label="New invoice" onPress={() => nav.openCreate()} theme={theme} /> : null}
    </View>
  );

  const appBar = (
    <TopAppBar
      title="Invoices"
      subtitle={`${rows.length} ${rows.length === 1 ? 'invoice' : 'invoices'}`}
      theme={theme}
      large
      actions={[
        { icon: 'download', label: 'Export list to Excel', onPress: () => runExport('list'), busy: busy === 'list' },
        { icon: 'book', label: 'Export consolidated register', onPress: () => runExport('register'), busy: busy === 'register' },
      ]}
    />
  );

  if (bp.isPhone) return <View style={{ flex: 1 }}>{appBar}{listPane}</View>;

  return (
    <View style={{ flex: 1 }}>
      {appBar}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {listPane}
        <View style={{ width: bp.panes === 3 ? '42%' : '50%', borderLeftWidth: 1, borderColor: theme.divider }}>
          {selected
            ? <InvoiceDetail key={selected.id} invoiceId={selected.id} />
            : <EmptyState icon="file-text" title="No invoice selected" text="Pick an invoice from the list to see it here." theme={theme} />}
        </View>
        {bp.panes === 3 && selected ? (
          <View style={{ width: '26%', borderLeftWidth: 1, borderColor: theme.divider, padding: layout.side }}>
            <Card theme={theme} small style={{ gap: space[1] }}>
              <Text style={[type.overline, { color: theme.textMuted, marginBottom: space[1] }]}>Activity</Text>
              <Text style={[type.label, { color: theme.text }]}>
                {selected.invoice_no} · {selected.status}
              </Text>
              <Text style={[type.caption, { color: theme.textMuted }]}>
                Issued {formatDateDisplay(selected.invoice_date)}
              </Text>
            </Card>
          </View>
        ) : null}
      </View>
    </View>
  );
}
