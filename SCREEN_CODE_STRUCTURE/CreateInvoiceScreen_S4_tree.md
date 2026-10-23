# Create / Edit invoice (S4) — Three-Slot tree

**File:** `src/features/invoices/CreateInvoiceScreen.tsx` (831 lines; line numbers as of 2026-10-23) · **Reached by:** `nav.openCreate()`, a full-screen overlay (`overlay = { k: 'create-invoice' }`, mounted by `src/shell/App.tsx:124` on phones and `:156` beside the rail): new from the "+ New invoice" FAB on S1 (`DashboardScreen.tsx:81`) and S2 (`InvoicesScreen.tsx:109`) and the rail "+" (`App.tsx:152`); edit mode `openCreate({ invoiceId })` from "Edit" on S3 (`InvoiceDetail.tsx:132`); draft mode `openCreate({ draftId })` from a draft row on S6 (`SettingsScreen.tsx:169`) · **Data:** `getSettings()` `src/data/settingsRepo.ts:5` · `getInvoice()` `:35`, `getLines()` `:45`, `saveInvoice()` `:60` in `src/data/invoicesRepo.ts` · `getDraft()` `:14`, `saveDraft()` `:21`, `deleteDraft()` `:55` in `src/data/draftsRepo.ts` · `listProducts(search)` `src/data/productsRepo.ts:25` · `logAudit()` `src/data/auditRepo.ts:8` · `buildInvoiceHtml()` `src/export/pdfTemplate.ts:13` · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S4 and § P2 · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

The invoice form: Bill to, Items, Totals, Review and a live PDF preview, with a draft autosave on every blur. Three layouts from the same blocks, all on `<Screen overlay>` (no bottom nav underneath): `bp.isPhone` (xs, sm) is the stepper with a footer (S4.L1); `bp.atLeast('xl')` is three panes, catalog | form | preview (S4.L3); everything between is the md / lg branch (S4.L2), where `bp.bp === 'md'` shows one pane and the header's eye swaps form and preview, and lg shows form | preview. This screen does not read `bp.panes`. The P2 catalog sheet lives in the same file.

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | `TopAppBar`: title `f.title` ("New invoice" / "Edit invoice"), subtitle `f.previewNo` (the invoice number), back = `f.leave`; at md one action, eye / pencil ("Show preview" / "Show form") = `f.togglePreview` | `Header` | 383-392 |
| Below (phones) | the stepper in the `below` slot of `<Screen>`: the three `STEPS`, tap = `f.setStep` | `Stepper` (S4.L1.1) | 396-438; set at 337 |
| Main | phones: one `ScrollView` showing the current step's block; md / lg / xl: a row of panes, each form pane its own `ScrollView`. Every scroller pads with `useScrollPad()`: sides 20, top 4, gap 16, bottom = `useMainInset()` (32 in an overlay) | `StepBody` (phones) / `FormPane` (tablets) / `useScrollPad` | 451-460 / 463-474 / 445-448 |
| Footer | phones only: the floating TOTAL bar with Next, or Save draft + Issue on the Review step; `<Screen>` pads it by the gesture inset (`useNavBottom()`). On tablets none: the actions are `ActionButtons` at the end of `FormPane` | `TotalBar` (S4.L1.3) | 778-798; set at 338 |
| FAB | none (an overlay; the primary action is in the footer or the form pane) | — | — |
| Nav / rail | owned by the shell (S0); `overlay` tells `<Screen>` there is no nav under it | — | — |

## 2. The file in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `STEPS` | 42 | the three step names |
| 2 | `S4` | 46-57 | every number specific to this screen |
| 3 | `emptyParty()` · `emptyShip()` · `blankForm()` | 59-80 | the empty form: today, due = today + 14 days, 0 % discount, no lines |
| 4 | `useInvoiceForm({ draftId, invoiceId })` | 88-316 | all state, data and actions (no JSX); `type Form` at 317 |
| 5 | `CreateInvoiceScreen()` | 323-379 | the phone / xl / md-lg switch on `<Screen overlay>` |
| 6 | `Header` · `Stepper` | 383-438 | the app bar and the phone stepper |
| 7 | `useScrollPad` · `StepBody` · `FormPane` · `BillToCard` · `CityPincodeRow` · `MobileEmailRow` · `DatesRow` · `ItemsSection` · `EmptyItemsCard` · `LineItemCard` · `AdjustmentsCard` · `ShippingFields` · `TotalsCard` · `ReviewSection` · `ActionButtons` · `PreviewPane` · `CatalogPanel` | 445-769 | Main: one function per region, in on-screen order; the two tablet-only panes last |
| 8 | `TotalBar` | 778-798 | the phone footer |
| 9 | `CatalogSheet` | 801-831 | P2, the "Add from products" sheet |

