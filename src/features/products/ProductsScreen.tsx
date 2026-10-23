// S5 — Products. Read top to bottom:
//   SIZES, QUICK_PICKS, S5   the text and the numbers you are most likely to edit
//   blank, num, AvlBadge     small helpers
//   useProducts()            all state, data and actions (no JSX)
//   ProductsScreen()         the phone / tablet switch, built on <Screen>
//   Header … StockHistory    one function per region, in the order they appear on screen
//   EditorSheet              P3
// IDs (S5.0, S5.6.4 …) are from SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md.
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { alert } from '../../ui/alert';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Badge, Button, Card, Chip, EmptyState, FAB, Input, ListItem, ListRow, MoneyInput, SearchField, SectionTitle, TopAppBar,
} from '../../ui/components';
import { useNavInset } from '../../ui/navMetrics';
import { Screen, useFabClearance } from '../../ui/Screen';
import { Columns } from '../../ui/Columns';
import { Sheet } from '../../ui/Sheet';
import { useSnackbar } from '../../ui/Snackbar';
import { layout, space, type } from '../../ui/tokens';
import type { Theme } from '../../ui/tokens';
import { formatPaise } from '../../data/money';
import { PRODUCT_SIZES, PRODUCT_SEED_NAMES } from '../../data/schema';
import { listProducts, upsertProduct, deleteProduct, restockProduct, listRestocks, type ProductInput } from '../../data/productsRepo';
import { exportProductsXlsx } from '../../export/xlsx';
import { shareFile } from '../../export/pdf';
import { logAudit } from '../../data/auditRepo';
import type { ProductRow, Restock } from '../../data/types';

// S5.6.3 / S5.6.2 — the chip labels (the catalog's sizes and seed names live in schema.ts).
const SIZES = PRODUCT_SIZES;
const QUICK_PICKS = PRODUCT_SEED_NAMES;

// Every number that is specific to this screen. Shared spacing comes from
// tokens.ts (layout.side 20, layout.gap 16, layout.grid 12).
const S5 = {
  // S5.2: the table's columns, in order; NAME takes the rest (flex 3). Shared by the
  // header and the rows so they cannot drift apart.
  columns: [
    { key: 'NAME', width: 0 }, { key: 'SIZE', width: 52 }, { key: 'PRICE', width: 84 },
    { key: 'STOCK', width: 60 }, { key: 'SOLD', width: 56 }, { key: 'AVL', width: 76 },
  ],
  nameFlex: 3, // S5.2: NAME's share of the remaining width
  tableMinWidth: 520, // S5.2: the list pane needs this much for the 6-column table (328 fixed + a readable NAME)
  editorWidth: '38%', // S5.5: lg+ editor pane
  rail: 88, // S0.4.3: the tablet rail, taken off the window width when sizing the panes
  editorPadding: 20, // S5.5 / P3: the editor card's padding
  longList: 6, // S5.3: more rows than this on a phone -> keep the last one clear of the FAB
} as const;

const blank = (): ProductInput => ({ name: '', size: 'S', unit_paise: 0, stock_qty: 0 });

const num = (v: string) => {
  const n = Math.round(Number(v) || 0);
  return Number.isFinite(n) ? String(Math.max(0, n)) : '0';
};

// Available stock: negative = oversold (error), zero = out of stock, positive = in stock.
function AvlBadge({ avl, theme }: { avl: number; theme: Theme }) {
  const n = Math.round(avl);
  return <Badge label={`Avl ${n}`} tone={n < 0 ? 'error' : n === 0 ? 'neutral' : 'success'} theme={theme} />;
}

