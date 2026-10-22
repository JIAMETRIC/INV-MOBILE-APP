import { gray } from '../ui/tokens';
import { formatDateDisplay, formatPaise } from '../data/money';
import type { Invoice, InvoiceLine, Settings } from '../data/types';

export type PageSize = 'A4' | 'Letter';

const esc = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (p: number) => formatPaise(p, false);

export function buildInvoiceHtml(
  inv: Invoice,
  lines: InvoiceLine[],
  s: Settings,
  pageSize: PageSize = 'A4',
): string {
  const dims = pageSize === 'A4' ? '210mm 297mm' : '216mm 279mm';
  const lineRows = lines.map(l => `
    <tr>
      <td>${l.sno}</td>
      <td>${esc(l.description)}</td>
      <td class="n">${l.qty}</td>
      <td class="n">${money(l.unit_paise)}</td>
      <td class="n">${money(l.line_paise)}</td>
    </tr>`).join('');

  const shipBlock = inv.has_shipping ? `
    <div class="box">
      <div class="h">SHIP TO / CONSIGNEE</div>
      <div>${esc(inv.ship_name)}<br/>${esc(inv.ship_address)}<br/>
      ${esc(inv.ship_city)} ${esc(inv.ship_pincode)}</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: ${dims}; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 10mm 9mm;
    color: ${gray[1000]}; background: ${gray[0]};
    font-family: 'Courier New', monospace; font-size: 9.5px; line-height: 1.35;
  }
  .grid { display: flex; justify-content: space-between; }
  .head { border-bottom: 2px solid ${gray[1000]}; padding-bottom: 6px; margin-bottom: 8px; }
  .co { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
  .sub { color: ${gray[600]}; }
  .h { font-weight: 700; color: ${gray[600]}; font-size: 8px; letter-spacing: 1px; margin-bottom: 2px; }
  .box { border: 1px solid ${gray[300]}; padding: 6px; margin-bottom: 8px; width: 49%; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid ${gray[300]}; padding: 3px 4px; text-align: left; vertical-align: top; }
  th { background: ${gray[100]}; font-size: 8px; letter-spacing: 1px; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .tot { width: 52%; margin-left: auto; }
  .tot td { border: none; padding: 2px 4px; }
  .tot td.v { text-align: right; font-variant-numeric: tabular-nums; }
  .grand td { border-top: 2px solid ${gray[1000]}; border-bottom: 2px solid ${gray[1000]}; font-weight: 700; }
  .words { border: 1px solid ${gray[300]}; padding: 6px; margin: 8px 0; font-style: italic; }
  .foot { display: flex; justify-content: space-between; margin-top: 16px; }
  .upi { border: 1px solid ${gray[1000]}; padding: 6px; text-align: center; }
  .sig { text-align: center; border-top: 1px solid ${gray[700]}; width: 160px; padding-top: 4px; margin-top: 30px; }
  .meta { color: ${gray[600]}; }
  .invno { font-size: 13px; font-weight: 700; }
</style></head>
<body>
  <div class="head grid">
    <div>
      <div class="co">${esc(s.name || '—')}</div>
      ${s.subtitle ? `<div class="sub">${esc(s.subtitle)}</div>` : ''}
      <div>${esc(s.address)}<br/>${esc(s.city)} ${esc(s.pincode)}<br/>
      ${s.contact ? 'Ph: ' + esc(s.contact) + '<br/>' : ''}${s.email ? esc(s.email) + '<br/>' : ''}
      ${s.pan ? 'PAN: ' + esc(s.pan) : ''}</div>
    </div>
    <div style="text-align:right">
      <div class="invno">${esc(inv.invoice_no)}</div>
      <div class="meta">Date: ${formatDateDisplay(inv.invoice_date)}</div>
      ${inv.due_date ? `<div class="meta">Due: ${formatDateDisplay(inv.due_date)}</div>` : ''}
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="h">BILL TO</div>
      <div><b>${esc(inv.party_name)}</b><br/>${esc(inv.party_address)}<br/>
      ${esc(inv.party_city)} ${esc(inv.party_pincode)}<br/>
      ${inv.party_mobile ? 'Ph: ' + esc(inv.party_mobile) : ''}</div>
    </div>
    ${shipBlock}
  </div>

  <table>
    <thead><tr>
      <th>#</th><th>ITEM</th>
      <th class="n">QTY</th><th class="n">RATE</th><th class="n">AMOUNT</th>
    </tr></thead>
    <tbody>${lineRows}</tbody>
  </table>

  <table class="tot">
    <tr><td>Gross</td><td class="v">${money(inv.gross_paise)}</td></tr>
    ${inv.discount_paise > 0 ? `<tr><td>Discount (${inv.discount_percent}%)</td><td class="v">-${money(inv.discount_paise)}</td></tr>` : ''}
    <tr><td>Round Off</td><td class="v">${money(inv.round_off_paise)}</td></tr>
    <tr class="grand"><td>TOTAL (₹)</td><td class="v">${money(inv.total_paise)}</td></tr>
  </table>

  <div class="words">Amount in words: ${esc(inv.amount_in_words)}</div>

  <div class="foot">
    <div>
      ${s.bank_name ? `<div class="h">BANK DETAILS</div><div>${esc(s.bank_name)}, ${esc(s.bank_branch)}<br/>A/C: ${esc(s.bank_ac_no)} · IFSC: ${esc(s.bank_ifsc)}</div>` : ''}
      ${inv.notes ? '<div class="meta" style="margin-top:6px">' + esc(inv.notes) + '</div>' : ''}
    </div>
    ${inv.upi_id || s.upi_id ? `<div class="upi"><div class="h">PAY VIA UPI</div><b>${esc(inv.upi_id || s.upi_id)}</b></div>` : '<div></div>'}
    <div class="sig">Authorised Signatory</div>
  </div>
</body></html>`;
}
