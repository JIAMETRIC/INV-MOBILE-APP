# Excel exports (D2) — Three-Slot tree

**Files:** `src/export/xlsx.ts` (162 lines) describes each workbook as sheets → columns → rows; `src/export/xlsxWriter.ts` (250 lines, `buildXlsx` at 236) turns that into the .xlsx bytes with a built-in writer and no library. Line numbers as of 2026-10-23 · **Reached by:** S2.0 header actions "Export list to Excel" (D2.1) and "Export consolidated register" (D2.2) (`InvoicesScreen.tsx:141-142` → `runExport`, 74-80, call at 76); S3.3 "Excel" (D2.1 with that one invoice, `InvoiceDetail.tsx:119`); S5.0 "Export products to Excel" (D2.3, `ProductsScreen.tsx:243` → `exportXlsx`, 185-190, call at 187) · **Data:** D2.1 the `Invoice[]` the caller passes in, no query; D2.2 and D2.3 SQL through `getDb()` (`src/data/db.ts`) · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § D2 · **Method:** `.claude/skills/three-slot-screen/SKILL.md`, read as the header row / data rows / totals of a sheet

Three workbooks. D2.1 is one sheet from the rows already on screen; D2.2 is the consolidated register, two sheets from one query over every invoice (void included), one row per invoice and one per line item; D2.3 is the product list with sold and available stock. Every export returns a `File` that the caller hands to `shareFile` (`pdf.ts:49`). On Android the file is `Documents/Exports/<name>_<timestamp>.xlsx`; on web it is a browser download.

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | row 1: one bold cell per column (`STYLE_BOLD`), frozen so it stays in view (`pane ySplit="1"`); column widths from `columns[].width` | `sheetXml` | xlsxWriter.ts 60-65, 81 |
| Body | rows 2 to n + 1: one cell per value, matched to the column by position; a number is a `<v>` cell, a string an inline string; `null` or `''` writes no cell; a `money` column gets `STYLE_MONEY` | `sheetXml` | 66-77 |
| Footer | none: no totals row and no formulas; a sheet ends at its last data row (`dimension` A1 to the last column and row) | — | 80 |
| Sheet title | the tab name only (`sheet.name`); there is no title row inside a sheet | `workbookXml` | 102-107 |

## 2. The files in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `BATCH` · `MAX_ROWS` · `XLSX_MIME` | xlsx.ts 7-10 | limits and the web MIME type |
| 2 | `rupees(paise)` | 12-14 | paise to rupees for every money cell |
| 3 | `saveXlsx(sheets, filename)` | 16-26 | where the file goes (Android folder, web download) |
| 4 | `RegisterRow` | 28-39 | the shape of one joined row of the D2.2 query |
| 5 | `exportInvoicesXlsx(rows)` (D2.1) | 41-58 | the list workbook |
| 6 | `CellRow`, `collectRegisterRows()` (D2.2 rows) | 60-101 | the query, the batches, the de-duplication |
| 7 | `exportConsolidatedRegister()` (D2.2 sheets) | 103-130 | the two register sheets |
| 8 | `exportProductsXlsx()` (D2.3) | 132-162 | the products workbook |
| 9 | `XlsxColumn`, `XlsxSheet`, style ids | xlsxWriter.ts 6-21 | the contract xlsx.ts writes against |
| 10 | `escapeXml` … `sheetXml` | 23-83 | cell and sheet XML |
| 11 | `CONTENT_TYPES`, `ROOT_RELS`, `workbookXml`, `workbookRels`, `STYLES` | 85-133 | the package parts; fonts and the number format |
| 12 | `CRC_TABLE`, `crc32`, `ZipEntry`, `DOS_TIME` / `DOS_DATE`, `utf8`, `sizeOf`, `zip` | 135-234 | the archive, stored uncompressed |
| 13 | `buildXlsx(sheets)` | 236-250 | the one export of the writer |

## 3. Tree

