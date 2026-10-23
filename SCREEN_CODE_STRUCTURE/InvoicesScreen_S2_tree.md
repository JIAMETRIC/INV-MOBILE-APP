# What's inside InvoicesScreen (S2, Invoices tab)

File: `src/features/invoices/InvoicesScreen.tsx` (159 lines). Line numbers as of 2026-10-23.
Opened by the Invoices tab (S0.4.1), or by `showInvoice(id, false)` on tablets (selects the row).
Data: `listInvoices({search, status, from, to, limit: 500})` in `src/data/invoicesRepo.ts:15`.
IDs (S2.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

> A restructure of this file (state hook + named pieces: `Header`, `ListPane`, `FilterRow`, `DateRangeRow`, `InvoiceListCard`, `InvoiceRow`, `DetailPane`, `ActivityPane`) is planned and waiting for the owner's OK. The line numbers below will change when it lands; the IDs will not.

```
STATUSES               S2.2  All · Issued · Partial · Paid · Void                 20

InvoicesScreen()                                                        line 28
│
├─ appBar (TopAppBar large)   S2.0                                            118
│    ├─ caption "N invoice(s)" above the H2 "Invoices"                        120-121
│    └─ 2 glass icon buttons:                                                 124-127
│         download = Export list to Excel (the rows on screen) → runExport('list')
│         book     = Export consolidated register             → runExport('register')
│
└─ listPane  (column: side padding 20, gap 16)                                 62
     │
     ├─ row  S2.1 + S2.3   gap 10                                              64
     │    ├─ SearchField "Search invoice no or party"  (flex 1)                65
     │    └─ IconButton calendar  S2.3  toggles the date row; tinted when      66
     │                                  open or when a date is set
     │
     ├─ SegmentedControl  S2.2  status tabs over STATUSES                      70
     │
     ├─ (dateOpen) row  S2.3a  gap 12, pulled up 16                            72
     │    ├─ Input "From"  YYYY-MM-DD, numeric, max 10  (flex 1)               74
     │    └─ Input "To"    YYYY-MM-DD, numeric, max 10  (flex 1)               78
     │
     ├─ Card list  S2.5  hugs its rows (flexShrink 1), scrolls when full;       83
     │    │              marginBottom = useNavInset()
     │    └─ FlatList                                                          84
     │         ├─ bottom padding 52 + 16 on phones with > 6 rows (FAB room)    89
     │         ├─ empty  S2.5.e  filtered → "No matches" ·                     90
     │         │                 no filter → "No invoices yet"
     │         └─ ListItem per row (flush)                                     94
     │              ├─ leading  36 avatar, initials(party); alt grey on odd rows 97
     │              ├─ title    party name or "(no party)"                      101
     │              ├─ subtitle "PRE-001 · 22 Oct 26"                           102
     │              ├─ trailing column, right-aligned, gap 4                    104
     │              │    ├─ MoneyText ₹ total (small, Bebas)                    106
     │              │    └─ StatusGlyph  icon + "Paid" pill                     107
     │              ├─ selected tint on tablets when it is the chosen row       100
     │              └─ tap: phone → showInvoice (S3 overlay);                   103
     │                      tablet → selectInvoice (right pane)
     │
     └─ FAB  S2.6  "+ New invoice", phones only → nav.openCreate()            114

return
├─ PHONE   column: appBar · listPane                                          131
└─ TABLET  appBar · row:                                                      133
     ├─ listPane                                       (flex 1)               137
     ├─ S2.7 detail pane   width 50 % (2 panes) / 42 % (3 panes), left divider 138
     │    └─ InvoiceDetail (S3) for the selected row, else
     │       EmptyState "No invoice selected"
     └─ S2.8 activity pane  xl+ only, and only with a row selected; 26 %       143
          └─ Card small: overline "Activity" · "no · status" · "Issued <date>" 145
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `load()` | 41 | queries `listInvoices` with the four filters; reruns when any filter or `nav.refreshKey` changes |
| `runExport(kind)` | 50 | 'list' → `exportInvoicesXlsx(rows)` (D2.1); 'register' → `exportConsolidatedRegister()` (D2.2); shares the file; spinner on that button; alert on failure |
| `selected` | 58 | the row matching `nav.selectedInvoiceId` (tablet panes) |
| `filtered` | 59 | true when any filter is active (picks the empty-state text) |
| `datesSet` | 60 | true when From or To has a value (keeps the calendar button tinted) |
| `initials(name)` | components.tsx:432 | two-letter avatar text |

## Where to change what

| You want to change | Go to |
| --- | --- |
| the status tab names, or add "Draft" | `STATUSES`, lines 20-26 (values must be `InvoiceStatus` or `'all'`) |
| the search placeholder | line 65 |
| the export buttons (icon, label, order) | `actions`, lines 124-127 |
| the date fields (labels, format, keyboard) | lines 74-79; `marginBottom: -space[4]` at 72 pulls the list card up |
| the empty-state texts | lines 91-92 |
| what a row shows (title, subtitle, trailing) | `renderItem`, lines 94-110 |
| row avatar colours | `leadingAlt` (line 98) and `ListItem` in components.tsx:443 |
| gap between search and calendar | `gap: 10`, line 64 |
| gap between blocks / side padding | `layout.gap` (16) and `layout.side` (20), line 63 |
| room above the FAB on long lists | `52 + layout.gap` and the `> 6` rule, line 89 |
| how many rows load | `limit: 500`, line 44 |
| the FAB's text or action | line 114; its look is the shared `FAB` (C9, components.tsx:586) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## Tablet (md+)

The phone/tablet branch is at line 131. Pane widths: detail `'42%'` when `bp.panes === 3` (xl+) else `'50%'` (line 138); activity `'26%'` (line 144). Rows don't open an overlay; they highlight (`selected`, line 100) and the detail pane re-mounts `InvoiceDetail` by `key={selected.id}` (line 140). The FAB is replaced by the rail's "+".
