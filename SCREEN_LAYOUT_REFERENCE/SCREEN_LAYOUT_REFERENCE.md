# Complete Layout & Architecture Reference

Every screen, section, row, column and function in the app, each with a **stable ID** you can quote in a prompt.

> **How to use the IDs in a prompt**
> `In S2.3 (Invoices → status chips) add a "Draft" chip.`
> `Make S1.1 (Dashboard KPI grid) show 3 cards per row on phones.`
> `In S4.B.4 (Create invoice → line-item card) put Qty and Rate on separate rows.`
>
> ID format: `S<screen>.<section>[.<row>]`. Overlays are `P<n>`, shared components are `C<n>`, documents are `D<n>`.
> Line numbers were taken on 2026-10-22 (session 13, re-checked after the Prompt 2 fixes). They drift as code changes. The file name plus the component name is what stays reliable.

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
| md | 600–767 | 8 | 2 | 16 | 24 | small tablet / foldable |
| lg | 768–959 | 8 | 2 | 20 | 24 | tablet portrait |
| xl | 960–1199 | 12 | 3 | 24 | 32 | tablet landscape |
| xxl | ≥1200 | 12 | 3 | 24 | 32 | large tablet / desktop web |

`isPhone` = xs or sm. Almost every layout branches on `bp.isPhone`, `bp.atLeast('lg')` or `bp.atLeast('xl')`.

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
Overlay "invoice-detail" → TopAppBar "Invoice" (back) + S3 full screen
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
| S0.4.1 | `TABS` | 4 destinations: dashboard/Home, invoices/Invoices, products/Products, settings/Settings (Ionicons outline + filled) | Nav.tsx:13-18 |
| S0.4.2 | `BottomTabs` | row, each tab flex:1, height 80 (`NAV_BAR_HEIGHT`), 64×32 indicator pill, label under the icon | Nav.tsx:40-85 |
| S0.4.3 | `Rail` | width 88, "+" FAB 56×56 at the top (calls `openCreate`), then 56×32 pills; labels only when `bp.atLeast('xl')` | Nav.tsx:88-144 |

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

Snackbar sits above the nav bar and FAB on phones: `bottomOffset = NAV_BAR_HEIGHT + 72` (App.tsx:79).

---

## S1 — Dashboard (Home)

**File:** `src/features/dashboard/DashboardScreen.tsx` · **Data:** `getKpis()`, `recentInvoices(5)`, `getAging()` from `src/data/dashboardRepo.ts`

### Phone wireframe (sm)

```
┌─────────────────────────────┐
│ Dashboard                   │ S1.0 large gradient app bar
│ FY 2026–27 overview         │
├──────────────┬──────────────┤
│ Invoices(FY) │ Total billed │ S1.1 KPI grid, row 1
│ 1            │ ₹0.00        │
├──────────────┼──────────────┤
│ Outstanding  │ Open invoices│ S1.1 KPI grid, row 2
│ ₹0.00        │ 1            │
├──────────────┴──────────────┤
│ Recent invoices     See all │ S1.2
│ ┌─────────────────────────┐ │
│ │ Party        ₹0.00      │ │ S1.2.1 row
│ │ PRE-001·date [Issued]   │ │
│ └─────────────────────────┘ │
│ Outstanding (aging)         │ S1.3
│ ┌─────────────────────────┐ │
│ │ Party        ₹0.00      │ │ S1.3.1 row
│ │ PRE-001·due date        │ │
│ └─────────────────────────┘ │
│              [+ New invoice]│ S1.4 FAB
└─────────────────────────────┘
```

### Tablet (lg+): KPI grid = **4 across in 1 row**; S1.2 and S1.3 sit **side by side** (row, gap 24). On md they stack.

### Sections

