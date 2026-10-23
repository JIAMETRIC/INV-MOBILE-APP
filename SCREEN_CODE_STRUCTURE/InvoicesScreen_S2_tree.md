# Invoices (S2) — Three-Slot tree

**File:** `src/features/invoices/InvoicesScreen.tsx` (300 lines; line numbers as of 2026-10-23) · **Reached by:** the Invoices tab (S0.4.1); on tablets also `nav.showInvoice(id, false)` (`src/shell/navigation.tsx:58-61`, switches to the tab and selects the row), which S4 calls after a save · **Data:** `listInvoices({ search, status, from, to, limit: 500 })` `src/data/invoicesRepo.ts:15`; exports `exportInvoicesXlsx(rows)` (D2.1) and `exportConsolidatedRegister()` (D2.2) in `src/export/xlsx.ts`, shared with `shareFile` from `src/export/pdf.ts` · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S2 · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

The filtered list of invoices, with the selected invoice beside it on tablets. One pane when `bp.panes === 1` (xs, sm, md): `Header` + `ListPane` on `<Screen header fab>`, and a row tap opens S3 as an overlay. lg+ is `Header` + a row of panes: `ListPane` (`flex: 1`) | `DetailPane` (`S2.detailWidth`) | `ActivityPane` (`S2.activityWidth`, only from `S2.activityFrom` = xxl and with a row selected). The FAB is phones only (`bp.isPhone`). On screens under `S2.shortScreen` (600 dp of height) the filters become the list's header so the card cannot collapse.

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | `TopAppBar large`: caption "N invoice(s)" over the "Invoices" title; two glass buttons: `download` = Export list to Excel, `book` = Export consolidated register, each with a busy spinner while its export runs | `Header` | 132-146 |
| Below | none; the filters (S2.1 to S2.3a) live inside Main so that on short screens they can scroll as the list's header | — | — |
| Main | one pane: `ListPane`, a column of the filters and the list card, whose `FlatList` is the one scroller. lg+: a `View` row of panes, `ListPane` plus `DetailPane` (plus `ActivityPane`). The card ends `useNavInset()` above the nav and its content adds `useFabClearance()` on long lists | `ListPane` / `InvoicesScreen()` | 149-175 / 122-126 |
| Footer | none (no screen-level action bar; the actions are the row tap and the FAB) | — | — |
| FAB | "New invoice" on phones → `nav.openCreate()`; the `fab` slot of `<Screen>` | in `InvoicesScreen()` | 109, 114 |
| Nav / rail | owned by the shell (S0) | — | — |

## 2. The file in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `STATUSES` | 32-38 | the status tabs (S2.2): value and label, in order |
| 2 | `S2` | 42-50 | every number specific to this screen |
| 3 | `useInvoiceList()` | 55-93 (type `InvoiceList` at 94) | all state, data and actions (no JSX) |
| 4 | `InvoicesScreen()` | 99-129 | the one-pane / panes switch on `<Screen>`; `showActivity` and the phone FAB |
| 5 | `Header` · `ListPane` · `FilterRow` · `DateRangeRow` · `InvoiceListCard` · `InvoiceRow` (memo) | 132-272 | one function per region, in on-screen order |
| 6 | `DetailPane` · `ActivityPane` | 275-300 | the tablet-only panes |

## 3. Tree

