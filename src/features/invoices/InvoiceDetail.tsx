import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { alert } from '../../ui/alert';
import { useTheme } from '../../shell/providers';
import { useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { Button, Card, Chip, Input, MoneyText, SectionTitle, StatusGlyph, TotalRow } from '../../ui/components';
import { Sheet } from '../../ui/Sheet';
import { useSnackbar } from '../../ui/Snackbar';
import { space, type, maxReadWidth } from '../../ui/tokens';
import { formatPaise, formatDateDisplay } from '../../data/money';
import { getInvoice, getLines, setStatus } from '../../data/invoicesRepo';
import { paidPaiseForInvoice, recordPayment } from '../../data/paymentsRepo';
import { logAudit } from '../../data/auditRepo';
import { exportInvoicePdfAndShare, shareFile } from '../../export/pdf';
import { exportInvoicesXlsx } from '../../export/xlsx';
import type { Invoice, InvoiceLine } from '../../data/types';

export function InvoiceDetail({ invoiceId }: { invoiceId: number }) {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
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

  if (!inv) {
    return (
      <View style={{ padding: space[6], alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const voidInvoice = () => {
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

  const outstanding = inv.total_paise - paid;

  const submitPayment = async () => {
    const amount = Number(payAmount.trim());
    if (!amount || amount <= 0) {
      setPayError('Enter the amount received, in rupees.');
      return;
    }
    setPayOpen(false);
    await recordPayment({
      payment_date: new Date().toISOString().slice(0, 10),
      party_name: inv.party_name,
      invoiceIds: [inv.id],
      mode: payMode,
      reference_no: '',
      amount_paise: Math.round(amount * 100),
      remarks: `Payment against ${inv.invoice_no}`,
    });
    await logAudit('payment.record', 'invoice', inv.invoice_no, { amount_paise: Math.round(amount * 100) });
    nav.refresh();
    snack(`₹${formatPaise(Math.round(amount * 100))} recorded (${payMode})`);
  };

  const share = (kind: 'pdf' | 'xlsx') => {
    setBusy(kind);
    const job = kind === 'pdf'
      ? exportInvoicePdfAndShare(inv.id)
      : exportInvoicesXlsx([inv]).then(f => shareFile(f.uri));
    void job.catch(e => alert('Export failed', e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  };

  const canPay = inv.status !== 'void' && inv.status !== 'paid' && outstanding > 0;
  const party = [inv.party_address, inv.party_city, inv.party_pincode].filter(Boolean).join(', ');
  const contact = [inv.party_mobile && `Ph ${inv.party_mobile}`, inv.party_email].filter(Boolean).join(' · ');

  return (
    <>
    <ScrollView contentContainerStyle={{ padding: bp.margin, maxWidth: maxReadWidth, paddingBottom: space[7] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[3] }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[type.title, { color: theme.text }]} numberOfLines={1}>{inv.invoice_no}</Text>
          <Text style={[type.bodyMedium, { color: theme.textMuted }]}>
            {formatDateDisplay(inv.invoice_date)}
            {inv.due_date ? ` · due ${formatDateDisplay(inv.due_date)}` : ''}
          </Text>
        </View>
        <StatusGlyph status={inv.status} theme={theme} />
      </View>

      <Card theme={theme} variant="filled" style={{ marginBottom: space[4] }}>
        <Text style={[type.labelMedium, { color: theme.textMuted }]}>BILL TO</Text>
        <Text style={[type.heading, { color: theme.text, marginTop: space[1] }]}>{inv.party_name || '(no party)'}</Text>
        {party ? <Text style={[type.bodyMedium, { color: theme.textMuted }]}>{party}</Text> : null}
        {contact ? <Text style={[type.bodyMedium, { color: theme.textMuted }]}>{contact}</Text> : null}
      </Card>

      {/* Primary actions first, within thumb reach. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[4] }}>
        {canPay ? <Button label="Record payment" icon="cash-outline" theme={theme} onPress={askPayment} /> : null}
        <Button label="Share PDF" icon="share-social-outline" variant={canPay ? 'tonal' : 'solid'} theme={theme}
          busy={busy === 'pdf'} onPress={() => share('pdf')} />
        <Button label="Excel" icon="grid-outline" variant="outline" theme={theme}
          busy={busy === 'xlsx'} onPress={() => share('xlsx')} />
      </View>

      <SectionTitle title={`Items (${lines.length})`} theme={theme} />
      <View style={{ borderBottomWidth: 1, borderColor: theme.outline, flexDirection: 'row', paddingBottom: space[1] }}>
        {['Item', 'Qty', 'Rate', 'Amount'].map((h, i) => (
          <Text key={h} style={[type.labelMedium, {
            color: theme.textMuted,
            flex: i === 0 ? 3 : 1,
            textAlign: i >= 1 ? 'right' : 'left',
          }]}>{h}</Text>
        ))}
      </View>
      {lines.map(l => (
        <View key={l.sno} style={{ flexDirection: 'row', paddingVertical: space[3], borderBottomWidth: 1, borderColor: theme.border }}>
          <View style={{ flex: 3, marginEnd: space[2] }}>
            <Text style={[type.bodyMedium, { color: theme.text }]} numberOfLines={2}>{l.description}</Text>
          </View>
          <View style={{ flex: 1 }}><MoneyText paiseText={String(l.qty)} theme={theme} small /></View>
          <View style={{ flex: 1 }}><MoneyText paiseText={formatPaise(l.unit_paise)} theme={theme} small /></View>
          <View style={{ flex: 1 }}><MoneyText paiseText={formatPaise(l.line_paise)} theme={theme} small /></View>
        </View>
      ))}

      <View style={{ marginTop: space[3] }}>
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
      </View>

      {inv.status !== 'void' ? (
        <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[5] }}>
          <Button label="Edit" icon="create-outline" variant="outline" theme={theme}
            onPress={() => nav.openCreate({ invoiceId: inv.id })} />
          <Button label="Void" icon="close-circle-outline" variant="ghost" danger theme={theme} onPress={voidInvoice} />
        </View>
      ) : null}
    </ScrollView>
    <Sheet visible={payOpen} onClose={() => setPayOpen(false)}
      title="Record payment" theme={theme}>
      <Text style={[type.bodyMedium, { color: theme.textMuted, marginBottom: space[3] }]}>
        {inv.invoice_no} · outstanding ₹{formatPaise(outstanding)}
      </Text>
      <Input label="Amount (₹)" value={payAmount} onChange={v => { setPayAmount(v); setPayError(''); }}
        theme={theme} keyboardType="decimal-pad" tabular placeholder="0.00" error={payError || undefined} />
      <Text style={[type.labelMedium, { color: theme.textMuted }]}>Mode</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space[3] }}>
        {['Cash', 'UPI', 'NEFT', 'Cheque'].map(m => (
          <Chip key={m} label={m} active={payMode === m} onPress={() => setPayMode(m)} theme={theme} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space[2] }}>
        <Button label="Cancel" variant="ghost" theme={theme} onPress={() => setPayOpen(false)} />
        <Button label="Save payment" theme={theme} onPress={() => void submitPayment()} />
      </View>
    </Sheet>
    </>
  );
}