```
xlsx.ts
│
├─ D2.1  exportInvoicesXlsx(rows)                                            41
│    │   from: S2 "Export list to Excel" (the loaded list, InvoicesScreen.tsx:76)
│    │         S3 "Excel" ([inv], InvoiceDetail.tsx:119)
│    │   rows: rows.slice(0, MAX_ROWS)                                       52
│    │   file: invoices_<Date.now()>.xlsx                                    57
│    └─ sheet "Invoices_Register"                                            42-56
│         Header  Invoice No 12 · Date 12 · Status 10 · Party 28 ·          44-51
│                 Round Off 10 ₹ · Total 14 ₹
│         Body    invoice_no · invoice_date · status · party_name ·         52-55
│                 rupees(round_off_paise) · rupees(total_paise)
│         Footer  none
│
├─ D2.2  exportConsolidatedRegister()                                        103
│    │   from: S2 "Export consolidated register" (InvoicesScreen.tsx:76)
│    │   rows: collectRegisterRows() → { register, lineItems }               104, 64
│    │     ├─ SELECT invoices i LEFT JOIN invoice_items li                   76-82
│    │     │   ORDER BY i.id DESC, li.sno · LIMIT 500 OFFSET n · no status filter
│    │     ├─ register.push once per change of invoice_no (lastInvoiceNo)   73, 86-89
│    │     ├─ lineItems.push when li.sno is not null                         90-95
│    │     └─ stop: empty batch · register ≥ MAX_ROWS · short batch          83, 85, 98
│    │   file: register_<Date.now()>.xlsx                                    129
│    ├─ sheet 1 "Invoices_Register"   one row per invoice                    106-116
│    │    Header  Invoice No 12 · Date 12 · Party 28 · Total 14 ₹ ·          108-114
│    │            Status 10
│    │    Body    invoice_no · invoice_date · party_name ·                   87
│    │            rupees(total_paise) · status
│    │    Footer  none
│    └─ sheet 2 "All_Line_Items"      one row per line item                  117-128
│         Header  Invoice No 12 · Sno 6 · Item 34 · Qty 8 · Rate 12 ₹ ·     119-126
│                 Amount 14 ₹
│         Body    invoice_no · sno · description · qty ·                     91-94
│                 rupees(unit_paise ?? 0) · rupees(line_paise ?? 0)
│         Footer  none
│
├─ D2.3  exportProductsXlsx()                                                132
│    │   from: S5 "Export products to Excel" (ProductsScreen.tsx:187)
│    │   rows: SELECT products with sold_qty and avl_qty (non-void           134-146
│    │         invoices only), ORDER BY name COLLATE NOCASE, size, id
│    │   file: products_<Date.now()>.xlsx                                    161
│    └─ sheet "Products"                                                     147-160
│         Header  Name 30 · Size 8 · Price 12 ₹ · Stock 10 · Sold 10 ·      149-156
│                 Avl-Stock 12
│         Body    name · size · rupees(unit_paise) · stock_qty ·             157-159
│                 sold_qty · avl_qty
│         Footer  none
│
└─ saveXlsx(sheets, filename)                                                16
     ├─ buildXlsx(sheets)                                      xlsxWriter.ts:236
     │    ├─ parts: [Content_Types].xml · _rels/.rels · xl/workbook.xml ·    238-245
     │    │         xl/_rels/workbook.xml.rels · xl/styles.xml ·
     │    │         xl/worksheets/sheet<n>.xml (sheetXml, 59)
     │    └─ zip(): stored entries, CRC-32, fixed 2020-01-01 stamp           182-234, 162-163
     ├─ web:     webBlobDownload(Blob, filename) → { uri, name }             18-21
     └─ Android: Documents/Exports/<filename>, overwritten                   22-25
```

(₹ marks a `money: true` column: the value is in rupees and Excel shows it as `#,##0.00`, right-aligned.)

## 4. The numbers

