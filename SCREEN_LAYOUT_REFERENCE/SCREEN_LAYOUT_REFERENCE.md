# Complete Layout & Architecture Reference

Every screen, section, row, column and function in the app, each with a **stable ID** you can quote in a prompt.

> **How to use the IDs in a prompt**
> `In S2.3 (Invoices → status chips) add a "Draft" chip.`
> `In S1.1 (Dashboard KPI grid) put all five cards in one row on tablets.`
> `In S4.B.4 (Create invoice → line-item card) put Qty and Rate on separate rows.`
>
> ID format: `S<screen>.<section>[.<row>]`. Overlays are `P<n>`, shared components are `C<n>`, documents are `D<n>`.
> Line numbers were taken on 2026-10-22 (session 13, re-checked after the Prompt 2 fixes). They drift as code changes. The file name plus the component name is what stays reliable.
>
> **Flat Glass redesign (Prompt 4):** every screen now follows `design/DESIGN.md` (see `CLAUDE.md`). S0.4, S1, S2 and the C / tokens tables below are updated for it. Elsewhere, read "app bar" as the flat header (C1), "card" as a glass card (C6), and chips as pills (C8); section IDs are unchanged. Line numbers in S3–S6 are from before the redesign.

---

## 0. Map of the app

```
App.tsx ─ SafeAreaProvider ─ ThemeProvider (light/dark from system)
   └─ Root: loading screen → error screen → ready
        └─ NavProvider (tab + overlay state, Android Back)
             └─ SnackbarProvider
                  └─ Shell
                       ├─ Phone  (<600dp): [tab screen] + BottomTabs      overlays take the full screen
                       └─ Tablet (≥600dp): Rail | [tab screen or Create]  detail opens in a side pane
```

| ID | Screen | File | Opened by |
| --- | --- | --- | --- |
| S0 | App shell, navigation, loading/error | `src/shell/App.tsx`, `src/shell/navigation.tsx`, `src/ui/Nav.tsx` | app start |
| S1 | Dashboard (Home) | `src/features/dashboard/DashboardScreen.tsx` | tab **Home** |
| S2 | Invoices list | `src/features/invoices/InvoicesScreen.tsx` | tab **Invoices** |
| S3 | Invoice detail | `src/features/invoices/InvoiceDetail.tsx` | tapping an invoice (phone: full-screen overlay; tablet: right pane of S2) |
| S4 | Create / Edit invoice | `src/features/invoices/CreateInvoiceScreen.tsx` | FAB / Rail **+** / "Edit" in S3 / a draft in S6 |
| S5 | Products | `src/features/products/ProductsScreen.tsx` | tab **Products** |
| S6 | Settings | `src/features/settings/SettingsScreen.tsx` | tab **Settings** |
| P1 | Record-payment sheet | inside `InvoiceDetail.tsx` | S3 "Record payment" |
| P2 | Add-from-products (catalog) sheet | `CatalogSheet` in `CreateInvoiceScreen.tsx` | S4 "Add from products" |
| P3 | Product editor / Restock sheet | inside `ProductsScreen.tsx` | S5 row tap or FAB (phone, md) |
| D1 | Invoice PDF / print layout | `src/export/pdfTemplate.ts` | S3 "Share PDF", S4 preview |
| D2 | Excel exports | `src/export/xlsx.ts` | S2, S3, S5 export buttons |

### Breakpoints (`src/ui/useBreakpoint.ts`)

| bp | Width (dp) | Columns | Panes | Gutter | Side margin (`bp.margin`) | Device class |
| --- | --- | --- | --- | --- | --- | --- |
| xs | 0–359 | 4 | 1 | 12 | 16 | small phone |
| sm | 360–599 | 4 | 1 | 16 | 16 | phone (emulator is 411dp → **sm**) |
| md | 600–767 | 8 | **1** | 16 | 24 | small tablet / foldable; an 8-inch tablet in portrait (601 dp). Rail, but one pane: S2 opens S3 as an overlay, S6 drills in, S5 uses the phone rows (since 2026-10-23) |
| lg | 768–959 | 8 | 2 | 20 | 24 | tablet portrait |
| xl | 960–1199 | 12 | 3 | 24 | 32 | tablet landscape |
| xxl | ≥1200 | 12 | 3 | 24 | 32 | large tablet / desktop web |

`isPhone` = xs or sm (floating bottom nav). `panes === 1` = xs, sm **and md** (one pane; md keeps the rail). Layouts branch on `bp.panes`, `bp.isPhone`, `bp.atLeast('lg')` or `bp.atLeast('xl')`.

---

## S0 — App shell & navigation

**Files:** `src/shell/App.tsx`, `src/shell/navigation.tsx`, `src/ui/Nav.tsx`

### S0.1 Start-up states (`Root`, App.tsx:35)

| ID | State | Layout | Lines |
| --- | --- | --- | --- |
| S0.1.1 | Loading | centred column: spinner, "Invoice ERP" (title), "Unlocking database…" | App.tsx:55-64 |
| S0.1.2 | Error | centred column: alert icon (40), "Cannot open the database", error text | App.tsx:65-74 |
| S0.1.3 | Ready | NavProvider → SnackbarProvider → Shell | App.tsx:76-83 |

Start-up work: `getDb()` → `syncNextSeq()` → ready → `ensureDailyBackup()` in the background (App.tsx:41-53).

### S0.2 Phone shell (`Shell`, App.tsx:104-126)

```
┌───────────────────────────┐
│  [ active tab screen ]    │  flex:1
│                           │
├───────────────────────────┤
│ Home Invoices Products Set│  S0.4 BottomTabs, 80dp + gesture inset
└───────────────────────────┘
Overlay "create-invoice" → S4 full screen (no tabs)
Overlay "invoice-detail" → TopAppBar "Invoice" (back) + S3 full screen (also on md tablets, inside the content area beside the rail)
```

### S0.3 Tablet shell (App.tsx:128-145)

```
┌──────┬────────────────────────────────────┐
│  +   │                                    │
│ Home │   [ active tab screen ]            │
│ Inv. │   or S4 when overlay=create        │
│ Prod │                                    │
│ Set. │                                    │
└──────┴────────────────────────────────────┘
 88dp Rail (labels only at xl+)
```

