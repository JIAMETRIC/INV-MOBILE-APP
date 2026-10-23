# What's inside CreateInvoiceScreen (S4, all layouts)

File: `src/features/invoices/CreateInvoiceScreen.tsx` (685 lines). Line numbers as of 2026-10-23.
Opened by `nav.openCreate()` (the "+ New invoice" FAB on S1, S2, S5; "Edit" on S3; a draft row on S6).
IDs (S4.x, P2) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.
The same building blocks (`partySection`, `itemsSection`, `totalsBlock`, `reviewSection`, `previewPane`, `actionButtons`) are arranged three ways: the phone stepper (S4.L1, first tree below), the two-pane tablet layout (S4.L2) and the three-panel layout (S4.L3), both under "Tablet layouts".

## Phone layout (S4.L1)

```
CreateInvoiceScreen()                                               line 54
│
├─ TopAppBar          "New invoice" / "Edit invoice" + next number    505
│                     (PRE-002); glass back button runs leave()       253
│
├─ Stepper            S4.L1.1  (1) Bill to ── (2) Items ── (3) Review 506
│                     component at line 612; tap a step to jump
│
├─ ScrollView         S4.L1.2  the step body; padding 20, gap 16      507
│                     (scrollPad, line 499)
│    │
│    ├─ step 0: partySection                                   S4.A  269
│    │    └─ Card "Bill to"
│    │         ├─ Party name *                                        272
│    │         ├─ Address                                             275
│    │         ├─ row: City | Pincode  (1:1, 6 digits)                280, 285
│    │         ├─ row: Mobile | Email  (1:1)                          292, 297
│    │         └─ row: Invoice date | Due date  (1:1, YYYY-MM-DD)     304, 309
│    │
│    ├─ step 1: itemsSection                                   S4.B  317
│    │    ├─ title "Items (n)" + ghost button "Add from products"     319-321
│    │    ├─ Card "No items yet"  (only when there are no lines)      326
│    │    ├─ one Card per line                              S4.B.3   333
│    │    │    ├─ header row: "ITEM n · FROM PRODUCTS / FREE LINE"
│    │    │    │              + trash IconButton                      334-339
│    │    │    ├─ Description                                         340
│    │    │    ├─ row: Qty | Rate (₹)  (flex 1 : 1.4)                 345, 350
│    │    │    └─ footer row: "Amount" …… ₹value                      355-358
│    │    ├─ outline button "Add free line"                 S4.B.4   361
│    │    ├─ Card "Adjustments"                             S4.B.5   364
│    │    │    ├─ row: Discount % | chip "Ship to address"  (1:1)     368, 373
│    │    │    ├─ (chip on) Consignee · Ship-to address ·   S4.B.6   379-392
│    │    │    │            row: City | Pincode
│    │    │    └─ Notes  (multiline)                        S4.B.7   400
│    │    └─ (nothing else; totals are on the bottom bar)
│    │
│    └─ step 2: reviewSection                                  S4.D  419
│         ├─ Card: "BILL TO" · party name · "no · date · due"         421
│         ├─ Card list "Items (n)": one row per line                  430
│         │       description (flex 1) | "qty × rate" | amount        434-445
│         ├─ totalsBlock                                       S4.C  408
│         │    └─ Card: Subtotal · Discount (if > 0) · Round off ·
│         │             Total (strong)                                410-415
│         └─ amount in words  (italic caption)                        448
│
├─ bottom bar         S4.L1.3  floating glass bar, radius 16,         512-528
│                     20 side margin, sits above the gesture inset
│    ├─ left:  "TOTAL" overline + ₹ total (Bebas 28)                  520-523
│    └─ right: steps 0–1 → Button "Next →"                            526
│              step 2   → actionButtons (S4.F): Save draft (outline)  479
│                         + Issue invoice / Update (blue)             480
│
└─ CatalogSheet       P2  the only modal: a bottom sheet opened by    487, 655
                      "Add from products"
     ├─ title "Add from products" + ✕                                 660
     ├─ SearchField "Search products"                                 661
     └─ product rows: (size) name · "Stock n · Sold n" · ₹price ·
                      [Avl n]; tap = addLine(p) and close             663-680
```

## What each function does (phone flow)

| Function | Line | Does |
| --- | --- | --- |
| `blankForm()` | 40 | empty party, today's date, due = today + 14, 0 % discount |
| mount effect | 72 | loads settings, then the edit invoice, a draft, or the next number preview |
| `patch(p)` / `autosave()` | 121 / 126 | merge a field change; save the draft on every field blur |
| `openCatalog()` | 173 | open P2 and load products |
| `addLine(p)` / `addBlankLine()` | 178 / 192 | add a product line (qty 1) / add a free line |
| `updateLine(i, p)` / `removeLine(i)` | 201 / 212 | edit a line and recompute its amount / delete and renumber |
| `issue()` | 217 | needs a party name (jumps to step 0) and ≥ 1 line (jumps to step 1) → saves → closes → snackbar with View |
| `saveAsDraft()` | 245 | save → close → snackbar |
| `leave()` | 253 | back arrow: unsaved new work is saved as a draft first |
| `useBackIntercept` | 260 | Android Back: step > 0 → previous step, else `leave()` |
| `Stepper` | 612 | 28-px numbered circles, check on done steps, connectors turn blue when reached |
| `CatalogSheet` | 655 | the P2 sheet above |

## Where to change what