| Key | Value | ID | Line | Means |
| --- | --- | --- | --- | --- |
| `BATCH` | 500 | D2.2 | xlsx.ts:7 | rows per SQL page in `collectRegisterRows` (`LIMIT ? OFFSET ?`, 80-81) |
| `MAX_ROWS` | 50 000 | D2.1, D2.2 | 8 | D2.1 slices the rows at it (52); D2.2 stops both arrays at the joined row where the register reaches it (85, 98) |
| `XLSX_MIME` | the spreadsheetml MIME type | web | 10 | the Blob type of the web download (19) |
| `width` | Excel character units | all | xlsxWriter.ts:61 | written as `<col … width customWidth="1">` |
| `STYLE_DEFAULT` | 0: General, Calibri 11, no alignment set | all | 19, 126 | text cells and plain numbers |
| `STYLE_BOLD` | 1: bold Calibri 11 | header | 20, 127 | row 1 |
| `STYLE_MONEY` | 2: number format 164 `#,##0.00`, horizontal right | ₹ columns | 21, 120, 128 | money cells |
| frozen pane | `ySplit="1"`, `topLeftCell="A2"` | header | 81 | row 1 stays in view |
| `DOS_TIME` / `DOS_DATE` | 0 / 2020-01-01 | zip | 162-163 | every entry carries the same stamp, so output is byte-stable |
| `dimension` | `A1:<last column><rows + 1>` | sheet | 80 | the used range |
| sheet names | `Invoices_Register` (D2.1 and D2.2 sheet 1) · `All_Line_Items` · `Products` | | xlsx.ts 43, 107, 118, 148 | the tab names |
| file names | `invoices_` · `register_` · `products_` + `Date.now()` + `.xlsx` | | 57, 129, 161 | one new file per export |

| Value | Written as | Style | Lines |
| --- | --- | --- | --- |
| number in a ₹ column | `<v>` of `rupees(paise)` = paise / 100 | 2 | xlsx.ts:12; xlsxWriter.ts:71-72 |
| other number (qty, sno, stock, sold, avl) | `<v>` of the raw value | 0 | 71-72 |
| string | inline string, XML-escaped (`& < >`), control characters dropped except tab, LF and CR | 0 (2 when its column is ₹) | 23-34, 51-52, 74 |
| date | `invoice_date` as stored: ISO `YYYY-MM-DD` text (`src/data/types.ts:77`), not an Excel date | 0 | xlsx.ts 53, 87 |
| `null` or `''` | no cell at all | — | xlsxWriter.ts:68 |

## 5. Columns

D2.1 `Invoices_Register` (xlsx.ts 44-55):

| Col | Header | Width | Value | Style | Lines |
| --- | --- | --- | --- | --- | --- |
| A | Invoice No | 12 | `invoice_no` | text | 45, 53 |
| B | Date | 12 | `invoice_date` | text, ISO | 46, 53 |
| C | Status | 10 | `status` | text | 47, 53 |
| D | Party | 28 | `party_name` | text | 48, 53 |
| E | Round Off | 10 | `rupees(round_off_paise)` | ₹, right | 49, 54 |
| F | Total | 14 | `rupees(total_paise)` | ₹, right | 50, 54 |

D2.2 sheet 1 `Invoices_Register` (108-114; row at 87):

| Col | Header | Width | Value | Style | Lines |
| --- | --- | --- | --- | --- | --- |
| A | Invoice No | 12 | `invoice_no` | text | 109, 87 |
| B | Date | 12 | `invoice_date` | text, ISO | 110, 87 |
| C | Party | 28 | `party_name` | text | 111, 87 |
| D | Total | 14 | `rupees(total_paise)` | ₹, right | 112, 87 |
| E | Status | 10 | `status` | text | 113, 87 |

D2.2 sheet 2 `All_Line_Items` (119-126; row at 91-94):

