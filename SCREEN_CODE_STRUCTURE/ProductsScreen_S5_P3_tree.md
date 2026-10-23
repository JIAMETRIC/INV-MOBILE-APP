# What's inside ProductsScreen (S5) and the Product editor / Restock sheet (P3)

File: `src/features/products/ProductsScreen.tsx` (348 lines). Line numbers as of 2026-10-23 **before** Prompt 28; that change inserted two memoised row components at lines 38-78 (`ProductTableRow`, `ProductListRow`), so every number from `ProductsScreen()` (now 81) onward is about **+40**, and `tableRow` is gone. Function names are still right.
Reached from the **Products** tab (bottom nav on phones, rail on tablets).
IDs (S5.x, P3) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

## Phone layout (xs / sm)

```
ProductsScreen()                                                     line 37
│
├─ S5.0  TopAppBar  large: "Products" + caption "N items"              272
│         └─ glass icon button  download = "Export products to Excel"  279
│            (tablets also get a  plus = "New product" button, 278)
│
├─ row container  (flex 1; holds the list column + tablet editor)      282
│   │
│   └─ list column  (flex 1; padding 20 sides; gap 16)                 283
│        │
│        ├─ S5.1  SearchField "Search products"  (4 top padding)       284-286
│        │
│        ├─ S5.3  list Card  (hugs its rows; scrolls when full;        287
│        │   │    bottom margin = space above the nav)
│        │   ├─ FlatList of products                                   289
│        │   │    (long lists get 52 + 16 bottom padding so the FAB
│        │   │     doesn't cover the last row, 294)
│        │   ├─ S5.3.e  empty states                                   295-297
│        │   │    searching → "No matches" · otherwise "No products"
│        │   └─ one ListItem per product  (phone rows)                 301-316
│        │        ├─ leading 36 circle = size ("—" when no size)      305
│        │        ├─ title  product name                               307
│        │        ├─ subtitle "Stock n · Sold n"                       308
│        │        └─ trailing column: ₹price (Bebas) + AvlBadge        310-315
│        │           (tap = startEdit(p), 309)
│        │
│        └─ S5.4  FAB "+ Add product"  (phone only) → startEdit()      320
│
└─ P3  Sheet  (phones and md tablets; visible = editing)               334
     title = "New product" / "Edit product" / "Restock"  (268)
     └─ shows S5.6 editorFields, or S5.7 restockFields when
        mode === 'restock'                                              335
```

### P3 contents — S5.6 Product editor (`editorFields`, line 201)

```
editorFields
├─ S5.6.1  Input "Product name"  (red error when empty or duplicate)   203
├─ S5.6.2  label "Quick pick" + Chip row (wraps)                       205-211
│            one Chip per PRODUCT_SEED_NAMES (src/data/schema.ts:152)
├─ S5.6.3  label "Size" + Chip row (wraps)                             212-220
│            S · M · L · XL · XXL (PRODUCT_SIZES, schema.ts:150)
│            + "No size"
├─ S5.6.4  <Columns> (C15): MoneyInput "Price (₹)" | Input "Stock"     262
│            Stock helper: "Sold n · Avl n" (editing) or
│            "Sold counts once invoiced" (new)
├─ S5.6.5  button row, right-aligned, wraps, gap 8                     233-237
│            Delete (ghost red, edit only) · Restock (tonal, edit only)
│            · Save (blue)
└─ S5.6.6  historyBlock "Stock history"  (edit only, when any)         182-199
             one row per restock: icon (arrow-down-circle / edit-2) ·
             "Restock +n → stock m" · "date · note"
```

### P3 contents — S5.7 Restock (`restockFields`, line 158)