## 3. Tree

```
CreateInvoiceScreen()                                                   line 323
│
│  phones (bp.isPhone): <Screen overlay header below footer>               332
│
├─ Header                      TopAppBar: f.title, subtitle f.previewNo,    383
│                              back = f.leave
├─ below: Stepper      S4.L1.1  STEPS × 3: 28 circles (check when done),    396
│                              2 px connectors, labels 14; tap = f.setStep
│
├─ StepBody            S4.L1.2  ScrollView, pad = useScrollPad()            451
│    │
│    ├─ step 0: BillToCard        S4.A   Card                               478
│    │    ├─ Input "Party name *"                                           485
│    │    ├─ Input "Address"                                                487
│    │    ├─ CityPincodeRow   S4.A row 3  [ City | Pincode ]  Columns kind="input"   499
│    │    ├─ MobileEmailRow   S4.A row 4  [ Mobile | Email ]   Columns kind="input"   513
│    │    └─ DatesRow         S4.A row 5  [ Invoice date | Due date ]  Columns kind="input",   529
│    │                                    marginBottom S4.inputPull
│    │
│    ├─ step 1: ItemsSection      S4.B   View, gap 16                       544
│    │    ├─ SectionTitle "Items (n)" + Button "Add from products"  S4.B.1  549
│    │    │                       (ghost; hidden at xl) → f.openCatalog
│    │    ├─ EmptyItemsCard       S4.B.2  "No items yet" (no lines)         566
│    │    ├─ LineItemCard × n     S4.B.3  Card (not memoised, see § 6)      578
│    │    │    ├─ row: overline "Item n · From products / Free line" | IconButton trash   582
│    │    │    ├─ Input "Description"                                       588
│    │    │    ├─ [ Qty | Rate (₹) ]  Columns kind="input" weights S4.qtyRateWeights   590
│    │    │    └─ row (space-between): "Amount" | MoneyText                 597
│    │    ├─ Button "Add free line"  S4.B.4  outline, flex-start → f.addBlankLine   558
│    │    └─ AdjustmentsCard      S4.B.5  Card                              607
│    │         ├─ row: [ Discount % | Chip "Ship to address" ]  flex 1 each, gap 12   612
│    │         ├─ ShippingFields  S4.B.6  only when the chip is on          634
│    │         │    ├─ Input "Consignee" · Input "Ship-to address"          640
│    │         │    └─ CityPincodeRow  [ City | Pincode ]                   642
│    │         └─ Input "Notes"   S4.B.7  multiline, marginBottom S4.inputPull   624
│    │
│    └─ step 2: ReviewSection     S4.D   View, gap 16                       664
│         ├─ Card: overline "Bill to" · party name · "no · date · due"      668
│         ├─ Card list: "Items (n)" · row × n [ description | qty × rate | amount ]   677
│         ├─ TotalsCard           S4.C   Subtotal · Discount (if > 0) · Round off · Total   649
│         └─ amount in words (caption, italic)                              696
│
├─ footer: TotalBar    S4.L1.3  glass bar: "Total" + ₹ figure | Next (steps 0–1)   778
│                              or ActionButtons S4.F (step 2)
└─ CatalogSheet        P2      Sheet: bottom sheet on phones                801

md / lg (line 362): <Screen overlay header>; Header gets eye={md}
   [ FormPane maxWidth 720 (md: PreviewPane instead when f.tabPreview) | PreviewPane 40 % (lg only) ]
   + CatalogSheet (centred dialog)                                           364-376

xl (line 346): <Screen overlay header>; no sheet
   [ CatalogPanel 25 % | FormPane 38 % | PreviewPane 37 % ]                  349-355

FormPane       S4.L2 / S4.L3  ScrollView, pad = useScrollPad():               463
                              BillToCard · ItemsSection · TotalsCard · ActionButtons (S4.F)
ActionButtons  S4.F           row (flex-end, gap 8): Save draft (outline) · Issue invoice / Update   704
PreviewPane    S4.E           row: overline "Preview" | SegmentedControl A4 / Letter (180);   715
                              page frame minHeight 400 (WebView; inline HTML on web)
CatalogPanel   S4.L3          25 %: SectionTitle "Products" · SearchField · Card list        742
                              FlatList → ListItem (titleLines 2 when narrowCatalog) + Avl Badge;
                              tap = f.addLine

P2  CatalogSheet (line 801): Sheet wide, title "Add from products"
   ├─ SearchField "Search products" → f.searchCatalog                        807
   ├─ EmptyState "No products found." (no products)                          810
   └─ ListItem × first 60: leadingText size (or "—") · name · "Stock n · Sold n" ·   811
      trailing ₹price + Badge "Avl n"; tap = f.addLine (closes the sheet)
```

