# What's inside CreateInvoiceScreen (S4, all layouts)

File: `src/features/invoices/CreateInvoiceScreen.tsx` (831 lines). Line numbers as of 2026-10-23, after the Three-Slot restructure (Prompt 37).
Opened by `nav.openCreate()` (the "+ New invoice" FAB on S1, S2, S5 and the rail "+"; "Edit" on S3; a draft row on S6).
IDs (S4.x, P2) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

The file reads top to bottom: the text and numbers you edit most (`STEPS`, `S4`), the empty form, all
the state in one hook (`useInvoiceForm`), the screen switch built on `<Screen>`, then one function per
region in on-screen order (Header · Stepper · Main pieces · Footer · the P2 sheet). Function names are
stable; line numbers drift.

```
STEPS                 S4.L1.1  'Bill to' · 'Items' · 'Review'                              42
S4                    every number specific to this screen:                                  46
                        stepCircle 28 · catalogWidth 25 % · formWidth 38 % ·
                        previewWidth 37 % · previewWidthTwoPane 40 % ·
                        catalogNarrowBelow 300 · pageSizeControl 180 ·
                        previewMinHeight 400 · qtyRateWeights [1, 1.4] · inputPull −16
blankForm()           empty party, today, due = today + 14, 0 % discount                   68

useInvoiceForm()      state + data, no JSX: settings · form · step · catalog · products ·   88
                      tabPreview · pageSize · totals · patch · autosave · previewHtml ·
                      openCatalog · searchCatalog · addLine · addBlankLine · updateLine ·
                      removeLine · issue · saveAsDraft · leave · Android Back · title

CreateInvoiceScreen() the switch, on <Screen overlay>                                       323
├─ phone  → header=Header · below=Stepper · <StepBody/> · footer=TotalBar        S4.L1    333
├─ xl     → header=Header · row[ CatalogPanel 25 % | FormPane 38 % | PreviewPane 37 % ]  S4.L3  346
└─ md/lg  → header=Header(+eye at md) · row[ FormPane or PreviewPane | PreviewPane 40 % at lg ]  S4.L2  360

Header                title · number · back = leave · md: eye / pencil toggle              383
Stepper               S4.L1.1  28-px circles, check on done steps, 2-px connectors         396

Main
├─ useScrollPad()     side 20 · top 4 · bottom useMainInset() (32 in an overlay) · gap 16   445
├─ StepBody           S4.L1.2  phone: BillToCard / ItemsSection / ReviewSection by step    451
├─ FormPane           tablets: BillToCard · ItemsSection · TotalsCard · ActionButtons      463
├─ BillToCard         S4.A  Party name · Address · then the three rows                     478
│    ├─ CityPincodeRow   S4.A row 3 (and S4.B.6)  <Columns kind="input"> City | Pincode     499
│    ├─ MobileEmailRow   S4.A row 4  <Columns kind="input"> Mobile | Email                  513
│    └─ DatesRow         S4.A row 5  <Columns kind="input"> Invoice date | Due date         529
├─ ItemsSection       S4.B  "Items (n)" + Add from products (not at xl)                    544
│    ├─ EmptyItemsCard   S4.B.2  "No items yet"                                             566
│    ├─ LineItemCard     S4.B.3  header row + trash · Description ·                         578
│    │                           <Columns weights [1, 1.4]> Qty | Rate · "Amount …"
│    ├─ (Add free line)  S4.B.4  outline button, inside ItemsSection                        559
│    └─ AdjustmentsCard  S4.B.5  Discount % | Ship-to chip · ShippingFields · Notes (S4.B.7)  607
│         └─ ShippingFields  S4.B.6  Consignee · Ship-to address · CityPincodeRow           634
├─ TotalsCard         S4.C  Subtotal · Discount (if > 0) · Round off · Total                649
├─ ReviewSection      S4.D  Bill-to summary · compact item rows · TotalsCard · words        664
├─ ActionButtons      S4.F  Save draft · Issue invoice / Update                             704
├─ PreviewPane        S4.E  A4 / Letter · the printed page (WebView)                        715
└─ CatalogPanel       S4.L3  xl products panel: search · list; names wrap when narrow       742

Footer
└─ TotalBar           S4.L1.3  phone: TOTAL + Next, or ActionButtons on Review              778

CatalogSheet          P2  bottom sheet: search + first 60 products                           801
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `useInvoiceForm({ draftId, invoiceId })` | 88 | loads settings, then the edit invoice / the draft / the next number; owns the form, totals, draft autosave (`patch` marks dirty, `autosave` saves), the catalog list, the preview HTML; `issue()`, `saveAsDraft()`, `leave()` (unsaved new work → draft), Android Back (phone step back, else leave) |
| `CreateInvoiceScreen()` | 323 | calls the hook, picks phone / xl / md-lg, builds the `<Screen>` |
| `Header` | 383 | the app bar; `eye` adds the md form ⇄ preview toggle |
| `Stepper` | 396 | S4.L1.1 |
| `useScrollPad()` | 445 | the padding every scrolling pane shares |
| `StepBody`, `FormPane` | 451, 463 | the one scroller of Main (phone / tablets) |
| `BillToCard`, `CityPincodeRow`, `MobileEmailRow`, `DatesRow` | 478–529 | S4.A |
| `ItemsSection`, `EmptyItemsCard`, `LineItemCard`, `AdjustmentsCard`, `ShippingFields` | 544–634 | S4.B |
| `TotalsCard`, `ReviewSection`, `ActionButtons`, `PreviewPane`, `CatalogPanel` | 649–742 | S4.C, S4.D, S4.F, S4.E, S4.L3 panel |
| `TotalBar` | 778 | S4.L1.3 footer |
| `CatalogSheet` | 801 | P2 |

## Where to change what

| You want to change | Go to |
| --- | --- |
| step names | `STEPS` (42) |
| pane widths, the stepper circle, the preview height, the Qty : Rate ratio | `S4` (46–57), one line each |
| a field's label, placeholder or keyboard | its `<Input>` inside the row or card named above |
| which fields share a row | the `<Columns>` in that row function; add a child to add a column, `stackAt="sm"` to stack on phones |
| the order of the Bill-to fields | the five lines inside `BillToCard` (483–493) |
| what a line-item card shows | `LineItemCard` (578–605) |
| the empty-items text | `EmptyItemsCard` (566) |
| the review rows | `ReviewSection` (664–702) |
| the TOTAL bar's look or buttons | `TotalBar` (778–799) |
| the A4 / Letter control | `PreviewPane` (715) |
| the tablet layouts | the three branches of `CreateInvoiceScreen()` (333–380) |
| what Save / Issue / Back do | `issue`, `saveAsDraft`, `leave`, `useBackIntercept` inside `useInvoiceForm` |
| card / input / button looks (all screens) | `src/ui/components.tsx` |
| colours, radii, fonts | `src/ui/tokens.ts` |

Not memoised on purpose: `LineItemCard` (a handful of cards, not a list; its handlers close over `form`).

## Tablet check (Prompt 37, after the restructure)

Checked on 2026-10-23 with `/size-check` (then `/tablet-check`) (phone AVD resized): **md** 601×961 dp · **lg** 800×1280 dp · **xl** 961×601 dp · **xxl** 1280×800 dp. See the walkthrough, Prompt 37, for what was seen; the layouts are unchanged from Prompts 31–33 (dates stack at xl; catalog names on two lines at xl; the form may grow past 38 % at xl and lg since the ScrollView keeps its default `flexGrow`).