| Col | Header | Width | Value | Style | Lines |
| --- | --- | --- | --- | --- | --- |
| A | Invoice No | 12 | `invoice_no` | text | 120, 92 |
| B | Sno | 6 | `sno` | number, General | 121, 92 |
| C | Item | 34 | `description` | text | 122, 92 |
| D | Qty | 8 | `qty` | number, General | 123, 92 |
| E | Rate | 12 | `rupees(unit_paise ?? 0)` | ₹, right | 124, 93 |
| F | Amount | 14 | `rupees(line_paise ?? 0)` | ₹, right | 125, 93 |

D2.3 `Products` (149-159):

| Col | Header | Width | Value | Style | Lines |
| --- | --- | --- | --- | --- | --- |
| A | Name | 30 | `name` | text | 150, 158 |
| B | Size | 8 | `size` | text | 151, 158 |
| C | Price | 12 | `rupees(unit_paise)` | ₹, right | 152, 158 |
| D | Stock | 10 | `stock_qty` | number, General | 153, 158 |
| E | Sold | 10 | `sold_qty` | number, General | 154, 158 |
| F | Avl-Stock | 12 | `avl_qty` | number, General | 155, 158 |

Columns and row values are matched by position (`sheet.columns[i]`, xlsxWriter.ts:70), so the two lists in each function must stay in the same order. The same column names carry different widths in different sheets only where the lists above say so; the D2.2 register has the same widths as D2.1 but drops Round Off and moves Status to the end.

## 6. Functions

| Function | File:line | Does |
| --- | --- | --- |
| `rupees(paise)` | xlsx.ts:12 | paise / 100, the number written into every ₹ column |
| `saveXlsx(sheets, filename)` | xlsx.ts:16 | `buildXlsx`, then on web a Blob download (returns `{ uri, name }` shaped as a `File`), on Android `Documents/Exports/<filename>` created with `overwrite: true` and written synchronously |
| `exportInvoicesXlsx(rows)` | xlsx.ts:41 | D2.1: one sheet from the rows passed in, capped at `MAX_ROWS`; no query of its own |
| `collectRegisterRows()` | xlsx.ts:64 | D2.2 rows: pages the join in batches of `BATCH`; pushes a register row only when `invoice_no` changes from the previous row (the join yields one row per line item, so an invoice with n items comes back n times, and once with nulls when it has none; rows of one invoice are contiguous because of `ORDER BY i.id`); pushes a line-item row when `sno` is not null; the marker survives a batch boundary. Exported so the integration test can read rows without parsing a workbook |
| `exportConsolidatedRegister()` | xlsx.ts:103 | D2.2: wraps those rows in the two sheets and saves |
| `exportProductsXlsx()` | xlsx.ts:132 | D2.3: one sheet from `products` with `sold_qty` and `avl_qty` computed inline from non-void invoices, the same subquery as `SOLD_SQL` in `src/data/productsRepo.ts:7-10` that S5 and the S1 tiles use |
| `escapeXml(value)` | xlsxWriter.ts:23 | escapes `& < >` and drops control characters other than tab, LF and CR |
| `columnName(index)` / `cellRef(col, row)` | 36 / 47 | 0-based column to `A`, `Z`, `AA` …; cell reference such as `B2` |
| `textCell(ref, style, value)` / `numberCell(ref, style, value)` | 51 / 55 | an inline-string cell / a `<v>` cell |
| `sheetXml(sheet)` | 59 | one worksheet: `<cols>`, the frozen bold header row, the data rows, the `dimension` |
| `CONTENT_TYPES(count)` · `ROOT_RELS` · `workbookXml(sheets)` · `workbookRels(count)` · `STYLES` | 85 · 97 · 102 · 109 · 118 | the fixed package parts; `STYLES` holds the two fonts, the one number format and the three `cellXfs` |
| `crc32(bytes)` | 145 | table-driven CRC-32 for each ZIP entry (`CRC_TABLE`, 135) |
| `utf8(value)` | 165 | string to UTF-8 bytes (up to three bytes per code unit) |
| `zip(entries)` | 182 | local headers, data, central directory and end record, all stored (method 0), little-endian |
| `buildXlsx(sheets)` | 236 | throws on an empty list; the five package parts plus one worksheet per sheet, zipped |

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| rename a column | its `{ header: '…' }` entry: D2.1 xlsx.ts 45-50 · D2.2 109-113 and 120-125 · D2.3 150-155; the header text is the only thing to edit |
| change a column width | the `width` on the same line (Excel character units; 12 fits a date, 28 to 34 a name) |
| add a column | two edits in the same function: a `{ header, width }` entry in `columns` and the value at the same position in each row (D2.1 `rows:` 52-55 · D2.2 `register.push` 87 or `lineItems.push` 91-94 · D2.3 157-159). When the value is new to the query, add it to the SELECT (D2.2 77-78, D2.3 138-145) and to `RegisterRow` (28-39) |
| reorder columns | move the `columns` entry and the row value together |
| make a column show ₹ formatting | `money: true` on the column and `rupees(...)` as the value |
| rename a sheet | `name:` at 43 · 107 · 118 · 148 |
| change a file name | the `saveXlsx(…, '…_${Date.now()}.xlsx')` call: 57, 129, 161 |
| change the row limit or batch size | `MAX_ROWS`, `BATCH`, lines 7-8 |
| include or exclude void invoices | D2.2 has no status filter (79): add `WHERE i.status != 'void'` before `ORDER BY`; D2.1 exports whatever S2's filters loaded; D2.3 already excludes void from sold and available (140, 143) |
| header row style, the number format or the font | `STYLES`, xlsxWriter.ts 118-133 (`numFmt` 120, fonts 121, `cellXfs` 125-129) |
| freeze a different number of rows | `ySplit` and `topLeftCell`, 81 |
| where files are saved | `docsDir('Exports')`, xlsx.ts:22 (`pdf.ts:11`) |
| the web download's MIME type | `XLSX_MIME`, line 10 |