| ID | Section | Rows / columns | Key props | Lines |
| --- | --- | --- | --- | --- |
| S1.0 | App bar | `TopAppBar large`, title "Dashboard", subtitle `fyLabel()` (FY starts in April) | — | 15-18, 46 |
| S1.1 | KPI grid | `perRow = isPhone ? 2 : 4` → phone 2×2, tablet 1×4. Each cell: filled Card, minHeight 104, icon 18 + label row, then value (title type, auto-shrinks to 60%) | the cards array | 36-42, 53-70 |
| S1.1.a | KPI 1 "Invoices (FY)" | `kpis.invoiceCount` · icon document-text-outline | | 37 |
| S1.1.b | KPI 2 "Total billed" | `₹ kpis.billedPaise` · trending-up-outline | | 38 |
| S1.1.c | KPI 3 "Outstanding" | sum of (total − paid) over the aging list · hourglass-outline | | 35, 39 |
| S1.1.d | KPI 4 "Open invoices" | `aging.length` · alert-circle-outline | | 40 |
| S1.2 | Recent invoices | SectionTitle + "See all" text button (→ Invoices tab); outlined Card holding up to 5 ListItems; empty state "No invoices yet" | | 76-106 |
| S1.2.1 | Recent row | title = party · subtitle = `invoice_no · date` · trailing column = amount + StatusGlyph · tap → `showInvoice` | | 90-103 |
| S1.3 | Outstanding (aging) | up to 10 rows; empty state "All settled" | `aging.slice(0, 10)` | 108-124 |
| S1.3.1 | Aging row | title = party · subtitle = `invoice_no · due date` · trailing = balance · tap → `showInvoice(a.invoice_id)` (same as S1.2.1) | | 114-122 |
| S1.4 | FAB "New invoice" | phone only, bottom-end 16dp → `openCreate()` | | 128 |
| — | Scroll container | padding `bp.margin`, paddingBottom 96 (clears the FAB), maxWidth max(720, 90% width) | | 47-52 |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `fyLabel(d)` | "FY 2026–27 overview" (April–March year) | 15-18 |
| `load()` | runs the 3 queries in parallel; reruns on `refreshKey` | 28-33 |

---

## S2 — Invoices list

**File:** `src/features/invoices/InvoicesScreen.tsx` · **Data:** `listInvoices({search,status,from,to,limit:500})`

### Phone wireframe

```
┌─────────────────────────────┐
│ Invoices          [⬇] [▤]   │ S2.0 app bar + 2 export actions
├─────────────────────────────┤
│ (🔍 Search invoice no/party)│ S2.1
│ [All][Issued][Partial][Paid][Void][📅 Date range] → scrolls sideways  S2.2
│ [From YYYY-MM-DD][To ...]   │ S2.3 (only when the Date chip is on)
│ 3 invoices                  │ S2.4
├─────────────────────────────┤
│ Party            ₹1,200.00  │ S2.5 row
│ PRE-003 · 22 Oct 26 [Paid]  │
│ ...                         │
│              [+ New invoice]│ S2.6 FAB
└─────────────────────────────┘
```

### Tablet wireframe (md/lg = 2 panes, xl+ = 3 panes)

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
| S2.0 | App bar | title "Invoices"; actions: `download-outline` = Export list to Excel (current filtered rows), `albums-outline` = Export consolidated register (all invoices + all lines) | 109-118 |
| S2.1 | Search | `SearchField` "Search invoice no or party" | 55 |
| S2.2 | Status chips | horizontal scroll; `STATUSES = ['all','issued','partial','paid','void']` + "Date range" chip (shows "Dates set" when a date is set) | 18, 56-65 |
| S2.3 | Date range row | 2 columns (flex 1 / 1): From, To, both `YYYY-MM-DD`, numeric, max 10 chars | 66-77 |
| S2.4 | Count line | "N invoice(s)" | 78-80 |
| S2.5 | List (FlatList) | ListItem: title party · subtitle `no · date` · trailing amount + StatusGlyph. Phone tap → S3 overlay; tablet tap → select (tinted row) | 82-104 |
| S2.5.e | Empty states | filtered → "No matches"; unfiltered → "No invoices yet" | 86-88 |
| S2.6 | FAB | phone only, "New invoice" | 105 |
| S2.7 | Detail pane | tablet only; width 50% (2 panes) or 42% (3 panes); left border; renders S3 | 127-138 |
| S2.8 | Activity pane | xl+ and a row selected; width 26%; "ACTIVITY", `no · status`, "Issued <date>" | 139-149 |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `load()` | query with filters; reruns when any filter or `refreshKey` changes | 32-39 |
| `runExport('list' \| 'register')` | builds XLSX (D2.1 / D2.2) → share sheet; busy spinner on that action | 41-47 |

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
| S3.4 | Items table | SectionTitle "Items (n)"; header row Item/Qty/Rate/Amount with **flex 3 : 1 : 1 : 1**, numbers right-aligned; each line row padded 12, bottom border; description up to 2 lines | 139-158 |
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
Phone = bottom sheet; tablet = centred dialog (see C10). Payment modes are hard-coded at line 192.

---

## S4 — Create / Edit invoice

**File:** `src/features/invoices/CreateInvoiceScreen.tsx` (largest screen, 658 lines)

There are **three different layouts** built from the same blocks:

| Layout | When | Lines |
| --- | --- | --- |
| S4.L1 Phone stepper | `bp.isPhone` | 487-513 |
| S4.L2 Two-pane | md / lg | 560-589 |
| S4.L3 Three-panel | xl+ | 515-558 |

