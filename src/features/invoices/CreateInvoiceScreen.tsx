// S4 — Create / Edit invoice. Read top to bottom:
//   STEPS, S4             the text and the numbers you are most likely to edit
//   blankForm()           the empty form
//   useInvoiceForm()      all state, data and actions (no JSX)
//   CreateInvoiceScreen() the phone / tablet switch, built on <Screen>
//   Header … TotalBar     one function per region, in the order they appear on screen
//   CatalogSheet          P2
// IDs (S4.A, S4.B.3 …) are from SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Platform, Pressable, ScrollView, Text, View,
} from 'react-native';
import { alert } from '../../ui/alert';
import WebView from 'react-native-webview';
import { useTheme } from '../../shell/providers';
import { Feather } from '@expo/vector-icons';
import { useBackIntercept, useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { Screen, useMainInset } from '../../ui/Screen';
import {
  Badge, Button, Card, Chip, IconButton, Input, ListItem, MoneyInput, MoneyText, SearchField, SectionTitle,
  SegmentedControl, TopAppBar, TotalRow, EmptyState,
} from '../../ui/components';
import { Columns } from '../../ui/Columns';
import { Sheet } from '../../ui/Sheet';
import { useSnackbar } from '../../ui/Snackbar';
import { font, layout, radius, shadow, space, touch, type, maxReadWidth } from '../../ui/tokens';
import type { Theme } from '../../ui/tokens';
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

// S4.L1.1 — the phone stepper's three steps, in order.
const STEPS = ['Bill to', 'Items', 'Review'];

// Every number that is specific to this screen. Shared spacing comes from
// tokens.ts (layout.side 20, layout.gap 16, layout.grid 12).
const S4 = {
  stepCircle: 28, // S4.L1.1: stepper circle diameter
  catalogWidth: '25%', // S4.L3: products panel
  formWidth: '38%', // S4.L3: form pane (a ScrollView; 38% is its flex basis, it may grow)
  previewWidth: '37%', // S4.L3: preview pane
  previewWidthTwoPane: '40%', // S4.L2 at lg: preview pane beside the form
  catalogNarrowBelow: 300, // S4.L3: under this panel width, product names take two lines
  pageSizeControl: 180, // S4.E: width of the A4 / Letter control
  previewMinHeight: 400, // S4.E: the printed page frame
  qtyRateWeights: [1, 1.4], // S4.B.3: Qty | Rate column weights
  inputPull: -space[4], // last input in a card: pulls the card's bottom padding up under the field
} as const;

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

type Line = InvoiceForm['lines'][number];

// ---------------------------------------------------------------------------
// State and data: the form, its totals, the draft autosave, the catalog, the
// preview HTML, and every action (issue, save draft, leave, Back).
// ---------------------------------------------------------------------------
function useInvoiceForm({ draftId, invoiceId }: { draftId?: number; invoiceId?: number }) {
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
  // S4.L3 products panel is 25 % of the width after the 88 rail; under 300 dp names need two lines.
  const narrowCatalog = (bp.width - 88) * 0.25 < S4.catalogNarrowBelow;
  useEffect(() => {
    if (showsCatalogPanel) void listProducts(catalogSearch).then(setProducts);
    // Only on entering the xl layout; typing in the search reloads by itself.
  }, [showsCatalogPanel]);

  const openCatalog = () => {
    setCatalogOpen(true);
    void listProducts().then(setProducts);
  };

  const searchCatalog = (v: string) => {
    setCatalogSearch(v);
    void listProducts(v).then(setProducts);
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

  const updateLine = (i: number, p: Partial<Line>) => {
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

  return {
    settings, form, totals, previewNo, editInvoiceId,
    title: editInvoiceId ? 'Edit invoice' : 'New invoice',
    step, setStep,
    catalogOpen, closeCatalog: () => setCatalogOpen(false), catalogSearch, products, narrowCatalog,
    tabPreview, togglePreview: () => setTabPreview(p => !p),
    pageSize, setPageSize, previewHtml,
    patch, autosave, openCatalog, searchCatalog, addLine, addBlankLine, updateLine, removeLine,
    issue, saveAsDraft, leave,
  };
}
type Form = ReturnType<typeof useInvoiceForm>;

// ---------------------------------------------------------------------------
// The screen: phone = header + stepper + step body + TOTAL bar;
// xl = header + [catalog | form | preview]; md / lg = header + [form | preview].
// ---------------------------------------------------------------------------
export function CreateInvoiceScreen({ draftId, invoiceId }: { draftId?: number; invoiceId?: number }) {
  const theme = useTheme();
  const bp = useBreakpoint();
  const f = useInvoiceForm({ draftId, invoiceId });
  const sheet = <CatalogSheet
    open={f.catalogOpen} onClose={f.closeCatalog} theme={theme}
    products={f.products} onSearch={f.searchCatalog} searchValue={f.catalogSearch} onPick={f.addLine}
  />;

  if (bp.isPhone) {
    return (
      <Screen
        overlay
        header={<Header f={f} theme={theme} />}
        below={<Stepper steps={STEPS} step={f.step} onStep={f.setStep} theme={theme} />}
        footer={<TotalBar f={f} theme={theme} />}
      >
        <StepBody f={f} theme={theme} />
        {sheet}
      </Screen>
    );
  }

  if (bp.atLeast('xl')) {
    return (
      <Screen overlay header={<Header f={f} theme={theme} />}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <CatalogPanel f={f} theme={theme} />
          <FormPane f={f} theme={theme} width={S4.formWidth} />
          <View style={{ width: S4.previewWidth, paddingEnd: layout.side, paddingBottom: layout.gap }}>
            <PreviewPane f={f} theme={theme} />
          </View>
        </View>
      </Screen>
    );
  }

  // md: one pane, the header's eye button swaps form and preview; lg: form | preview 40 %.
  const md = bp.bp === 'md';
  return (
    <Screen overlay header={<Header f={f} theme={theme} eye={md} />}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {!(md && f.tabPreview)
            ? <FormPane f={f} theme={theme} maxWidth={maxReadWidth} />
            : <View style={{ flex: 1, paddingHorizontal: layout.side, paddingBottom: layout.gap }}><PreviewPane f={f} theme={theme} /></View>}
        </View>
        {md ? null : (
          <View style={{ width: S4.previewWidthTwoPane, paddingEnd: layout.side, paddingBottom: layout.gap }}>
            <PreviewPane f={f} theme={theme} />
          </View>
        )}
      </View>
      {sheet}
    </Screen>
  );
}

// S4 app bar — "New invoice" / "Edit invoice", the invoice number, glass back button (leave);
// at md an eye / pencil button swaps the form and the preview.
function Header({ f, theme, eye }: { f: Form; theme: Theme; eye?: boolean }) {
  return (
    <TopAppBar
      title={f.title} subtitle={f.previewNo} theme={theme} onBack={f.leave}
      actions={eye
        ? [{ icon: f.tabPreview ? 'edit-2' : 'eye', label: f.tabPreview ? 'Show form' : 'Show preview', onPress: f.togglePreview }]
        : undefined}
    />
  );
}

// S4.L1.1 — Stepper on the kit's selected-state recipe: 28 circles (blue + white when
// active or done, glass when not), 2px connectors, 14/500 labels. Tap a step to jump.
function Stepper({ steps, step, onStep, theme }: {
  steps: string[]; step: number; onStep: (i: number) => void; theme: Theme;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: layout.side, paddingBottom: space[2] }}>
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <React.Fragment key={s}>
            {i > 0 ? (
              <View style={{
                flex: 1, height: 2, borderRadius: radius.pill, marginHorizontal: space[2],
                backgroundColor: done || active ? theme.accent : theme.divider,
              }} />
            ) : null}
            <Pressable
              onPress={() => onStep(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Step ${i + 1} of ${steps.length}: ${s}`}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: touch.min }}
            >
              <View style={{
                width: S4.stepCircle, height: S4.stepCircle, borderRadius: S4.stepCircle / 2,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: active || done ? theme.fillStrong : theme.glassStrong,
                borderWidth: active || done ? 0 : 1, borderColor: theme.glassBorderStrong,
                boxShadow: active ? shadow.primary : undefined,
              }}>
                {done
                  ? <Feather name="check" size={16} color={theme.onFillStrong} />
                  : <Text style={[type.labelMedium, { fontFamily: font.semibold, color: active ? theme.onFillStrong : theme.textMuted }]}>{i + 1}</Text>}
              </View>
              <Text style={[type.label, { color: active ? theme.text : theme.textMuted, fontFamily: active ? font.semibold : font.medium }]}>{s}</Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Padding of every scrolling pane: side 20, gap 16, and the bottom inset from <Screen>.
function useScrollPad() {
  const bottom = useMainInset();
  return { paddingHorizontal: layout.side, paddingTop: space[1], paddingBottom: bottom, gap: layout.gap };
}

// S4.L1.2 — phone: the scrolling body of the current step.
function StepBody({ f, theme }: { f: Form; theme: Theme }) {
  const pad = useScrollPad();
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={pad} keyboardShouldPersistTaps="handled">
      {f.step === 0 ? <BillToCard f={f} theme={theme} />
        : f.step === 1 ? <ItemsSection f={f} theme={theme} />
          : <ReviewSection f={f} theme={theme} />}
    </ScrollView>
  );
}

// S4.L2 / S4.L3 — tablets: the whole form in one scroll, actions at the end (S4.F).
function FormPane({ f, theme, width, maxWidth }: { f: Form; theme: Theme; width?: string; maxWidth?: number }) {
  const pad = useScrollPad();
  return (
    <ScrollView style={width ? { width } : undefined} contentContainerStyle={[pad, maxWidth ? { maxWidth } : null]}
      keyboardShouldPersistTaps="handled">
      <BillToCard f={f} theme={theme} />
      <ItemsSection f={f} theme={theme} />
      <TotalsCard f={f} theme={theme} />
      <ActionButtons f={f} theme={theme} />
    </ScrollView>
  );
}

// S4.A — Bill to: Party name · Address · City | Pincode · Mobile | Email · Invoice date | Due date.
// Every field autosaves the draft on blur.
function BillToCard({ f, theme }: { f: Form; theme: Theme }) {
  const party = f.form.party;
  const set = (k: keyof typeof party) => (v: string) => f.patch({ party: { ...party, [k]: v } });
  const blur = () => void f.autosave();
  return (
    <Card theme={theme}>
      <SectionTitle title="Bill to" theme={theme} />
      <Input label="Party name *" value={party.party_name} autoCapitalize="words"
        onChange={set('party_name')} onBlur={blur} theme={theme} />
      <Input label="Address" value={party.party_address}
        onChange={set('party_address')} onBlur={blur} theme={theme} />
      <CityPincodeRow city={party.party_city} pincode={party.party_pincode}
        onCity={set('party_city')} onPincode={set('party_pincode')} onBlur={blur} theme={theme} />
      <MobileEmailRow f={f} theme={theme} />
      <DatesRow f={f} theme={theme} />
    </Card>
  );
}

// S4.A row 3 and S4.B.6 — one row, two equal columns: City | Pincode (6 digits).
// Columns stacks them only if a cell would be under 128 wide.
function CityPincodeRow({ city, pincode, onCity, onPincode, onBlur, theme }: {
  city: string; pincode: string; onCity: (v: string) => void; onPincode: (v: string) => void;
  onBlur: () => void; theme: Theme;
}) {
  return (
    <Columns kind="input">
      <Input label="City" value={city} onChange={onCity} onBlur={onBlur} theme={theme} />
      <Input label="Pincode" value={pincode} onChange={onPincode} onBlur={onBlur}
        theme={theme} keyboardType="numeric" maxLength={6} />
    </Columns>
  );
}

// S4.A row 4 — one row, two equal columns: Mobile | Email.
function MobileEmailRow({ f, theme }: { f: Form; theme: Theme }) {
  const party = f.form.party;
  return (
    <Columns kind="input">
      <Input label="Mobile" value={party.party_mobile}
        onChange={v => f.patch({ party: { ...party, party_mobile: v } })}
        onBlur={() => void f.autosave()} theme={theme} keyboardType="phone-pad" />
      <Input label="Email" value={party.party_email}
        onChange={v => f.patch({ party: { ...party, party_email: v } })}
        onBlur={() => void f.autosave()} theme={theme} keyboardType="email-address" autoCapitalize="none" />
    </Columns>
  );
}

// S4.A row 5 — one row, two equal columns: Invoice date | Due date (YYYY-MM-DD).
// Stacks inside the narrow xl form instead of clipping.
function DatesRow({ f, theme }: { f: Form; theme: Theme }) {
  return (
    <Columns kind="input" style={{ marginBottom: S4.inputPull }}>
      <Input label="Invoice date" value={f.form.invoiceDate}
        onChange={v => f.patch({ invoiceDate: v })} onBlur={() => void f.autosave()}
        theme={theme} tabular placeholder="YYYY-MM-DD" />
      <Input label="Due date" value={f.form.dueDate}
        onChange={v => f.patch({ dueDate: v })} onBlur={() => void f.autosave()}
        theme={theme} tabular placeholder="YYYY-MM-DD" />
    </Columns>
  );
}

// S4.B — Items: title + "Add from products" (hidden at xl, where the catalog is a panel),
// the line-item cards or the empty card, "Add free line", then Adjustments.
function ItemsSection({ f, theme }: { f: Form; theme: Theme }) {
  const bp = useBreakpoint();
  const xl = bp.atLeast('xl');
  return (
    <View style={{ gap: layout.gap }}>
      <SectionTitle title={`Items (${f.form.lines.length})`} theme={theme}
        right={xl ? undefined : (
          <Button label="Add from products" icon="tag" variant="ghost" theme={theme} onPress={f.openCatalog} />
        )}
      />
      {f.form.lines.length === 0
        ? <EmptyItemsCard xl={xl} theme={theme} />
        : f.form.lines.map((l, i) => <LineItemCard key={i} f={f} line={l} index={i} theme={theme} />)}
      {/* S4.B.4 */}
      <Button label="Add free line" icon="plus" variant="outline" theme={theme} onPress={f.addBlankLine}
        style={{ alignSelf: 'flex-start' }} />
      <AdjustmentsCard f={f} theme={theme} />
    </View>
  );
}

// S4.B.2 — "No items yet".
function EmptyItemsCard({ xl, theme }: { xl: boolean; theme: Theme }) {
  return (
    <Card theme={theme}>
      <EmptyState icon="shopping-cart" title="No items yet"
        text={xl ? 'Tap a product on the left, or add a free line.' : 'Pick products from your catalog, or add a free line.'}
        theme={theme} />
    </Card>
  );
}

// S4.B.3 — one line-item card: "ITEM n · FROM PRODUCTS / FREE LINE" + trash ·
// Description · Qty | Rate (1 : 1.4) · "Amount … ₹value".
function LineItemCard({ f, line, index, theme }: { f: Form; line: Line; index: number; theme: Theme }) {
  const blur = () => void f.autosave();
  return (
    <Card theme={theme}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space[2], marginTop: -space[2] }}>
        <Text style={[type.overline, { color: theme.textMuted, flex: 1 }]}>
          Item {index + 1} · {line.product_id ? 'From products' : 'Free line'}
        </Text>
        <IconButton icon="trash-2" label={`Remove item ${index + 1}`} onPress={() => f.removeLine(index)} theme={theme} />
      </View>
      <Input label="Description" value={line.description}
        onChange={v => f.updateLine(index, { description: v })} onBlur={blur} theme={theme} />
      <Columns kind="input" weights={[...S4.qtyRateWeights]}>
        <Input label="Qty" value={String(line.qty)}
          onChange={v => f.updateLine(index, { qty: Math.max(0, Number(v.replace(/[^0-9.]/g, '')) || 0) })}
          onBlur={blur} theme={theme} keyboardType="decimal-pad" tabular />
        <MoneyInput label="Rate (₹)" valuePaise={line.unit_paise}
          onChangePaise={p => f.updateLine(index, { unit_paise: p })} onBlur={blur} theme={theme} />
      </Columns>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[type.bodyMedium, { color: theme.textMuted }]}>Amount</Text>
        <MoneyText paiseText={`₹${formatPaise(line.line_paise)}`} theme={theme} />
      </View>
    </Card>
  );
}

// S4.B.5 — Adjustments: Discount % | "Ship to address" chip · shipping fields (S4.B.6, when
// the chip is on) · Notes (S4.B.7).
function AdjustmentsCard({ f, theme }: { f: Form; theme: Theme }) {
  const blur = () => void f.autosave();
  return (
    <Card theme={theme}>
      <SectionTitle title="Adjustments" theme={theme} />
      <View style={{ flexDirection: 'row', gap: layout.grid, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input label="Discount %" value={String(f.form.discountPercent)}
            onChange={v => f.patch({ discountPercent: Math.max(0, Math.min(100, Number(v) || 0)) })}
            onBlur={blur} theme={theme} keyboardType="decimal-pad" tabular />
        </View>
        <View style={{ flex: 1, marginBottom: space[4] }}>
          <Chip label="Ship to address" icon="truck" active={f.form.hasShipping}
            onPress={() => f.patch({ hasShipping: !f.form.hasShipping })} theme={theme} />
        </View>
      </View>
      {f.form.hasShipping ? <ShippingFields f={f} theme={theme} /> : null}
      <View style={{ marginBottom: S4.inputPull }}>
        <Input label="Notes" value={f.form.notes}
          onChange={v => f.patch({ notes: v })} onBlur={blur}
          theme={theme} multiline placeholder="Optional — printed on the invoice" />
      </View>
    </Card>
  );
}

// S4.B.6 — Consignee · Ship-to address · City | Pincode; all printed on the invoice (D1.2).
function ShippingFields({ f, theme }: { f: Form; theme: Theme }) {
  const ship = f.form.ship;
  const set = (k: keyof typeof ship) => (v: string) => f.patch({ ship: { ...ship, [k]: v } });
  const blur = () => void f.autosave();
  return (
    <>
      <Input label="Consignee" value={ship.ship_name} onChange={set('ship_name')} onBlur={blur} theme={theme} />
      <Input label="Ship-to address" value={ship.ship_address} onChange={set('ship_address')} onBlur={blur} theme={theme} />
      <CityPincodeRow city={ship.ship_city} pincode={ship.ship_pincode}
        onCity={set('ship_city')} onPincode={set('ship_pincode')} onBlur={blur} theme={theme} />
    </>
  );
}

// S4.C — Subtotal · Discount (if > 0) · Round off · Total.
function TotalsCard({ f, theme }: { f: Form; theme: Theme }) {
  const { totals } = f;
  return (
    <Card theme={theme}>
      <TotalRow label="Subtotal" value={formatPaise(totals.gross)} theme={theme} />
      {totals.discount > 0
        ? <TotalRow label={`Discount (${f.form.discountPercent}%)`} value={`-${formatPaise(totals.discount)}`} theme={theme} />
        : null}
      <TotalRow label="Round off" value={formatPaise(totals.roundOff)} theme={theme} />
      <TotalRow label="Total" value={`₹${formatPaise(totals.total)}`} theme={theme} strong />
    </Card>
  );
}

// S4.D — Review (phone step 3): Bill-to summary · compact item rows · totals · amount in words.
function ReviewSection({ f, theme }: { f: Form; theme: Theme }) {
  const { form } = f;
  return (
    <View style={{ gap: layout.gap }}>
      <Card theme={theme} style={{ gap: space[1] }}>
        <Text style={[type.overline, { color: theme.textMuted }]}>Bill to</Text>
        <Text style={[type.heading, { color: theme.text }]}>
          {form.party.party_name || '(no party)'}
        </Text>
        <Text style={[type.bodyMedium, { color: theme.textMuted }]}>
          {f.previewNo} · {form.invoiceDate}{form.dueDate ? ` · due ${form.dueDate}` : ''}
        </Text>
      </Card>
      <Card theme={theme} list>
        <View style={{ paddingTop: space[2] }}>
          <SectionTitle title={`Items (${form.lines.length})`} theme={theme} />
        </View>
        {form.lines.map((l, i) => (
          // one row: description (flex 1) | "qty × rate" | amount
          <View key={i} style={{
            flexDirection: 'row', alignItems: 'center', paddingVertical: space[3], gap: space[3],
            borderBottomWidth: i < form.lines.length - 1 ? 1 : 0, borderColor: theme.divider,
          }}>
            <Text style={[type.label, { color: theme.text, flex: 1 }]} numberOfLines={2}>
              {l.description || '(no description)'}
            </Text>
            <Text style={[type.caption, { color: theme.textMuted }]}>{l.qty} × {formatPaise(l.unit_paise)}</Text>
            <MoneyText paiseText={formatPaise(l.line_paise)} theme={theme} small />
          </View>
        ))}
      </Card>
      <TotalsCard f={f} theme={theme} />
      <Text style={[type.caption, { color: theme.textMuted, fontStyle: 'italic' }]}>
        {numberToWordsIndian(f.totals.total)}
      </Text>
    </View>
  );
}

// S4.F — right-aligned: Save draft (glass) · Issue invoice / Update (blue).
function ActionButtons({ f, theme }: { f: Form; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', gap: space[2], justifyContent: 'flex-end' }}>
      <Button label="Save draft" variant="outline" theme={theme} onPress={() => void f.saveAsDraft()} />
      <Button label={f.editInvoiceId ? 'Update' : 'Issue invoice'} icon={f.editInvoiceId ? 'check' : 'send'} theme={theme}
        onPress={() => void f.issue()} />
    </View>
  );
}

// S4.E — "Preview" + A4 / Letter control, then the printed page (always white) in a glass frame.
function PreviewPane({ f, theme }: { f: Form; theme: Theme }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] }}>
        <Text style={[type.overline, { color: theme.textMuted }]}>Preview</Text>
        <SegmentedControl label="Page size" value={f.pageSize} onChange={f.setPageSize} theme={theme}
          style={{ width: S4.pageSizeControl }}
          options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]} />
      </View>
      <View style={{
        flex: 1, borderWidth: 1, borderColor: theme.glassBorder, borderRadius: radius.card, overflow: 'hidden',
        minHeight: S4.previewMinHeight, backgroundColor: theme.paper, boxShadow: theme.cardShadow,
      }}>
        {Platform.OS === 'web'
          // Browser tier: the invoice HTML shares the page origin, so it is
          // scoped to a padded box instead of a WebView sandbox.
          // react-native-web's View renders a div and honours this prop, but
          // the RN type surface doesn't declare it.
          ? <View style={{ flex: 1 }} {...({ dangerouslySetInnerHTML: { __html: `<div style="padding:16px">${f.previewHtml}</div>` } } as object)} />
          : <WebView originWhitelist={['*']} source={{ html: f.previewHtml }} style={{ flex: 1, backgroundColor: theme.paper }} />}
      </View>
    </View>
  );
}

// S4.L3 — xl: the products panel (25 %): search, then a list; tap a product to add a line.
// Under 300 dp the name takes two lines and the size joins the price below it.
function CatalogPanel({ f, theme }: { f: Form; theme: Theme }) {
  const { products, narrowCatalog } = f;
  return (
    <View style={{ width: S4.catalogWidth, paddingStart: layout.side, paddingBottom: layout.gap, gap: space[3] }}>
      <SectionTitle title="Products" theme={theme} />
      <SearchField value={f.catalogSearch} onChange={f.searchCatalog} theme={theme} placeholder="Search products" />
      <Card theme={theme} list style={{ flex: 1, overflow: 'hidden' }}>
        <FlatList
          data={products}
          keyExtractor={p => String(p.id)}
          ListEmptyComponent={<EmptyState text="No products. Add them under Products." theme={theme} />}
          renderItem={({ item: p, index }) => (
            <ListItem
              theme={theme}
              flush
              divider={index < products.length - 1}
              title={narrowCatalog ? p.name : `${p.name}${p.size ? ` · ${p.size}` : ''}`}
              titleLines={narrowCatalog ? 2 : 1}
              subtitle={narrowCatalog && p.size ? `${p.size} · ₹${formatPaise(p.unit_paise)}` : `₹${formatPaise(p.unit_paise)}`}
              onPress={() => f.addLine(p)}
              trailing={<Badge label={`Avl ${p.avl_qty}`} tone={p.avl_qty < 0 ? 'error' : p.avl_qty === 0 ? 'neutral' : 'success'} theme={theme} />}
            />
          )}
        />
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

// S4.L1.3 — phone: floating glass bar (bottom-nav recipe) with the running TOTAL and the
// step's primary action: Next on steps 1–2, Save draft + Issue on the Review step.
// <Screen> keeps it in the flex column (it rises with the keyboard) and pads the gesture inset.
function TotalBar({ f, theme }: { f: Form; theme: Theme }) {
  return (
    <View style={{
      marginHorizontal: layout.side, marginTop: space[2],
      paddingStart: 20, paddingEnd: space[2], paddingVertical: space[2],
      borderRadius: radius.card, backgroundColor: theme.navSurface,
      borderWidth: 1, borderColor: theme.navBorder, boxShadow: shadow.secondary,
      flexDirection: 'row', alignItems: 'center', gap: space[2],
    }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.overline, { color: theme.textMuted }]}>Total</Text>
        <Text style={[type.figure, { color: theme.text }]} numberOfLines={1}>
          ₹{formatPaise(f.totals.total)}
        </Text>
      </View>
      {f.step < 2
        ? <Button label="Next" icon="arrow-right" theme={theme} onPress={() => f.setStep(f.step + 1)} />
        : <ActionButtons f={f} theme={theme} />}
    </View>
  );
}

// P2 — "Add from products" bottom sheet (phones, md, lg): search + the first 60 products.
function CatalogSheet({ open, onClose, theme, products, onSearch, searchValue, onPick }: {
  open: boolean; onClose: () => void; theme: Theme;
  products: ProductRow[]; onSearch: (v: string) => void; searchValue: string; onPick: (p: ProductRow) => void;
}) {
  return (
    <Sheet visible={open} onClose={onClose} title="Add from products" theme={theme} wide>
      <SearchField value={searchValue} onChange={onSearch} placeholder="Search products" theme={theme}
        style={{ marginBottom: space[2] }} />
      {products.length === 0
        ? <EmptyState icon="search" text="No products found." theme={theme} />
        : products.slice(0, 60).map((p, i, shown) => (
          <ListItem
            key={p.id}
            theme={theme}
            flush
            divider={i < shown.length - 1}
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
