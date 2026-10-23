// S2 — Invoices list. Read top to bottom:
//   STATUSES, S2        the text and the numbers you are most likely to edit
//   useInvoiceList()    all state and data (no JSX)
//   InvoicesScreen()    the phone / tablet switch
//   Header … ActivityPane   one function per region, in the order they appear on screen
// IDs (S2.0 …) are from SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md.
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { useNavInset } from '../../ui/navMetrics';
import { Columns } from '../../ui/Columns';
import {
  Card, EmptyState, FAB, IconButton, Input, ListItem, MoneyText, SearchField, SegmentedControl, StatusGlyph,
  TopAppBar, initials,
} from '../../ui/components';
import { alert } from '../../ui/alert';
import { layout, space, touch, type } from '../../ui/tokens';
import type { Theme } from '../../ui/tokens';
import { formatPaise, formatDateDisplay } from '../../data/money';
import { listInvoices } from '../../data/invoicesRepo';
import { exportInvoicesXlsx, exportConsolidatedRegister } from '../../export/xlsx';
import { shareFile } from '../../export/pdf';
import { InvoiceDetail } from './InvoiceDetail';
import type { Invoice, InvoiceStatus } from '../../data/types';

type StatusFilter = InvoiceStatus | 'all';

// S2.2 — the status tabs, in order.
const STATUSES: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'issued', label: 'Issued' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Void' },
];

// Every number that is specific to this screen. Shared spacing comes from
// tokens.ts (layout.side 20, layout.gap 16, layout.grid 12).
const S2 = {
  filterGap: 10, // S2.1: between the search field and the calendar button
  dateRowPull: -space[4], // S2.3a: pulls the list card up under the date inputs' bottom gap
  longList: 6, // S2.5: more rows than this on a phone -> keep the last one clear of the FAB
  fabClearance: touch.button + layout.gap, // S2.5: that clearance (52 + 16)
  detailWidth: { 2: '50%', 3: '42%' } as const, // S2.7: detail pane width by pane count
  activityWidth: '26%', // S2.8: activity pane width
  activityFrom: 'xxl' as const, // S2.8: shown from this breakpoint; at xl (961 dp) three panes squeezed the list
} as const;

// ---------------------------------------------------------------------------
// State and data: filters, the rows they produce, the two exports.
// ---------------------------------------------------------------------------
function useInvoiceList() {
  const nav = useNav();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
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

  return {
    rows,
    search, setSearch,
    status, setStatus,
    dateOpen, toggleDates: () => setDateOpen(o => !o),
    from, setFrom, to, setTo,
    datesSet: !!from || !!to,
    filtered: status !== 'all' || !!search || !!from || !!to,
    selected: rows.find(r => r.id === nav.selectedInvoiceId) ?? null,
    busy, runExport,
  };
}
type InvoiceList = ReturnType<typeof useInvoiceList>;

// ---------------------------------------------------------------------------
// The screen: phone = header + list; tablet = header + [list | detail | activity].
// ---------------------------------------------------------------------------
export function InvoicesScreen() {
  const theme = useTheme();
  const bp = useBreakpoint();
  const list = useInvoiceList();

  // S2.8 needs the width of xxl; with it the list at xl was ≈ 280 dp.
  const showActivity = bp.atLeast(S2.activityFrom) && list.selected !== null;

  // One pane: phones, and md tablets (rail, no panes); a tap opens S3 as an overlay.
  if (bp.panes === 1) {
    return (
      <View style={{ flex: 1 }}>
        <Header list={list} theme={theme} />
        <ListPane list={list} theme={theme} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header list={list} theme={theme} />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <ListPane list={list} theme={theme} />
        <DetailPane selected={list.selected} width={S2.detailWidth[showActivity ? 3 : 2]} theme={theme} />
        {showActivity && list.selected ? <ActivityPane selected={list.selected} theme={theme} /> : null}
      </View>
    </View>
  );
}

// S2.0 — title, "N invoices", and the two Excel export buttons.
function Header({ list, theme }: { list: InvoiceList; theme: Theme }) {
  const n = list.rows.length;
  return (
    <TopAppBar
      title="Invoices"
      subtitle={`${n} ${n === 1 ? 'invoice' : 'invoices'}`}
      theme={theme}
      large
      actions={[
        { icon: 'download', label: 'Export list to Excel', onPress: () => list.runExport('list'), busy: list.busy === 'list' },
        { icon: 'book', label: 'Export consolidated register', onPress: () => list.runExport('register'), busy: list.busy === 'register' },
      ]}
    />
  );
}

// S2.1–S2.6 — the column under the header: filters, then the list card, then the FAB.
function ListPane({ list, theme }: { list: InvoiceList; theme: Theme }) {
  const nav = useNav();
  const bp = useBreakpoint();
  const navInset = useNavInset();
  return (
    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: layout.side, gap: layout.gap }}>
      <FilterRow list={list} theme={theme} />
      <SegmentedControl label="Status" options={STATUSES} value={list.status} onChange={list.setStatus} theme={theme} />
      {list.dateOpen ? <DateRangeRow list={list} theme={theme} /> : null}
      <InvoiceListCard list={list} theme={theme} navInset={navInset} />
      {bp.isPhone ? <FAB icon="plus" label="New invoice" onPress={() => nav.openCreate()} theme={theme} /> : null}
    </View>
  );
}