```
restockFields
├─ S5.7.1  info line "name · size — current stock n"                   160-162
├─ S5.7.2  <Columns> (C15): Input "Qty to add" | MoneyInput "New price"  208
│            price placeholder "Keep current", helper "Blank keeps price"
├─ S5.7.3  Input "Note (lot / supplier)"  placeholder "Optional"       173
└─ S5.7.4  button row, right-aligned: Back (ghost) · Add to stock      175-178
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `blank()` | 24 | a new product: no name, size S, price 0, stock 0 |
| `num(v)` | 26 | turns typed text into a non-negative whole number string |
| `AvlBadge({ avl })` | 32 | "Avl n" pill: red below 0 (oversold), grey at 0, green above |
| `load()` | 58 | `listProducts(search)`; reruns on search or `nav.refreshKey` |
| `loadHistory(id)` | 68 | restock history for S5.6.6 |
| `startEdit(p?)` | 76 | opens P3 for a product (edit) or blank (new), in edit mode |
| `save()` | 87 | name required → `upsertProduct` → audit → close → reload → snackbar; a duplicate name·size shows an inline error |
| `remove()` | 103 | confirm dialog → `deleteProduct` → audit → close → reload → snackbar |
| `openRestock()` | 123 | clears the restock fields and switches P3 to S5.7 |
| `applyRestock()` | 128 | qty must be > 0 → `restockProduct(qty, price, note)` → audit → back to S5.6 with fresh stock → reload → snackbar |
| `exportXlsx()` | 151 | D2.3 Products sheet → share sheet; spinner on the header button |
| `restockFields` | 158 | the S5.7 JSX |
| `historyBlock` | 182 | the S5.6.6 JSX (null when nothing to show) |
| `editorFields` | 201 | the S5.6 JSX |
| `headerRow` | 242 | the tablet table header (S5.2) |
| `ProductTableRow` | 40 | one tablet table row (S5.2.r), `React.memo`, `onPress(p)` = `startEdit` |
| `ProductListRow` | 58 | one phone row (S5.3), `React.memo` |
| `editorTitle` | 268 | "Restock" / "Edit product" / "New product" |

## Where to change what

| You want to change | Go to |
| --- | --- |
| the size choices | `PRODUCT_SIZES` in `src/data/schema.ts:150` (also seeds the database) |
| the quick-pick names | `PRODUCT_SEED_NAMES` in `src/data/schema.ts:152` |
| a field label, placeholder or helper text | its `<Input>` / `<MoneyInput>` line in the trees above |
| which fields share a row, or their widths | the `flexDirection: 'row'` View around them (lines 163, 221; `flex: 1` each) |
| the phone row's text (title / subtitle / trailing) | lines 305-315 |
| the tablet table columns and widths | `headerRow` line 247 **and** `tableRow` lines 258-263 — keep both the same (NAME flex 3 · SIZE 52 · PRICE 84 · STOCK 60 · SOLD 56 · AVL 76) |
| the empty-state wording | lines 296-297 |
| the Avl badge colours / thresholds | `AvlBadge`, line 32 (tones come from `theme.tone` in tokens.ts) |
| the Delete confirm wording | `alert(...)` strings at line 106 |
| the snackbar wording | lines 97, 116, 145 |
| the editor pane width on tablets | `width: '38%'` at line 323 |
| gap between blocks / side padding | `gap: layout.gap`, `paddingHorizontal: layout.side` at line 283 |
| the sheet's look | `src/ui/Sheet.tsx` (C10; changes P1 and P2 too) |
| colours, radii, fonts | `src/ui/tokens.ts` |
| the look of every Card / Input / Chip / Button | `src/ui/components.tsx` (changes all screens) |

## Tablet layouts

| Width | What changes | Lines |
| --- | --- | --- |
| md+ (≥ 600) | the list Card becomes a **table**: `headerRow` (S5.2: NAME · SIZE · PRICE · STOCK · SOLD · AVL) above `tableRow`s (S5.2.r) instead of ListItems; a "New product" plus button joins the app bar; no FAB | 288, 298-299, 278 |
| md only | the editor still opens as the P3 **sheet** (a centred dialog, from `Sheet`) | 333-337 |
| lg+ (≥ 768) | S5.5 **editor pane**: a 38 %-wide ScrollView on the right with one Card (padding 20) titled "Product editor" (empty state "Select a product to edit, or add a new one.") or `editorTitle` with S5.6 / S5.7 inside; the sheet is not used | 322-332 |

## Tablet check (Prompt 30)

Checked on 2026-10-23 with `/tablet-check` (phone AVD resized): **md** 601×961 dp (8-inch portrait) · **xl** 961×601 dp (8-inch landscape) · **lg** 800×1280 dp (10-inch portrait) · **xxl** 1280×800 dp (10-inch landscape).

| Size | Seen | Verdict |
| --- | --- | --- |
| md 601 | table in one pane: NAME ≈ 140 dp truncated "Acid Wash T-S..", and the SIZE glyph touches the ellipsis (no gap between the columns) | **tight** |
| lg 800 | editor pane open: list card ≈ 300 dp, **NAME column gone, STOCK cut, SOLD / AVL off-screen** | **bug** |
| xl 961 | list card ≈ 335 dp: NAME gone, AVL cut | **bug** |
| xxl 1280 | list card ≈ 347 dp: NAME gone, AVL badges clipped | **bug** |
| P3 sheet (md) | Price \| Stock `Columns` row fine | ok |

Root cause (`ProductsScreen.tsx:330`): the editor is `<ScrollView style={{ width: '38%' }}>`; a ScrollView's default style has `flexGrow: 1`, so 38 % is only its flex basis and it grows into the leftover space, leaving the list ≈ 25–27 %. The fixed table columns (52 + 84 + 60 + 56 + 76 = 328 dp) then eat the whole card and NAME (flex 3) collapses to 0.

Proposed fix (not applied): `flexGrow: 0, flexShrink: 0` on that ScrollView (or wrap it in a `View` of 38 %), a `minWidth` ≈ 420 on the list pane, and `gap: 8` between the table columns so SIZE never touches NAME. Same ScrollView pattern in S4.L2 / L3 (`:565`), harmless there.