| You want to change | Go to |
| --- | --- |
| step names "Bill to / Items / Review" | `steps` array, line 502 |
| a field label, placeholder or keyboard | that `<Input … />` line in the tree above |
| which fields share a row, or their widths | the `flexDirection: 'row'` View around them (`flex: 1` each; Qty\|Rate is 1 : 1.4) |
| gap between cards / side padding | `scrollPad`, line 499 (`layout.gap` 16, `layout.side` 20) |
| the bottom bar's look | lines 512-518 (margins, radius `radius.card`, fill `theme.navSurface`, shadow) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |
| the look of every Card / Input / Button | `src/ui/components.tsx` (changes all screens) |

## Tablet layouts

Which layout runs is decided at the bottom of `CreateInvoiceScreen()`: `bp.isPhone` → S4.L1 (line 501), `bp.atLeast('xl')` → S4.L3 (line 534), otherwise S4.L2 (line 580). The step body is not used on tablets: every section is on screen at once, and the TOTAL bar is replaced by `totalsBlock` + `actionButtons` at the end of the form.

### S4.L2 two-pane (md / lg)

```
CreateInvoiceScreen()  md / lg                                        line 580
│
├─ TopAppBar          title + next number; back = leave()                   582
│                     md only: a glass action button toggles tabPreview      584-586
│                     (eye "Show preview" ⇄ edit-2 "Show form")
│
└─ row                                                                      588
     ├─ left, flex 1                                                        589
     │    ├─ (form, maxWidth 720)  ScrollView with scrollPad                590-596
     │    │    ├─ partySection                                    S4.A    592
     │    │    ├─ itemsSection                                    S4.B    593
     │    │    ├─ totalsBlock                                     S4.C    594
     │    │    └─ actionButtons  Save draft | Issue invoice       S4.F    595
     │    └─ (md with tabPreview on) previewPane instead of the form        598
     │
     ├─ right, width 40%  (lg only; md has no right pane)                   601-603
     │    └─ previewPane                                          S4.E
     │
     └─ CatalogSheet  P2 (opened by "Add from products")                    605
```

### S4.L3 three-panel (xl+)

```
CreateInvoiceScreen()  xl+                                            line 534
│
├─ TopAppBar          title + next number; back = leave()                   538
│
└─ row                                                                      539
     ├─ Products panel, width 25%                                           540
     │    ├─ SectionTitle "Products"                                        541
     │    ├─ SearchField "Search products"  (filters the list as you type)  542
     │    └─ Card list + FlatList                                           546
     │         ├─ EmptyState "No products. Add them under Products."        550
     │         └─ one ListItem per product: "name · size" · ₹price ·        552
     │              [Avl n] badge (red < 0, grey = 0, green > 0);           559
     │              tap = addLine(p)
     │    (no "Add from products" button here; the panel replaces P2,
     │     and the products load as soon as this layout opens, line 166)
     │
     ├─ Form, width 38%  ScrollView with scrollPad                          565
     │    ├─ partySection                                         S4.A    566
     │    ├─ itemsSection                                         S4.B    567
     │    ├─ totalsBlock                                          S4.C    568
     │    └─ actionButtons                                        S4.F    569
     │
     └─ Preview, width 37%                                                  571
          └─ previewPane                                          S4.E
```

### previewPane (S4.E), shared by both tablet layouts

```
previewPane                                                           line 454
├─ header row                                                               456
│    ├─ "PREVIEW" overline                                                  457
│    └─ SegmentedControl "Page size": A4 | Letter  (width 180)              458
└─ page frame: 1px glass border, radius 16, min height 400,                 462
   white paper, card shadow
     ├─ web:    the invoice HTML in a padded div                            471
     └─ native: WebView rendering previewHtml (D1, rebuilt on every edit)   472
```

### Where to change what (tablet)

| You want to change | Go to |
| --- | --- |
| the breakpoint where a layout starts | the `bp.isPhone` / `bp.atLeast('xl')` checks, lines 501 / 534 (`src/ui/useBreakpoint.ts` for the widths) |
| panel widths 25% / 38% / 37% (xl) | lines 540 / 565 / 571 |
| preview width 40% (lg) | line 603 |
| form max width 720 (md/lg) | `maxReadWidth` on line 591 (`src/ui/tokens.ts`) |
| the md toggle icons / labels | lines 584-586 |
| the page-size options | line 459 |
| the preview frame (border, radius, min height) | lines 462-465 |

## Tablet check (Prompt 30)

Checked on 2026-10-23 with `/tablet-check` (phone AVD resized): **md** 601×961 dp (8-inch portrait) · **xl** 961×601 dp (8-inch landscape) · **lg** 800×1280 dp (10-inch portrait) · **xxl** 1280×800 dp (10-inch landscape).

| Size | Layout | Seen | Verdict |
| --- | --- | --- | --- |
| md 601 | S4.L2 single pane + eye toggle | Bill-to card with 2-column rows, all readable | ok |
| xl 961 | S4.L3 three panels (25 / 38 / 37) | products panel names truncated "Acid Wash T…"; **date inputs clip their first digit ("'026-10-23")**: the form is ≈ 330 dp, each date cell ≈ 134 dp, text area ≈ 102 dp | **bug** |
| lg 800 | S4.L2 form + 40 % preview | readable | ok |
| xxl 1280 | S4.L3 | readable, product names fit | ok |

Proposed fix (not applied): S4.A row 5 (Invoice date | Due date) as `<Columns kind="input" minCell={150}>` so it stacks inside the narrow xl form; the S4.L3 products panel title + size on two lines under 300 dp. Note: `ScrollView style={{ width: '38%' }}` (S4.L2 and L3) is a flex *basis*, not a fixed width: ScrollView has `flexGrow: 1` by default, so the form grows into leftover space (harmless here, a bug in S5).