### S0.4 Navigation components (`src/ui/Nav.tsx`)

| ID | Component | Spec | Lines |
| --- | --- | --- | --- |
| S0.4.1 | `TABS` | 4 destinations, Feather icons: dashboard `home`, invoices `file-text`, products `tag`, settings `settings` | Nav.tsx:12-17 |
| S0.4.2 | `BottomTabs` | kit floating bottom nav: absolute, 20 from the left/right edges and `useNavBottom()` (≥ 20) from the bottom; height 68 (`NAV_HEIGHT`), radius 16, glass nav fill + 1px border, `shadow.secondary`; 4 icon-only items (label is the accessibility label) | Nav.tsx:45-66 |
| S0.4.2a | `NavItem` | 48×48, radius 14; active = blue fill, white 22px icon, `shadow.primary`; inactive = `#666` icon | Nav.tsx:21-41 |
| S0.4.3 | `Rail` | tablet: width 88, glass nav fill, right border; "New invoice" primary button (52, radius 12) on top, then `NavItem`s; labels under them at xl+ | Nav.tsx:69-123 |
| S0.4.4 | `navMetrics.ts` | `NAV_HEIGHT` 68 · `useNavBottom()` · `useNavInset()` (space screens keep clear above the nav) · `useMainInset()` / `useFabClearance()` from `Screen.tsx` (C16) | navMetrics.ts |

### S0.5 Navigation state (`NavProvider`, navigation.tsx)

| Function / field | Does | Lines |
| --- | --- | --- |
| `tab`, `goTab(t)` | switch tab and close any overlay | navigation.tsx:46-53 |
| `overlay`, `openCreate({draftId?, invoiceId?})`, `closeOverlay()` | show or hide S4 / S3-overlay | navigation.tsx:5-8, 54-57 |
| `showInvoice(id, phone)` | phone → S3 overlay; tablet → Invoices tab + select row | navigation.tsx:58-61 |
| `selectedInvoiceId`, `selectInvoice` | the row selected in the S2 tablet list | navigation.tsx:48 |
| `refresh()`, `refreshKey` | every screen reloads its data when this changes | navigation.tsx:49-52 |
| `pushBack` / `useBackIntercept(fn)` | a screen claims Android Back (S4 stepper, S6 drill-in) | navigation.tsx:38-43 |
| Back order | screen interceptor → close overlay → go to Home → exit app | navigation.tsx:67-81 |

Snackbar sits above the nav bar and FAB on phones: `bottomOffset = NAV_HEIGHT + 52 + 2 * 16 + 8` (= 160; App.tsx:95).

> **Per-screen tree files:** `SCREEN_CODE_STRUCTURE/` holds one `*_tree.md` per screen, overlay, document and shared component (S0–S6, P1–P3, D1–D2, C1–C4) with the current component tree, line numbers, a function table and a "where to change what" table. Line numbers there are refreshed more often than the ones in this file.

---

## S1 — Dashboard (Home)

**File:** `src/features/dashboard/DashboardScreen.tsx` · **Data:** `getKpis()` from `src/data/dashboardRepo.ts`; `getStockTotals()` from `src/data/productsRepo.ts` · **Kit reference:** `design/screens/02-dashboard`

### Phone wireframe (sm)

```
 FY 2026–27 overview          S1.0 flat header: caption above H2 title
 Dashboard
┌─────────────────────────────┐
│ TOTAL BILLED · FY [1 invoice]│ S1.1 hero card (kit "Revenue" card):
│ ₹0.00                       │       overline + badge, hero figure
└─────────────────────────────┘
┌─────────┐┌─────────┐┌─────────┐
│ (chip)  ││ (chip)  ││ (chip)  │ S1.2 stat tiles, 3 across, gap 12
│ Products││ Balance ││ Actual  │       icon chip · 2-line label · figure
│ Sold    ││ Stock   ││ Stock   │
│ 3       ││ 12      ││ 15      │
└─────────┘└─────────┘└─────────┘
               [+ New invoice]   S1.5 FAB (52, radius 12, blue)
┌─────────────────────────────┐
│ [■]   [ ]    [ ]    [ ]     │ S0.4.2 floating bottom nav
└─────────────────────────────┘
```

### Tablet (md+): same blocks, full width. (Recent invoices S1.3 and Outstanding S1.4 were removed in Prompt 5; their IDs are retired.)

### Sections

| ID | Section | Rows / columns | Key props | Lines |
| --- | --- | --- | --- | --- |
| S1.0 | Header | `TopAppBar large`: caption `fyLabel()` above the "Dashboard" H2 | — | 20-23, 68 |
| S1.1 | Hero card | glass card, padding 20, gap 6: overline "Total billed · FY" + badge "N invoice(s)" (`kpis.invoiceCount`, this FY) · `₹ kpis.billedPaise` in `type.hero` (Bebas Neue 44) | — | 76-87 |
| S1.2 | Stat tiles | one row, 3 cells (flex 1, gap 12); each `StatTile`: small glass card (`shadow.primary`), padding 16, gap 10, `IconChip` · label 13 `#666` (2 lines, min height 36 so values align) · value `type.figure` (Bebas 28) | — | 26-39 (StatTile), 60-64, 89-95 |
| S1.2.a | "Products Sold" | `stock.soldQty` = Σ qty on product-linked lines of non-void invoices (all time; = SOLD in S5) · `shopping-cart` | | 61 |
| S1.2.b | "Balance Stock" | `stock.avlQty` = Actual − Sold (= AVL in S5; can go negative) · `box` | | 62 |
| S1.2.c | "Actual Stock" | `stock.stockQty` = Σ `products.stock_qty` (= STOCK in S5) · `layers` | | 63 |
| S1.5 | FAB "New invoice" | phone only, 20 from the right, 16 above the nav (C9) | | 93 |
| — | Scroll container | side padding 20, gap 16, bottom = `useMainInset()` (clears nav + FAB; from `<Screen fab>`), maxWidth max(720, 90% width) | | 69-75 |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `fyLabel(d)` | "FY 2026–27 overview" (April–March year) | 20-23 |
| `StatTile({kpi, theme})` | one kit stat tile | 26-39 |
| `load()` | runs the 2 queries in parallel (KPIs, stock totals); reruns on `refreshKey` | 46-49 |
| `getStockTotals()` (productsRepo.ts:40) | Σ stock, Σ sold (same SOLD rule as S5), avl = stock − sold | — |

