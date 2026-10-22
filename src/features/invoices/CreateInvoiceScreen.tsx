import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Platform, Pressable, ScrollView, Text, View,
} from 'react-native';
import { alert } from '../../ui/alert';
import WebView from 'react-native-webview';
import { useTheme } from '../../shell/providers';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useBackIntercept, useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Badge, Button, Card, Chip, IconButton, Input, ListItem, MoneyInput, MoneyText, SearchField, SectionTitle,
  TopAppBar, TotalRow, EmptyState,
} from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import { useSnackbar } from '../../ui/Snackbar';
import { radius, space, type, maxReadWidth } from '../../ui/tokens';
import {
  addDaysIso, computeTotals, formatInvoiceNo, formatPaise, linePaise, numberToWordsIndian, todayIso,
} from '../../data/money';
import { getSettings } from '../../data/settingsRepo';
import { listProducts } from '../../data/productsRepo';
import { saveInvoice } from '../../data/invoicesRepo';
import { getInvoice, getLines } from '../../data/invoicesRepo';
import { deleteDraft, getDraft, saveDraft, type DraftPayload } from '../../data/draftsRepo';
import { logAudit } from '../../data/auditRepo';
import { buildInvoiceHtml } from '../../export/pdfTemplate';
import type { InvoiceForm, ProductRow, Settings } from '../../data/types';

const emptyParty = () => ({
  party_name: '', party_address: '', party_city: '', party_pincode: '',
  party_mobile: '', party_email: '',
});

const emptyShip = () => ({
  ship_name: '', ship_address: '', ship_city: '', ship_pincode: '',
});

function blankForm(): InvoiceForm {
  const today = todayIso();
  return {
    party: emptyParty(),
    invoiceDate: today,
    dueDate: addDaysIso(today, 14),
    discountPercent: 0,
    lines: [],
    notes: '',
    hasShipping: false,
    ship: emptyShip(),
  };
}

