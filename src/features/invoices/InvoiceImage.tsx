// The invoice as a picture (the Image share). Drawn with plain views in the printed
// palette (white page, black text) so the PNG reads the same in any app theme.
// InvoiceDetail renders it off screen and captures it with react-native-view-shot.
import React from 'react';
import { Text, View } from 'react-native';
import { light, space, type } from '../../ui/tokens';
import { formatDateDisplay, formatPaise, numberToWordsIndian } from '../../data/money';
import type { Invoice, InvoiceLine, Settings } from '../../data/types';

export const IMAGE_WIDTH = 390;

const t = light;
const rule = { height: 1, backgroundColor: t.divider, marginVertical: space[3] };

export function InvoiceImage({ inv, lines, settings }: { inv: Invoice; lines: InvoiceLine[]; settings: Settings | null }) {
  const contact = [settings?.contact, settings?.email].filter(Boolean).join(' · ');
  const billTo = [inv.party_address, inv.party_city, inv.party_pincode].filter(Boolean).join(', ');
  const billContact = [inv.party_mobile, inv.party_email].filter(Boolean).join(' · ');

  // Top row, three columns: business (left) | payment mode, Cash or UPI (middle) | invoice no and date (right).
  // The outer two share the width equally so the middle one sits on the centre line.
  return (
    <View style={{ width: IMAGE_WIDTH, padding: space[5], backgroundColor: t.paper, gap: space[1] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: t.text }]}>{settings?.name || 'Invoice'}</Text>
          {settings?.subtitle ? <Text style={[type.bodyMedium, { color: t.textMuted }]}>{settings.subtitle}</Text> : null}
          {contact ? <Text style={[type.caption, { color: t.textMuted }]}>{contact}</Text> : null}
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={[type.overline, { color: t.textMuted }]}>Payment</Text>
          <Text style={[type.label, { color: t.text }]}>{inv.payment_mode || 'Cash'}</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
          <Text style={[type.overline, { color: t.textMuted }]}>Invoice</Text>
          <Text style={[type.label, { color: t.text }]}>{inv.invoice_no}</Text>
          <Text style={[type.caption, { color: t.textMuted }]}>{formatDateDisplay(inv.invoice_date)}</Text>
        </View>
      </View>

      <View style={rule} />

      <Text style={[type.overline, { color: t.textMuted }]}>Bill to</Text>
      <Text style={[type.label, { color: t.text }]}>{inv.party_name || '(no customer)'}</Text>
      {billTo ? <Text style={[type.caption, { color: t.textMuted }]}>{billTo}</Text> : null}
      {billContact ? <Text style={[type.caption, { color: t.textMuted }]}>{billContact}</Text> : null}

      <View style={rule} />

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Text style={[type.overline, { color: t.textMuted, flex: 1 }]}>Item</Text>
        <Text style={[type.overline, { color: t.textMuted, width: 44 }]}>Size</Text>
        <Text style={[type.overline, { color: t.textMuted, width: 40, textAlign: 'right' }]}>Qty</Text>
        <Text style={[type.overline, { color: t.textMuted, width: 70, textAlign: 'right' }]}>Rate</Text>
        <Text style={[type.overline, { color: t.textMuted, width: 80, textAlign: 'right' }]}>Amount</Text>
      </View>
      {lines.map((l, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space[2], paddingVertical: space[1] }}>
          <Text style={[type.caption, { color: t.text, flex: 1 }]} numberOfLines={2}>{l.description || '—'}</Text>
          <Text style={[type.caption, { color: t.text, width: 44 }]}>{l.size || '—'}</Text>
          <Text style={[type.number, { color: t.text, width: 40, textAlign: 'right' }]}>{l.qty}</Text>
          <Text style={[type.number, { color: t.text, width: 70, textAlign: 'right' }]}>{formatPaise(l.unit_paise)}</Text>
          <Text style={[type.number, { color: t.text, width: 80, textAlign: 'right' }]}>{formatPaise(l.line_paise)}</Text>
        </View>
      ))}

      <View style={rule} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type.bodyMedium, { color: t.textMuted }]}>Subtotal</Text>
        <Text style={[type.number, { color: t.text }]}>{formatPaise(inv.gross_paise)}</Text>
      </View>
      {inv.discount_paise > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[type.bodyMedium, { color: t.textMuted }]}>Discount ({inv.discount_percent}%)</Text>
          <Text style={[type.number, { color: t.text }]}>-{formatPaise(inv.discount_paise)}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[type.bodyMedium, { color: t.textMuted }]}>Round off</Text>
        <Text style={[type.number, { color: t.text }]}>{formatPaise(inv.round_off_paise)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space[1] }}>
        <Text style={[type.heading, { color: t.text }]}>Total</Text>
        <Text style={[type.figure, { color: t.text }]}>₹{formatPaise(inv.total_paise)}</Text>
      </View>
      <Text style={[type.caption, { color: t.textMuted, fontStyle: 'italic' }]}>{numberToWordsIndian(inv.total_paise)}</Text>

      {settings?.upi_id ? (
        <>
          <View style={rule} />
          <Text style={[type.caption, { color: t.textMuted }]}>UPI: {settings.upi_id}</Text>
        </>
      ) : null}
    </View>
  );
}
