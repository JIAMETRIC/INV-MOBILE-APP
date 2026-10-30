# Products (S5) and the Product editor (P3) — Three-Slot tree

**File:** `src/features/products/ProductsScreen.tsx` (518 lines; line numbers as of 2026-10-23) · **Reached by:** the Products tab (bottom nav on phones, the S0.4.3 rail on tablets); P3 opens from a row tap, the FAB (xs, sm) or the "New product" header button (md) · **Data:** `listProducts(search)` `src/data/productsRepo.ts:25`, `upsertProduct()` `:58`, `restockProduct()` `:96`, `listRestocks(id)` `:117`, `deleteProduct(id)` `:125`, `logAudit()` `src/data/auditRepo.ts:8`, `exportProductsXlsx()` `src/export/xlsx.ts:132`, `shareFile()` `src/export/pdf.ts:49` · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S5 (P3 is the last row of its Sections table) · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

The product catalogue (name, size, price, stock, sold, available) and its editor. One pane on xs, sm and md: header, search, the list card, and the editor as the P3 sheet. From lg (`bp.atLeast('lg')`, line 218) the editor is a pinned 38 % pane beside the list; `bp.isPhone` (xs, sm) adds the FAB and drops the "New product" header button. This file does not read `bp.panes`. Inside the list card, the six-column table appears only when `showTable` holds (md+ **and** a list pane at least `S5.tableMinWidth` 520 dp wide, lines 195-196); every other size gets the phone rows.

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | `TopAppBar large`: caption "N items" over the "Products" title; glass buttons New product (md+, `plus`) and Export products to Excel (`download`, spinner while `busy`) | `Header` | 233-247 |
| Main | a `flex: 1` row in `ProductsScreen()` (223). One pane: `ListPane` only, a column of `SearchRow` and the hugging `ProductListCard`, whose `FlatList` is the one scroller. lg+: `EditorPane` (its own `ScrollView`) beside it. The P3 `EditorSheet` is a `Modal`, so it takes no space in the row | `ListPane`, `ProductListCard` | 254-299 |
| Footer | none (the editor's buttons live in the editor body: `EditorActions`, `RestockForm`) | — | — |
| FAB | "Add product" on phones → `p.startEdit()`; the `fab` slot of `<Screen>` | in `ProductsScreen()` | 220 |
| Nav / rail | owned by the shell (S0) | — | — |

The bottom clearance is not `useMainInset()` here: the hugging card keeps `marginBottom: navInset` (`useNavInset()`, 255 and 283) and, for lists longer than `S5.longList`, pads its `FlatList` content with `useFabClearance()` (281, 289), which is 0 on tablets. `EditorPane` pads its content with the same `navInset` (371, 374).

## 2. The file in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `SIZES`, `QUICK_PICKS` | 35-36 | the chip labels (aliases of `PRODUCT_SIZES` and `PRODUCT_SEED_NAMES`, `src/data/schema.ts:150` and `:152`) |
| 2 | `S5` | 40-53 | every number specific to this screen |
| 3 | `blank()`, `num()`, `AvlBadge` | 55-66 | a blank draft; text → non-negative whole number; the Avl pill |
| 4 | `useProducts()` | 72-207 | all state, data and actions (no JSX); `type Products` on 208 |
| 5 | `ProductsScreen()` | 214-229 | the one-pane / panes switch on `<Screen header fab>` |
| 6 | `Header` · `ListPane` · `SearchRow` · `ProductListCard` · `TableHeader` · `COL` · `ProductTableRow` · `ProductListRow` | 233-362 | the header and the list, in on-screen order |
| 7 | `EditorPane` · `EditorSheet` · `EditorBody` · `ProductForm` · `QuickPickChips` · `SizeChips` · `PriceStockRow` · `EditorActions` · `StockHistory` · `RestockForm` | 370-518 | the editor: the lg+ pane, the P3 sheet, then the body they share |

## 3. Tree

```
ProductsScreen()                                                       line 214
│
├─ Header               S5.0  TopAppBar large: "N items", "Products";           233
│                             New product (md+) · Export products to Excel
│
├─ Main                       View flex 1, row (223); one pane = ListPane only
│    └─ ListPane        S5.1-S5.3  column: flex 1, minWidth 0, sides 20, gap 16  254
│         ├─ SearchRow  S5.1  SearchField "Search products", top 4               266
│         └─ ProductListCard  S5.2 / S5.3  Card list, flexShrink 1, hugs its     277
│              │              rows; marginBottom = useNavInset(); FlatList
│              │              flexGrow 0 (the one scroller); more than
│              │              S5.longList rows → content paddingBottom =
│              │              useFabClearance()
│              ├─ TableHeader       S5.2    only when showTable: 6 overlines     302
│              ├─ ProductTableRow × n  S5.2.r  memo; when showTable              323
│              ├─ ProductListRow × n   S5.3    memo; otherwise                   341
│              └─ EmptyState        S5.3.e  "No matches" (search) / "No products" 290
│
└─ fab slot (phones)    S5.4  FAB "Add product" → p.startEdit()                  220

lg+ (panes):  Header · [ ListPane flex 1 | EditorPane 38 % ]                     225
│
└─ EditorPane           S5.5  ScrollView: width S5.editorWidth, flexGrow 0,      370
     │                        flexShrink 0; content paddingEnd 20,
     │                        paddingBottom = useNavInset()
     └─ Card padding S5.editorPadding                                            375
          ├─ SectionTitle   editorTitle while editing, else "Product editor"    376
          └─ EditorBody     or EmptyState "Select a product to edit, or         377
                            add a new one." until something is selected

P3 (xs, sm, md):  EditorSheet  Sheet wide: visible = editing, title = editorTitle 386
└─ EditorBody                 RestockForm when mode = 'restock' on an existing   395
     │                        product, else ProductForm
     ├─ ProductForm     S5.6                                                     400
     │    ├─ Input "Product name"   S5.6.1  error = nameError, words capitalised 403
     │    ├─ QuickPickChips  S5.6.2  "Quick pick": Chip × QUICK_PICKS, wraps      415
     │    ├─ SizeChips       S5.6.3  "Size": Chip × SIZES + "No size", wraps      430
     │    ├─ PriceStockRow   S5.6.4  [ Price (₹) | Stock ]  Columns kind="input"  447
     │    ├─ EditorActions   S5.6.5  row, wraps, right: Delete · Restock · Save   462
     │    └─ StockHistory    S5.6.6  "Stock history": one row per entry           473
     └─ RestockForm     S5.7                                                     496
          ├─ info line       S5.7.1  name · size, "current stock n"               499
          ├─ row             S5.7.2  [ Qty to add | New price (₹) ]  Columns kind="input" 503
          ├─ Input "Note (lot / supplier)"  S5.7.3  placeholder "Optional"        509
          └─ buttons         S5.7.4  row, right: Back · Add to stock              512
```

P3 is the same `EditorBody` as the lg+ pane, inside `Sheet` (C10, `src/ui/Sheet.tsx`): on phones a bottom sheet that slides up (full width, at most 92 % of the height); on md a centred dialog, `wide` = 86 % of the window up to `maxReadWidth` 720. `EditorSheet` is rendered whenever `sidePane` is false (225), so on md the table-or-rows rule and the sheet are independent.

## 4. The `S5` numbers

| Key | Value | ID | Means |
| --- | --- | --- | --- |
| `columns` | NAME 0 · SIZE 52 · PRICE 84 · STOCK 60 · SOLD 56 · AVL 76 | S5.2 | the table's columns in order (lines 43-46); width 0 marks NAME, which takes `nameFlex` instead. Read by `TableHeader` and, through `COL` (319), by `ProductTableRow`, so the two cannot drift apart |
| `nameFlex` | 3 | S5.2 | NAME's share of the width left after the five fixed columns (52 + 84 + 60 + 56 + 76 = 328 dp) |
| `tableMinWidth` | 520 | S5.2 | the list pane must be at least this wide for the table: 328 dp of fixed columns plus a readable NAME |
| `editorWidth` | `'38%'` | S5.5 | the lg+ editor pane's width |
| `rail` | 88 | S0.4.3 | the tablet rail, taken off the window width when `useProducts()` sizes the list pane (195) |
| `editorPadding` | 20 | S5.5 | the editor card's padding in `EditorPane` (375) |
| `longList` | 6 | S5.3 | more rows than this on a phone pads the list so the last row clears the FAB (289) |

The table-or-rows rule (195-196): `listPaneWidth` = (window − `rail`) × 0.62 from lg, window − `rail` below; `showTable` = `bp.atLeast('md')` and `listPaneWidth ≥ tableMinWidth`. Phones never qualify; md (601 − 88 = 513) and lg 800 ((800 − 88) × 0.62 = 441) fall short, xl 961 (541) and xxl 1280 (739) pass.

## 5. Rows and columns

| Row | Function | Cells | Rule |
| --- | --- | --- | --- |
| S5.6.4 Price · Stock | `PriceStockRow` | 2: `MoneyInput` "Price (₹)" · `Input` "Stock" (helper "Sold n · Avl n" for an existing product, else "Sold counts once invoiced") | `Columns kind="input"`: stacks under 128 dp per cell |
| S5.7.2 Qty · New price | `RestockForm` | 2: `Input` "Qty to add" · `MoneyInput` "New price (₹)" (placeholder "Keep current", helper "Blank keeps price") | `Columns kind="input"`: stacks under 128 dp per cell |
| S5.2 table header and S5.2.r rows | `TableHeader`, `ProductTableRow` | 6: NAME `flex: 3` then five fixed widths from `S5.columns`; SIZE left-aligned, the numbers right-aligned | **never stacks** and not `Columns`: the header and every row read the same `S5.columns` so the columns stay aligned; when the pane is narrower than `S5.tableMinWidth` the whole table gives way to the phone rows (`showTable`) |
| S5.6.2 / S5.6.3 chips | `QuickPickChips`, `SizeChips` | one `Chip` per label (`SIZES` plus "No size") | `flexDirection: 'row', flexWrap: 'wrap'`: chips flow onto more lines; not `Columns` (no fixed cell count) |
| S5.6.5 actions | `EditorActions` | up to 3 `Button`s: Delete (ghost, danger) · Restock (tonal) · Save; the first two only for an existing product | row, `flexWrap: 'wrap'`, `justifyContent: 'flex-end'`, gap 8: buttons keep their own width and wrap; not `Columns` |
| S5.7.4 actions | `RestockForm` | 2 `Button`s: Back (ghost) · Add to stock | row, right-aligned, gap 8, no wrap; not `Columns` |
| S5.3 phone row trailing | `ProductListRow` | price over the `AvlBadge` | a column (`alignItems: 'flex-end'`, gap 4) in the `ListItem` trailing slot |
| S5.6.6 history row | `StockHistory` | icon 20 · a `flex: 1, minWidth: 0` column (label, caption) | row, gap 12, divider under each entry |

Both list rows are `React.memo` with explicit props (`p`, `last`, `onPress`, `theme`; the phone row also `alt`); their `onPress` is `startEdit` from the hook, a `useCallback` (110-119), so typing in the search box re-renders the list, not every row (322).

## 6. State and actions (`useProducts()`)

| Name | Does |
| --- | --- |
| `products` | the rows for the current `search`, from `listProducts(search.trim())` |
| `search`, `setSearch` | the S5.1 text; `load()` depends on it |
| `editing`, `closeEditor()` | whether the editor (pane body or sheet) is open; `closeEditor` sets it false |
| `editId` | the product being edited, `undefined` for a new one (gates Delete, Restock and the history) |
| `draft`, `setDraft` | the `ProductInput` being edited: `name`, `size`, `unit_paise`, `stock_qty` |
| `draftSold` | the product's sold quantity, for the Stock helper "Sold n · Avl n" |
| `mode`, `setMode` | `'edit'` (S5.6) or `'restock'` (S5.7) |
| `rQty`, `rPricePaise`, `rNote` (+ setters) | the restock fields |
| `nameError`, `qtyError` (+ setters) | inline errors on Product name and Qty to add |
| `history` | `Restock[]` for the S5.6.6 list, from `listRestocks(id)` |
| `busy` | true while the Excel export runs (header spinner) |
| `editorTitle` | "Restock" / "Edit product" / "New product" from `mode` and `editId` |
| `showTable` | md+ and a list pane at least 520 dp (section 4) |
| `load()` | `listProducts`; reruns when `search` or `nav.refreshKey` changes (99) |
| `loadHistory(id)` | `listRestocks(id)` → `history` |
| `startEdit(p?)` | stable (`useCallback`): fills the draft from `p` or `blank()`, mode edit, clears the name error and the history, loads the history for an existing product, opens the editor |
| `save()` | name required (else `nameError`) → `upsertProduct(draft, editId)` → `logAudit('product.upsert')` → close → `load()` → snackbar "Saved name · size"; a thrown duplicate becomes the inline error "… already exists." |
| `remove()` | `alert` confirm ("Past invoices keep their lines; only the stock link is removed.") → `deleteProduct` → `logAudit('product.upsert', { deleted: true })` → close → `load()` → snackbar |
| `openRestock()` | clears the restock fields and switches to `'restock'` |
| `applyRestock()` | qty must be > 0 (else `qtyError`) → `restockProduct(editId, qty, rPricePaise, rNote)` → `logAudit('product.restock')` → draft refreshed from the returned product → back to `'edit'` → `loadHistory`, `load()` → snackbar "Added n to stock"; a thrown error shows an alert |
| `exportXlsx()` | `busy` on → `exportProductsXlsx()` (D2.3) → `shareFile(uri)`; failure shows an alert; `busy` off |

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| the title, the "N items" caption or the header buttons | `Header`, lines 236-244 |
| the search placeholder | `SearchRow`, line 269 |
| a table column's width, order or alignment | `S5.columns` (43-46); the header and the rows follow. Alignment: `TableHeader` 311 and the `textAlign` on each cell in `ProductTableRow` 330-333 |
| when the table is used instead of phone rows | `S5.tableMinWidth`; the rule itself is `listPaneWidth` / `showTable`, lines 195-196 |
| what a table row shows | `ProductTableRow`, lines 329-334 |
| what a phone row shows | `ProductListRow`, lines 349-359 |
| the empty-state texts | `ProductListCard`, lines 290-292 |
| how many rows count as a long list (FAB clearance) | `S5.longList`; the clearance itself is `useFabClearance()` in `src/ui/Screen.tsx` |
| the editor pane's width or card padding | `S5.editorWidth`, `S5.editorPadding` |
| the editor pane's empty state or title | `EditorPane`, lines 376-379 |
| the sheet's look (also P1, P2) | `src/ui/Sheet.tsx` (C10); `wide` is set in `EditorSheet`, line 388 |
| which form the editor shows | `EditorBody`, line 396 |
| the editor's field order | the five lines inside `ProductForm`, 405-409 |
| the chip labels | `PRODUCT_SIZES` / `PRODUCT_SEED_NAMES` in `src/data/schema.ts` (150, 152); they also seed the database |
| the Stock helper texts | `PriceStockRow`, line 455 |
| the editor's buttons | `EditorActions`, lines 465-467 |
| a stock-history row | `StockHistory`, lines 478-490 |
| the restock fields, placeholders and buttons | `RestockForm`, lines 504-514 |
| the Avl thresholds | `AvlBadge`, line 65 (tones from `theme`) |
| what Save, Delete and Restock do, the confirm, snackbar and error texts | `save`, `remove`, `applyRestock` in `useProducts()`, lines 121-183 |
| the FAB's text or action | `ProductsScreen`, line 220; its look is `FAB` (C9, `src/ui/components.tsx`) |
| side padding and the gap between the search and the card | `layout.side` (20), `layout.gap` (16) in `ListPane`, line 257 |
| card, input, chip and button looks (all screens) | `src/ui/components.tsx` |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## 8. Sizes

| Size | Layout | Last checked |
| --- | --- | --- |
| phone5 360 × 640 (5-inch) | Search, then four list rows visible; the FAB floats over the fifth. P3 opens as a bottom sheet at 92 % height: name, quick-pick chips wrapping in 2 to 3 per line. | Prompt 65 |
| xs 320 · sm 360 · phone 411 | header, search, phone rows in the hugging card, the FAB over the list above the floating nav; P3 as a bottom sheet | Prompt 44 (xs: rows, sheet and FAB fine; sm: nothing truncated), Prompt 47 (411: S5 top pixel-identical before / after the `Screen` scaffold), Prompt 49 (411: list, editor sheet, Restock, Back and closed, 0.000 % differing pixels before / after the restructure) |
| phone landscape (914 × 411, lg) | [ phone rows \| editor pane ]: list pane (914 − 88) × 0.62 = 512 dp < 520; fits in 411 dp of height and scrolls | Prompt 44 |
| md 601 (8-inch portrait) | one pane + rail: list pane 513 dp < 520, so phone rows at full width with complete names; "New product" in the header, no FAB; P3 as a centred dialog | Prompt 30 (table shown: NAME truncated, SIZE touching the ellipsis, "tight"; the sheet's Price \| Stock row fine), Prompt 31 (threshold 480), Prompt 32 (threshold 520 and NAME `paddingEnd`: phone rows, full names), Prompt 49 (phone rows full width) |
| lg 800 (10-inch portrait) | [ phone rows \| editor 38 % ]: list pane (800 − 88) × 0.62 = 441 dp < 520 | Prompt 30 (bug: the editor `ScrollView` grew past 38 %, list ≈ 300 dp, NAME gone, STOCK cut, SOLD / AVL off screen), Prompt 31 (`flexGrow: 0, flexShrink: 0` on the pane plus `showTable`: rows with full names beside the editor), Prompt 49 (rows beside the editor, editor open on the right) |
| xl 961 · xxl 1280 | [ table \| editor 38 % ]: list pane 541 dp (xl) and 739 dp (xxl) ≥ 520, six columns with full names; the editor pane shows its empty state until a row is tapped | Prompt 30 (bug as at lg: list ≈ 335 / 347 dp, NAME gone, AVL cut), Prompt 31 (fixed: all six columns, names readable), Prompt 32 (xl 541 ≥ 520 by arithmetic), Prompt 49 (six-column table, editor pane empty state) |

Open findings (not applied): none. Every Prompt 30 finding on S5 was closed in Prompts 31 and 32; Prompt 44 reported S5 and P3 as ok at every phone size.

## 2026-10-30 addendum: limits (LAN_SYNC Phase 5, D4)

`useProducts()` returns `canProducts` / `canStock` from `useLock().can(...)` (line 207). Products: the FAB (224) and the header's New product only with Products; `ProductForm` (402) makes the name read-only and hides `QuickPickChips` without it; `PriceStockRow` makes price read-only without Products and stock read-only without Stock; `EditorActions` (448) shows Delete with Products, Restock with Stock, Save with either, else one explanatory line; `RestockForm` hides New price without Products. Checked on the emulator as Ravi (staff, no switches): no FAB, editor read-only with the line, stock history still shown.
