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

// S5.2.r — one table row (md+): NAME flex 3 · SIZE 52 · PRICE 84 · STOCK 60 · SOLD 56 · AVL 76.
// Memoised: typing in the search box re-renders the list, not every row.
const ProductTableRow = React.memo(function ProductTableRow({ p, last, onPress, theme }: {
  p: ProductRow; last: boolean; onPress: (p: ProductRow) => void; theme: Theme;
}) {
  return (
    <ListRow theme={theme} flush divider={!last} onPress={() => onPress(p)}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type.label, { color: theme.text, flex: 3, paddingEnd: space[2] }]} numberOfLines={1}>{p.name}</Text>
        <Text style={[type.number, { color: theme.text, width: 52 }]}>{p.size || '—'}</Text>
        <Text style={[type.number, { color: theme.text, width: 84, textAlign: 'right' }]}>₹{formatPaise(p.unit_paise)}</Text>
        <Text style={[type.number, { color: theme.text, width: 60, textAlign: 'right' }]}>{num(String(p.stock_qty))}</Text>
        <Text style={[type.number, { color: theme.textMuted, width: 56, textAlign: 'right' }]}>{num(String(p.sold_qty))}</Text>
        <View style={{ width: 76 }}><AvlBadge avl={p.avl_qty} theme={theme} /></View>
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

export function ProductsScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const snack = useSnackbar();
  const navInset = useNavInset();
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

  const restockFields = (
    <View>
      <Text style={[type.bodyMedium, { color: theme.textMuted, marginBottom: space[3] }]}>
        {draft.name} · {draft.size || 'No size'} — current stock {num(String(draft.stock_qty))}
      </Text>
      <Columns kind="input">
        <Input label="Qty to add" value={rQty} error={qtyError || undefined}
          onChange={v => { setRQty(num(v)); setQtyError(''); }} theme={theme} keyboardType="numeric" tabular />
        <MoneyInput label="New price (₹)" valuePaise={rPricePaise} onChangePaise={setRPricePaise}
          theme={theme} placeholder="Keep current" helper="Blank keeps price" />
      </Columns>
      <Input label="Note (lot / supplier)" value={rNote}
        onChange={setRNote} theme={theme} placeholder="Optional" />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space[2] }}>
        <Button label="Back" variant="ghost" theme={theme} onPress={() => setMode('edit')} />
        <Button label="Add to stock" icon="plus" theme={theme} onPress={() => void applyRestock()} />
      </View>
    </View>
  );

  const historyBlock = editId && history.length > 0 ? (
    <View style={{ marginTop: space[4] }}>
      <SectionTitle title="Stock history" theme={theme} />
      {history.map(h => (
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
  ) : null;

  const editorFields = (
    <View>
      <Input label="Product name" value={draft.name} error={nameError || undefined} autoCapitalize="words"
        onChange={v => { setDraft({ ...draft, name: v }); setNameError(''); }} theme={theme} />
      <Text style={[type.labelMedium, { color: theme.textMuted, marginBottom: space[1] }]}>Quick pick</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space[2] }}>
        {PRODUCT_SEED_NAMES.map(n => (
          <Chip key={n} label={n} active={draft.name === n}
            onPress={() => { setDraft({ ...draft, name: n }); setNameError(''); }} theme={theme} />
        ))}
      </View>
      <Text style={[type.labelMedium, { color: theme.textMuted, marginBottom: space[1] }]}>Size</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space[3] }}>
        {PRODUCT_SIZES.map(s => (
          <Chip key={s} label={s} active={draft.size === s}
            onPress={() => setDraft({ ...draft, size: s })} theme={theme} />
        ))}
        <Chip label="No size" active={draft.size === ''}
          onPress={() => setDraft({ ...draft, size: '' })} theme={theme} />
      </View>
      <Columns kind="input">
        <MoneyInput label="Price (₹)" valuePaise={draft.unit_paise}
          onChangePaise={p => setDraft(d => ({ ...d, unit_paise: p }))} theme={theme} />
        <Input label="Stock" value={String(draft.stock_qty)}
          onChange={v => setDraft({ ...draft, stock_qty: Number(num(v)) })}
          theme={theme} keyboardType="numeric" tabular
          helper={editId ? `Sold ${draftSold} · Avl ${draft.stock_qty - draftSold}` : 'Sold counts once invoiced'} />
      </Columns>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[2], marginTop: space[1] }}>
        {editId ? <Button label="Delete" icon="trash-2" variant="ghost" danger theme={theme} onPress={remove} /> : null}
        {editId ? <Button label="Restock" icon="plus-circle" variant="tonal" theme={theme} onPress={openRestock} /> : null}
        <Button label="Save" theme={theme} onPress={() => void save()} />
      </View>
      {historyBlock}
    </View>
  );

  const headerRow = (
    <View style={{
      flexDirection: 'row', paddingVertical: space[3],
      borderBottomWidth: 1, borderColor: theme.divider,
    }}>
      {[['NAME', 0], ['SIZE', 52], ['PRICE', 84], ['STOCK', 60], ['SOLD', 56], ['AVL', 76]].map(([h, w]) => (
        <Text key={h} style={[type.overline, {
          color: theme.textMuted, ...(w ? { width: w as number, textAlign: h === 'SIZE' ? 'left' : 'right' } : { flex: 3 }),
        }]}>{h}</Text>
      ))}
    </View>
  );

  const editorTitle = mode === 'restock' ? 'Restock' : editId ? 'Edit product' : 'New product';
  // S5.2: the 6-column table needs about 520 dp (fixed columns 328 + a readable NAME).
  // At lg the editor pane takes 38 %, so the list pane (62 % minus the 88 rail) is
  // ≈ 410 dp on a 10-inch portrait tablet: use the phone rows there, the table from xl.
  const listPaneWidth = bp.atLeast('lg') ? (bp.width - 88) * 0.62 : bp.width - 88;
  const showTable = bp.atLeast('md') && listPaneWidth >= 520;

  // S5.0 header and S5.4 FAB are <Screen> slots; the list card clears the FAB through useFabClearance().
  return (
    <Screen
      header={(
        <TopAppBar
          title="Products"
          subtitle={`${products.length} items`}
          theme={theme}
          large
          actions={[
            ...(bp.isPhone ? [] : [{ icon: 'plus' as const, label: 'New product', onPress: () => startEdit() }]),
            { icon: 'download', label: 'Export products to Excel', onPress: exportXlsx, busy },
          ]}
        />
      )}
      fab={bp.isPhone ? <FAB icon="plus" label="Add product" onPress={() => startEdit()} theme={theme} /> : null}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: layout.side, gap: layout.gap }}>
          <View style={{ paddingTop: space[1] }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search products" theme={theme} />
          </View>
          <ProductListCard products={products} search={search} showTable={showTable} headerRow={headerRow}
            onPress={startEdit} navInset={navInset} theme={theme} />
        </View>
        {bp.atLeast('lg') ? (
          // S5.5: a ScrollView grows by default (flexGrow 1), which made 38% only a
          // basis and squeezed the table until NAME vanished. Pin it.
          <ScrollView style={{ width: '38%', flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ paddingEnd: layout.side, paddingBottom: navInset }} keyboardShouldPersistTaps="handled">
            <Card theme={theme} style={{ padding: 20 }}>
              <SectionTitle title={editing ? editorTitle : 'Product editor'} theme={theme} />
              {editing
                ? (mode === 'restock' && editId ? restockFields : editorFields)
                : <EmptyState icon="tag" text="Select a product to edit, or add a new one." theme={theme} />}
            </Card>
          </ScrollView>
        ) : null}
        {bp.atLeast('lg') ? null : (
          <Sheet visible={editing} onClose={() => setEditing(false)} title={editorTitle} theme={theme} wide>
            {mode === 'restock' && editId ? restockFields : editorFields}
          </Sheet>
        )}
      </View>
    </Screen>
  );
}

// S5.2 / S5.3 — the glass card that hugs the product rows (table rows at ≥ 520 dp, phone rows
// otherwise) and scrolls when full; long lists on phones keep the last row clear of the FAB.
function ProductListCard({ products, search, showTable, headerRow, onPress, navInset, theme }: {
  products: ProductRow[]; search: string; showTable: boolean; headerRow: React.ReactNode;
  onPress: (p: ProductRow) => void; navInset: number; theme: Theme;
}) {
  const fabClearance = useFabClearance(); // 0 when no FAB floats (tablets)
  return (
    <Card theme={theme} list style={{ flexShrink: 1, marginBottom: navInset, overflow: 'hidden' }}>
      {showTable ? headerRow : null}
      <FlatList
        data={products}
        keyExtractor={p => String(p.id)}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingBottom: products.length > 6 ? fabClearance : 0 }}
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
