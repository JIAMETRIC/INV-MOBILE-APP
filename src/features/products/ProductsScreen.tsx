import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { alert } from '../../ui/alert';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Badge, Button, Chip, EmptyState, FAB, Input, ListItem, ListRow, MoneyInput, SearchField, SectionTitle, TopAppBar,
} from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import { useSnackbar } from '../../ui/Snackbar';
import { space, type } from '../../ui/tokens';
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

export function ProductsScreen() {
  const theme = useTheme();
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

  const startEdit = (p?: ProductRow) => {
    setEditId(p?.id);
    setDraft(p ? { name: p.name, size: p.size, unit_paise: p.unit_paise, stock_qty: p.stock_qty } : blank());
    setDraftSold(p?.sold_qty ?? 0);
    setMode('edit');
    setNameError('');
    setHistory([]);
    if (p) void loadHistory(p.id);
    setEditing(true);
  };

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
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Input label="Qty to add" value={rQty} error={qtyError || undefined}
            onChange={v => { setRQty(num(v)); setQtyError(''); }} theme={theme} keyboardType="numeric" tabular />
        </View>
        <View style={{ flex: 1 }}>
          <MoneyInput label="New price (₹)" valuePaise={rPricePaise} onChangePaise={setRPricePaise}
            theme={theme} placeholder="Keep current" helper="Blank keeps price" />
        </View>
      </View>
      <Input label="Note (lot / supplier)" value={rNote}
        onChange={setRNote} theme={theme} placeholder="Optional" />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space[2] }}>
        <Button label="Back" variant="ghost" theme={theme} onPress={() => setMode('edit')} />
        <Button label="Add to stock" icon="add" theme={theme} onPress={() => void applyRestock()} />
      </View>
    </View>
  );

  const historyBlock = editId && history.length > 0 ? (
    <View style={{ marginTop: space[4] }}>
      <SectionTitle title="Stock history" theme={theme} />
      {history.map(h => (
        <View key={h.id} style={{ flexDirection: 'row', gap: space[3], paddingVertical: space[2], borderBottomWidth: 1, borderColor: theme.border }}>
          <Ionicons name={h.kind === 'restock' ? 'arrow-down-circle-outline' : 'create-outline'} size={20} color={theme.textMuted} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[type.bodyMedium, { color: theme.text }]}>
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
      <Text style={[type.labelMedium, { color: theme.textMuted }]}>Quick pick</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space[2] }}>
        {PRODUCT_SEED_NAMES.map(n => (
          <Chip key={n} label={n} active={draft.name === n}
            onPress={() => { setDraft({ ...draft, name: n }); setNameError(''); }} theme={theme} />
        ))}
      </View>
      <Text style={[type.labelMedium, { color: theme.textMuted }]}>Size</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space[3] }}>
        {PRODUCT_SIZES.map(s => (
          <Chip key={s} label={s} active={draft.size === s}
            onPress={() => setDraft({ ...draft, size: s })} theme={theme} />
        ))}
        <Chip label="No size" active={draft.size === ''}
          onPress={() => setDraft({ ...draft, size: '' })} theme={theme} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <MoneyInput label="Price (₹)" valuePaise={draft.unit_paise}
            onChangePaise={p => setDraft(d => ({ ...d, unit_paise: p }))} theme={theme} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Stock" value={String(draft.stock_qty)}
            onChange={v => setDraft({ ...draft, stock_qty: Number(num(v)) })}
            theme={theme} keyboardType="numeric" tabular
            helper={editId ? `Sold ${draftSold} · Avl ${draft.stock_qty - draftSold}` : 'Sold counts once invoiced'} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[2], marginTop: space[1] }}>
        {editId ? <Button label="Delete" icon="trash-outline" variant="ghost" danger theme={theme} onPress={remove} /> : null}
        {editId ? <Button label="Restock" icon="add-circle-outline" variant="tonal" theme={theme} onPress={openRestock} /> : null}
        <Button label="Save" theme={theme} onPress={() => void save()} />
      </View>
      {historyBlock}
    </View>
  );

  const headerRow = (
    <View style={{
      flexDirection: 'row', paddingHorizontal: space[4], paddingVertical: space[2],
      borderBottomWidth: 1, borderColor: theme.outline,
    }}>
      {[['NAME', 0], ['SIZE', 52], ['PRICE', 84], ['STOCK', 60], ['SOLD', 56], ['AVL', 76]].map(([h, w]) => (
        <Text key={h} style={[type.labelMedium, {
          color: theme.textMuted, ...(w ? { width: w as number, textAlign: h === 'SIZE' ? 'left' : 'right' } : { flex: 3 }),
        }]}>{h}</Text>
      ))}
    </View>
  );

  const tableRow = (p: ProductRow) => (
    <ListRow theme={theme} onPress={() => startEdit(p)}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={[type.bodyMedium, { color: theme.text, flex: 3 }]} numberOfLines={1}>{p.name}</Text>
        <Text style={[type.number, { color: theme.text, width: 52 }]}>{p.size || '—'}</Text>
        <Text style={[type.number, { color: theme.text, width: 84, textAlign: 'right' }]}>₹{formatPaise(p.unit_paise)}</Text>
        <Text style={[type.number, { color: theme.text, width: 60, textAlign: 'right' }]}>{num(String(p.stock_qty))}</Text>
        <Text style={[type.number, { color: theme.textMuted, width: 56, textAlign: 'right' }]}>{num(String(p.sold_qty))}</Text>
        <View style={{ width: 76 }}><AvlBadge avl={p.avl_qty} theme={theme} /></View>
      </View>
    </ListRow>
  );

  const editorTitle = mode === 'restock' ? 'Restock' : editId ? 'Edit product' : 'New product';

  return (
    <View style={{ flex: 1 }}>
      <TopAppBar
        title="Products"
        subtitle={`${products.length} items`}
        theme={theme}
        actions={[
          ...(bp.isPhone ? [] : [{ icon: 'add' as const, label: 'New product', onPress: () => startEdit() }]),
          { icon: 'download-outline', label: 'Export products to Excel', onPress: exportXlsx, busy },
        ]}
      />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ paddingHorizontal: space[4], paddingVertical: space[3] }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search products" theme={theme} />
          </View>
          {bp.atLeast('md') ? headerRow : null}
          <FlatList
            data={products}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={{ paddingBottom: 96 }}
            ListEmptyComponent={search
              ? <EmptyState icon="search-outline" title="No matches" text={`Nothing matches "${search}".`} theme={theme} />
              : <EmptyState icon="pricetags-outline" title="No products" text="Add your first product to start billing from stock." theme={theme} />}
            renderItem={({ item }) => bp.atLeast('md')
              ? tableRow(item)
              : (
                <ListItem
                  theme={theme}
                  leadingText={item.size || '—'}
                  title={item.name}
                  subtitle={`Stock ${num(String(item.stock_qty))} · Sold ${num(String(item.sold_qty))}`}
                  onPress={() => startEdit(item)}
                  trailing={(
                    <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                      <Text style={[type.number, { color: theme.text }]}>₹{formatPaise(item.unit_paise)}</Text>
                      <AvlBadge avl={item.avl_qty} theme={theme} />
                    </View>
                  )}
                />
              )}
          />
          {bp.isPhone ? <FAB icon="add" label="Add product" onPress={() => startEdit()} theme={theme} /> : null}
        </View>
        {bp.atLeast('lg') ? (
          <ScrollView style={{ width: '38%', borderLeftWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}
            contentContainerStyle={{ padding: space[5] }} keyboardShouldPersistTaps="handled">
            <SectionTitle title={editing ? editorTitle : 'Product editor'} theme={theme} />
            {editing
              ? (mode === 'restock' && editId ? restockFields : editorFields)
              : <EmptyState icon="pricetag-outline" text="Select a product to edit, or add a new one." theme={theme} />}
          </ScrollView>
        ) : null}
        {bp.atLeast('lg') ? null : (
          <Sheet visible={editing} onClose={() => setEditing(false)} title={editorTitle} theme={theme} wide>
            {mode === 'restock' && editId ? restockFields : editorFields}
          </Sheet>
        )}
      </View>
    </View>
  );
}