### Building blocks (shared by all layouts)

| ID | Block | Rows / columns | Lines |
| --- | --- | --- | --- |
| S4.A | **Bill to** (`partySection`) | row 1 Party name * (full) · row 2 Address (full) · row 3 City \| Pincode (1:1, 6 digits) · row 4 Mobile \| Email (1:1) · row 5 Invoice date \| Due date (1:1, YYYY-MM-DD). Every field autosaves on blur | 268-314 |
| S4.B | **Items** (`itemsSection`) | | 316-401 |
| S4.B.1 | Items title | "Items (n)" + "Add from products" tonal button (hidden at xl, where S4.L3 shows the catalog panel) | 318-322 |
| S4.B.2 | Empty card | "No items yet" | 323-330 |
| S4.B.3 | Line-item card | header row "ITEM n · FROM PRODUCTS / FREE LINE" + trash IconButton · Description (full) · **Qty \| Rate (₹)** at flex **1 : 1.4** · footer row "Amount" … ₹value | 331-359 |
| S4.B.4 | "Add free line" | outline button, left-aligned | 360-361 |
| S4.B.5 | Adjustments | "Adjustments" title · row: Discount % (flex 1, clamped 0–100) \| "Ship to address" chip (flex 1) | 363-374 |
| S4.B.6 | Shipping card | only when the chip is on: Consignee (full) · Address (full) · **City \| Pincode** (1:1, 6 digits); all printed in D1.2 | 375-396 |
| S4.B.7 | Notes | multiline, "Optional — printed on the invoice" | 397-399 |
| S4.C | **Totals** (`totalsBlock`) | Subtotal · Discount (if > 0) · Round off · **Total** | 403-412 |
| S4.D | **Review** (`reviewSection`) | Bill-to filled card (party, `no · date · due`) · "Items (n)" compact rows: description (flex 1) \| `qty × rate` \| amount · S4.C · amount in words | 414-440 |
| S4.E | **Preview** (`previewPane`) | "Preview" title + A4 / Letter chips · bordered white box, minHeight 400, WebView rendering D1 live | 442-462 |
| S4.F | **Action buttons** | right-aligned: Save draft (outline) · Issue invoice / Update (solid, send / checkmark icon) | 464-469 |
| P2 | Catalog sheet | see P2 below | 473-483, 630-658 |

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
Stepper component `Stepper` (592-628): 24dp numbered circles, a check on done steps, 1dp connectors (accent when reached), touch height 48.

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
Product rows (534-542): title `name · size`, subtitle price, trailing Avl badge (red < 0, grey = 0, green > 0).
The panel loads the full product list as soon as the layout opens (`showsCatalogPanel` effect); typing in its search box narrows it.

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `blankForm()` | empty party, today, due = today + 14 days, 0% discount | 40-52 |
| mount effect | loads settings, then the edit invoice (`invoiceId`) **or** a draft (`draftId`) **or** the next number preview | 72-114 |
| `totals` | `computeTotals(lines, discount%)` → gross, discount, roundOff, total | 116-119 |
| `patch(p)` | merges a form change and marks it unsaved | 121-124 |
| `autosave()` | `saveDraft` (called on every field blur) | 126-135 |
| `previewInvoice` / `previewHtml` | builds the D1 HTML for the live preview | 137-164 |
| catalog-panel effect | at xl+ loads products on entering the layout (S4.L3 panel) | 166-171 |
| `openCatalog()` | opens P2 and loads products | 173-176 |
| `addLine(p)` | appends a product line (description `name - size`, qty 1) and closes P2 | 178-190 |
| `addBlankLine()` | appends a free line | 192-199 |
| `updateLine(i, p)` | edits a line and recomputes `line_paise` | 201-210 |
| `removeLine(i)` | deletes a line and renumbers `sno` | 212-214 |
| `issue()` | needs a party name (jumps to step 0) and ≥ 1 line (jumps to step 1) → `saveInvoice` → audit → delete draft → close → snackbar with **View** | 216-242 |
| `saveAsDraft()` | autosave → close → snackbar | 244-249 |
| `leave()` | back arrow: unsaved new work → saved as a draft first | 252-256 |
| `useBackIntercept` | Android Back: phone step > 0 → previous step, else `leave()` | 259-264 |

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
| S5.0 | App bar | "Products", subtitle "N items"; actions: `add` New product (tablet only) · `download-outline` Export products to Excel (D2.3) | 270-278 |
| S5.1 | Search | `SearchField` "Search products" | 281-283 |
| S5.2 | Table header | md+ only. Columns **NAME flex 3 · SIZE 52 · PRICE 84 · STOCK 60 · SOLD 56 · AVL 76** (dp; SIZE left-aligned, the rest right-aligned) | 240-251, 284 |
| S5.2.r | Table row | `ListRow` with the same 6 columns; AVL = `AvlBadge` | 253-264 |
| S5.3 | Phone row | ListItem: leading circle = size · title name · subtitle "Stock n · Sold n" · trailing price + Avl badge | 294-307 |
| S5.3.e | Empty states | searching → "No matches"; otherwise "No products" | 289-291 |
| S5.4 | FAB | phone only, "Add product" | 310 |
| S5.5 | Editor pane | lg+: scroll pane, width 38%, padding 24, title "Product editor" / "Edit product" / "New product" / "Restock"; empty state until something is selected | 312-320 |
| P3 | Editor sheet | below lg: the same content in a `Sheet wide` | 321-325 |