Note on D2.2: until 2026-10-23 a register row was pushed per joined row, so an invoice with three line items appeared three times on `Invoices_Register`. Fixed with the `lastInvoiceNo` marker (73, 86-89); covered by the integration test below.

## 8. Checks

| Check | Script | What it asserts |
| --- | --- | --- |
| `npm run test:integration`, case "consolidated register: one row per invoice, one per line item" | `scripts/run-integration-tests.mjs:435-449` | compiles `src/export/xlsx.ts` with the data repos (132-138), replacing `expo-file-system` with a no-op `File` and `./pdf` with `pdfMock` (115-118, 125-126); saves a three-line invoice, calls `collectRegisterRows()` and asserts: `register.length` equals `COUNT(*)` of `invoices`; no `invoice_no` appears twice; `lineItems.length` equals `COUNT(*)` of `invoice_items`; the new invoice is on the register once and in the line items three times |
| `npm run test:xlsx` (10 cases) | `scripts/run-xlsx-tests.mjs` | compiles `xlsxWriter.ts` alone (15-17) and builds a two-sheet probe workbook (21-42) saved to the OS temp folder (44-45). Cases: the file starts with a local header (58); the end record lists 7 entries and the central directory ends at it (62-69); every part is listed once (92-102); central offsets, stored method, sizes and CRC-32 match the local entries (104-115); markup is escaped and cells are typed (`A2 s=0 inlineStr`, `B2 s=2` with `1499.5`, `C3` with `-2`, a null writes no cell) (123-130); the header row is `s=1` and frozen (132-136); styles carry `numFmtId="164" formatCode="#,##0.00"` and three `cellXfs` (138-142); workbook, relationships and content types agree on the sheet count (144-152); column names roll past `Z` to `AA` and `AB` (154-178); an empty workbook throws (180-182) |
| not covered | — | D2.1 and D2.3 have no automated case: D2.1 is a plain map of the rows passed in; D2.3 follows the same sold rule as `productsRepo.ts` but as a separate copy of the SQL, so a change to one needs the other checked by hand (export from S5 and compare with the S5 table) |
