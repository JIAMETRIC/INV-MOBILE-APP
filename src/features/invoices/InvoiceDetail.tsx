// S3 — Invoice detail. Read top to bottom:
//   PAY_MODES, S3         the text and the numbers you are most likely to edit
//   useInvoiceDetail()    all state, data and actions (no JSX)
//   InvoiceDetail()       the spinner, then Main + the P1 sheet
//   DetailMain … LineRow  one function per region, in the order they appear on screen
//   PaymentSheet          P1
// S3 has no header or footer of its own: on phones the shell draws the "Invoice" back bar
// (App.tsx), on tablets S2's DetailPane hosts it. So this file is an embeddable Main.
// IDs (S3.1 …) are from SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { alert } from '../../ui/alert';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { Button, Card, Input, MoneyText, SectionTitle, SegmentedControl, StatusGlyph, TotalRow } from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import { useSnackbar } from '../../ui/Snackbar';
import { layout, space, type, maxReadWidth } from '../../ui/tokens';
import type { Theme } from '../../ui/tokens';
import { formatPaise, formatDateDisplay } from '../../data/money';
import { getInvoice, getLines, setStatus } from '../../data/invoicesRepo';
import { paidPaiseForInvoice, recordPayment } from '../../data/paymentsRepo';
import { logAudit } from '../../data/auditRepo';
import { exportInvoicePdfAndShare, shareFile } from '../../export/pdf';
import { exportInvoicesXlsx } from '../../export/xlsx';
import type { Invoice, InvoiceLine } from '../../data/types';

// P1 — the payment modes, in order.
const PAY_MODES = ['Cash', 'UPI', 'NEFT', 'Cheque'].map(m => ({ value: m, label: m }));

// Every number that is specific to this screen. Shared spacing comes from
// tokens.ts (layout.side 20, layout.gap 16, layout.grid 12).
const S3 = {
  itemColumns: [2.6, 0.8, 1.3, 1.3], // S3.4: Item · Qty · Rate · Amount flex shares (header and rows)
  readWidth: maxReadWidth, // the scroll content's max width (720)
  bottomPad: space[6], // the end of the scroll (32)
  paisePerRupee: 100, // P1: the typed amount is rupees
} as const;