### Editor content (S5.6) and Restock content (S5.7)

| ID | Rows | Lines |
| --- | --- | --- |
| S5.6.1 | Product name (error: empty or duplicate) | 201-202 |
| S5.6.2 | "Quick pick" chips = `PRODUCT_SEED_NAMES` (src/data/schema.ts) | 203-209 |
| S5.6.3 | "Size" chips = `PRODUCT_SIZES` + "No size" | 210-218 |
| S5.6.4 | Price (₹) \| Stock (1:1); Stock helper = "Sold n · Avl n" | 219-230 |
| S5.6.5 | Buttons right-aligned: Delete (ghost red, edit only) · Restock (tonal, edit only) · Save | 231-235 |
| S5.6.6 | Stock history list: icon (restock / edit) · "Restock +n → stock m" · date · note | 180-197 |
| S5.7.1 | Info line: "name · size — current stock n" | 158-160 |
| S5.7.2 | Qty to add \| New price (₹) (1:1; a blank price keeps the current one) | 161-170 |
| S5.7.3 | Note (lot / supplier) | 171-172 |
| S5.7.4 | Back (ghost) · Add to stock | 173-176 |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `AvlBadge` | Avl < 0 red, = 0 grey, > 0 green | 30-34 |
| `num(v)` | non-negative whole number as a string | 25-28 |
| `load()` / `loadHistory(id)` | products list / restock history | 56-72 |
| `startEdit(p?)` | open the editor for a product or a blank one | 74-83 |
| `save()` | validate the name → `upsertProduct` → audit → snackbar (duplicate → inline error) | 85-99 |
| `remove()` | confirm → `deleteProduct` → audit | 101-119 |
| `openRestock()` / `applyRestock()` | switch to S5.7 / `restockProduct(qty, price, note)` → back to the editor | 121-147 |
| `exportXlsx()` | D2.3 → share | 149-154 |

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

### Tablet: master-detail

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
| S6.1 | Section list | ListItem: icon · label · hint (chevron on phones) | 26-31, 258-264, 277-283 |
| S6.2 | **Company** form | | 133-169 |
| S6.2.1 | Business | Business name · Subtitle · Address (multiline) · City \| Pincode · PAN \| Contact · Email | 135-146 |
| S6.2.2 | Bank / UPI | title · Bank \| Branch · A/C no \| IFSC · UPI ID | 147-156 |
| S6.2.3 | Invoice numbering | title · Prefix \| Next number (read-only, e.g. `PRE-002`) | 157-166 |
| S6.2.4 | Save | right-aligned Save button | 167-168 |
| S6.3 | **Drafts** | "Drafts (n)" (tablet) · Card list: title party · subtitle `draft_no · n lines · ₹total · date` · trailing trash (confirm). Tap → S4 with `draftId`. Empty: "No drafts" | 172-204 |
| S6.4 | **Backup & restore** | info text · Export \| Restore (1:1 buttons) · "Recent backups": archive icon · file name · `kind · KB · date` | 206-224 |
| S6.5 | **Activity log** | ListItem: `action — entity_type entity_id` · date (latest 50) | 226-236 |

### Functions

| Function | Does | Lines |
| --- | --- | --- |
| `useBackIntercept` | phone: Back closes the open section first | 47-50 |
| `load()` | settings, drafts, backups, audit (50) | 52-59 |
| `setField(k, v)` | edits the local settings copy | 65-67 |
| `saveCompany()` | `updateSettings(...)` (prefix defaults to `PRE-`) → refresh → snackbar | 69-87 |
| `doExportBackup()` | `exportDbBackup` → share | 89-100 |
| `doImportBackup()` | pick a file → confirm → `restoreDbBackup` (takes a safety copy first) | 102-131 |

---

## D1 — Invoice PDF / print layout