```
InvoicesScreen()                                                        line 99
│   bp.panes === 1 (xs, sm, md) → <Screen header fab>                   112-118
│   lg+                          → <Screen header> + row of panes        120-128
│
├─ Header               S2.0  TopAppBar large: "N invoice(s)", "Invoices";    132
│                             glass buttons download = Export list to Excel,
│                             book = Export consolidated register (busy)
│
├─ ListPane             S2.1–S2.5  column: flex 1, minWidth 0, sides 20,      149
│    │                        gap 16; the filters are built once (152-158)
│    │                        bp.height < S2.shortScreen: the filters become
│    │                        the card's `header` and the card gets `fill`   161-168
│    ├─ FilterRow       S2.1 + S2.3  [ SearchField flex 1 | IconButton 44 ]    178
│    │                        plain row, gap S2.filterGap, top 4 (not Columns)
│    ├─ SegmentedControl S2.2  the STATUSES tabs, one line (kit control)       155
│    ├─ DateRangeRow    S2.3a  [ Input From | Input To ]  Columns kind="input"  191
│    │                        only while list.dateOpen; marginBottom S2.dateRowPull
│    └─ InvoiceListCard S2.5  Card list: flexShrink 1, marginBottom navInset,  206
│         │                   overflow hidden (`fill`: flex 1, top 4)
│         ├─ FlatList         flexGrow 0 (`fill`: flex 1); ListHeaderComponent  223
│         │                   = header; paddingBottom = useFabClearance()
│         │                   when rows.length > S2.longList, else 0
│         ├─ empty      S2.5.e  filtered → "No matches" · else "No invoices yet"  230
│         └─ InvoiceRow × n    React.memo; onPress(id) is a useCallback        250
│              ├─ ListItem flush: initials avatar (leadingAlt on odd rows),
│              │   party name or "(no party)", "no · date"; divider except
│              │   the last row; selected tint (tablets only)
│              └─ trailing column: ₹ total (MoneyText small) over StatusGlyph  264
│
└─ fab slot (phones)    S2.6  FAB "New invoice" → nav.openCreate()             109

lg+ (panes):  Header · row [ ListPane flex 1 | DetailPane | ActivityPane ]     122
   DetailPane           S2.7  width S2.detailWidth[3 if activity else 2];      275
                              left divider; InvoiceDetail (S3) keyed by id,
                              or "No invoice selected"
   ActivityPane         S2.8  xxl with a row selected: width S2.activityWidth,  286
                              left divider, padding 20; small Card: "Activity"
                              overline · "no · status" · "Issued <date>"
```

## 4. The `S2` numbers

| Key | Value | ID | Means |
| --- | --- | --- | --- |
| `filterGap` | 10 | S2.1 | between the search field and the calendar button |
| `dateRowPull` | `-space[4]` (−16) | S2.3a | pulls the list card up under the date inputs' bottom gap |
| `longList` | 6 | S2.5 | more rows than this on a phone: the list's content pads by `useFabClearance()` so the last row clears the FAB (0 on tablets, where no `fab` is set) |
| `detailWidth` | `{ 2: '50%', 3: '42%' }` | S2.7 | detail pane width by pane count: 42 % only while the activity pane shows |
| `activityWidth` | `'26%'` | S2.8 | activity pane width |
| `activityFrom` | `'xxl'` | S2.8 | the activity pane shows from this breakpoint; at xl (961 dp) three panes squeezed the list to about 280 dp |
| `shortScreen` | 600 | S2.5 | under this height (a phone in landscape is 411) the filters scroll with the list as its header and the card fills the pane |

Shared spacing comes from `src/ui/tokens.ts`: `layout.side` 20, `layout.gap` 16, `layout.grid` 12 (the `Columns` default gap). The FAB clearance (52 + 16) is known only to `src/ui/Screen.tsx`.

## 5. Rows and columns