// ---------------------------------------------------------------------------
// State and data: the invoice, its lines and payments, the two exports, Void,
// and the Record-payment sheet (P1).
// ---------------------------------------------------------------------------
function useInvoiceDetail(invoiceId: number) {
  const nav = useNav();
  const snack = useSnackbar();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState('');
  const [payMode, setPayMode] = useState('Cash');

  const load = useCallback(async () => {
    const i = await getInvoice(invoiceId);
    setInv(i);
    if (i) {
      setLines(await getLines(i.id));
      setPaid(await paidPaiseForInvoice(i.id));
    }
  }, [invoiceId]);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  const voidInvoice = () => {
    if (!inv) return;
    alert('Void invoice?', `${inv.invoice_no} will be marked Void. It stays in the register.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Void', style: 'destructive',
        onPress: async () => {
          await setStatus(inv.id, 'void');
          await logAudit('invoice.void', 'invoice', inv.invoice_no);
          nav.refresh();
          snack(`${inv.invoice_no} voided`);
        },
      },
    ]);
  };

  const askPayment = () => {
    setPayAmount('');
    setPayError('');
    setPayOpen(true);
  };

  const outstanding = inv ? inv.total_paise - paid : 0;

  const submitPayment = async () => {
    if (!inv) return;
    const amount = Number(payAmount.trim());
    if (!amount || amount <= 0) {
      setPayError('Enter the amount received, in rupees.');
      return;
    }
    setPayOpen(false);
    const amountPaise = Math.round(amount * S3.paisePerRupee);
    await recordPayment({
      payment_date: new Date().toISOString().slice(0, 10),
      party_name: inv.party_name,
      invoiceIds: [inv.id],
      mode: payMode,
      reference_no: '',
      amount_paise: amountPaise,
      remarks: `Payment against ${inv.invoice_no}`,
    });
    await logAudit('payment.record', 'invoice', inv.invoice_no, { amount_paise: amountPaise });
    nav.refresh();
    snack(`₹${formatPaise(amountPaise)} recorded (${payMode})`);
  };

  const share = (kind: 'pdf' | 'xlsx') => {
    if (!inv) return;
    setBusy(kind);
    const job = kind === 'pdf'
      ? exportInvoicePdfAndShare(inv.id)
      : exportInvoicesXlsx([inv]).then(f => shareFile(f.uri));
    void job.catch(e => alert('Export failed', e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };

  const canPay = !!inv && inv.status !== 'void' && inv.status !== 'paid' && outstanding > 0;
  const party = inv ? [inv.party_address, inv.party_city, inv.party_pincode].filter(Boolean).join(', ') : '';
  const contact = inv ? [inv.party_mobile && `Ph ${inv.party_mobile}`, inv.party_email].filter(Boolean).join(' · ') : '';

  return {
    inv, lines, paid, outstanding, busy, canPay, party, contact,
    payOpen, closePayment: () => setPayOpen(false), payAmount, setPayAmount, payError, setPayError, payMode, setPayMode,
    voidInvoice, askPayment, submitPayment, share,
    openEdit: () => { if (inv) nav.openCreate({ invoiceId: inv.id }); },
  };
}
type DetailState = ReturnType<typeof useInvoiceDetail>;
// Below the spinner every region sees a loaded invoice.
type Loaded = DetailState & { inv: Invoice };

// ---------------------------------------------------------------------------
// The embedded screen: a spinner until the invoice loads, then Main + P1.
// ---------------------------------------------------------------------------
export function InvoiceDetail({ invoiceId }: { invoiceId: number }) {
  const theme = useTheme();
  const d = useInvoiceDetail(invoiceId);

  if (!d.inv) {
    return (
      <View style={{ padding: space[6], alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }
  const s = d as Loaded;
  return (
    <>
      <DetailMain s={s} theme={theme} />
      <PaymentSheet s={s} theme={theme} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// S3 — the one scroller, capped at the reading width: header row, bill-to, actions, items, totals, Edit / Void.
function DetailMain({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <ScrollView contentContainerStyle={{
      paddingHorizontal: layout.side, paddingTop: space[1], paddingBottom: S3.bottomPad,
      maxWidth: S3.readWidth, gap: layout.gap,
    }}>
      <HeaderRow s={s} theme={theme} />
      <BillToCard s={s} theme={theme} />
      <ActionRow s={s} theme={theme} />
      <ItemsCard s={s} theme={theme} />
      <TotalsCard s={s} theme={theme} />
      {s.inv.status !== 'void' ? <EditVoidRow s={s} theme={theme} /> : null}
    </ScrollView>
  );
}

// S3.1 — one row: invoice number over "date · due" (grows) | the status pill.
function HeaderRow({ s, theme }: { s: Loaded; theme: Theme }) {
  const { inv } = s;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[type.title, { color: theme.text }]} numberOfLines={1}>{inv.invoice_no}</Text>
        <Text style={[type.bodyMedium, { color: theme.textMuted }]}>
          {formatDateDisplay(inv.invoice_date)}
          {inv.due_date ? ` · due ${formatDateDisplay(inv.due_date)}` : ''}
        </Text>
      </View>
      <StatusGlyph status={inv.status} theme={theme} />
    </View>
  );
}

// S3.2 — "BILL TO" · party name · "address, city, pincode" · "Ph … · email" (each line only when present).
function BillToCard({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <Card theme={theme} style={{ gap: space[1] }}>
      <Text style={[type.overline, { color: theme.textMuted }]}>Bill to</Text>
      <Text style={[type.heading, { color: theme.text }]}>{s.inv.party_name || '(no customer)'}</Text>
      {s.party ? <Text style={[type.bodyMedium, { color: theme.textMuted }]}>{s.party}</Text> : null}
      {s.contact ? <Text style={[type.bodyMedium, { color: theme.textMuted }]}>{s.contact}</Text> : null}
    </Card>
  );
}

// S3.3 — primary actions first, within thumb reach; the row wraps:
// Record payment (only when something is outstanding) · Share PDF · Excel.
function ActionRow({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.grid }}>
      {s.canPay ? <Button label="Record payment" icon="credit-card" theme={theme} onPress={s.askPayment} /> : null}
      <Button label="Share PDF" icon="share-2" variant={s.canPay ? 'tonal' : 'solid'} theme={theme}
        busy={s.busy === 'pdf'} onPress={() => s.share('pdf')} />
      <Button label="Excel" icon="grid" variant="outline" theme={theme}
        busy={s.busy === 'xlsx'} onPress={() => s.share('xlsx')} />
    </View>
  );
}

// S3.4 — "Items (n)", the column header, then one LineRow per line.
function ItemsCard({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <Card theme={theme}>
      <SectionTitle title={`Items (${s.lines.length})`} theme={theme} />
      <ItemsHeader theme={theme} />
      {s.lines.map((l, i) => <LineRow key={l.sno} line={l} last={i === s.lines.length - 1} theme={theme} />)}
    </Card>
  );
}

// S3.4.h — Item · Qty · Rate · Amount, flex shares from S3.itemColumns; numbers right-aligned.
function ItemsHeader({ theme }: { theme: Theme }) {
  return (
    <View style={{ borderBottomWidth: 1, borderColor: theme.divider, flexDirection: 'row', paddingBottom: space[2] }}>
      {['Item', 'Qty', 'Rate', 'Amount'].map((h, i) => (
        <Text key={h} numberOfLines={1} style={[type.overline, {
          color: theme.textMuted,
          flex: S3.itemColumns[i],
          textAlign: i >= 1 ? 'right' : 'left',
        }]}>{h}</Text>
      ))}
    </View>
  );
}

// S3.4.r — one line: description (up to 2 lines) · qty · rate · amount, the same flex shares.
const LineRow = React.memo(function LineRow({ line, last, theme }: { line: InvoiceLine; last: boolean; theme: Theme }) {
  const [item, qty, rate, amount] = S3.itemColumns;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: space[3],
      borderBottomWidth: last ? 0 : 1, borderColor: theme.divider,
    }}>
      <View style={{ flex: item, marginEnd: space[2] }}>
        <Text style={[type.label, { color: theme.text }]} numberOfLines={2}>{line.description}</Text>
      </View>
      <View style={{ flex: qty }}><MoneyText paiseText={String(line.qty)} theme={theme} small /></View>
      <View style={{ flex: rate }}><MoneyText paiseText={formatPaise(line.unit_paise)} theme={theme} small /></View>
      <View style={{ flex: amount }}><MoneyText paiseText={formatPaise(line.line_paise)} theme={theme} small /></View>
    </View>
  );
});

// S3.5 — Gross · Discount (if > 0) · Round off · Total · Paid (if > 0) · Balance due (if paid and outstanding) ·
// amount in words (italic) · notes.
function TotalsCard({ s, theme }: { s: Loaded; theme: Theme }) {
  const { inv, paid, outstanding } = s;
  return (
    <Card theme={theme}>
      <TotalRow label="Gross" value={formatPaise(inv.gross_paise)} theme={theme} />
      {inv.discount_paise > 0
        ? <TotalRow label={`Discount (${inv.discount_percent}%)`} value={`-${formatPaise(inv.discount_paise)}`} theme={theme} />
        : null}
      <TotalRow label="Round off" value={formatPaise(inv.round_off_paise)} theme={theme} />
      <TotalRow label="Total" value={`₹${formatPaise(inv.total_paise)}`} theme={theme} strong />
      {paid > 0 ? <TotalRow label="Paid" value={formatPaise(paid)} theme={theme} /> : null}
      {paid > 0 && outstanding > 0 ? <TotalRow label="Balance due" value={formatPaise(outstanding)} theme={theme} /> : null}
      <Text style={[type.caption, { color: theme.textMuted, marginTop: space[2], fontStyle: 'italic' }]}>
        {inv.amount_in_words}
      </Text>
      {inv.notes ? <Text style={[type.bodyMedium, { color: theme.textMuted, marginTop: space[2] }]}>{inv.notes}</Text> : null}
    </Card>
  );
}

// S3.6 — Edit (glass) · Void (ghost, red); hidden once the invoice is void.
function EditVoidRow({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', gap: layout.grid }}>
      <Button label="Edit" icon="edit-2" variant="outline" theme={theme} onPress={s.openEdit} />
      <Button label="Void" icon="x-circle" variant="ghost" danger theme={theme} onPress={s.voidInvoice} />
    </View>
  );
}

// P1 — Record payment: "no · outstanding ₹" · Amount (₹) · Mode (Cash · UPI · NEFT · Cheque) · Cancel / Save payment.
// Phones: bottom sheet; tablets: centred dialog (C10).
function PaymentSheet({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <Sheet visible={s.payOpen} onClose={s.closePayment} title="Record payment" theme={theme}>
      <Text style={[type.bodyMedium, { color: theme.textMuted, marginBottom: space[4] }]}>
        {s.inv.invoice_no} · outstanding ₹{formatPaise(s.outstanding)}
      </Text>
      <Input label="Amount (₹)" value={s.payAmount} onChange={v => { s.setPayAmount(v); s.setPayError(''); }}
        theme={theme} keyboardType="decimal-pad" tabular placeholder="0.00" error={s.payError || undefined} />
      <Text style={[type.labelMedium, { color: theme.textMuted, marginBottom: space[2] }]}>Mode</Text>
      <SegmentedControl label="Payment mode" options={PAY_MODES} value={s.payMode} onChange={s.setPayMode} theme={theme}
        style={{ marginBottom: space[5] }} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space[2] }}>
        <Button label="Cancel" variant="ghost" theme={theme} onPress={s.closePayment} />
        <Button label="Save payment" theme={theme} onPress={() => void s.submitPayment()} />
      </View>
    </Sheet>
  );
}
