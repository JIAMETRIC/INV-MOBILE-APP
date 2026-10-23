# What's inside the Excel exports (D2)

File: `src/export/xlsx.ts` (162 lines). It describes each workbook as sheets → columns → rows, and `src/export/xlsxWriter.ts` (`buildXlsx`, line 236) writes the .xlsx bytes (a tiny built-in writer, no library). Files are saved to `Documents/Exports/` through `docsDir` from `pdf.ts`, then shared with `shareFile`. Line numbers as of 2026-10-23.
IDs (D2.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

Money columns: any column with `money: true` is written in rupees (paise ÷ 100, `rupees()` line 12) and gets Excel's `#,##0.00` format, right-aligned (`xlsxWriter.ts:120`, `128`). Column `width` is in Excel character units.

```
xlsx.ts
│
├─ BATCH 500 · MAX_ROWS 50 000 · XLSX_MIME                          7-10
├─ rupees(paise)                                                    12
├─ saveXlsx(sheets, filename)   bytes → Documents/Exports/<file>    16
│                               (web: browser download)
│
├─ D2.1  exportInvoicesXlsx(rows)                                   41
│    │   data: the Invoice rows the caller passes in (no query)
│    │   from: S2 header "Export list to Excel" (current filtered
│    │         list, InvoicesScreen.tsx:52) · S3 "Excel" (just that
│    │         one invoice, InvoiceDetail.tsx:98)
│    │   file: invoices_<timestamp>.xlsx                            57
│    └─ sheet "Invoices_Register"                                   43-55
│         Invoice No 12 · Date 12 · Status 10 · Party 28 ·
│         Round Off 10 ₹ · Total 14 ₹
│
├─ D2.2  collectRegisterRows()  → { register, lineItems }           64
│    │   data: SQL over ALL invoices LEFT JOIN invoice_items,       77-80
│    │         newest first, items in sno order, batches of 500
│    │         (void included); one register row per invoice
│    │         (pushed when invoice_no changes, line 86-89),
│    │         one line-item row per joined item (90-94)
│    │
│    │ exportConsolidatedRegister()  wraps the rows in 2 sheets    103
│    │   from: S2 header "Export consolidated register"
│    │         (InvoicesScreen.tsx:52)
│    │   file: register_<timestamp>.xlsx                            129
│    ├─ sheet "Invoices_Register"  one row per invoice              106-116
│    │     Invoice No 12 · Date 12 · Party 28 · Total 14 ₹ ·
│    │     Status 10
│    └─ sheet "All_Line_Items"     one row per line item            117-128
│          Invoice No 12 · Sno 6 · Item 34 · Qty 8 · Rate 12 ₹ ·
│          Amount 14 ₹
│
└─ D2.3  exportProductsXlsx()                                       116
     │   data: SQL over products with sold_qty and avl_qty          118-130
     │         computed (non-void invoices only), sorted by name
     │   from: S5 header "Export products to Excel"
     │         (ProductsScreen.tsx:153)
     │   file: products_<timestamp>.xlsx                            145
     └─ sheet "Products"                                            131-144
          Name 30 · Size 8 · Price 12 ₹ · Stock 10 · Sold 10 ·
          Avl-Stock 12
```

(₹ = `money: true` column.)

## Functions

| Function | Line | Does |
| --- | --- | --- |
| `rupees(paise)` | 12 | paise → rupees number for the sheet |
| `saveXlsx(sheets, filename)` | 16 | builds the bytes and writes `Documents/Exports/<filename>` (overwrites); on web triggers a download |
| `exportInvoicesXlsx(rows)` | 41 | D2.1, one sheet from rows already on screen; caps at 50 000 rows |
| `collectRegisterRows()` | 64 | D2.2 rows: one register row per invoice (a line-less invoice still appears), one line-item row per item (`sno` not null). Exported so the integration test can check it |
| `exportConsolidatedRegister()` | 103 | D2.2, puts those rows into the two sheets and saves |
| `exportProductsXlsx()` | 132 | D2.3, one sheet; "Sold" and "Avl-Stock" use the same rule as S5 and the Dashboard tiles |
| `buildXlsx(sheets)` | xlsxWriter.ts:236 | sheets → .xlsx bytes (header row bold, widths, money format) |

Note on D2.2: until 2026-10-23 the register row was pushed per joined row, so an invoice with 3 line items appeared 3 times on "Invoices_Register". Fixed with the `lastInvoiceNo` marker (line 75); covered by the integration test "consolidated register: one row per invoice, one per line item".

## Where to change what

| You want to change | Go to |
| --- | --- |
| rename a column | its `{ header: '…' }` entry (D2.1 lines 45-50, D2.2 109-113 and 120-125, D2.3 150-155); the header text is the only thing to edit |
| change a column width | the `width` on the same line (Excel character units; 12 fits a date, 28-34 a name) |
| add a column | two edits in the same function: a `{ header, width }` entry in `columns` **and** the matching value at the same position in each row (D2.1 `rows:` 52-55 · D2.2 `register.push` 87 or `lineItems.push` 91-94 · D2.3 157-159). Columns and row values are matched by position, so keep the order the same. If the value is new to the query, add it to the SELECT (D2.2 77-80, D2.3 138-145) and to `RegisterRow` (28-39) |
| reorder columns | move the `columns` entry and the row value together |
| make a column show ₹ formatting | add `money: true` to its column and pass `rupees(...)` as the value |
| rename a sheet | `name:` (D2.1 43 · D2.2 107, 118 · D2.3 148) |
| change the file name | the `saveXlsx(…, 'name_${Date.now()}.xlsx')` call: 57, 129, 161 |
| change the row limit or batch size | `MAX_ROWS`, `BATCH`, lines 7-8 |
| include or exclude void invoices | D2.2 has no status filter (line 79): add `WHERE i.status != 'void'`; D2.1 exports whatever S2's filter shows |
| header row style or number format | `xlsxWriter.ts` styles, lines 120-128 |
| where files are saved | `docsDir('Exports')`, line 22 (`pdf.ts:11`) |
