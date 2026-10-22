// Minimal SpreadsheetML (xlsx) writer: a ZIP of XML parts, stored uncompressed.
// Synchronous and dependency-free on purpose — exceljs's browser bundle vendors
// core-js, whose Promise.prototype.then wrapper self-recurses under Hermes, so
// any async writer either floods RangeErrors or loops until the OS kills us.

export interface XlsxColumn {
  header: string;
  width: number;
  /** Renders the column's numbers with a rupee-friendly #,##0.00 format. */
  money?: boolean;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  rows: (string | number | null)[][];
}

const STYLE_DEFAULT = 0;
const STYLE_BOLD = 1;
const STYLE_MONEY = 2;

function escapeXml(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    if (ch === 38) out += '&amp;';
    else if (ch === 60) out += '&lt;';
    else if (ch === 62) out += '&gt;';
    else if (ch < 32 && ch !== 9 && ch !== 10 && ch !== 13) continue;
    else out += value.charAt(i);
  }
  return out;
}

function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = (n - rem - 1) / 26;
  }
  return name;
}

function cellRef(col: number, row: number): string {
  return `${columnName(col)}${row}`;
}

function textCell(ref: string, style: number, value: string): string {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(ref: string, style: number, value: number): string {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join('');
  const header = `<row r="1">${sheet.columns
    .map((c, i) => textCell(cellRef(i, 1), STYLE_BOLD, c.header))
    .join('')}</row>`;
  const body = sheet.rows.map((row, r) => {
    const cells = row.map((value, i) => {
      if (value === null || value === '') return '';
      const ref = cellRef(i, r + 2);
      const column = sheet.columns[i];
      if (typeof value === 'number') {
        return numberCell(ref, column?.money ? STYLE_MONEY : STYLE_DEFAULT, value);
      }
      return textCell(ref, column?.money ? STYLE_MONEY : STYLE_DEFAULT, value);
    }).join('');
    return `<row r="${r + 2}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<dimension ref="A1:${columnName(sheet.columns.length - 1)}${sheet.rows.length + 1}"/>`
    + `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    + `<cols>${cols}</cols><sheetData>${header}${body}</sheetData></worksheet>`;
}

const CONTENT_TYPES = (count: number): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
  + `<Default Extension="xml" ContentType="application/xml"/>`
  + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
  + Array.from({ length: count }, (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')
  + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
  + `</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
  + `</Relationships>`;

const workbookXml = (sheets: XlsxSheet[]): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
  + `<sheets>${sheets.map((s, i) =>
      `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
  + `</workbook>`;

const workbookRels = (count: number): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + Array.from({ length: count }, (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')
  + `<Relationship Id="rId${count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
  + `</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + `<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>`
  + `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
  + `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>`
  + `<borders count="1"><border/></borders>`
  + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  + `<cellXfs count="3">`
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
  + `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
  + `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right"/></xf>`
  + `</cellXfs>`
  + `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>`
  + `<dxfs count="0"/>`
  + `<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>`
  + `</styleSheet>`;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] ?? 0;
    c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: Uint8Array;
  data: Uint8Array;
  offset: number;
  crc: number;
}

// Fixed timestamp keeps generated files byte-stable, which the tests rely on.
const DOS_TIME = 0;
const DOS_DATE = (((2020 - 1980) << 9) | (1 << 5) | 1) >>> 0;

function utf8(value: string): Uint8Array {
  const out = new Uint8Array(value.length * 3);
  let n = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x80) out[n++] = c;
    else if (c < 0x800) { out[n++] = 0xc0 | (c >> 6); out[n++] = 0x80 | (c & 63); }
    else { out[n++] = 0xe0 | (c >> 12); out[n++] = 0x80 | ((c >> 6) & 63); out[n++] = 0x80 | (c & 63); }
  }
  return out.subarray(0, n);
}

function sizeOf(entry: ZipEntry): number {
  return 30 + entry.name.length + entry.data.length;
}

/** Packs the parts into a stored (uncompressed) ZIP archive. */
function zip(entries: ZipEntry[]): Uint8Array {
  let cursor = 0;
  for (const entry of entries) {
    entry.offset = cursor;
    cursor += sizeOf(entry);
  }
  const centralStart = cursor;
  for (const entry of entries) cursor += 46 + entry.name.length;
  const out = new Uint8Array(cursor + 22);
  const view = new DataView(out.buffer);
  const put16 = (at: number, v: number) => view.setUint16(at, v, true);
  const put32 = (at: number, v: number) => view.setUint32(at, v, true);

  let at = 0;
  for (const entry of entries) {
    put32(at, 0x04034b50);
    put16(at + 4, 20);
    put16(at + 6, 0x0800);
    put16(at + 8, 0);
    put16(at + 10, DOS_TIME);
    put16(at + 12, DOS_DATE);
    put32(at + 14, entry.crc);
    put32(at + 18, entry.data.length);
    put32(at + 22, entry.data.length);
    put16(at + 26, entry.name.length);
    put16(at + 28, 0);
    out.set(entry.name, at + 30);
    out.set(entry.data, at + 30 + entry.name.length);
    at = sizeOf(entry) + at;
  }
  for (const entry of entries) {
    put32(at, 0x02014b50);
    put16(at + 4, 20);
    put16(at + 6, 20);
    put16(at + 8, 0x0800);
    put16(at + 10, 0);
    put16(at + 12, DOS_TIME);
    put16(at + 14, DOS_DATE);
    put32(at + 16, entry.crc);
    put32(at + 20, entry.data.length);
    put32(at + 24, entry.data.length);
    put16(at + 28, entry.name.length);
    put32(at + 42, entry.offset);
    out.set(entry.name, at + 46);
    at += 46 + entry.name.length;
  }
  put32(at, 0x06054b50);
  put16(at + 8, entries.length);
  put16(at + 10, entries.length);
  put32(at + 12, at - centralStart);
  put32(at + 16, centralStart);
  return out;
}

export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  if (sheets.length === 0) throw new Error('buildXlsx needs at least one sheet');
  const parts: [string, string][] = [
    ['[Content_Types].xml', CONTENT_TYPES(sheets.length)],
    ['_rels/.rels', ROOT_RELS],
    ['xl/workbook.xml', workbookXml(sheets)],
    ['xl/_rels/workbook.xml.rels', workbookRels(sheets.length)],
    ['xl/styles.xml', STYLES],
    ...sheets.map((s, i): [string, string] => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ];
  return zip(parts.map(([name, xml]) => {
    const data = utf8(xml);
    return { name: utf8(name), data, offset: 0, crc: crc32(data) };
  }));
}