## 4. The `S4` numbers

| Key | Value | ID | Means |
| --- | --- | --- | --- |
| `stepCircle` | 28 | S4.L1.1 | the stepper circle diameter |
| `catalogWidth` | `'25%'` | S4.L3 | the products panel at xl |
| `formWidth` | `'38%'` | S4.L3 | the form pane at xl (a `ScrollView`; 38 % is its flex basis, it may grow) |
| `previewWidth` | `'37%'` | S4.L3 | the preview pane at xl |
| `previewWidthTwoPane` | `'40%'` | S4.L2 | the preview pane beside the form at lg |
| `catalogNarrowBelow` | 300 | S4.L3 | under this panel width product names take two lines (`narrowCatalog`) |
| `pageSizeControl` | 180 | S4.E | width of the A4 / Letter control |
| `previewMinHeight` | 400 | S4.E | the printed page frame |
| `qtyRateWeights` | `[1, 1.4]` | S4.B.3 | Qty : Rate column weights |
| `inputPull` | `-space[4]` (−16) | S4.A, S4.B.7 | the last input in a card pulls the card's bottom padding up under the field |

## 5. Rows and columns

| Row | Function | Cells | Rule |
| --- | --- | --- | --- |
| S4.A row 3 City \| Pincode (also S4.B.6) | `CityPincodeRow` | 2: City · Pincode (6 digits) | `Columns kind="input"`: stacks under 128 dp per cell; no `wrap`, no `stackAt`. Stacks at xs 320 and in the xl 38 % form |
| S4.A row 4 Mobile \| Email | `MobileEmailRow` | 2 | `Columns kind="input"`, same rule |
| S4.A row 5 Invoice date \| Due date | `DatesRow` | 2 | `Columns kind="input"`, same rule; `style marginBottom: S4.inputPull` |
| S4.B.3 header | `LineItemCard` | 2: overline (`flex: 1`) · trash `IconButton` | plain row; never stacks |
| S4.B.3 Qty \| Rate | `LineItemCard` | 2 | `Columns kind="input" weights={[1, 1.4]}`: stacks under 128 dp per cell |
| S4.B.3 amount | `LineItemCard` | 2: "Amount" · `MoneyText` | space-between; never stacks |
| S4.B.5 Discount % \| chip | `AdjustmentsCard` | 2: `Input` (`flex: 1`) · `Chip` (`flex: 1`, `marginBottom` 16) | a plain row, gap 12, `alignItems: 'flex-end'`; never stacks. The one two-cell row in the file that is not `Columns`; its comment gives no reason |
| S4.D item rows | `ReviewSection` | 3: description (`flex: 1`, 2 lines) · "qty × rate" · amount | plain row, gap 12, divider between rows; never stacks (text only) |
| S4.E header | `PreviewPane` | 2: overline "Preview" · `SegmentedControl` (180) | space-between; never stacks |
| S4.F actions | `ActionButtons` | 2 buttons | `justifyContent: 'flex-end'`, gap 8; never stacks |
| S4.L1.3 footer | `TotalBar` | 2: Total figure (`flex: 1`, 1 line) · Next or `ActionButtons` | never stacks |
| S4.L2 panes (lg) | `CreateInvoiceScreen` | 2: form wrapper (`flex: 1, minWidth: 0`) · preview `'40%'` | md drops the preview column and swaps the panes with `f.tabPreview` |
| S4.L3 panes (xl) | `CreateInvoiceScreen` | 3: catalog `'25%'` · form `'38%'` · preview `'37%'` | percentages of the width after the 88 rail |

