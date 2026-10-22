import type { InvoiceLine, InvoiceTotals } from './types';

// All money is integer paise so totals never leave the integer domain
// except for line qty * rate.

export function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

export function toPaise(rupees: number): number {
  return roundHalfUp(rupees * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function wordsBelow100(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t] ?? ''}${o ? ' ' + (ONES[o] ?? '') : ''}`;
}

function wordsBelow1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ONES[h] ?? ''} Hundred`);
  if (r > 0) parts.push(wordsBelow100(r));
  return parts.join(' ');
}

// Indian numbering: Crore / Lakh / Thousand / Hundred.
export function numberToWordsIndian(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const paiseRem = paise % 100;
  if (rupees === 0 && paiseRem === 0) return 'Zero Rupees Only';

  const chunks: Array<[number, string]> = [
    [10000000, 'Crore'],
    [100000, 'Lakh'],
    [1000, 'Thousand'],
  ];
  const parts: string[] = [];
  let rest = rupees;
  for (const [div, label] of chunks) {
    const q = Math.floor(rest / div);
    if (q > 0) {
      parts.push(`${wordsBelow1000(q)} ${label}`);
      rest %= div;
    }
  }
  if (rest > 0) parts.push(wordsBelow1000(rest));

  let out = `Rupees ${parts.join(' ')}`;
  if (paiseRem > 0) out += ` And ${wordsBelow100(paiseRem)} Paise`;
  return `${out} Only`;
}

export function linePaise(qty: number, unitPaise: number): number {
  return roundHalfUp(qty * unitPaise);
}

export function computeTotals(
  lines: InvoiceLine[],
  discountPercent: number,
): InvoiceTotals {
  const gross = lines.reduce((sum, l) => sum + linePaise(l.qty, l.unit_paise), 0);
  const discount = discountPercent > 0
    ? roundHalfUp((gross * discountPercent) / 100)
    : 0;
  const net = Math.max(0, gross - discount);

  // Round-off to the whole rupee, like the desktop app.
  const total = roundHalfUp(net / 100) * 100;
  const roundOff = total - net;

  return { gross, discount, net, roundOff, total };
}

const group = (n: number): string => n.toLocaleString('en-IN');

export function formatPaise(paise: number, withRupeeSign = false): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const body = `${group(rupees)}.${String(rem).padStart(2, '0')}`;
  return `${sign}${withRupeeSign ? '₹' : ''}${body}`;
}

export function formatRupeesShort(paise: number): string {
  const abs = Math.abs(paise);
  if (abs >= 1000000000) return `${(paise / 1000000000).toFixed(2)} Cr`;
  if (abs >= 10000000) return `${(paise / 10000000).toFixed(2)} L`;
  if (abs >= 100000) return `${(paise / 100000).toFixed(1)} K`;
  return formatPaise(paise);
}

export function formatInvoiceNo(prefix: string, seq: number): string {
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysIso(iso: string, days: number): string {
  const parts = iso.split('-');
  let dt = new Date();
  if (parts.length === 3) {
    const [y, m, d] = [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      dt = new Date(y, m - 1, d);
    }
  }
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function formatDateDisplay(iso: string | null): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${MON[(Number(m) - 1) % 12] ?? ''} ${y?.slice(2) ?? ''}`;
}