| Row | Function | Cells | Rule |
| --- | --- | --- | --- |
| S2.1 + S2.3 filter row | `FilterRow` | 2: search field · calendar button | **not `Columns`**: the field grows (`flex: 1`) and the button keeps its 44 width, while `Columns` gives every cell a flex weight. Gap `S2.filterGap`, `paddingTop` 4 |
| S2.2 status tabs | `SegmentedControl` inside `ListPane` | 5 tabs | one line; the kit control (C8a) lays out its own tabs (they truncate at 320 dp, see § 8) |
| S2.3a date fields | `DateRangeRow` | 2: From · To | `Columns kind="input"`: stacks under 128 dp per cell (`CELL_MIN.input`), gap 12. Never at phone widths: inside the pane's 20 dp sides a cell is about 134 at 320 dp. `stackAt="sm"` would force a stack |
| S2.5 row trailing | `InvoiceRow` | amount over status pill | a column (`alignItems: 'flex-end'`, gap 4) in `ListItem`'s `trailing` slot, not a row |
| lg+ panes | `InvoicesScreen()` | 2 or 3 panes | **not `Columns`**: pane widths are percentages from `S2` and `ListPane` takes the rest with `flex: 1` (the method's rule for panes) |

## 6. State and actions (`useInvoiceList()`)

| Name | Does |
| --- | --- |
| `rows` | the invoices from `listInvoices` for the current filters, at most 500 |
| `search`, `setSearch` | the search text; trimmed before the query |
| `status`, `setStatus` | the active tab, `'all'` or an `InvoiceStatus`; `'all'` sends no status filter |
| `dateOpen`, `toggleDates` | whether the date fields (S2.3a) show; the calendar button toggles it |
| `from`, `setFrom`, `to`, `setTo` | the date range as typed (`YYYY-MM-DD`); empty strings send no bound |
| `load()` | runs the query; reruns whenever a filter changes or `nav.refreshKey` changes (any save anywhere) |
| `runExport(kind)` | `'list'` = `exportInvoicesXlsx(rows)`, `'register'` = `exportConsolidatedRegister()`; opens the share sheet, shows an "Export failed" alert on error, keeps `busy` set while it runs |
| `busy` | `'list'`, `'register'` or `null`: which header button shows its spinner |
| `datesSet` | a from or to date is set (tints the calendar button) |
| `filtered` | any filter is active (picks the "No matches" empty state) |
| `selected` | the row matching `nav.selectedInvoiceId`, or `null` (drives the tablet panes) |

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| a status tab's name, or add / remove a tab | `STATUSES`, lines 32-38; the value must be an `InvoiceStatus` or `'all'` |
| the gap between search and calendar, the pane widths, when the activity pane appears, the short-screen height | `S2`, lines 42-50, one line each |
| the order of search / tabs / date fields | the three lines inside `ListPane`, 154-156 |
| the search placeholder or the calendar button's label | `FilterRow`, lines 181-182 |
| the date fields' labels, placeholder or keyboard | `DateRangeRow`, lines 194-197; to stack them always, add `stackAt="sm"` to `Columns` at 193 |
| what a row shows (avatar, title, caption, trailing) | `InvoiceRow`, lines 254-270; the trailing column is the `View` at 265 |
| the empty-state icons and text | `InvoiceListCard`, lines 231-232 |
| what a tap on a row does | `onPressRow` in `InvoiceListCard`, lines 215-218 |
| how many rows count as a long list (FAB clearance) | `S2.longList`; the padding is applied at 229 |
| the header title, count text or export buttons | `Header`, lines 136-143 |
| what sits in the list's header on short screens | `ListPane`, lines 161-168 (the `header` prop of `InvoiceListCard`) |
| the tablet panes | `InvoicesScreen()` lines 120-128, `DetailPane` 275-283, `ActivityPane` 286-300 |
| the FAB's text or action | `InvoicesScreen()`, line 109; its look is `FAB` (C9, `src/ui/components.tsx`) |
| the FAB clearance or the nav inset | `src/ui/Screen.tsx` (`useFabClearance`), `src/ui/navMetrics.ts` (`useNavInset`); never in this file |
| card / row / tabs / button looks (all screens) | `src/ui/components.tsx`: C6 `Card`, C7 `ListItem`, C8a `SegmentedControl`, C9 `FAB`; `src/ui/Columns.tsx` (C15), `src/ui/Screen.tsx` (C16) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## 8. Sizes

| Size | Layout | Last checked |
| --- | --- | --- |
| xs 320 · sm 360 · phone 411 | one pane: header, filters, list card, FAB above the floating nav. At 320 the search placeholder, the tabs and the From / To placeholders truncate, a row's date wraps to two lines and the FAB sits over the card's bottom padding: tight but readable, nothing hidden (the app's floor). 360 and 411 complete | Prompt 44 |
| phone landscape 914 × 411 (lg, 2 panes) | height under `S2.shortScreen`: the filters are the list's `ListHeaderComponent` inside a card that fills the pane, so everything scrolls together; with the date range open the row sits below the fold and the card never collapses (before Prompt 45 it collapsed to nothing) | Prompt 44, fix Prompt 45 |
| md 601 (8-inch portrait) | one pane + rail (`bp.panes === 1`): full-width list, tabs and placeholders complete; a tap opens S3 as an overlay with a back bar beside the rail (before Prompt 32: two panes, list about 235 dp, everything truncated) | Prompt 30, fix Prompt 32 |
| lg 800 · xl 961 · xxl 1280 | lg: 2 panes, list about 340 dp, detail 50 %, everything readable. xl: 2 panes since `S2.activityFrom` = xxl, list about 450 dp with complete tabs and row text, detail 50 % (before Prompt 33: 3 panes, list about 280 dp, tabs truncated). xxl: 3 panes with a row selected, detail 42 %, activity 26 %, everything readable | Prompt 30, fix Prompt 33 |

The move onto `<Screen>` (C16) was Prompt 37; the memoised rows and the `Columns` date row were Prompt 28; the restructure itself was Prompt 12. Line numbers moved with each; the function names did not.

Open findings (not applied): none.