// ---------------------------------------------------------------------------
// State and data: the list and its search, the editor (draft, mode, errors,
// history, restock fields) and every action (save, delete, restock, export).
// ---------------------------------------------------------------------------
function useProducts() {
  const nav = useNav();
  const bp = useBreakpoint();
  const snack = useSnackbar();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState<number | undefined>(undefined);
  const [draft, setDraft] = useState<ProductInput>(blank);
  const [draftSold, setDraftSold] = useState(0);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'edit' | 'restock'>('edit');
  const [rQty, setRQty] = useState('');
  const [rPricePaise, setRPricePaise] = useState(0);
  const [rNote, setRNote] = useState('');
  const [nameError, setNameError] = useState('');
  const [qtyError, setQtyError] = useState('');
  const [history, setHistory] = useState<Restock[]>([]);

  const load = useCallback(async () => {
    try {
      setProducts(await listProducts(search.trim()));
    } catch (e) {
      console.error('Products load failed:', e);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  const loadHistory = useCallback(async (id: number) => {
    try {
      setHistory(await listRestocks(id));
    } catch (e) {
      console.error('Stock history load failed:', e);
    }
  }, []);

  // Stable, so the memoised rows don't re-render when unrelated state changes.
  const startEdit = useCallback((p?: ProductRow) => {
    setEditId(p?.id);
    setDraft(p ? { name: p.name, size: p.size, unit_paise: p.unit_paise, stock_qty: p.stock_qty } : blank());
    setDraftSold(p?.sold_qty ?? 0);
    setMode('edit');
    setNameError('');
    setHistory([]);
    if (p) void loadHistory(p.id);
    setEditing(true);
  }, [loadHistory]);

  const save = async () => {
    if (!draft.name.trim()) {
      setNameError('Enter a product name.');
      return;
    }
    try {
      const saved = await upsertProduct({ ...draft, name: draft.name.trim() }, editId);
      await logAudit('product.upsert', 'product', saved.id, { name: saved.name, size: saved.size });
      setEditing(false);
      void load();
      snack(`Saved ${saved.name}${saved.size ? ` · ${saved.size}` : ''}`);
    } catch (e) {
      setNameError(`"${draft.name.trim()} · ${draft.size || 'No size'}" already exists.`);
    }
  };

  const remove = () => {
    if (!editId) return;
    const id = editId;
    alert('Delete product?', 'Past invoices keep their lines; only the stock link is removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteProduct(id);
            await logAudit('product.upsert', 'product', id, { deleted: true });
            setEditing(false);
            void load();
            snack('Product deleted');
          })();
        },
      },
    ]);
  };

  const openRestock = () => {
    setRQty(''); setRPricePaise(0); setRNote(''); setQtyError('');
    setMode('restock');
  };

  const applyRestock = async () => {
    if (!editId) return;
    const qty = Math.round(Number(rQty) || 0);
    if (qty <= 0) {
      setQtyError('Enter a quantity greater than 0.');
      return;
    }
    try {
      const after = await restockProduct(editId, qty, rPricePaise, rNote.trim());
      await logAudit('product.restock', 'product', editId, { qty, pricePaise: rPricePaise, note: rNote.trim() });
      if (after) {
        setDraft({ name: after.name, size: after.size, unit_paise: after.unit_paise, stock_qty: after.stock_qty });
        setDraftSold(after.sold_qty);
      }
      setMode('edit');
      void loadHistory(editId);
      void load();
      snack(`Added ${qty} to stock`);
    } catch (e) {
      alert('Restock failed', String(e));
    }
  };

  const exportXlsx = () => {
    setBusy(true);
    void exportProductsXlsx().then(f => shareFile(f.uri))
      .catch(e => alert('Export failed', e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  // S5.2: the 6-column table needs S5.tableMinWidth. At lg the editor pane takes 38 %, so the
  // list pane (62 % minus the rail) is ≈ 410 dp on a 10-inch portrait tablet: phone rows there,
  // the table from xl (and at md, where the list has the full width).
  const listPaneWidth = bp.atLeast('lg') ? (bp.width - S5.rail) * 0.62 : bp.width - S5.rail;
  const showTable = bp.atLeast('md') && listPaneWidth >= S5.tableMinWidth;

  return {
    products, search, setSearch,
    editing, closeEditor: () => setEditing(false), editId, draft, setDraft, draftSold,
    mode, setMode, rQty, setRQty, rPricePaise, setRPricePaise, rNote, setRNote,
    nameError, setNameError, qtyError, setQtyError, history, busy,
    editorTitle: mode === 'restock' ? 'Restock' : editId ? 'Edit product' : 'New product',
    showTable,
    startEdit, save, remove, openRestock, applyRestock, exportXlsx,
  };
}
type Products = ReturnType<typeof useProducts>;

// ---------------------------------------------------------------------------
// The screen: phones and md = header + list, the editor as a sheet (P3);
// lg+ = header + [ list | editor pane 38 % ].
// ---------------------------------------------------------------------------
export function ProductsScreen() {
  const theme = useTheme();
  const bp = useBreakpoint();
  const p = useProducts();
  const sidePane = bp.atLeast('lg');
  // S5.4 — the FAB floats over Main on phones; the list card clears it through useFabClearance().
  const fab = bp.isPhone ? <FAB icon="plus" label="Add product" onPress={() => p.startEdit()} theme={theme} /> : null;
  return (
    <Screen header={<Header p={p} theme={theme} />} fab={fab}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <ListPane p={p} theme={theme} />
        {sidePane ? <EditorPane p={p} theme={theme} /> : <EditorSheet p={p} theme={theme} />}
      </View>
    </Screen>
  );
}

// S5.0 — "N items" · "Products"; glass buttons: New product (tablets, where there is no FAB)
// and Export products to Excel (busy spinner while it runs).
function Header({ p, theme }: { p: Products; theme: Theme }) {
  const bp = useBreakpoint();
  return (
    <TopAppBar
      title="Products"
      subtitle={`${p.products.length} items`}
      theme={theme}
      large
      actions={[
        ...(bp.isPhone ? [] : [{ icon: 'plus' as const, label: 'New product', onPress: () => p.startEdit() }]),
        { icon: 'download', label: 'Export products to Excel', onPress: p.exportXlsx, busy: p.busy },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// S5.1–S5.3 — the column under the header: the search row, then the list card.
function ListPane({ p, theme }: { p: Products; theme: Theme }) {
  const navInset = useNavInset();
  return (
    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: layout.side, gap: layout.gap }}>
      <SearchRow p={p} theme={theme} />
      <ProductListCard products={p.products} search={p.search} showTable={p.showTable}
        onPress={p.startEdit} navInset={navInset} theme={theme} />
    </View>
  );
}

// S5.1 — the search field.
function SearchRow({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <View style={{ paddingTop: space[1] }}>
      <SearchField value={p.search} onChange={p.setSearch} placeholder="Search products" theme={theme} />
    </View>
  );
}

// S5.2 / S5.3 — the glass card that hugs the product rows (table rows when the pane is wide
// enough, phone rows otherwise) and scrolls when full; long lists on phones keep the last row
// clear of the FAB.
function ProductListCard({ products, search, showTable, onPress, navInset, theme }: {
  products: ProductRow[]; search: string; showTable: boolean;
  onPress: (p: ProductRow) => void; navInset: number; theme: Theme;
}) {
  const fabClearance = useFabClearance(); // 0 when no FAB floats (tablets)
  return (
    <Card theme={theme} list style={{ flexShrink: 1, marginBottom: navInset, overflow: 'hidden' }}>
      {showTable ? <TableHeader theme={theme} /> : null}
      <FlatList
        data={products}
        keyExtractor={p => String(p.id)}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingBottom: products.length > S5.longList ? fabClearance : 0 }}
        ListEmptyComponent={search
          ? <EmptyState icon="search" title="No matches" text={`Nothing matches "${search}".`} theme={theme} />
          : <EmptyState icon="tag" title="No products" text="Add your first product to start billing from stock." theme={theme} />}
        renderItem={({ item, index }) => showTable
          ? <ProductTableRow p={item} last={index === products.length - 1} onPress={onPress} theme={theme} />
          : <ProductListRow p={item} alt={index % 2 === 1} last={index === products.length - 1} onPress={onPress} theme={theme} />}
      />
    </Card>
  );
}

// S5.2 — the table's column labels, from S5.columns (SIZE left-aligned, the numbers right-aligned).
function TableHeader({ theme }: { theme: Theme }) {
  return (
    <View style={{
      flexDirection: 'row', paddingVertical: space[3],
      borderBottomWidth: 1, borderColor: theme.divider,
    }}>
      {S5.columns.map(c => (
        <Text key={c.key} style={[type.overline, {
          color: theme.textMuted,
          ...(c.width ? { width: c.width, textAlign: c.key === 'SIZE' ? 'left' : 'right' } : { flex: S5.nameFlex }),
        }]}>{c.key}</Text>
      ))}
    </View>
  );
}

// Column widths by key, for the table rows.
const COL = Object.fromEntries(S5.columns.map(c => [c.key, c.width])) as Record<string, number>;

// S5.2.r — one table row: NAME flex 3 · SIZE · PRICE · STOCK · SOLD · AVL (widths from S5.columns).
// Memoised: typing in the search box re-renders the list, not every row.
const ProductTableRow = React.memo(function ProductTableRow({ p, last, onPress, theme }: {
  p: ProductRow; last: boolean; onPress: (p: ProductRow) => void; theme: Theme;
}) {
  return (
    <ListRow theme={theme} flush divider={!last} onPress={() => onPress(p)}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type.label, { color: theme.text, flex: S5.nameFlex, paddingEnd: space[2] }]} numberOfLines={1}>{p.name}</Text>
        <Text style={[type.number, { color: theme.text, width: COL.SIZE }]}>{p.size || '—'}</Text>
        <Text style={[type.number, { color: theme.text, width: COL.PRICE, textAlign: 'right' }]}>₹{formatPaise(p.unit_paise)}</Text>
        <Text style={[type.number, { color: theme.text, width: COL.STOCK, textAlign: 'right' }]}>{num(String(p.stock_qty))}</Text>
        <Text style={[type.number, { color: theme.textMuted, width: COL.SOLD, textAlign: 'right' }]}>{num(String(p.sold_qty))}</Text>
        <View style={{ width: COL.AVL }}><AvlBadge avl={p.avl_qty} theme={theme} /></View>
      </View>
    </ListRow>
  );
});

