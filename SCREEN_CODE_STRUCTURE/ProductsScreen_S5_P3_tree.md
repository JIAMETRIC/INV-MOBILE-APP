# What's inside ProductsScreen (S5) and the Product editor / Restock sheet (P3)

File: `src/features/products/ProductsScreen.tsx` (518 lines). Line numbers as of 2026-10-23, after the Three-Slot restructure (Prompt 49).
Opened by the Products tab (bottom nav on phones, rail on tablets).
IDs (S5.x, P3) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

The file reads top to bottom: the labels and numbers you edit most (`SIZES`, `QUICK_PICKS`, `S5`),
three small helpers, all the state in one hook (`useProducts`), the screen switch on `<Screen>`,
then one function per region in on-screen order: the header, the list, the editor (pane or sheet)
and the editor's rows. Function names are stable; line numbers drift.

```
SIZES, QUICK_PICKS    S5.6.3 / S5.6.2  the chip labels (from schema.ts)                    35
S5                    every number specific to this screen:                                  40
                        columns [NAME flex 3 · SIZE 52 · PRICE 84 · STOCK 60 · SOLD 56 · AVL 76]
                        tableMinWidth 520 · editorWidth 38 % · rail 88 · editorPadding 20 · longList 6
blank(), num(), AvlBadge  helpers                                                            55–63

useProducts()         state + data, no JSX: products · search · editing · editId · draft ·    72
                      draftSold · mode · rQty / rPricePaise / rNote · nameError · qtyError ·
                      history · busy · load · loadHistory · startEdit · save · remove ·
                      openRestock · applyRestock · exportXlsx · editorTitle · showTable

ProductsScreen()      the switch, on <Screen header fab>                                     214
├─ phones, md → Main = row[ ListPane ] · EditorSheet (P3)
└─ lg+        → Main = row[ ListPane | EditorPane 38 % ]

Header                S5.0  "N items" · "Products" · New product (tablets) · Export           233

Main
├─ ListPane           S5.1–S5.3  column: SearchRow · ProductListCard                          254
│    ├─ SearchRow     S5.1  "Search products"                                                 266
│    └─ ProductListCard  S5.2 / S5.3  hugging card; table when showTable, else phone rows;   277
│         │                  long lists clear the FAB (useFabClearance)
│         ├─ TableHeader     S5.2  the six labels from S5.columns                             302
│         ├─ ProductTableRow S5.2.r  (React.memo) widths from S5.columns                      323
│         ├─ ProductListRow  S5.3    (React.memo) size circle · name · stock/sold · price     341
│         └─ empty states    S5.3.e  "No matches" / "No products"                             289
├─ EditorPane         S5.5  lg+: 38 % pinned ScrollView, glass card, EditorBody or empty      370
└─ EditorSheet        P3    below lg: Sheet wide with EditorBody                              386
     └─ EditorBody    RestockForm when mode = restock on an existing product, else ProductForm 395
          ├─ ProductForm    S5.6  name input, then:                                           400
          │    ├─ QuickPickChips  S5.6.2                                                      415
          │    ├─ SizeChips       S5.6.3  + "No size"                                         430
          │    ├─ PriceStockRow   S5.6.4  <Columns kind="input"> Price | Stock                447
          │    ├─ EditorActions   S5.6.5  Delete · Restock · Save                             462
          │    └─ StockHistory    S5.6.6  one row per restock / edit                          473
          └─ RestockForm    S5.7  info line · Qty | New price (Columns) · Note · Back / Add   496

Footer: none (the FAB, S5.4, is a <Screen> slot in ProductsScreen())
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `useProducts()` | 72 | `load()` (search, reruns on `refreshKey`), `loadHistory(id)`, `startEdit(p?)` (stable, opens the editor for a product or a blank one), `save()` (name required → `upsertProduct` → audit → snackbar; duplicate → inline error), `remove()` (confirm → `deleteProduct` → audit), `openRestock()` / `applyRestock()` (`restockProduct` → audit → back to the editor), `exportXlsx()` (D2.3 → share); `showTable` = md+ and list pane ≥ 520 dp |
| `ProductsScreen()` | 214 | calls the hook; `<Screen>` with `Header`, the phone FAB, `ListPane` and either `EditorPane` (lg+) or `EditorSheet` |
| `Header` … `RestockForm` | 233–496 | the regions above |
| `AvlBadge` | 63 | Avl < 0 red, = 0 grey, > 0 green |
| `num(v)` | 57 | non-negative whole number as a string |

## Where to change what

| You want to change | Go to |
| --- | --- |
| a table column's width or order | `S5.columns` (43–46): header and rows follow |
| when the table is used instead of phone rows | `S5.tableMinWidth` (49) |
| the editor pane width or padding | `S5.editorWidth`, `S5.editorPadding` |
| the chip labels | `PRODUCT_SIZES` / `PRODUCT_SEED_NAMES` in `src/data/schema.ts` (used by `SIZES`, `QUICK_PICKS`) |
| what a phone row shows | `ProductListRow` (341) |
| what a table row shows | `ProductTableRow` (323) |
| the editor's field order | the five lines inside `ProductForm` (403–410) |
| the restock fields | `RestockForm` (496) |
| the editor's buttons | `EditorActions` (462) |
| the empty-state texts | `ProductListCard` (289–291) |
| what Save / Delete / Restock do | `save`, `remove`, `applyRestock` inside `useProducts` |
| the header buttons | `Header` (233) |
| card / input / chip looks (all screens) | `src/ui/components.tsx` |
| colours, radii, fonts | `src/ui/tokens.ts` |

## Size check (Prompt 49, after the restructure)

Phone (411 dp): list, editor sheet, Restock, Back, closed: **0.000 % differing pixels** before vs after. md, lg, xl, xxl: see the walkthrough, Prompt 49; the layouts are those of Prompts 31–32 (table at md full width and xl / xxl beside the editor; phone rows at lg).

Earlier size notes (Prompts 30–32) are superseded by this section; the decisions are in `SCREEN_CODE_STRUCTURE_TRACKING.md`.