---

## S2 — Invoices list

**File:** `src/features/invoices/InvoicesScreen.tsx` · **Data:** `listInvoices({search,status,from,to,limit:500})`

### Phone wireframe

```
 1 invoice                [⬇] [▤]   S2.0 flat header + 2 glass export buttons
 Invoices
[🔍 Search invoice no or party] [📅]  S2.1 search field + S2.3 date-range button
( All | Issued | Partial | Paid | Void )  S2.2 segmented control
[From YYYY-MM-DD] [To YYYY-MM-DD]   S2.3a date fields (only when 📅 is on)
┌─────────────────────────────┐
│ (AS) Party       ₹1,200.00  │ S2.5 list card: hugs its rows,
│      PRE-003 · date [Paid]  │      scrolls once it fills the space
└─────────────────────────────┘
               [+ New invoice]   S2.6 FAB
```

### Tablet wireframe (lg = 2 panes, xl+ = 3 panes; md is one pane like the phone, plus the rail)

```
┌──────────────────────┬────────────────────────┬──────────────┐
│ S2.1–S2.5 list pane  │ S2.7 detail pane       │ S2.8 Activity│
│ flex:1               │ md/lg 50%, xl 42%      │ xl+ 26%      │
│ selected row tinted  │ = S3 InvoiceDetail     │ (only when a │
│                      │ or "No invoice         │  row is      │
│                      │  selected"             │  selected)   │
└──────────────────────┴────────────────────────┴──────────────┘
```

### Sections

| ID | Section | Spec | Lines |
| --- | --- | --- | --- |
| S2.0 | Header | `Header`: `TopAppBar large`, caption "N invoice(s)", title "Invoices"; glass icon buttons `download` = Export list to Excel (current filtered rows), `book` = Export consolidated register | `Header` |
| S2.1 | Search | `FilterRow`: `SearchField` (50 tall, glass) "Search invoice no or party", flex 1 | `FilterRow` |
| S2.2 | Status filter | `SegmentedControl` over `STATUSES` (All, Issued, Partial, Paid, Void), inside `ListPane` | `STATUSES`, `ListPane` |
| S2.3 | Date-range button | `FilterRow`: glass `IconButton` `calendar`; tinted when open or when a date is set | `FilterRow` |
| S2.3a | Date fields | `DateRangeRow`: 2 columns (gap 12): From, To, `YYYY-MM-DD`, numeric, max 10 | `DateRangeRow` |
| S2.5 | List card | `InvoiceListCard`: `Card list` with `flexShrink: 1` + `FlatList` `flexGrow: 0`; rows = `InvoiceRow` (`ListItem flush` with avatar, party, `no · date`, amount + status). Phone tap → S3 overlay; tablet tap → select (tinted row). Long lists (> `S2.longList`) get `S2.fabClearance` at the bottom | `InvoiceListCard`, `InvoiceRow` |
| S2.5.e | Empty states | filtered → "No matches"; unfiltered → "No invoices yet" | `InvoiceListCard` |
| S2.6 | FAB | phone only, "New invoice"; the `fab` slot of `<Screen>` in `InvoicesScreen()`; the list card clears it with `useFabClearance()` | `InvoicesScreen` |
| S2.7 | Detail pane | `DetailPane`: lg+; width `S2.detailWidth` 50%, or 42% when the activity pane shows (xxl); left divider; renders S3 | `DetailPane` |
| S2.8 | Activity pane | `ActivityPane`: **xxl** (`S2.activityFrom`) with a row selected; width `S2.activityWidth` 26%; small glass card: overline "Activity", `no · status`, "Issued <date>". At xl the screen is 2 panes (detail 50 %) | `ActivityPane` |

Since Prompt 12 (2026-10-23) the file is split into named functions, listed in the last column instead of line numbers: `useInvoiceList()` holds all state; `S2` (line ~40) holds every screen-specific number. See `SCREEN_CODE_STRUCTURE/InvoicesScreen_S2_tree.md`.

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `useInvoiceList()` | all state: rows, search, status, dateOpen, from, to, busy; `load()` queries with the filters and reruns when any filter or `refreshKey` changes; `runExport('list' \| 'register')` builds XLSX (D2.1 / D2.2) → share sheet, busy spinner on that action; derived `datesSet`, `filtered`, `selected` | 52-90 |
| `InvoicesScreen()` | phone: `Header` + `ListPane`; tablet: `Header` + row [`ListPane` \| `DetailPane` \| `ActivityPane`] | 96-120 |

---

## S3 — Invoice detail

**File:** `src/features/invoices/InvoiceDetail.tsx` · **Data:** `getInvoice`, `getLines`, `paidPaiseForInvoice`

Phone: full screen under a "Invoice" back app bar (App.tsx:112-119). Tablet: inside S2.7.

### Wireframe

```
┌───────────────────────────────┐
│ PRE-001                [Issued]│ S3.1 header row
│ 22 Oct 26 · due 05 Nov 26      │
├───────────────────────────────┤
│ BILL TO                        │ S3.2 filled card
│ Party name                     │
│ address, city, pincode         │
│ Ph 98xxxxxx · mail@x.com       │
├───────────────────────────────┤
│ [Record payment][Share PDF][Excel] S3.3 action row (wraps)
├───────────────────────────────┤
│ Items (2)                      │ S3.4
│ Item ............ Qty Rate Amt │ S3.4.h header (flex 3:1:1:1)
│ Shirt - M          2  500 1000 │ S3.4.r line rows
├───────────────────────────────┤
│              Gross    1,000.00 │ S3.5 totals
│     Discount (5%)       -50.00 │
│          Round off       0.00  │
│              Total  ₹950.00    │
│               Paid / Balance   │
│ Nine Hundred Fifty Rupees Only │ amount in words (italic)
│ notes                          │
├───────────────────────────────┤
│ [Edit]  [Void]                 │ S3.6 (hidden when void)
└───────────────────────────────┘
```