**File:** `src/export/pdfTemplate.ts` · `buildInvoiceHtml(inv, lines, settings, 'A4' | 'Letter')`
Page A4 210×297mm or Letter 216×279mm · padding 10mm × 9mm · Courier New 9.5px, black on white.

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

Change one of these and **every screen that uses it changes**.

| ID | Component | Spec | Used in | File:line |
| --- | --- | --- | --- | --- |
| C1 | `TopAppBar` | brand gradient (headerFrom→headerTo), min row 64; `large` adds a 28px title block below; optional back arrow and action icons | all screens | components.tsx:297 |
| C2 | `Button` | variants solid / tonal / outline / ghost; `danger`, `busy`, `icon` | everywhere | components.tsx:36 |
| C3 | `IconButton` | 48dp round icon button with a11y label | app bar, trash buttons | components.tsx:80 |
| C4 | `Input` / `MoneyInput` | outlined field, label above; `helper`, `error`, `tabular`. MoneyInput is bound to integer paise | forms | components.tsx:123 / 178 |
| C5 | `SearchField` | pill-shaped search with a clear button | S2, S4, S5 | components.tsx:204 |
| C6 | `Card` | outlined (default) or filled; radius 12, padding 16 | S1, S3, S4, S6 | components.tsx:359 |
| C7 | `ListItem` / `ListRow` | ListItem: leading icon or circle text, title + subtitle, trailing, chevron, selected tint; height 72 with subtitle, else 56. ListRow: free-form row (S5 table) | lists | components.tsx:399 / 375 |
| C8 | `Chip` | filter chip, height 32, check mark when on | filters, modes, sizes | components.tsx:456 |
| C9 | `FAB` | extended FAB, absolute 16dp from bottom-end | S1, S2, S5 | components.tsx:493 |
| C10 | `Sheet` | phone: bottom sheet (28 radius, drag handle, max 92% height); tablet: dialog (92% or 86% wide, max 560 / 720) | P1, P2, P3 | Sheet.tsx:21 |
| C11 | `Snackbar` (`useSnackbar`) | 4s (6s with an action), max width 560, above the nav bar | all saves | Snackbar.tsx:18 |
| C12 | `StatusGlyph` / `Badge` | status = icon + text + tone (Draft, Issued, Partial, Paid, Void) | lists, S3 | components.tsx:265 / 282 |
| C13 | `SectionTitle`, `TotalRow`, `MoneyText`, `EmptyState` | section heading with right slot · label/value row · tabular amount · icon + title + text | many | components.tsx:346 / 247 / 231 / 442 |
| C14 | `alert()` | native dialog (web: confirm/alert) | confirms, errors | alert.ts:13 |

### Design tokens (`src/ui/tokens.ts`)

| Token | Values | Line |
| --- | --- | --- |
| `light` / `dark` themes | brand navy `#0C476F`, accent `#00668B` / `#7FCFF3`, header gradient, tone colours | 31 / 51 |
| `space` | 0, 4, 8, 12, 16, 24, 32, 48, 64 (keys 0–8) | 71 |
| `radius` | xs 4 · sm 8 · md 12 · lg 16 · xl 28 · pill | 73 |
| `touch` | min 48 · comfortable 56 | 75 |
| `maxReadWidth` | 720 | 76 |
| `type` | display 28 · title 22 · heading 16/600 · body 16 · bodyMedium 14 · label 14/500 · labelMedium 12 · caption 12 · number (tabular) | 83 |
| `status` | icon / label / tone for each invoice status | 107 |

---

## Prompt cookbook (example edit prompts)

| Goal | Prompt |
| --- | --- |
| Rename a KPI | "In S1.1.b rename 'Total billed' to 'Revenue (FY)'." |
| 3 KPI cards per row on phones | "In S1.1 change `perRow` to 3 on phones." |
| Add a Draft filter | "In S2.2 add 'draft' to STATUSES." |
| Replace date typing with a picker | "In S2.3 and S4.A row 5 replace the YYYY-MM-DD inputs with a date picker." |
| Add a GST column to the invoice items | "Add a GST % column to S3.4 (flex 1), S4.B.3, D1.3 and D2.2 All_Line_Items." |
| Change payment modes | "In P1 change the modes to Cash, UPI, Card, Bank transfer." |
| Widen the product name column | "In S5.2 / S5.2.r change PRICE to 100dp." |
| Add a field to company settings | "In S6.2.1 add a GSTIN field next to PAN." |
| Restyle the PDF header | "In D1.1 make the company name 20px and add a logo on the left." |
| Change every app bar | "In C1 change the gradient to …" (affects all screens) |