export function CreateInvoiceScreen({ draftId, invoiceId }: { draftId?: number; invoiceId?: number }) {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const snack = useSnackbar();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<InvoiceForm>(blankForm);
  const [draftRowId, setDraftRowId] = useState<number | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);
  const [previewNo, setPreviewNo] = useState('NEW');
  const [step, setStep] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [tabPreview, setTabPreview] = useState(false);
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  const autosaved = useRef(false);

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      setSettings(s);
      if (invoiceId) {
        const inv = await getInvoice(invoiceId);
        if (inv) {
          const lines = await getLines(inv.id);
          setEditInvoiceId(inv.id);
          setPreviewNo(inv.invoice_no);
          setForm({
            party: {
              party_name: inv.party_name, party_address: inv.party_address,
              party_city: inv.party_city, party_pincode: inv.party_pincode,
              party_mobile: inv.party_mobile, party_email: inv.party_email,
            },
            invoiceDate: inv.invoice_date,
            dueDate: inv.due_date ?? '',
            discountPercent: inv.discount_percent,
            lines,
            notes: inv.notes,
            hasShipping: inv.has_shipping === 1,
            ship: {
              ship_name: inv.ship_name, ship_address: inv.ship_address, ship_city: inv.ship_city,
              ship_pincode: inv.ship_pincode,
            },
          });
          return;
        }
      }
      if (draftId) {
        const d = await getDraft(draftId);
        if (d) {
          const payload = JSON.parse(d.payload_json) as DraftPayload;
          setDraftRowId(d.id);
          setPreviewNo(payload.invoiceNo);
          setForm(payload.form);
          return;
        }
      }
      setPreviewNo(formatInvoiceNo(s.invoice_prefix, s.next_seq));
    })();
  }, [draftId, invoiceId]);

  const totals = useMemo(
    () => computeTotals(form.lines, form.discountPercent),
    [form.lines, form.discountPercent],
  );

  const patch = useCallback((p: Partial<InvoiceForm>) => {
    setForm(f => ({ ...f, ...p }));
    autosaved.current = false;
  }, []);

  const autosave = useCallback(async () => {
    if (!settings) return;
    const payload: DraftPayload = {
      form,
      invoiceNo: editInvoiceId ? previewNo : formatInvoiceNo(settings.invoice_prefix, settings.next_seq),
    };
    const id = await saveDraft(draftRowId, payload, totals.total);
    setDraftRowId(id);
    autosaved.current = true;
  }, [settings, form, totals.total, draftRowId, previewNo, editInvoiceId]);

  const previewInvoice = useMemo(() => {
    if (!settings) return null;
    return {
      ...form.party,
      id: 0,
      invoice_no: previewNo,
      status: 'draft' as const,
      invoice_date: form.invoiceDate,
      due_date: form.dueDate || null,
      gross_paise: totals.gross,
      discount_percent: form.discountPercent,
      discount_paise: totals.discount,
      round_off_paise: totals.roundOff,
      total_paise: totals.total,
      amount_in_words: numberToWordsIndian(totals.total),
      upi_id: settings.upi_id,
      notes: form.notes,
      has_shipping: form.hasShipping ? 1 : 0,
      ship_name: form.ship.ship_name, ship_address: form.ship.ship_address,
      ship_city: form.ship.ship_city, ship_pincode: form.ship.ship_pincode,
      created_at: '', updated_at: '',
    };
  }, [settings, form, totals, previewNo]);

  const previewHtml = useMemo(() => {
    if (!settings || !previewInvoice) return '';
    return buildInvoiceHtml(previewInvoice, form.lines, settings, pageSize);
  }, [settings, previewInvoice, form.lines, pageSize]);

  // The xl layout shows the catalog as a permanent panel, so it needs the list up front.
  const showsCatalogPanel = bp.atLeast('xl');
  useEffect(() => {
    if (showsCatalogPanel) void listProducts(catalogSearch).then(setProducts);
    // Only on entering the xl layout; typing in the search reloads by itself.
  }, [showsCatalogPanel]);

  const openCatalog = () => {
    setCatalogOpen(true);
    void listProducts().then(setProducts);
  };

  const addLine = (p: ProductRow) => {
    patch({
      lines: [...form.lines, {
        sno: form.lines.length + 1,
        product_id: p.id,
        description: p.size ? `${p.name} - ${p.size}` : p.name,
        qty: 1,
        unit_paise: p.unit_paise,
        line_paise: linePaise(1, p.unit_paise),
      }],
    });
    setCatalogOpen(false);
  };

  const addBlankLine = () => {
    patch({
      lines: [...form.lines, {
        sno: form.lines.length + 1, product_id: null, description: '',
        qty: 1, unit_paise: 0, line_paise: 0,
      }],
    });
  };

  const updateLine = (i: number, p: Partial<(typeof form.lines)[number]>) => {
    patch({
      lines: form.lines.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...p };
        next.line_paise = linePaise(next.qty, next.unit_paise);
        return next;
      }),
    });
  };

  const removeLine = (i: number) => {
    patch({ lines: form.lines.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sno: idx + 1 })) });
  };

  const issue = async () => {
    if (!settings) return;
    if (!form.party.party_name.trim()) {
      alert('Party required', 'Enter the party name before issuing.');
      setStep(0);
      return;
    }
    if (form.lines.length === 0) {
      alert('No line items', 'Add at least one product line before issuing.');
      setStep(1);
      return;
    }
    const res = await saveInvoice(
      form,
      totals,
      editInvoiceId
        ? { invoiceId: editInvoiceId, invoiceNo: previewNo }
        : {},
    );
    await logAudit(editInvoiceId ? 'invoice.update' : 'invoice.issue', 'invoice', res.invoiceNo);
    if (draftRowId) await deleteDraft(draftRowId);
    nav.refresh();
    nav.closeOverlay();
    snack(`${res.invoiceNo} ${editInvoiceId ? 'updated' : 'issued'} · ₹${formatPaise(totals.total)}`, {
      label: 'View', onPress: () => nav.showInvoice(res.invoiceId, bp.isPhone),
    });
  };

  const saveAsDraft = async () => {
    await autosave();
    nav.refresh();
    nav.closeOverlay();
    snack('Saved to drafts');
  };

  // Leaving keeps work: anything typed since the last autosave goes to drafts first.
  const leave = () => {
    const dirty = !autosaved.current && (!!form.party.party_name.trim() || form.lines.length > 0);
    if (dirty && !editInvoiceId) void saveAsDraft();
    else nav.closeOverlay();
  };

  // Android Back on the phone stepper walks back one step before leaving.
  useBackIntercept(() => {
    if (catalogOpen) return false;
    if (bp.isPhone && step > 0) { setStep(s => s - 1); return true; }
    leave();
    return true;
  });

  // ---------- building blocks ----------

  const partySection = (
    <View>
      <SectionTitle title="Bill to" theme={theme} />
      <Input label="Party name *" value={form.party.party_name} autoCapitalize="words"
        onChange={v => patch({ party: { ...form.party, party_name: v } })}
        onBlur={() => void autosave()} theme={theme} />
      <Input label="Address" value={form.party.party_address}
        onChange={v => patch({ party: { ...form.party, party_address: v } })}
        onBlur={() => void autosave()} theme={theme} />
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Input label="City" value={form.party.party_city}
            onChange={v => patch({ party: { ...form.party, party_city: v } })}
            onBlur={() => void autosave()} theme={theme} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Pincode" value={form.party.party_pincode}
            onChange={v => patch({ party: { ...form.party, party_pincode: v } })}
            onBlur={() => void autosave()} theme={theme} keyboardType="numeric" maxLength={6} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Input label="Mobile" value={form.party.party_mobile}
            onChange={v => patch({ party: { ...form.party, party_mobile: v } })}
            onBlur={() => void autosave()} theme={theme} keyboardType="phone-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Email" value={form.party.party_email}
            onChange={v => patch({ party: { ...form.party, party_email: v } })}
            onBlur={() => void autosave()} theme={theme} keyboardType="email-address" autoCapitalize="none" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Input label="Invoice date" value={form.invoiceDate}
            onChange={v => patch({ invoiceDate: v })} onBlur={() => void autosave()}
            theme={theme} tabular placeholder="YYYY-MM-DD" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Due date" value={form.dueDate}
            onChange={v => patch({ dueDate: v })} onBlur={() => void autosave()}
            theme={theme} tabular placeholder="YYYY-MM-DD" />
        </View>
      </View>
    </View>
  );

  const itemsSection = (
    <View>
      <SectionTitle title={`Items (${form.lines.length})`} theme={theme}
        right={bp.atLeast('xl') ? undefined : (
          <Button label="Add from products" icon="pricetags-outline" variant="tonal" theme={theme} onPress={openCatalog} />
        )}
      />
      {form.lines.length === 0
        ? (
          <Card theme={theme} variant="filled" style={{ marginBottom: space[3] }}>
            <EmptyState icon="cart-outline" title="No items yet"
              text={bp.atLeast('xl') ? 'Tap a product on the left, or add a free line.' : 'Pick products from your catalog, or add a free line.'}
              theme={theme} />
          </Card>
        )
        : form.lines.map((l, i) => (
          <Card key={i} theme={theme} style={{ marginBottom: space[3], paddingBottom: space[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space[2] }}>
              <Text style={[type.labelMedium, { color: theme.textMuted, flex: 1 }]}>
                ITEM {i + 1} · {l.product_id ? 'FROM PRODUCTS' : 'FREE LINE'}
              </Text>
              <IconButton icon="trash-outline" label={`Remove item ${i + 1}`} onPress={() => removeLine(i)} theme={theme} />
            </View>
            <Input label="Description" value={l.description}
              onChange={v => updateLine(i, { description: v })}
              onBlur={() => void autosave()} theme={theme} />
            <View style={{ flexDirection: 'row', gap: space[3] }}>
              <View style={{ flex: 1 }}>
                <Input label="Qty" value={String(l.qty)}
                  onChange={v => updateLine(i, { qty: Math.max(0, Number(v.replace(/[^0-9.]/g, '')) || 0) })}
                  onBlur={() => void autosave()} theme={theme} keyboardType="decimal-pad" tabular />
              </View>
              <View style={{ flex: 1.4 }}>
                <MoneyInput label="Rate (₹)" valuePaise={l.unit_paise}
                  onChangePaise={p => updateLine(i, { unit_paise: p })}
                  onBlur={() => void autosave()} theme={theme} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[type.bodyMedium, { color: theme.textMuted }]}>Amount</Text>
              <MoneyText paiseText={`₹${formatPaise(l.line_paise)}`} theme={theme} />
            </View>
          </Card>
        ))}
      <Button label="Add free line" icon="add" variant="outline" theme={theme} onPress={addBlankLine}
        style={{ alignSelf: 'flex-start', marginBottom: space[4] }} />

      <SectionTitle title="Adjustments" theme={theme} />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}>
          <Input label="Discount %" value={String(form.discountPercent)}
            onChange={v => patch({ discountPercent: Math.max(0, Math.min(100, Number(v) || 0)) })}
            onBlur={() => void autosave()} theme={theme} keyboardType="decimal-pad" tabular />
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Chip label="Ship to address" icon="car-outline" active={form.hasShipping}
            onPress={() => patch({ hasShipping: !form.hasShipping })} theme={theme} />
        </View>
      </View>
      {form.hasShipping ? (
        <Card theme={theme} variant="filled" style={{ marginBottom: space[3], paddingBottom: space[1] }}>
          <Input label="Consignee" value={form.ship.ship_name}
            onChange={v => patch({ ship: { ...form.ship, ship_name: v } })}
            onBlur={() => void autosave()} theme={theme} />
          <Input label="Address" value={form.ship.ship_address}
            onChange={v => patch({ ship: { ...form.ship, ship_address: v } })}
            onBlur={() => void autosave()} theme={theme} />
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Input label="City" value={form.ship.ship_city}
                onChange={v => patch({ ship: { ...form.ship, ship_city: v } })}
                onBlur={() => void autosave()} theme={theme} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Pincode" value={form.ship.ship_pincode}
                onChange={v => patch({ ship: { ...form.ship, ship_pincode: v } })}
                onBlur={() => void autosave()} theme={theme} keyboardType="numeric" maxLength={6} />
            </View>
          </View>
        </Card>
      ) : null}
      <Input label="Notes" value={form.notes}
        onChange={v => patch({ notes: v })} onBlur={() => void autosave()}
        theme={theme} multiline placeholder="Optional — printed on the invoice" />
    </View>
  );

  const totalsBlock = (
    <View style={{ paddingTop: space[2] }}>
      <TotalRow label="Subtotal" value={formatPaise(totals.gross)} theme={theme} />
      {totals.discount > 0
        ? <TotalRow label={`Discount (${form.discountPercent}%)`} value={`-${formatPaise(totals.discount)}`} theme={theme} />
        : null}
      <TotalRow label="Round off" value={formatPaise(totals.roundOff)} theme={theme} />
      <TotalRow label="Total" value={`₹${formatPaise(totals.total)}`} theme={theme} strong />
    </View>
  );

  const reviewSection = (
    <View>
      <Card theme={theme} variant="filled" style={{ marginBottom: space[4] }}>
        <Text style={[type.labelMedium, { color: theme.textMuted }]}>BILL TO</Text>
        <Text style={[type.heading, { color: theme.text, marginTop: space[1] }]}>
          {form.party.party_name || '(no party)'}
        </Text>
        <Text style={[type.bodyMedium, { color: theme.textMuted }]}>
          {previewNo} · {form.invoiceDate}{form.dueDate ? ` · due ${form.dueDate}` : ''}
        </Text>
      </Card>
      <SectionTitle title={`Items (${form.lines.length})`} theme={theme} />
      {form.lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', paddingVertical: space[2], borderBottomWidth: 1, borderColor: theme.border, gap: space[2] }}>
          <Text style={[type.bodyMedium, { color: theme.text, flex: 1 }]} numberOfLines={2}>
            {l.description || '(no description)'}
          </Text>
          <Text style={[type.bodyMedium, { color: theme.textMuted }]}>{l.qty} × {formatPaise(l.unit_paise)}</Text>
          <MoneyText paiseText={formatPaise(l.line_paise)} theme={theme} small />
        </View>
      ))}
      {totalsBlock}
      <Text style={[type.caption, { color: theme.textMuted, marginTop: space[2], fontStyle: 'italic' }]}>
        {numberToWordsIndian(totals.total)}
      </Text>
    </View>
  );

  const previewPane = (
    <View style={{ flex: 1, minWidth: 0 }}>
      <SectionTitle title="Preview" theme={theme}
        right={
          <View style={{ flexDirection: 'row' }}>
            <Chip label="A4" active={pageSize === 'A4'} onPress={() => setPageSize('A4')} theme={theme} />
            <Chip label="Letter" active={pageSize === 'Letter'} onPress={() => setPageSize('Letter')} theme={theme} />
          </View>
        }
      />
      <View style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: radius.md, overflow: 'hidden', minHeight: 400, backgroundColor: theme.paper }}>
        {Platform.OS === 'web'
          // Browser tier: the invoice HTML shares the page origin, so it is
          // scoped to a padded box instead of a WebView sandbox.
          // react-native-web's View renders a div and honours this prop, but
          // the RN type surface doesn't declare it.
          ? <View style={{ flex: 1 }} {...({ dangerouslySetInnerHTML: { __html: `<div style="padding:16px">${previewHtml}</div>` } } as object)} />
          : <WebView originWhitelist={['*']} source={{ html: previewHtml }} style={{ flex: 1, backgroundColor: theme.paper }} />}
      </View>
    </View>
  );

  const actionButtons = (
    <View style={{ flexDirection: 'row', gap: space[2], justifyContent: 'flex-end' }}>
      <Button label="Save draft" variant="outline" theme={theme} onPress={() => void saveAsDraft()} />
      <Button label={editInvoiceId ? 'Update' : 'Issue invoice'} icon={editInvoiceId ? 'checkmark' : 'send'} theme={theme} onPress={() => void issue()} />
    </View>
  );

  // ---------- layouts ----------

  const catalogSheet = (
    <CatalogSheet
      open={catalogOpen} onClose={() => setCatalogOpen(false)} theme={theme}
      products={products} onSearch={v => {
        setCatalogSearch(v);
        void listProducts(v).then(setProducts);
      }}
      searchValue={catalogSearch}
      onPick={addLine}
    />
  );

  const title = editInvoiceId ? 'Edit invoice' : 'New invoice';

  if (bp.isPhone) {
    const steps = ['Bill to', 'Items', 'Review'];
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TopAppBar title={title} subtitle={previewNo} theme={theme} onBack={leave} />
        <Stepper steps={steps} step={step} onStep={setStep} theme={theme} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
          {step === 0 ? partySection : step === 1 ? itemsSection : reviewSection}
        </ScrollView>
        {/* Bottom app bar: running total + the step's primary action; stays above the keyboard. */}
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: theme.surfaceContainer }}>
          <View style={{ paddingHorizontal: space[4], paddingVertical: space[3], flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <View style={{ flex: 1 }}>
              <Text style={[type.labelMedium, { color: theme.textMuted }]}>TOTAL</Text>
              <Text style={[type.figure, { color: theme.text }]} numberOfLines={1}>
                ₹{formatPaise(totals.total)}
              </Text>
            </View>
            {step < 2
              ? <Button label="Next" icon="arrow-forward" theme={theme} onPress={() => setStep(s => s + 1)} />
              : actionButtons}
          </View>
        </SafeAreaView>
        {catalogSheet}
      </View>
    );
  }

  if (bp.atLeast('xl')) {
    // 3 panels: catalog (3 cols) / form (5) / live preview (4)
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <TopAppBar title={title} subtitle={previewNo} theme={theme} onBack={leave} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: '25%', borderRightWidth: 1, borderColor: theme.border, paddingTop: space[3] }}>
            <View style={{ paddingHorizontal: space[3] }}>
              <SectionTitle title="Products" theme={theme} />
              <SearchField value={catalogSearch} onChange={v => {
                setCatalogSearch(v);
                void listProducts(v).then(setProducts);
              }} theme={theme} placeholder="Search products" />
            </View>
            <FlatList
              data={products}
              keyExtractor={p => String(p.id)}
              style={{ marginTop: space[2] }}
              ListEmptyComponent={<EmptyState text="No products. Add them under Products." theme={theme} />}
              renderItem={({ item: p }) => (
                <ListItem
                  theme={theme}
                  title={`${p.name}${p.size ? ` · ${p.size}` : ''}`}
                  subtitle={`₹${formatPaise(p.unit_paise)}`}
                  onPress={() => addLine(p)}
                  trailing={<Badge label={`Avl ${p.avl_qty}`} tone={p.avl_qty < 0 ? 'error' : p.avl_qty === 0 ? 'neutral' : 'success'} theme={theme} />}
                />
              )}
            />
          </View>
          <ScrollView style={{ width: '38%' }} contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
            {partySection}
            {itemsSection}
            {totalsBlock}
            <View style={{ height: space[5] }} />
            {actionButtons}
          </ScrollView>
          <View style={{ width: '37%', padding: space[3], borderLeftWidth: 1, borderColor: theme.border }}>
            {previewPane}
          </View>
        </View>
      </View>
    );
  }

  // md / lg: 2 panes; at md preview is a tab.
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <TopAppBar
        title={title} subtitle={previewNo} theme={theme} onBack={leave}
        actions={bp.bp === 'md'
          ? [{ icon: tabPreview ? 'create-outline' : 'eye-outline', label: tabPreview ? 'Show form' : 'Show preview', onPress: () => setTabPreview(p => !p) }]
          : undefined}
      />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {!(bp.bp === 'md' && tabPreview) ? (
            <ScrollView contentContainerStyle={{ padding: space[4], maxWidth: maxReadWidth }} keyboardShouldPersistTaps="handled">
              {partySection}
              {itemsSection}
              {totalsBlock}
              <View style={{ height: space[4] }} />
              {actionButtons}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, padding: space[3] }}>{previewPane}</View>
          )}
        </View>
        {bp.bp === 'md'
          ? null
          : <View style={{ width: '40%', borderLeftWidth: 1, borderColor: theme.border, padding: space[3] }}>{previewPane}</View>}
      </View>
      {catalogSheet}
    </View>
  );
}