### Sections

| ID | Section | Spec | Lines |
| --- | --- | --- | --- |
| S3.0 | Loading | centred spinner until the invoice loads | 44-50 |
| S3.1 | Header row | left column: invoice_no (title) + date · due; right: StatusGlyph | 112-121 |
| S3.2 | Bill-to card | filled Card: "BILL TO", party (heading), address line, contact line (`Ph … · email`) | 106-107, 123-128 |
| S3.3 | Primary actions | wrap row, gap 8: **Record payment** (solid, only if `canPay`) · **Share PDF** (tonal if canPay, else solid) · **Excel** (outline) | 105, 131-137 |
| S3.4 | Items table | SectionTitle "Items (n)"; header row Item/Qty/Rate/Amount with **flex 2.6 : 0.8 : 1.3 : 1.3**, numbers right-aligned; each line row padded 12, bottom border; description up to 2 lines | 139-158 |
| S3.5 | Totals block | `TotalRow`s: Gross · Discount (only if > 0) · Round off · **Total** (strong) · Paid (if > 0) · Balance due (if paid and outstanding) · amount in words · notes | 160-173 |
| S3.6 | Secondary actions | not void → **Edit** (outline, opens S4 in edit mode) · **Void** (ghost, red) | 175-181 |
| P1 | Record-payment sheet | see P1 below | 183-200 |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `load()` | invoice + lines + paid total | 33-42 |
| `voidInvoice()` | confirm dialog → `setStatus('void')` → audit → refresh → snackbar | 52-65 |
| `askPayment()` | reset fields, open P1 | 67-71 |
| `submitPayment()` | validate amount > 0 → `recordPayment` (today, selected mode) → audit → refresh → snackbar | 75-94 |
| `share('pdf' \| 'xlsx')` | PDF (D1) or single-invoice XLSX (D2.1) → share | 96-103 |
| `canPay` | not void, not paid, outstanding > 0 | 105 |

### P1 — Record-payment sheet (InvoiceDetail.tsx:183-200)

```
Record payment                    ✕
PRE-001 · outstanding ₹950.00
[ Amount (₹)        0.00 ]        error text if invalid
Mode
[Cash][UPI][NEFT][Cheque]         single-select chips
                 [Cancel] [Save payment]
```
Phone = bottom sheet; tablet = centred dialog (see C10). Payment modes (Cash, UPI, NEFT, Cheque) are a `SegmentedControl`, hard-coded in `InvoiceDetail.tsx` (`modes`).

---

## S4 — Create / Edit invoice

**File:** `src/features/invoices/CreateInvoiceScreen.tsx` (largest screen, 658 lines)

There are **three different layouts** built from the same blocks:

