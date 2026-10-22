import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { buildInvoiceHtml, type PageSize } from './pdfTemplate';
import { getSettings } from '../data/settingsRepo';
import { getInvoice, getLines } from '../data/invoicesRepo';

export const isWeb = Platform.OS === 'web';

export function docsDir(...segments: string[]): Directory {
  if (isWeb) throw new Error('File storage is Android-only');
  const dir = new Directory(Paths.document, ...segments);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

// Web preview tier: no native PDF engine, so downloads go through blob URLs.
export function webBlobDownload(data: Blob | string, filename: string, mime = 'text/html'): string {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  return url;
}

export async function exportInvoicePdfHtml(invoiceId: number, pageSize: PageSize): Promise<string> {
  const inv = await getInvoice(invoiceId);
  if (!inv) throw new Error('Invoice not found');
  const [settings, lines] = await Promise.all([getSettings(), getLines(invoiceId)]);
  return buildInvoiceHtml(inv, lines, settings, pageSize);
}

export async function exportInvoicePdf(invoiceId: number, pageSize: PageSize = 'A4'): Promise<File> {
  if (isWeb) throw new Error('Direct PDF generation is Android-only; use the HTML download on web');
  const html = await exportInvoicePdfHtml(invoiceId, pageSize);
  const inv = await getInvoice(invoiceId);
  const safeNo = inv!.invoice_no.replace(/[^A-Za-z0-9_-]/g, '-');
  const generated = await Print.printToFileAsync({ html, base64: false });
  const target = new File(docsDir('Invoices'), `${safeNo}.pdf`);
  new File(generated.uri).moveSync(target);
  return target;
}

export async function shareFile(uri: string): Promise<void> {
  if (isWeb) {
    if (uri.startsWith('blob:')) return; // blob downloads already triggered themselves
    throw new Error('Sharing is Android-only');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('No share target available on this device');
  }
  await Sharing.shareAsync(uri, { dialogTitle: 'Share file' });
}

export async function exportInvoicePdfAndShare(invoiceId: number, pageSize: PageSize = 'A4'): Promise<void> {
  if (isWeb) {
    const html = await exportInvoicePdfHtml(invoiceId, pageSize);
    webBlobDownload(html, `invoice-${invoiceId}.html`);
    return;
  }
  const file = await exportInvoicePdf(invoiceId, pageSize);
  await shareFile(file.uri);
}