// S5.3 — one phone row: size circle · name · "Stock n · Sold n" · price over the Avl badge.
const ProductListRow = React.memo(function ProductListRow({ p, alt, last, onPress, theme }: {
  p: ProductRow; alt: boolean; last: boolean; onPress: (p: ProductRow) => void; theme: Theme;
}) {
  return (
    <ListItem
      theme={theme}
      flush
      divider={!last}
      leadingText={p.size || '—'}
      leadingAlt={alt}
      title={p.name}
      subtitle={`Stock ${num(String(p.stock_qty))} · Sold ${num(String(p.sold_qty))}`}
      onPress={() => onPress(p)}
      trailing={(
        <View style={{ alignItems: 'flex-end', gap: space[1] }}>
          <Text style={[type.number, { color: theme.text }]}>₹{formatPaise(p.unit_paise)}</Text>
          <AvlBadge avl={p.avl_qty} theme={theme} />
        </View>
      )}
    />
  );
});

// ---------------------------------------------------------------------------
// The editor: a side pane on lg+, a sheet (P3) below; the same body in both.
// ---------------------------------------------------------------------------

// S5.5 — lg+: the editor pane (38 %, pinned: a ScrollView grows by default), a glass card
// with the editor or an empty state until something is selected.
function EditorPane({ p, theme }: { p: Products; theme: Theme }) {
  const navInset = useNavInset();
  return (
    <ScrollView style={{ width: S5.editorWidth, flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ paddingEnd: layout.side, paddingBottom: navInset }} keyboardShouldPersistTaps="handled">
      <Card theme={theme} style={{ padding: S5.editorPadding }}>
        <SectionTitle title={p.editing ? p.editorTitle : 'Product editor'} theme={theme} />
        {p.editing
          ? <EditorBody p={p} theme={theme} />
          : <EmptyState icon="tag" text="Select a product to edit, or add a new one." theme={theme} />}
      </Card>
    </ScrollView>
  );
}

