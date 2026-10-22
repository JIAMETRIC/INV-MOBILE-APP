// Verifies the hand-rolled xlsx writer: ZIP structure, CRCs and sheet XML.
// Run from the INV-MOBILE-APP directory: npm run test:xlsx
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import assert from 'node:assert/strict';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const outDir = path.join(root, '.tmp-xlsx-test');

execFileSync('npx', ['tsc', '--ignoreConfig', 'src/export/xlsxWriter.ts',
  '--outDir', outDir, '--module', 'nodenext', '--moduleResolution', 'nodenext',
  '--target', 'es2020', '--skipLibCheck'], { stdio: 'inherit', shell: true });

const { buildXlsx } = require(path.join(outDir, 'xlsxWriter.js'));

const sheets = [
  {
    name: 'Products',
    columns: [
      { header: 'Name', width: 30 },
      { header: 'Price', width: 12, money: true },
      { header: 'Avl-Stock', width: 12 },
    ],
    rows: [
      ['Acid Wash <T>&"X"', 1499.5, 7],
      ['Drop Shoulder', 0, -2],
      ['Note only', null, 0],
    ],
  },
  {
    name: 'Invoices_Register',
    columns: [{ header: 'Invoice No', width: 12 }, { header: 'Total', width: 14, money: true }],
    rows: [['PRE-042', 627]],
  },
];

const bytes = buildXlsx(sheets);
// Kept after the run for manual inspection (e.g. openpyxl), outside the project folder.
const file = path.join(os.tmpdir(), 'invoice-erp-xlsx-probe.xlsx');
writeFileSync(file, bytes);

let failed = 0;
const t = (name, fn) => {
  try { fn(); console.log('PASS', name); }
  catch (e) { failed++; console.log('FAIL', name, '-', e.message); }
};

const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const u16 = at => view.getUint16(at, true);
const u32 = at => view.getUint32(at, true);
const text = (at, len) => new TextDecoder().decode(bytes.subarray(at, at + len));

t('starts with a local file header', () => {
  assert.equal(u32(0), 0x04034b50);
});

t('ends with an EOCD naming every entry', () => {
  const eocd = bytes.length - 22;
  assert.equal(u32(eocd), 0x06054b50);
  assert.equal(u16(eocd + 10), 7); // content types, root rels, workbook, wb rels, styles, 2 sheets
  const centralSize = u32(eocd + 12);
  const centralStart = u32(eocd + 16);
  assert.equal(centralStart + centralSize, eocd);
});

function centralEntries() {
  const eocd = bytes.length - 22;
  let at = u32(eocd + 16);
  const end = at + u32(eocd + 12);
  const out = [];
  while (at < end) {
    assert.equal(u32(at), 0x02014b50, 'central header signature');
    const nameLen = u16(at + 28);
    out.push({
      name: text(at + 46, nameLen),
      crc: u32(at + 16),
      size: u32(at + 24),
      offset: u32(at + 42),
    });
    at += 46 + nameLen + u16(at + 30) + u16(at + 32);
  }
  return out;
}

const entries = centralEntries();

t('every part is listed once', () => {
  assert.deepEqual(entries.map(e => e.name).sort(), [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/workbook.xml',
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/sheet2.xml',
  ].sort());
});

t('central offsets match local headers, sizes and CRCs', () => {
  for (const e of entries) {
    assert.equal(u32(e.offset), 0x04034b50, `${e.name} local signature`);
    assert.equal(u16(e.offset + 8), 0, `${e.name} uses stored method`);
    assert.equal(u32(e.offset + 18), e.size, `${e.name} uncompressed size`);
    const nameLen = u16(e.offset + 26);
    assert.equal(text(e.offset + 30, nameLen), e.name);
    const data = bytes.subarray(e.offset + 30 + nameLen, e.offset + 30 + nameLen + e.size);
    assert.equal(zlib.crc32(data) >>> 0, e.crc, `${e.name} crc32`);
    assert.equal(data.length, e.size);
  }
});

const part = name => {
  const e = entries.find(x => x.name === name);
  const nameLen = u16(e.offset + 26);
  return text(e.offset + 30 + nameLen, e.size);
};

t('sheet XML escapes markup and writes typed cells', () => {
  const s1 = part('xl/worksheets/sheet1.xml');
  assert.match(s1, /Acid Wash &lt;T&gt;&amp;"X"/);
  assert.match(s1, /<c r="A2" s="0" t="inlineStr">/);
  assert.match(s1, /<c r="B2" s="2"><v>1499.5<\/v><\/c>/);
  assert.match(s1, /<c r="C3" s="0"><v>-2<\/v><\/c>/);
  assert.ok(!s1.includes('<c r="B4"'), 'null value emits no cell');
});

t('header row is bold and frozen', () => {
  const s1 = part('xl/worksheets/sheet1.xml');
  assert.match(s1, /<row r="1"><c r="A1" s="1" t="inlineStr">/);
  assert.match(s1, /<pane ySplit="1"/);
});

t('money style maps to the custom number format', () => {
  const styles = part('xl/styles.xml');
  assert.match(styles, /numFmtId="164" formatCode="#,##0.00"/);
  assert.match(styles, /<cellXfs count="3">/);
});

t('workbook and relationships agree on sheet count', () => {
  assert.match(part('xl/workbook.xml'), /<sheet name="Products" sheetId="1" r:id="rId1"\/>/);
  assert.match(part('xl/workbook.xml'), /<sheet name="Invoices_Register" sheetId="2" r:id="rId2"\/>/);
  const rels = part('xl/_rels/workbook.xml.rels');
  assert.match(rels, /Id="rId2" Type="[^"]*worksheet" Target="worksheets\/sheet2.xml"/);
  assert.match(rels, /Id="rId3" Type="[^"]*styles" Target="styles.xml"/);
  const types = part('[Content_Types].xml');
  assert.match(types, /PartName="\/xl\/worksheets\/sheet2.xml"/);
});

t('column names roll past Z', () => {
  const wide = buildXlsx([{
    name: 'W',
    columns: Array.from({ length: 28 }, (_, i) => ({ header: `c${i}`, width: 8 })),
    rows: [Array.from({ length: 28 }, (_, i) => i)],
  }]);
  const wv = new DataView(wide.buffer, wide.byteOffset, wide.byteLength);
  const rd = new TextDecoder();
  const eocd = wide.length - 22;
  let c = wv.getUint32(eocd + 16, true);
  const stop = c + wv.getUint32(eocd + 12, true);
  let sheet = '';
  while (c < stop) {
    const nl = wv.getUint16(c + 28, true);
    if (rd.decode(wide.subarray(c + 46, c + 46 + nl)) === 'xl/worksheets/sheet1.xml') {
      const off = wv.getUint32(c + 42, true);
      const lnl = wv.getUint16(off + 26, true);
      sheet = rd.decode(wide.subarray(off + 30 + lnl, off + 30 + lnl + wv.getUint32(c + 24, true)));
    }
    c += 46 + nl + wv.getUint16(c + 30, true) + wv.getUint16(c + 32, true);
  }
  assert.match(sheet, /r="Z1"/);
  assert.match(sheet, /r="AA2"/);
  assert.match(sheet, /r="AB2"/);
});

t('rejects an empty workbook', () => {
  assert.throws(() => buildXlsx([]), /at least one sheet/);
});

console.log(`\nprobe workbook: ${file} (${bytes.length} bytes)`);
rmSync(outDir, { recursive: true, force: true });
if (failed) { console.log(`${failed} test(s) failed`); process.exit(1); }
console.log('All xlsx-writer tests passed.');