| Layout | When | Lines |
| --- | --- | --- |
| S4.L1 Phone stepper | `bp.isPhone` | `CreateInvoiceScreen()` phone branch: `<Screen>` with `Header`, `Stepper`, `StepBody`, `TotalBar` |
| S4.L2 Two-pane | md / lg | `CreateInvoiceScreen()` last branch: `FormPane` \| `PreviewPane` (md: the header's eye toggles them) |
| S4.L3 Three-panel | xl+ | `CreateInvoiceScreen()` xl branch: `CatalogPanel` \| `FormPane` \| `PreviewPane` |

### Building blocks (shared by all layouts)

| ID | Block | Rows / columns | Lines |
| --- | --- | --- | --- |
| S4.A | **Bill to** (`BillToCard`) | row 1 Party name * (full) · row 2 Address (full) · row 3 `CityPincodeRow` (Columns, 6 digits) · row 4 `MobileEmailRow` (Columns) · row 5 `DatesRow` (Columns, YYYY-MM-DD; stacks in the narrow xl form). Every field autosaves on blur | `BillToCard` |
| S4.B | **Items** (`ItemsSection`) | | `ItemsSection` |
| S4.B.1 | Items title | "Items (n)" + "Add from products" ghost button (hidden at xl, where S4.L3 shows the catalog panel) | `ItemsSection` |
| S4.B.2 | Empty card | "No items yet" | `EmptyItemsCard` |
| S4.B.3 | Line-item card | header row "ITEM n · FROM PRODUCTS / FREE LINE" + trash IconButton · Description (full) · **Qty \| Rate (₹)** as `Columns` weights **1 : 1.4** (`S4.qtyRateWeights`) · footer row "Amount" … ₹value | `LineItemCard` |
| S4.B.4 | "Add free line" | outline button, left-aligned | inside `ItemsSection` |
| S4.B.5 | Adjustments | "Adjustments" title · row: Discount % (flex 1, clamped 0–100) \| "Ship to address" chip (flex 1) | `AdjustmentsCard` |
| S4.B.6 | Shipping fields | only when the chip is on: Consignee (full) · Address (full) · `CityPincodeRow`; all printed in D1.2 | `ShippingFields` |
| S4.B.7 | Notes | multiline, "Optional — printed on the invoice" | inside `AdjustmentsCard` |
| S4.C | **Totals** (`TotalsCard`) | Subtotal · Discount (if > 0) · Round off · **Total** | `TotalsCard` |
| S4.D | **Review** (`ReviewSection`) | Bill-to filled card (party, `no · date · due`) · "Items (n)" compact rows: description (flex 1) \| `qty × rate` \| amount · `TotalsCard` · amount in words | `ReviewSection` |
| S4.E | **Preview** (`PreviewPane`) | "Preview" title + A4 / Letter control (`S4.pageSizeControl` 180) · white page frame, `S4.previewMinHeight` 400, WebView rendering D1 live | `PreviewPane` |
| S4.F | **Action buttons** (`ActionButtons`) | right-aligned: Save draft (outline) · Issue invoice / Update (solid, send / checkmark icon); in `FormPane` on tablets, in `TotalBar` on the phone's Review step | `ActionButtons` |
| P2 | Catalog sheet | see P2 below | `CatalogSheet` |

### S4.L1 — Phone stepper

```
┌──────────────────────────────┐
│ ← New invoice                │ app bar, subtitle = PRE-002 (preview no.)
│   PRE-002                    │
├──────────────────────────────┤
│ (1) Bill to ── (2) Items ── (3) Review │ S4.L1.1 Stepper (tap to jump)
├──────────────────────────────┤
│                              │
│  step 0 → S4.A               │ S4.L1.2 scroll body (padding 16)
│  step 1 → S4.B               │
│  step 2 → S4.D               │
│                              │
├──────────────────────────────┤
│ TOTAL                        │ S4.L1.3 bottom bar (surfaceContainer)
│ ₹950.00            [Next →]  │   steps 0–1: Next
│                    or S4.F   │   step 2: Save draft + Issue invoice
└──────────────────────────────┘
```
`Stepper`: 28-dp numbered circles (`S4.stepCircle`), a check on done steps, 2-dp connectors (accent when reached), touch height 44. The phone body is `StepBody` (one `ScrollView`), the bar is `TotalBar` (a `<Screen>` footer: in the flex column, so it rises with the keyboard).

### S4.L2 — Two-pane (md / lg)

```
lg:  ┌─────────────────────────────┬──────────────────┐
     │ S4.A + S4.B + S4.C + S4.F   │ S4.E preview     │
     │ scroll, maxWidth 720        │ width 40%        │
     └─────────────────────────────┴──────────────────┘
md:  one pane only; the app-bar eye / pencil action toggles Form ⇄ Preview (`tabPreview`)
```

### S4.L3 — Three-panel (xl+)

```
┌───────────────┬──────────────────────────┬────────────────────┐
│ Products  25% │ Form 38% (scroll)        │ Preview 37%        │
│ (🔍 search)   │ S4.A                     │ S4.E               │
│ Name · Size   │ S4.B                     │                    │
│ ₹price [Avl n]│ S4.C                     │                    │
│ tap = add line│ S4.F                     │                    │
└───────────────┴──────────────────────────┴────────────────────┘
```
Product rows: title `name · size`, subtitle price, trailing Avl badge (red < 0, grey = 0, green > 0). When the panel is under 300 dp (`narrowCatalog`, true at xl) the name may take two lines (`titleLines={2}`) and the size moves to the subtitle: `size · price`.
The panel loads the full product list as soon as the layout opens (`showsCatalogPanel` effect); typing in its search box narrows it.

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `S4` | every number specific to this screen (pane widths, stepper circle, preview height, Qty : Rate weights) | 46 |
| `blankForm()` | empty party, today, due = today + 14 days, 0% discount | 68 |
| `useInvoiceForm({ draftId, invoiceId })` | all state and actions: the mount effect (settings, then the edit invoice **or** a draft **or** the next number), `totals`, `patch` (marks unsaved), `autosave` (`saveDraft` on every blur), `previewHtml`, the xl catalog effect, `openCatalog`, `searchCatalog`, `addLine`, `addBlankLine`, `updateLine`, `removeLine`, `issue` (party name → step 0, ≥ 1 line → step 1, save, audit, delete draft, close, snackbar **View**), `saveAsDraft`, `leave` (unsaved new work → draft first), Android Back (phone step back, else leave) | 88-317 |
| `CreateInvoiceScreen()` | the phone / xl / md-lg switch on `<Screen overlay>` | 323-381 |
| `useScrollPad()` | the padding every scrolling pane shares; bottom from `useMainInset()` | 445 |

### P2 — Catalog sheet (`CatalogSheet`, 630-658)

```
Add from products                   ✕
(🔍 Search products)
(M)  Shirt                 ₹519.00     leading circle = size
     Stock 10 · Sold 2     [Avl 8]
...  (first 60 results)
```

---

## S5 — Products

**File:** `src/features/products/ProductsScreen.tsx` · **Data:** `listProducts(search)`, `listRestocks(id)`

### Phone wireframe (xs/sm): card list

```
┌──────────────────────────────┐
│ Products               [⬇]   │ S5.0 subtitle "N items"
│ N items                      │
├──────────────────────────────┤
│ (🔍 Search products)         │ S5.1
├──────────────────────────────┤
│ (M) Shirt          ₹500.00   │ S5.3 ListItem row
│     Stock 10 · Sold 2 [Avl 8]│
│ ...                          │
│               [+ Add product]│ S5.4 FAB
└──────────────────────────────┘
tap row / FAB → P3 bottom sheet
```

### Tablet: table (md+) and side editor (lg+)

```
┌───────────────────────────────────────────────┬──────────────────┐
│ (🔍 Search products)                          │ S5.5 editor pane │
│ NAME       SIZE  PRICE  STOCK  SOLD   AVL     │ width 38% (lg+)  │
│ flex 3     52    84     60     56     76 (dp) │ Edit product     │
│ Shirt      M   ₹500.00   10     2   [Avl 8]   │ [fields...]      │
└───────────────────────────────────────────────┴──────────────────┘
md: table, but the editor opens as P3 (dialog)
```

### Sections

| ID | Section | Spec | Lines |
| --- | --- | --- | --- |
| S5.0 | App bar | `Header`: "Products", subtitle "N items"; actions: `plus` New product (tablet only) · `download` Export products to Excel (D2.3) | `Header` |
| S5.1 | Search | `SearchRow`: `SearchField` "Search products" | `SearchRow` |
| S5.2 | Table header | `TableHeader`, shown when `showTable`: md+ **and** the list pane ≥ `S5.tableMinWidth` 520 dp (so md full-width and xl / xxl beside the editor; at lg the editor pane leaves ≈ 410 dp and the phone rows S5.3 are used). Columns from `S5.columns`: **NAME flex 3 · SIZE 52 · PRICE 84 · STOCK 60 · SOLD 56 · AVL 76** (dp; SIZE left-aligned, the rest right-aligned) | `TableHeader`, `S5.columns` |
| S5.2.r | Table row | `ProductTableRow` (memo): `ListRow` with the same 6 columns from `S5.columns`; AVL = `AvlBadge` | `ProductTableRow` |
| S5.3 | Phone row | `ProductListRow` (memo): ListItem: leading circle = size · title name · subtitle "Stock n · Sold n" · trailing price + Avl badge | `ProductListRow` |
| S5.3.e | Empty states | searching → "No matches"; otherwise "No products" | `ProductListCard` |
| S5.4 | FAB | phone only, "Add product"; the `fab` slot of `<Screen>` in `ProductsScreen()` | `ProductsScreen` |
| S5.5 | Editor pane | `EditorPane`, lg+: pinned scroll pane, width `S5.editorWidth` 38%, card padding `S5.editorPadding` 20, title "Product editor" / "Edit product" / "New product" / "Restock"; empty state until something is selected; content = `EditorBody` | `EditorPane` |
| P3 | Editor sheet | `EditorSheet`, below lg: the same `EditorBody` in a `Sheet wide` | `EditorSheet` |

### Editor content (S5.6) and Restock content (S5.7)

| ID | Rows | Lines |
| --- | --- | --- |
| S5.6.1 | Product name (error: empty or duplicate) | `ProductForm` |
| S5.6.2 | "Quick pick" chips = `QUICK_PICKS` (`PRODUCT_SEED_NAMES`, src/data/schema.ts) | `QuickPickChips` |
| S5.6.3 | "Size" chips = `SIZES` (`PRODUCT_SIZES`) + "No size" | `SizeChips` |
| S5.6.4 | Price (₹) \| Stock (`Columns kind="input"`); Stock helper = "Sold n · Avl n" | `PriceStockRow` |
| S5.6.5 | Buttons right-aligned: Delete (ghost red, edit only) · Restock (tonal, edit only) · Save | `EditorActions` |
| S5.6.6 | Stock history list: icon (restock / edit) · "Restock +n → stock m" · date · note | `StockHistory` |
| S5.7.1 | Info line: "name · size — current stock n" | `RestockForm` |
| S5.7.2 | Qty to add \| New price (₹) (`Columns kind="input"`; a blank price keeps the current one) | `RestockForm` |
| S5.7.3 | Note (lot / supplier) | `RestockForm` |
| S5.7.4 | Back (ghost) · Add to stock | `RestockForm` |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `AvlBadge` | Avl < 0 red, = 0 grey, > 0 green | 63 |
| `num(v)` | non-negative whole number as a string | 57 |
| `useProducts()` | all state and actions below; `showTable`; `editorTitle` | 72-208 |
| `load()` / `loadHistory(id)` | products list / restock history | in `useProducts` |
| `startEdit(p?)` | open the editor for a product or a blank one (stable `useCallback`) | in `useProducts` |
| `save()` | validate the name → `upsertProduct` → audit → snackbar (duplicate → inline error) | in `useProducts` |
| `remove()` | confirm → `deleteProduct` → audit | in `useProducts` |
| `openRestock()` / `applyRestock()` | switch to S5.7 / `restockProduct(qty, price, note)` → back to the editor | in `useProducts` |
| `exportXlsx()` | D2.3 → share | in `useProducts` |

---

## S6 — Settings

**File:** `src/features/settings/SettingsScreen.tsx`

Sections are defined in `SECTIONS` (lines 26-31): **company**, **drafts**, **backup**, **activity**.

### Phone: list, then drill-in

```
┌──────────────────────────────┐        ┌──────────────────────────┐
│ Settings (large app bar)     │  tap → │ ← Company                │
├──────────────────────────────┤        ├──────────────────────────┤
│ 🏢 Company               >   │ S6.1   │ S6.2 / S6.3 / S6.4 / S6.5│
│ 📄 Drafts                >   │        │ (padding bp.margin)      │
│ ☁ Backup & restore       >   │        │                          │
│ ⏱ Activity log           >   │        └──────────────────────────┘
│   Invoice ERP 1.0.1 (build n)│ version label; Back returns to the list
└──────────────────────────────┘
```

### Tablet (lg+): master-detail — md uses the phone list + drill-in beside the rail

```
┌───────────────────────┬─────────────────────────────────┐
│ S6.1 section list     │ selected section pane           │
│ width 300, selected   │ scroll, padding bp.margin,      │
│ row tinted            │ maxWidth 720                    │
│ version label         │                                 │
└───────────────────────┴─────────────────────────────────┘
```

### Sections

| ID | Section | Rows / columns | Lines |
| --- | --- | --- | --- |
| S6.1 | Section list | `SectionList` (in `SectionListPane` on lg+): ListItem: icon · label · hint (chevron on one pane, tint on lg+); the version line under it | `SECTIONS`, `SectionList` |
| S6.2 | **Company** form (`CompanyForm`) | three cards + Save | `CompanyForm` |
| S6.2.1 | Business | Business name · Subtitle · Address (multiline) · City \| Pincode · PAN \| Contact (`FieldRow` = `Columns`) · Email | `BusinessCard` |
| S6.2.2 | Bank / UPI | title · Bank \| Branch · A/C no \| IFSC · UPI ID | `BankCard` |
| S6.2.3 | Invoice numbering | title · Prefix \| Next number (read-only, e.g. `PRE-002`, padded to `S6.numberPad`) | `NumberingCard` |
| S6.2.4 | Save | the Save button at the end of the form | `CompanyForm` |
| S6.3 | **Drafts** | `DraftsPane`: "Drafts (n)" (lg+) · Card list of `DraftRow` (memo): title party · subtitle `draft_no · n lines · ₹total · date` · trailing trash (confirm). Tap → S4 with `draftId`. Empty: "No drafts" | `DraftsPane`, `DraftRow` |
| S6.4 | **Backup & restore** | `BackupPane`: info text · `ExportRestoreRow` (Export \| Restore, 1:1) · `RecentBackups`: archive icon · file name · `kind · KB · date` | `BackupPane` |
| S6.5 | **Activity log** | `ActivityPane`: ListItem: `action — entity_type entity_id` · date (latest `S6.auditRows` 50) | `ActivityPane` |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `useSettings()` | all state and actions below; `section` (lg+) / `openOnPhone` (one pane) | 64-178 |
| `useBackIntercept` | one pane: Back closes the open section first | in `useSettings` |
| `load()` | settings, drafts, backups, audit (`S6.auditRows`) | in `useSettings` |
| `setField(k, v)` | edits the local settings copy | in `useSettings` |
| `saveCompany()` | `updateSettings(...)` (prefix defaults to `PRE-`) → refresh → snackbar | in `useSettings` |
| `exportBackup()` | `exportDbBackup` → share | in `useSettings` |
| `importBackup()` | pick a file → confirm → `restoreDbBackup` (takes a safety copy first) | in `useSettings` |
| `removeDraft(d)` / `openDraft(d)` | confirm → `deleteDraft` / S4 with the draft | in `useSettings` |

---

## D1 — Invoice PDF / print layout

**File:** `src/export/pdfTemplate.ts` · `buildInvoiceHtml(inv, lines, settings, 'A4' | 'Letter')`
Page A4 210×297mm or Letter 216×279mm · padding 10mm × 9mm · Inter 9.5px (embedded Latin + ₹ subset, 400/700) for text; number cells and totals (`td.n`, `.tot td.v`) in Bebas Neue 11.5px (digits subset). Both from `src/export/pdfFonts.ts`. Black on white.

```
┌──────────────────────────────────────────────────────┐
│ COMPANY NAME (16px bold)               PRE-001 (13px)│ D1.1 header (.head, 2px rule below)
│ subtitle                               Date: …       │
│ address / city pin / Ph / email / PAN  Due: …        │
├──────────────────────────┬───────────────────────────┤
│ BILL TO        (49%)     │ SHIP TO / CONSIGNEE (49%) │ D1.2 boxes (ship only if has_shipping)
├────┬─────────────────────┴──────┬──────┬──────┬──────┤
│ #  │ ITEM                       │ QTY  │ RATE │AMOUNT│ D1.3 line table (numbers right-aligned)
├────┴────────────────────────────┴──────┴──────┴──────┤
│                         Gross / Discount / Round Off │ D1.4 totals table, 52% wide, right
│                         TOTAL (₹)  (2px rules)       │
├──────────────────────────────────────────────────────┤
│ Amount in words: …                                   │ D1.5
├──────────────────┬──────────────┬────────────────────┤
│ BANK DETAILS     │ PAY VIA UPI  │ Authorised         │ D1.6 footer (3 columns)
│ notes            │ upi id       │ Signatory          │
└──────────────────┴──────────────┴────────────────────┘
```

| ID | Block | Lines |
| --- | --- | --- |
| D1.0 | CSS (all sizes and borders) | 37-65 |
| D1.1 | Header | 67-80 |
| D1.2 | Bill-to / Ship-to boxes | 28-33, 82-90 |
| D1.3 | Line table (`#`, ITEM, QTY, RATE, AMOUNT) | 19-26, 92-98 |
| D1.4 | Totals | 100-105 |
| D1.5 | Amount in words | 107 |
| D1.6 | Footer: bank + notes / UPI / signature | 109-116 |

PDF generation and sharing: `src/export/pdf.ts` (`exportInvoicePdfAndShare`, `shareFile`).

## D2 — Excel exports (`src/export/xlsx.ts`)

| ID | Export | Sheet → columns (width) | Triggered from |
| --- | --- | --- | --- |
| D2.1 | `exportInvoicesXlsx(rows)` | **Invoices_Register**: Invoice No 12 · Date 12 · Status 10 · Party 28 · Round Off 10 · Total 14 | S2.0 list export, S3.3 Excel |
| D2.2 | `exportConsolidatedRegister()` | **Invoices_Register**: Invoice No · Date · Party · Total · Status; **All_Line_Items**: Invoice No 12 · Sno 6 · Item 34 · Qty 8 · Rate 12 · Amount 14 | S2.0 register export |
| D2.3 | `exportProductsXlsx()` | **Products**: Name 30 · Size 8 · Price 12 · Stock 10 · Sold 10 · Avl-Stock 12 | S5.0 export |

---

## C — Shared components (`src/ui/`)

Change one of these and **every screen that uses it changes**. They implement the kit recipes in `design/DESIGN.md` §6.

| ID | Component | Spec | Used in | File:line |
| --- | --- | --- | --- | --- |
| C1 | `TopAppBar` | flat header on the screen background (no gradient), top padding = status bar + 8, sides 20. `large`: caption 14 `#666` above an H2 title (24/600), glass action buttons right. Otherwise: glass back button (`chevron-left`) · centred title 16/600 + caption · glass actions | all screens | components.tsx:319 |
| C2 | `Button` | `solid` = kit primary button (52 tall, radius 12, blue, white 16/600, `shadow.secondary`); `tonal` / `outline` = glass button (50 tall, glass fill, white border, `shadow.primary`, 15/500 black); `ghost` = text link (link colour, 14/600). `danger` = red. Press scale 0.98 | everywhere | components.tsx:39 |
| C3 | `IconButton` | 44×44. `glass` = kit icon button (radius 12, glass fill, white border, `shadow.primary`, black 20px icon); default = ghost button (radius 10, `#666` icon) | headers, row actions, sheet close | components.tsx:92 |
| C4 | `Input` / `MoneyInput` | label 13/500 `#666` above (gap 8); field 50 tall, radius 12, padding 16, 15/400; focus = blue border + focus ring; `helper`, `error`, `tabular` (Inter, tabular digits) | forms | components.tsx:138 / 192 |
| C5 | `SearchField` | 50 tall, radius 12, glass icon-button recipe, search glyph, clear button | S2, S4, S5 | components.tsx:218 |
| C6 | `Card` | kit glass card: 55% white, 1px white border, radius 16, padding 16, `theme.cardShadow`. `small` = tile shadow; `list` = 8 × 16 padding for `flush` rows | all screens | components.tsx:375 |
| C6a | `IconChip` | 36×36, radius 10, blue tint, blue 18px icon | stat tiles, list rows | components.tsx:396 |
| C7 | `ListItem` / `ListRow` | kit list row: gap 12, padding 12 vertical, divider `#ebeaea`; leading 36 avatar (`leadingText`; `leadingAlt` = grey) or icon chip; title 14/500 (one line unless `titleLines`), caption 12 `#666` (2 lines); `flush` drops side padding inside list cards; `selected` = blue tint | lists | components.tsx:443 / 408 |
| C7a | `initials(name)` | two-letter avatar initials | list rows | components.tsx:432 |
| C8 | `Chip` | pill, 36 tall; off = glass fill + input border, 14/500 `#666`; on = blue fill, white 14/600, `shadow.primary` | sizes, quick pick, ship-to | components.tsx:504 |
| C8a | `SegmentedControl` | kit Day/Week/Month: glass pill, 4px padding, `shadow.primary`; tabs 36, active blue + white 14/600 | S2 status, P1 modes, S4 page size | components.tsx:543 |
| C9 | `FAB` | primary-button recipe: 52 tall, radius 12, blue, white 16/600, 20px icon, `shadow.secondary`; 20 from the right, 16 above the nav | S1, S2, S5 | components.tsx:586 |
| C10 | `Sheet` | phone: bottom sheet (solid white / black, radius 16 top, 36×5 handle, max 92% height); tablet: dialog (radius 18); title 18/600; `shadow.secondary` | P1, P2, P3 | Sheet.tsx:22 |
| C11 | `Snackbar` (`useSnackbar`) | black bar (white in dark mode), radius 12, `shadow.secondary`; 4s (6s with an action); above the nav + FAB | all saves | Snackbar.tsx:19 |
| C12 | `StatusGlyph` / `Badge` | kit badge: pill, padding 4 × 10, 12/600, tinted fill; status adds a Feather glyph (circle, clock, pie-chart, check-circle, x-circle) | lists, S3 | components.tsx:282 / 299 |
| C13 | `SectionTitle`, `TotalRow`, `MoneyText`, `EmptyState` | overline (12/600 upper-case `#666`) with right slot · label/value row · amount in Bebas Neue (strong = larger) · icon + title + text | many | components.tsx:359 / 264 / 247 / 490 |
| C14 | `alert()` | native dialog (web: confirm/alert) | confirms, errors | alert.ts:13 |
| C15 | `Columns` | one row of equal columns (`flex: 1`, or `weights=[1, 1.4]`), gap 12. `kind` sets the usable cell minimum (`touch` 44 · `input` 128 · `button` 96; `minCell` overrides); when cells would be narrower it stacks, or with `wrap` flows onto more lines (4 inputs = 2 + 2 on a phone); `stackAt` forces a stack. Decides from its own measured width, so it is right inside tablet panes (Three-Slot Screen rule 4; decision in `columnsMode.ts`, tests `npm run test:columns`) | S2.3a, S4.A row 5, S5.6.4, S5.7.2 | Columns.tsx:21 |
| C16 | `Screen` | the Three-Slot scaffold: `header` · `below` (stepper) · Main (children, `flex: 1`) · `footer` (in the flex column, padded by the gesture inset, rises with the keyboard) · `fab` (floats over Main); `overlay` = no bottom nav underneath. `useMainInset()` = what Main's scroller pads at the bottom (nav inset or 32 in an overlay, + FAB clearance); `useFabClearance()` = 52 + 16 when a `fab` is set, else 0 | S2, S4 | Screen.tsx:23 |

### Design tokens (`src/ui/tokens.ts`)

| Token | Values | Line |
| --- | --- | --- |
| `brand` | the kit's 5 colours: primary `#2596be` · secondary `#666666` · tertiary `#ebeaea` · dark `#000000` · light `#ffffff`, plus link `#1a6f8e` | 14 |
| `shadow` | primary `0 4px 8px rgba(20, 71, 108, 0.15)` (small items) · secondary `0 8px 16px rgba(20, 71, 108, 0.2)` (large items) | 34 |
| `light` / `dark` themes | light: `#ebeaea` background, white glass (55 / 60 / 65%), 85–90% white borders, black / `#666` text. Dark (Sign In recipe): black background, 8% white glass, 16% borders, white / `#ebeaea` text, cards add a 1px inner highlight. Real-status green/red only | 87 / 115 |
| `space` / `layout` | 0, 4, 8, 12, 16, 24, 32, 48, 64 · `layout`: side 20, sideWide 24, gap 16, grid 12, top 8 | 144 / 145 |
| `radius` | chip 10 · control 12 · item 14 · bar 16 · card 16 · form 18 · frame 16 · pill 999 (owner's values; kit was 12/14/16/20/24/28/32) | 156 |
| `touch` | min 44 · nav 48 · input 50 · button 52 · comfortable 56 | 160 |
| `maxReadWidth` | 720 | 161 |
| `font` | Inter `Inter_300Light` · `Inter_400Regular` · `Inter_500Medium` · `Inter_600SemiBold` (no 700); numbers: `BebasNeue_400Regular` (owner's exception) | 170 |
| `type` | kit scale: h1 28/600 · title (H2) 24/600 · subtitle 18/500 · heading 16/600 · bodyLarge 16 · body 15 · bodyMedium 14 · label 14/500 · labelMedium 13/500 · caption 12 · overline 12/600 upper · micro 11/600 upper; numbers in Bebas: number 16 · figure 28 · hero 44; numberField = Inter 15 tabular | 180 |
| `motion` | press scale 0.98 (buttons), 0.96 (icon buttons) | 221 |
| `statusStyle` | Feather icon / label / tone for each invoice status | 224 |

---

## Prompt cookbook (example edit prompts)

| Goal | Prompt |
| --- | --- |
| Rename a KPI | "In S1.1.b rename 'Total billed' to 'Revenue (FY)'." |
| Add a KPI card | "In S1.1 add a 'Paid (FY)' card to row 1." |
| Add a Draft filter | "In S2.2 add 'draft' to STATUSES." |
| Replace date typing with a picker | "In S2.3 and S4.A row 5 replace the YYYY-MM-DD inputs with a date picker." |
| Add a GST column to the invoice items | "Add a GST % column to S3.4 (flex 1), S4.B.3, D1.3 and D2.2 All_Line_Items." |
| Change payment modes | "In P1 change the modes to Cash, UPI, Card, Bank transfer." |
| Widen the product name column | "In S5.2 / S5.2.r change PRICE to 100dp." |
| Add a field to company settings | "In S6.2.1 add a GSTIN field next to PAN." |
| Restyle the PDF header | "In D1.1 make the company name 20px and add a logo on the left." |
| Change every app bar | "In C1 change the gradient to …" (affects all screens) |