// P3 — below lg: the same editor in a wide bottom sheet.
function EditorSheet({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <Sheet visible={p.editing} onClose={p.closeEditor} title={p.editorTitle} theme={theme} wide>
      <EditorBody p={p} theme={theme} />
    </Sheet>
  );
}

// Restock (S5.7) when that mode is on for an existing product, else the product form (S5.6).
function EditorBody({ p, theme }: { p: Products; theme: Theme }) {
  return p.mode === 'restock' && p.editId ? <RestockForm p={p} theme={theme} /> : <ProductForm p={p} theme={theme} />;
}

// S5.6 — Product name · Quick pick chips · Size chips · Price | Stock · actions · stock history.
function ProductForm({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <View>
      <Input label="Product name" value={p.draft.name} error={p.nameError || undefined} autoCapitalize="words"
        onChange={v => { p.setDraft({ ...p.draft, name: v }); p.setNameError(''); }} theme={theme} />
      <QuickPickChips p={p} theme={theme} />
      <SizeChips p={p} theme={theme} />
      <PriceStockRow p={p} theme={theme} />
      <EditorActions p={p} theme={theme} />
      <StockHistory p={p} theme={theme} />
    </View>
  );
}

// S5.6.2 — "Quick pick": one chip per seed name, wrapping; the active one matches the draft's name.
function QuickPickChips({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <>
      <Text style={[type.labelMedium, { color: theme.textMuted, marginBottom: space[1] }]}>Quick pick</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space[2] }}>
        {QUICK_PICKS.map(n => (
          <Chip key={n} label={n} active={p.draft.name === n}
            onPress={() => { p.setDraft({ ...p.draft, name: n }); p.setNameError(''); }} theme={theme} />
        ))}
      </View>
    </>
  );
}

