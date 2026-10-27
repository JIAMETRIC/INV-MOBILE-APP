# Dashboard (S1) — Three-Slot tree

**File:** `src/features/dashboard/DashboardScreen.tsx` (159 lines; line numbers as of 2026-10-23) · **Reached by:** the Home tab (S0.4.1); the first screen after start-up · **Data:** `getKpis()` `src/data/dashboardRepo.ts:15`, `getStockTotals()` `src/data/productsRepo.ts:40` · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S1 · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

The financial-year figures and the three stock totals. One layout at every width: there is no pane branch, only the FAB (phones) and the bottom padding change with `bp.isPhone`. S1.3 and S1.4 are retired IDs (removed 2026-10-22).

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | `TopAppBar large`: caption "FY 2026–27 overview" over the "Dashboard" title; no buttons | `Header` | 89-91 |
| Main | one `ScrollView`: the hero card, then the row of three stat tiles; bottom = `useMainInset()` | `DashboardMain` | 98-112 |
| Footer | none (no screen-level action bar) | — | — |
| FAB | "+ New invoice" on phones → `nav.openCreate()`; the `fab` slot of `<Screen>` | in `DashboardScreen()` | 81 |
| Nav / rail | owned by the shell (S0) | — | — |

## 2. The file in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `STOCK_TILES` | 26-30 | the three tiles: label · icon · which stock figure |
| 2 | `S1` | 34-41 | every number specific to this screen |
| 3 | `fyLabel(d)` | 45-48 | the header caption |
| 4 | `useDashboard()` | 53-68 | state and data (no JSX) |
| 5 | `DashboardScreen()` | 73-86 | the screen on `<Screen header fab>` |
| 6 | `Header` · `DashboardMain` · `HeroCard` · `StatTilesRow` · `StatTile` · `StockPieCard` | 89-159 | one function per region, in on-screen order |

## 3. Tree

```
DashboardScreen()                                                    line 73
│
├─ Header               S1.0  TopAppBar large: fyLabel() caption, "Dashboard"  89
│
├─ DashboardMain              ScrollView: sides 20, gap 16, top 4;            98
│    │                        bottom = useMainInset(); maxWidth max(720, 90 %)
│    │
│    ├─ HeroCard        S1.1  Card padding 20, gap 6                          115
│    │    ├─ row (space-between)                                              119
│    │    │    ├─ overline "Total billed · FY"                                120
│    │    │    └─ Badge "N invoice(s)"  (kpis.invoiceCount, this FY)          121
│    │    └─ ₹ kpis.billedPaise   type.hero (Bebas 44), shrinks to 0.6        126
│    │
│    └─ StatTilesRow    S1.2  one row, 3 cells flex 1, gap 12 · never stacks  134
│         └─ StatTile × 3  (d.tiles ← STOCK_TILES)                           147
│              ├─ IconChip  36 × 36 blue tint, blue icon 18                   150
│              ├─ label     13 #666, 2 lines, minHeight 36                    151
│              └─ value     type.figure (Bebas 28), shrinks to 0.6            154
│
│         S1.2.a  "Products Sold"  stock.soldQty   shopping-cart               27
│         S1.2.b  "Balance Stock"  stock.avlQty    box                         28
│         S1.2.c  "Actual Stock"   stock.stockQty  layers                      29
│
│    └─ StockPieCard    S1.6  Card gap 12: overline "Stock split"
│         └─ row (gap 16, centred)
│              ├─ PieChart3D  width S1.pieWidth (S1.pieWidthXs at xs), tilt, depth;
│              │              slices Sold (accent) · Balance (textMuted), ≥ 0
│              └─ legend (flex 1): dot · label · value × 2, divider,
│                   "Actual Stock" · value, "Oversold by N" (error) if Balance < 0
│
└─ fab slot (phones)    S1.5  FAB "New invoice" → nav.openCreate()             81
```

## 4. The `S1` numbers

