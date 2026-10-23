# What's inside DashboardScreen (S1, Home tab)

File: `src/features/dashboard/DashboardScreen.tsx` (159 lines). Line numbers as of 2026-10-23 (Prompt 54, Three-Slot Screen).
Opened by the Home tab (S0.4.1); it is the first screen after start-up.
Data: `getKpis()` in `src/data/dashboardRepo.ts:15` · `getStockTotals()` in `src/data/productsRepo.ts:40`.
IDs (S1.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`. S1.3 and S1.4 are retired (removed 2026-10-22).

## How the file reads (top to bottom)

| Block | Line | What it is |
| --- | --- | --- |
| `STOCK_TILES` | 26 | the three tiles: label · icon · which stock figure (S1.2.a–c) |
| `S1` | 34 | every number specific to this screen (hero padding and gap, tile gap, label height, figure min scale, read-width share) |
| `fyLabel(d)` | 45 | "FY 2026–27 overview": the April–March year that contains today |
| `useDashboard()` | 53 | all state and data, no JSX: `kpis`, `stock`, `load()`, the `tiles` list |
| `DashboardScreen()` | 73 | the screen: `<Screen header={Header} fab={FAB on phones}>` around `DashboardMain` |
| `Header` | 89 | S1.0 |
| `DashboardMain` | 98 | the one scroller: `HeroCard`, `StatTilesRow` |
| `HeroCard` | 115 | S1.1 |
| `StatTilesRow` | 134 | S1.2 row |
| `StatTile` | 147 | S1.2 tile |

```
DashboardScreen()                                                    line 73
│
├─ Header              S1.0  TopAppBar large: caption fyLabel() above        89
│                            the H2 "Dashboard"; no action buttons
│
├─ DashboardMain             ScrollView: side 20, gap 16, bottom =           98
│    │                       useMainInset() (clears nav + FAB);
│    │                       maxWidth max(720, S1.readShare × window)
│    │
│    ├─ HeroCard       S1.1  Card, padding S1.heroPadding, gap S1.heroGap   115
│    │    ├─ row (space-between)
│    │    │    ├─ overline "Total billed · FY"                               120
│    │    │    └─ Badge "N invoice(s)"  (kpis.invoiceCount, this FY)        121
│    │    └─ ₹ kpis.billedPaise   type.hero (Bebas 44), shrinks to          126
│    │                            S1.figureMinScale
│    │
│    └─ StatTilesRow   S1.2  one row, 3 cells flex 1, gap 12 (never stacks) 134
│         └─ StatTile × 3  (d.tiles, from STOCK_TILES)                     147
│              ├─ IconChip  36×36 blue tint, blue icon 18                   150
│              ├─ label     13 #666, 2 lines, minHeight S1.tileLabelHeight  151
│              └─ value     type.figure (Bebas 28), shrinks to fit          154
│
│         S1.2.a  "Products Sold"  stock.soldQty   shopping-cart             27
│         S1.2.b  "Balance Stock"  stock.avlQty    box                       28
│         S1.2.c  "Actual Stock"   stock.stockQty  layers                    29
│
└─ FAB (Screen slot)   S1.5  "+ New invoice", phones only → nav.openCreate() 81
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `fyLabel(d)` | 45 | "FY 2026–27 overview": the April–March year that contains today |
| `useDashboard()` | 53 | holds `kpis` and `stock`; `load()` (line 58) runs `getKpis()` and `getStockTotals()` in parallel and reruns whenever `nav.refreshKey` changes (any save anywhere); returns `{ kpis, tiles }` where `tiles` is `STOCK_TILES` with the rounded figures filled in |
| `DashboardScreen()` | 73 | the screen on the `Screen` scaffold (C16): header slot, FAB slot on phones, `DashboardMain` as Main |
| `Header` | 89 | S1.0 |
| `DashboardMain` | 98 | the one scroller; its bottom padding comes from `useMainInset()` |
| `HeroCard` | 115 | S1.1 |
| `StatTilesRow` | 134 | S1.2: the row of three equal columns |
| `StatTile({kpi, theme})` | 147 | one kit stat tile: small glass card (`Card small`), icon chip, label, figure |
| `getKpis()` | dashboardRepo.ts:15 | invoice count and Σ total for the current FY, excluding void |
| `getStockTotals()` | productsRepo.ts:40 | Σ `stock_qty`, Σ sold (same `SOLD_SQL` as the Products screen), avl = stock − sold |

## Where to change what

| You want to change | Go to |
| --- | --- |
| the header caption ("FY … overview") | `fyLabel()`, line 45 |
| the title "Dashboard" | `Header`, line 90 |
| the hero card's overline or badge text | `HeroCard`, lines 120-123 |
| the hero figure size | `type.hero` in `src/ui/tokens.ts` (44) |
| the hero card's padding or inner gap | `S1.heroPadding`, `S1.heroGap` |
| a tile's label, icon or which number it shows | `STOCK_TILES`, lines 26-30 |
| tile order, or add a fourth tile | add to `STOCK_TILES`; every tile shares the row's width (`flex: 1`) |
| tiles in a 2-column grid instead of 3 across | `StatTilesRow`: add `flexWrap: 'wrap'` and give each cell `minWidth` |
| the tile's inside (chip, label size, gap) | `StatTile`, lines 147-158; `S1.tileGap`, `S1.tileLabelHeight` |
| how far a figure may shrink before it clips | `S1.figureMinScale` |
| gap between the card and the tiles | `gap: layout.gap` (16) in `DashboardMain` |
| screen side padding | `layout.side` (20) in `DashboardMain` |
| the content's maximum width | `S1.readShare` (90 % of the window, never under 720) |
| the FAB's text or action | `DashboardScreen`, line 81; its look is the shared `FAB` (C9, `src/ui/components.tsx`) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## Tablet (md+)

Same blocks, no branch in the layout: only the FAB disappears (`bp.isPhone`, line 81) because the rail's "+" takes its place, and the bottom padding drops to the gesture inset (`useMainInset()` without a FAB).

## Three-Slot restructure (Prompt 54, 2026-10-23)

108 → 159 lines: the inline numbers moved into `S1`, the three tiles into `STOCK_TILES`, the two `useState` + `load` into `useDashboard()`, and the hero card and tiles row became `HeroCard` / `StatTilesRow`. Phone screenshot before / after: 0.000 % differing pixels. lg (10-inch portrait) read from the size check: same blocks full width beside the rail, no FAB.