// S5.6.3 — "Size": the size chips plus "No size".
function SizeChips({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <>
      <Text style={[type.labelMedium, { color: theme.textMuted, marginBottom: space[1] }]}>Size</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space[3] }}>
        {SIZES.map(s => (
          <Chip key={s} label={s} active={p.draft.size === s}
            onPress={() => p.setDraft({ ...p.draft, size: s })} theme={theme} />
        ))}
        <Chip label="No size" active={p.draft.size === ''}
          onPress={() => p.setDraft({ ...p.draft, size: '' })} theme={theme} />
      </View>
    </>
  );
}

// S5.6.4 — one row, two equal columns: Price (₹) | Stock (helper: "Sold n · Avl n").
function PriceStockRow({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <Columns kind="input">
      <MoneyInput label="Price (₹)" valuePaise={p.draft.unit_paise}
        onChangePaise={v => p.setDraft(d => ({ ...d, unit_paise: v }))} theme={theme} />
      <Input label="Stock" value={String(p.draft.stock_qty)}
        onChange={v => p.setDraft({ ...p.draft, stock_qty: Number(num(v)) })}
        theme={theme} keyboardType="numeric" tabular
        helper={p.editId ? `Sold ${p.draftSold} · Avl ${p.draft.stock_qty - p.draftSold}` : 'Sold counts once invoiced'} />
    </Columns>
  );
}

// S5.6.5 — right-aligned, wrapping: Delete (ghost, red) · Restock (glass) · Save (blue);
// Delete and Restock only for an existing product.
function EditorActions({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[2], marginTop: space[1] }}>
      {p.editId ? <Button label="Delete" icon="trash-2" variant="ghost" danger theme={theme} onPress={p.remove} /> : null}
      {p.editId ? <Button label="Restock" icon="plus-circle" variant="tonal" theme={theme} onPress={p.openRestock} /> : null}
      <Button label="Save" theme={theme} onPress={() => void p.save()} />
    </View>
  );
}

// S5.6.6 — "Stock history": one row per restock / edit: icon · "Restock +n → stock m" · date · note.
function StockHistory({ p, theme }: { p: Products; theme: Theme }) {
  if (!p.editId || p.history.length === 0) return null;
  return (
    <View style={{ marginTop: space[4] }}>
      <SectionTitle title="Stock history" theme={theme} />
      {p.history.map(h => (
        <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3], borderBottomWidth: 1, borderColor: theme.divider }}>
          <Feather name={h.kind === 'restock' ? 'arrow-down-circle' : 'edit-2'} size={20} color={theme.accent} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[type.label, { color: theme.text }]}>
              {h.kind === 'restock' ? 'Restock' : 'Edit'} {h.delta > 0 ? '+' : ''}{h.delta} → stock {h.stock_after}
            </Text>
            <Text style={[type.caption, { color: theme.textMuted }]} numberOfLines={1}>
              {h.created_at}{h.note ? ` · ${h.note}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// S5.7 — Restock: "name · size — current stock n" · Qty to add | New price (₹) · Note · Back / Add to stock.
function RestockForm({ p, theme }: { p: Products; theme: Theme }) {
  return (
    <View>
      <Text style={[type.bodyMedium, { color: theme.textMuted, marginBottom: space[3] }]}>
        {p.draft.name} · {p.draft.size || 'No size'} — current stock {num(String(p.draft.stock_qty))}
      </Text>
      {/* S5.7.2 — one row, two equal columns */}
      <Columns kind="input">
        <Input label="Qty to add" value={p.rQty} error={p.qtyError || undefined}
          onChange={v => { p.setRQty(num(v)); p.setQtyError(''); }} theme={theme} keyboardType="numeric" tabular />
        <MoneyInput label="New price (₹)" valuePaise={p.rPricePaise} onChangePaise={p.setRPricePaise}
          theme={theme} placeholder="Keep current" helper="Blank keeps price" />
      </Columns>
      <Input label="Note (lot / supplier)" value={p.rNote}
        onChange={p.setRNote} theme={theme} placeholder="Optional" />
      {/* S5.7.4 */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space[2] }}>
        <Button label="Back" variant="ghost" theme={theme} onPress={() => p.setMode('edit')} />
        <Button label="Add to stock" icon="plus" theme={theme} onPress={() => void p.applyRestock()} />
      </View>
    </View>
  );
}