## 6. State and actions (`useInvoiceForm()`)

| Name | Does |
| --- | --- |
| mount effect (105-147) | `getSettings()`; then with `invoiceId`: `getInvoice` + `getLines` → edit mode (`editInvoiceId`, `previewNo` = the real number, the form filled); else with `draftId`: `getDraft` → `draftRowId`, `previewNo` and `form` from the payload; else `previewNo` = `formatInvoiceNo(prefix, next_seq)`. Reruns when `draftId` / `invoiceId` change |
| `form`, `patch(p)` | the `InvoiceForm`; `patch` merges and clears the `autosaved` flag |
| `totals` | `computeTotals(lines, discountPercent)`: gross, discount, roundOff, total (paise) |
| `autosave()` | `saveDraft(draftRowId, { form, invoiceNo }, totals.total)`, keeps the row id, sets `autosaved`; every field calls it on blur |
| `previewInvoice`, `previewHtml` | the form as an `Invoice` row (status draft, amount in words, UPI id), then `buildInvoiceHtml(…, lines, settings, pageSize)` |
| `title` | "Edit invoice" when `editInvoiceId`, else "New invoice" |
| `step`, `setStep` | the phone stepper (0–2) |
| `catalogOpen`, `closeCatalog`, `openCatalog()` | the P2 sheet; opening loads `listProducts()` unfiltered |
| `catalogSearch`, `searchCatalog(v)`, `products` | the shared search for the sheet and the xl panel; reloads `listProducts(v)` |
| `showsCatalogPanel` effect (203-206) | at `bp.atLeast('xl')` loads the list on entering the layout, so the panel is full on arrival |
| `narrowCatalog` | `(bp.width − 88) × 0.25 < S4.catalogNarrowBelow`: true under 1288 dp of window width (218 dp at xl 961, 298 dp at 1280) → `titleLines={2}` and "size · ₹price" in the subtitle |
| `tabPreview`, `togglePreview` | md only: form ⇄ preview |
| `pageSize`, `setPageSize` | 'A4' / 'Letter' for the preview |
| `addLine(p)` | appends a line from a product (description = name, or "name - size"), qty 1, closes the sheet |
| `addBlankLine()` | appends an empty free line |
| `updateLine(i, p)` | merges and recomputes `line_paise` |
| `removeLine(i)` | removes and renumbers `sno` |
| `issue()` | party name required (else alert, step 0); at least one line (else alert, step 1); `saveInvoice(form, totals, edit ? { invoiceId, invoiceNo } : {})`; `logAudit('invoice.update' / 'invoice.issue')`; `deleteDraft` when a draft row exists; `nav.refresh()`, `nav.closeOverlay()`; snackbar "no issued / updated · ₹total" with **View** → `nav.showInvoice(id, bp.isPhone)` |
| `saveAsDraft()` | `autosave()`, refresh, close, snackbar "Saved to drafts" |
| `leave()` | dirty (not autosaved, and a party name or a line) and not editing → `saveAsDraft()`; else `nav.closeOverlay()` |
| `useBackIntercept` (299-304) | sheet open → not handled (the sheet closes itself); phone and `step > 0` → one step back; else `leave()` |

