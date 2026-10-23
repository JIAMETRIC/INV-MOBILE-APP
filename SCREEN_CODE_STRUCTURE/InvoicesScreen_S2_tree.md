# What's inside InvoicesScreen (S2, Invoices tab)

File: `src/features/invoices/InvoicesScreen.tsx` (269 lines). Line numbers as of 2026-10-23, after the restructure (Prompt 12) and the memoised rows + `Columns` (Prompt 28).
Opened by the Invoices tab (S0.4.1), or by `showInvoice(id, false)` on tablets (selects the row).
Data: `listInvoices({search, status, from, to, limit: 500})` in `src/data/invoicesRepo.ts:15`.
IDs (S2.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

The file reads top to bottom: the text and numbers you edit most (`STATUSES`, `S2`), then all the
state in one hook (`useInvoiceList`), then the screen switch, then one function per region in the
order they appear on screen. Every function's name is stable; line numbers drift.

```
STATUSES              S2.2  All · Issued · Partial · Paid · Void (text to edit)       31
S2                    every number specific to this screen:                            41
                        filterGap 10 · dateRowPull −16 · longList 6 ·
                        fabClearance 52+16 · detailWidth 50 % / 42 % · activityWidth 26 %

useInvoiceList()      state + data, no JSX: rows, search, status, dateOpen,            53
                      from, to, busy · load() reruns on any filter or refreshKey ·
                      runExport('list' | 'register') · datesSet · filtered · selected

InvoicesScreen()      the switch                                                       97
├─ phone  → <Header> + <ListPane>                                                     103
└─ tablet → <Header> + row[ <ListPane> | <DetailPane> | <ActivityPane> (3 panes) ]    111

Header                S2.0  TopAppBar large: "N invoice(s)" · "Invoices" ·            124
                            glass buttons: download = Export list,
                            book = Export consolidated register (busy spinner)

ListPane              S2.1–S2.6  column, side padding 20, gap 16                      141
├─ FilterRow          S2.1 + S2.3  row, gap S2.filterGap:                             157
│      SearchField "Search invoice no or party" (flex 1) |
│      calendar IconButton (tinted when open or a date is set)
├─ SegmentedControl   S2.2  the status tabs (one line)                                148
├─ DateRangeRow       S2.3a  <Columns> (C15): two equal columns; stacks only if a      170
│      cell would be under 44 wide:
│      Input "From" | Input "To"  (YYYY-MM-DD, numeric, max 10);
│      only while the calendar button is on
├─ InvoiceListCard    S2.5  Card list, hugs its rows (flexShrink 1), scrolls when     183
│    │                      full, stops navInset above the nav
│    ├─ FlatList      paddingBottom = S2.fabClearance on phones with > 6 rows         195
│    ├─ empty         S2.5.e  filtered → "No matches" · else "No invoices yet"        200
│    └─ InvoiceRow    one row (React.memo; onPress(id) is a stable useCallback):      219
│           avatar (initials; alternate rows grey) · party name ·
│           "no · date" caption · ₹ total (Bebas, small) over the status pill ·
│           divider except on the last row · tinted when selected (tablet) ·
│           tap: phone → S3 overlay, tablet → select the row
└─ FAB                S2.6  "New invoice" → nav.openCreate(); phone only              151

DetailPane            S2.7  tablet: width S2.detailWidth[panes], left divider;        244
                            InvoiceDetail (S3) or "No invoice selected"
ActivityPane          S2.8  3-pane tablets with a row selected: width 26 %,          255
                            small Card: "ACTIVITY" · "no · status" · "Issued date"
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `useInvoiceList()` | 53 | owns every piece of state; `load()` queries the repo and reruns when a filter or `nav.refreshKey` changes; `runExport()` builds the XLSX (D2.1 or D2.2), opens the share sheet, shows an alert on failure |
| `InvoicesScreen()` | 97 | reads theme + breakpoint, calls the hook, picks the phone or tablet layout |
| `Header` | 124 | S2.0 |
| `ListPane` | 141 | S2.1–S2.6 container; the only place that knows the order of the filter rows |
| `FilterRow` | 157 | S2.1 + S2.3 |
| `DateRangeRow` | 170 | S2.3a, built with `Columns` (C15) |
| `InvoiceListCard` | 183 | S2.5 card, list, empty states, FAB clearance |
| `InvoiceRow` | 219 | one list row, `React.memo` (props: `item`, `alt`, `last`, `selected`, `onPress(id)`) |
| `DetailPane` | 244 | S2.7 |
| `ActivityPane` | 255 | S2.8 |

## Where to change what

| You want to change | Go to |
| --- | --- |
| a status tab's name, or add / remove a tab | `STATUSES` (31); the value must be an `InvoiceStatus` or `'all'` |
| the gap between search and calendar, the FAB clearance, pane widths | `S2` (41-48), one line each |
| the order of search / tabs / date fields | the 5 lines inside `ListPane` (147-151) |
| the search placeholder or the calendar label | `FilterRow` (160-161) |
| the date fields' labels, placeholder or keyboard | `DateRangeRow` (173, 175); to stack them always, add `stackAt="sm"` to `Columns` |
| what a row shows (title, caption, trailing) | `InvoiceRow` (219-241); the trailing column is the `View` at 234 |
| the empty-state icons and text | `InvoiceListCard` (201-202) |
| what a tap on a row does | `InvoiceListCard` `onPressRow` (188-191) |
| the header title, count text or export buttons | `Header` (127-137) |
| the tablet panes | `InvoicesScreen` tablet branch (111-119), `DetailPane`, `ActivityPane` |
| card / row / button looks (all screens) | `src/ui/components.tsx` (C6 Card, C7 ListItem, C8a SegmentedControl, C9 FAB) |
| colours, radii, fonts | `src/ui/tokens.ts` |

## Tablet (md+)

Same `Header` and `ListPane`; the row adds `DetailPane` (50 % at 2 panes, 42 % at 3) and, at 3 panes with a row selected, `ActivityPane` (26 %). Tapping a row selects it (`nav.selectInvoice`) instead of opening the S3 overlay. Not verified on a device in this session (phone emulator only); checked by reading the code.