| Key | Value | ID | Means |
| --- | --- | --- | --- |
| `heroPadding` | 20 | S1.1 | the kit's hero card padding |
| `heroGap` | 6 | S1.1 | between the overline row and the figure |
| `tileGap` | 10 | S1.2 | inside a stat tile: chip · label · value |
| `tileLabelHeight` | 36 | S1.2 | two-line label floor, so the three values line up |
| `figureMinScale` | 0.6 | S1.1 / S1.2 | how far a figure may shrink to stay on one line |
| `pieWidth` | 128 | S1.6 | the 3D pie's width |
| `pieWidthXs` | 96 | S1.6 | under 360 dp, so the legend labels keep about 134 dp |
| `pieTilt` | 0.55 | S1.6 | top height / width |
| `pieDepth` | 16 | S1.6 | side wall height |
| `swatch` | 10 | S1.6 | legend colour dot |
| `readShare` | 0.9 | Main | content max width = max(720, 90 % of the window) |

## 5. Rows and columns

| Row | Function | Cells | Rule |
| --- | --- | --- | --- |
| S1.1 overline row | `HeroCard` | 2: overline · badge | space-between; the badge never wraps |
| S1.6 pie row | `StockPieCard` | 2: pie (fixed width) · legend (`flex: 1`) | plain row, never stacks; the pie shrinks to 96 at xs instead |
| S1.2 tiles | `StatTilesRow` | 3 equal (`flex: 1`) | **never stacks**: the kit's dashboard is 3-across at every width and each cell holds one figure (no label + value), so rule 3 holds down to 320 dp; the labels wrap to two lines instead. Not a `Columns` row for that reason |

## 6. State and actions (`useDashboard()`)

| Name | Does |
| --- | --- |
| `kpis` | `{ invoiceCount, billedPaise }` for the current FY, void excluded (`getKpis`) |
| `stock` | `{ stockQty, soldQty, avlQty }`: Σ stock, Σ sold (same `SOLD_SQL` as S5), avl = stock − sold (`getStockTotals`) |
| `load()` | runs both queries in parallel; reruns whenever `nav.refreshKey` changes (any save anywhere) |
| `tiles` | `STOCK_TILES` with the rounded figures filled in, in tile order |

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| the header caption ("FY … overview") | `fyLabel()`, line 45 |
| the title "Dashboard" | `Header`, line 90 |
| the hero overline or badge text | `HeroCard`, lines 120-123 |
| the hero figure size | `type.hero` in `src/ui/tokens.ts` (44) |
| the hero card's padding or inner gap | `S1.heroPadding`, `S1.heroGap` |
| a tile's label, icon or which number it shows | `STOCK_TILES`, lines 26-30 |
| tile order, or a fourth tile | add to `STOCK_TILES`; every tile shares the row (`flex: 1`); for four, consider `flexWrap: 'wrap'` + `minWidth` in `StatTilesRow` |
| the tile's inside (chip, label, gap) | `StatTile`, lines 147-158; `S1.tileGap`, `S1.tileLabelHeight` |
| how far a figure may shrink before it clips | `S1.figureMinScale` |
| gap between the card and the tiles / side padding | `layout.gap` (16), `layout.side` (20) in `DashboardMain` |
| the content's maximum width | `S1.readShare` |
| the FAB's text or action | `DashboardScreen`, line 81; its look is `FAB` (C9, `src/ui/components.tsx`) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## 8. Sizes

| Size | Layout | Last checked |
| --- | --- | --- |
| phone5 360 × 640 (5-inch) | Header, hero, three tiles (labels on two lines), FAB above the nav; about 200 dp of empty space below the tiles. | Prompt 65 |
| xs 320 · sm 360 · phone 411 | header, hero, three tiles (labels on two lines at 320), FAB above the floating nav | Prompt 44 (phones), Prompt 54 (phone, pixel-identical before / after) |
| phone landscape (lg) | same blocks beside the rail, no FAB, bottom = gesture inset + 16 | Prompt 44 |
| md 601 (8-inch portrait) | same blocks beside the rail, no FAB | Prompt 54 |
| lg 800 · xl 961 · xxl 1280 | same, content capped at 90 % of the window | Prompt 54 (lg), Prompt 30 (xl, xxl) |

Open findings (not applied): none.