Not memoised on purpose: `LineItemCard` (a handful of cards in a `ScrollView`, not a list; its handlers close over `form`). The P2 rows are a `map`, not a `FlatList`, capped at 60.

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| the step names | `STEPS`, line 42 |
| the title or subtitle of the app bar | `f.title` (line 308) and `f.previewNo`; `Header`, line 386 |
| the md eye / pencil action | `Header`, lines 387-389 |
| the stepper's circles, connectors or labels | `Stepper`, lines 396-438; `S4.stepCircle` |
| the pane widths | `S4.catalogWidth`, `formWidth`, `previewWidth`, `previewWidthTwoPane`; the md / lg form's cap is `maxReadWidth` (720) in `src/ui/tokens.ts` |
| the scroll padding every pane shares | `useScrollPad()`, line 445 (`layout.side`, `layout.gap`, `useMainInset()`) |
| a field's label, placeholder or keyboard | its `<Input>` inside the row or card named in § 3 |
| which fields share a row | the `<Columns>` in that row function: add a child for a column, `wrap` to let a 4th cell flow, `stackAt="sm"` to force a stack on phones |
| the order of the Bill-to fields | the five lines inside `BillToCard`, lines 485-492 |
| the "Add from products" button or where it hides | `ItemsSection`, lines 549-553 (`xl`) |
| the empty-items text (two variants) | `EmptyItemsCard`, line 570 |
| what a line-item card shows, the Qty : Rate ratio | `LineItemCard`, lines 578-603; `S4.qtyRateWeights` |
| the discount clamp (0–100) or the shipping chip | `AdjustmentsCard`, lines 612-622 |
| the shipping fields | `ShippingFields`, lines 634-646 |
| the totals rows | `TotalsCard`, lines 649-661 (also used by `ReviewSection`) |
| the review cards and item rows | `ReviewSection`, lines 664-701 |
| the Save draft / Issue buttons | `ActionButtons`, lines 704-712 |
| the A4 / Letter control or the page frame | `PreviewPane`, lines 715-738; `S4.pageSizeControl`, `S4.previewMinHeight` |
| the xl products panel and when names wrap | `CatalogPanel`, lines 742-769; `S4.catalogNarrowBelow`; `narrowCatalog`, line 202 |
| the TOTAL bar's look or buttons | `TotalBar`, lines 778-798 |
| the P2 sheet's rows or its 60-row cap | `CatalogSheet`, lines 801-831 |
| the three layouts | the three `return`s of `CreateInvoiceScreen()`, lines 332-378 |
| what Issue, Save draft, Back and leaving do | `issue`, `saveAsDraft`, `leave`, `useBackIntercept` in `useInvoiceForm`, lines 256-304 |
| the draft autosave or what loads on open | `autosave` (159) and the mount effect (105) in `useInvoiceForm` |
| card, input, button, sheet looks (all screens) | `src/ui/components.tsx`, `src/ui/Sheet.tsx` |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## 8. Sizes

| Size | Layout | Last checked |
| --- | --- | --- |
| xs 320 · sm 360 · phone 411 | stepper, one step at a time, TOTAL bar in the footer. xs: `Columns` stacks City / Pincode, Mobile / Email and the dates (cells 118 dp < 128), rule 4 working as designed; stepper, cards and TOTAL bar fine. sm: complete, nothing truncated. 411: step 0, Items and Review pixel-identical before / after the restructure; the P2 sheet 0.066 % (a slide-in frame), identical to the eye | Prompt 44 (xs, sm), Prompt 37 (411) |
| phone landscape (lg) | form \| preview 40 % beside the rail; fits in 411 dp of height and scrolls | Prompt 44 |
| md 601 (8-inch portrait) | one pane + rail: the form (cap 720), the header's eye swaps in the preview; the P2 sheet as a centred dialog | Prompt 32, Prompt 37 (as before the restructure) |
| lg 800 · xl 961 · xxl 1280 | lg: form \| preview 40 %, dates side by side. xl: catalog 25 % \| form 38 % \| preview 37 %; in the 289 dp form the three Bill-to rows stack (cells 122 dp < 128; before the restructure only the dates did, the others were hand-written rows); product names on two lines with "size · ₹price" below and the Avl badge beside. xxl: three panels, dates side by side | Prompt 31 (dates at xl, lg, xxl), Prompt 33 (xl catalog names), Prompt 37 (md, lg, xl, xxl after the restructure) |

Open findings (not applied): none recorded against S4 after Prompt 37. Two things to know: the xl form `ScrollView` keeps its default `flexGrow`, so 38 % is a basis the pane may grow past (the `S4.formWidth` comment, line 49); and the Discount % | chip row in `AdjustmentsCard` is a plain row, not `Columns`, so it never stacks.
