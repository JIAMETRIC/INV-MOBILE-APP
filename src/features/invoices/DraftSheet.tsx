// A draft opened from the Invoices list (Draft tab): every detail in one sheet, editable.
// Save changes writes the draft back; "Open in editor" continues it on the full invoice screen to issue.
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { alert } from '../../ui/alert';
import { Button, Card, IconButton, Input, MoneyInput, SectionTitle } from '../../ui/components';
import { Columns } from '../../ui/Columns';
import { Dropdown } from '../../ui/Dropdown';
import { Sheet } from '../../ui/Sheet';
import { useSnackbar } from '../../ui/Snackbar';
import { space, type, white } from '../../ui/tokens';
import type { Theme } from '../../ui/tokens';
import { useNav } from '../../shell/navigation';
import { computeTotals, formatPaise, linePaise } from '../../data/money';
import { deleteDraft, saveDraft, type DraftPayload } from '../../data/draftsRepo';
import type { Draft, InvoiceLine } from '../../data/types';

// The sizes on an invoice line (the same list as the invoice screen's Size dropdown).
const SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function DraftSheet({ draft, onClose, onChanged, theme }: {
  draft: Draft | null; onClose: () => void; onChanged: () => void; theme: Theme;
}) {
  const nav = useNav();
  const snack = useSnackbar();
  const [payload, setPayload] = useState<DraftPayload | null>(null);

  // A new draft (or a reopened one) replaces the working copy.
  useEffect(() => {
    setPayload(draft ? JSON.parse(draft.payload_json) as DraftPayload : null);
  }, [draft]);

  const form = payload?.form;
  const totals = useMemo(() => form ? computeTotals(form.lines, form.discountPercent) : null, [form]);

  const patchForm = (p: Partial<DraftPayload['form']>) =>
    setPayload(cur => cur ? { ...cur, form: { ...cur.form, ...p } } : cur);

  const patchLine = (i: number, p: Partial<InvoiceLine>) =>
    setPayload(cur => {
      if (!cur) return cur;
      const lines = cur.form.lines.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...p };
        next.line_paise = linePaise(next.qty, next.unit_paise);
        return next;
      });
      return { ...cur, form: { ...cur.form, lines } };
    });

  const removeLine = (i: number) =>
    setPayload(cur => cur ? {
      ...cur,
      form: { ...cur.form, lines: cur.form.lines.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sno: idx + 1 })) },
    } : cur);

  const save = async () => {
    if (!draft || !payload || !totals) return;
    await saveDraft(draft.id, payload, totals.total);
    snack('Draft saved');
    onChanged();
  };

  const remove = () => {
    if (!draft) return;
    alert('Delete draft?', draft.draft_no, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteDraft(draft.id);
            snack('Draft deleted');
            onChanged();
            onClose();
          })();
        },
      },
    ]);
  };

  const openEditor = () => {
    if (draft) nav.openCreate({ draftId: draft.id });
  };

  return (
    <Sheet visible={!!draft} onClose={onClose} title={draft?.draft_no ?? 'Draft'} theme={theme} wide>
      {form && totals ? (
        <View style={{ gap: space[3] }}>
          <Input label="Customer name" value={form.party.party_name} autoCapitalize="words"
            onChange={v => patchForm({ party: { ...form.party, party_name: v } })} theme={theme} />
          <Input label="Mobile" value={form.party.party_mobile} keyboardType="phone-pad"
            onChange={v => patchForm({ party: { ...form.party, party_mobile: v } })} theme={theme} />
          <Input label="Invoice date" value={form.invoiceDate} tabular placeholder="YYYY-MM-DD"
            onChange={v => patchForm({ invoiceDate: v })} theme={theme} />

          <SectionTitle title={`Items (${form.lines.length})`} theme={theme} />
          {form.lines.map((l, i) => (
            <Card key={i} theme={theme} style={{ backgroundColor: theme.sheet, gap: space[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type.overline, { color: theme.textMuted, flex: 1 }]}>Item {i + 1}</Text>
                <IconButton icon="trash-2" label={`Remove item ${i + 1}`} onPress={() => removeLine(i)} theme={theme}
                  color={white} fill={theme.destructive} />
              </View>
              <Input label="Description" value={l.description}
                onChange={v => patchLine(i, { description: v })} theme={theme} />
              <Dropdown label="Size" value={l.size ?? ''} options={SIZES} theme={theme}
                onChange={v => patchLine(i, { size: v })} />
              <Columns kind="input">
                <Input label="Qty" value={String(l.qty)} keyboardType="decimal-pad" tabular
                  onChange={v => patchLine(i, { qty: Math.max(0, Number(v.replace(/[^0-9.]/g, '')) || 0) })} theme={theme} />
                <MoneyInput label="Rate (₹)" valuePaise={l.unit_paise}
                  onChangePaise={p => patchLine(i, { unit_paise: p })} theme={theme} />
              </Columns>
            </Card>
          ))}

          <Text style={[type.heading, { color: theme.text, textAlign: 'right' }]}>
            Total ₹{formatPaise(totals.total)}
          </Text>

          <Button label="Save changes" icon="check" theme={theme} onPress={() => void save()} />
          <Button label="Open in editor" icon="edit-2" variant="tonal" theme={theme} onPress={openEditor} />
          <Button label="Delete draft" icon="trash-2" variant="ghost" danger destructive theme={theme} onPress={remove} />
        </View>
      ) : null}
    </Sheet>
  );
}