// S2.1 + S2.3 — one row: search field (grows) | calendar button (44).
function FilterRow({ list, theme }: { list: InvoiceList; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', gap: S2.filterGap, paddingTop: space[1] }}>
      <SearchField value={list.search} onChange={list.setSearch} placeholder="Search invoice no or party" theme={theme} style={{ flex: 1 }} />
      <IconButton glass icon="calendar" label={list.datesSet ? 'Date range (set)' : 'Date range'}
        selected={list.dateOpen || list.datesSet} color={list.datesSet ? theme.accent : undefined}
        onPress={list.toggleDates} theme={theme} />
    </View>
  );
}

// S2.3a — one row, two equal columns: From | To (YYYY-MM-DD). Shown while the calendar button is on.
// Columns stacks them only if a cell would fall under 44 wide (never at phone widths).
function DateRangeRow({ list, theme }: { list: InvoiceList; theme: Theme }) {
  return (
    <Columns kind="input" style={{ marginBottom: S2.dateRowPull }}>
      <Input label="From" value={list.from} onChange={list.setFrom} placeholder="YYYY-MM-DD"
        theme={theme} tabular keyboardType="numeric" maxLength={10} />
      <Input label="To" value={list.to} onChange={list.setTo} placeholder="YYYY-MM-DD"
        theme={theme} tabular keyboardType="numeric" maxLength={10} />
    </Columns>
  );
}

// S2.5 — the glass card holding the scrolling list, or an empty state.
// It hugs its rows (flexShrink on the card, flexGrow 0 on the list) and stops above the nav.
function InvoiceListCard({ list, theme, navInset }: { list: InvoiceList; theme: Theme; navInset: number }) {
  const nav = useNav();
  const bp = useBreakpoint();
  const { rows } = list;
  // Stable, so the memoised rows don't re-render on every keystroke in the search box.
  const single = bp.panes === 1;
  const onPressRow = useCallback(
    (id: number) => single ? nav.showInvoice(id, true) : nav.selectInvoice(id),
    [single, nav],
  );
  return (
    <Card theme={theme} list style={{ flexShrink: 1, marginBottom: navInset, overflow: 'hidden' }}>
      <FlatList
        data={rows}
        keyExtractor={r => String(r.id)}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingBottom: bp.isPhone && rows.length > S2.longList ? S2.fabClearance : 0 }}
        ListEmptyComponent={list.filtered
          ? <EmptyState icon="search" title="No matches" text="Try a different search or clear the filters." theme={theme} />
          : <EmptyState icon="file-text" title="No invoices yet" text="Tap New invoice to create the first one." theme={theme} />}
        renderItem={({ item, index }) => (
          <InvoiceRow
            item={item}
            alt={index % 2 === 1}
            last={index === rows.length - 1}
            selected={!single && item.id === nav.selectedInvoiceId}
            onPress={onPressRow}
            theme={theme}
          />
        )}
      />
    </Card>
  );
}

// S2.5 row — avatar (initials) · party name · "invoice no · date" · ₹ total over the status pill.
// Memoised: a row re-renders only when its own props change (rule 5).
const InvoiceRow = React.memo(function InvoiceRow({ item, alt, last, selected, onPress, theme }: {
  item: Invoice; alt: boolean; last: boolean; selected: boolean; onPress: (id: number) => void; theme: Theme;
}) {
  return (
    <ListItem
      theme={theme}
      flush
      leadingText={initials(item.party_name)}
      leadingAlt={alt}
      divider={!last}
      selected={selected}
      title={item.party_name || '(no party)'}
      subtitle={`${item.invoice_no} · ${formatDateDisplay(item.invoice_date)}`}
      onPress={() => onPress(item.id)}
      trailing={(
        <View style={{ alignItems: 'flex-end', gap: space[1] }}>
          <MoneyText paiseText={`₹${formatPaise(item.total_paise)}`} theme={theme} small />
          <StatusGlyph status={item.status} theme={theme} />
        </View>
      )}
    />
  );
});

// S2.7 — tablet only: the selected invoice (S3) or a placeholder, behind a left divider.
function DetailPane({ selected, width, theme }: { selected: Invoice | null; width: string; theme: Theme }) {
  return (
    <View style={{ width, borderLeftWidth: 1, borderColor: theme.divider }}>
      {selected
        ? <InvoiceDetail key={selected.id} invoiceId={selected.id} />
        : <EmptyState icon="file-text" title="No invoice selected" text="Pick an invoice from the list to see it here." theme={theme} />}
    </View>
  );
}

// S2.8 — 3-pane tablets only: a small card with the selected invoice's number, status and issue date.
function ActivityPane({ selected, theme }: { selected: Invoice; theme: Theme }) {
  return (
    <View style={{ width: S2.activityWidth, borderLeftWidth: 1, borderColor: theme.divider, padding: layout.side }}>
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
  );
}