// M3-style horizontal stepper: numbered circles joined by connectors; done steps show a check.
function Stepper({ steps, step, onStep, theme }: {
  steps: string[]; step: number; onStep: (i: number) => void; theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[2], backgroundColor: theme.surface, borderBottomWidth: 1, borderColor: theme.border }}>
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <React.Fragment key={s}>
            {i > 0 ? <View style={{ flex: 1, height: 1, backgroundColor: done || active ? theme.accent : theme.border, marginHorizontal: space[2] }} /> : null}
            <Pressable
              onPress={() => onStep(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Step ${i + 1} of ${steps.length}: ${s}`}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48 }}
            >
              <View style={{
                width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: active || done ? theme.fillStrong : 'transparent',
                borderWidth: active || done ? 0 : 1, borderColor: theme.outline,
              }}>
                {done
                  ? <Ionicons name="checkmark" size={16} color={theme.onFillStrong} />
                  : <Text style={[type.labelMedium, { color: active ? theme.onFillStrong : theme.textMuted }]}>{i + 1}</Text>}
              </View>
              <Text style={[type.label, { color: active ? theme.text : theme.textMuted }]}>{s}</Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

function CatalogSheet({ open, onClose, theme, products, onSearch, searchValue, onPick }: {
  open: boolean; onClose: () => void; theme: ReturnType<typeof useTheme>;
  products: ProductRow[]; onSearch: (v: string) => void; searchValue: string; onPick: (p: ProductRow) => void;
}) {
  return (
    <Sheet visible={open} onClose={onClose} title="Add from products" theme={theme} wide>
      <SearchField value={searchValue} onChange={onSearch} placeholder="Search products" theme={theme}
        style={{ marginBottom: space[2] }} />
      {products.length === 0
        ? <EmptyState icon="search-outline" text="No products found." theme={theme} />
        : products.slice(0, 60).map(p => (
          <ListItem
            key={p.id}
            theme={theme}
            leadingText={p.size || '—'}
            title={p.name}
            subtitle={`Stock ${p.stock_qty} · Sold ${p.sold_qty}`}
            onPress={() => onPick(p)}
            trailing={(
              <View style={{ alignItems: 'flex-end', gap: space[1] }}>
                <MoneyText paiseText={`₹${formatPaise(p.unit_paise)}`} theme={theme} small />
                <Badge label={`Avl ${p.avl_qty}`} tone={p.avl_qty < 0 ? 'error' : p.avl_qty === 0 ? 'neutral' : 'success'} theme={theme} />
              </View>
            )}
          />
        ))}
    </Sheet>
  );
}
