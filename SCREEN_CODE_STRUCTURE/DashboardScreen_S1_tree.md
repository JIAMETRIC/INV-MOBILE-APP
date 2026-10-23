# What's inside DashboardScreen (S1, Home tab)

File: `src/features/dashboard/DashboardScreen.tsx` (96 lines). Line numbers as of 2026-10-23.
Opened by the Home tab (S0.4.1); it is the first screen after start-up.
Data: `getKpis()` in `src/data/dashboardRepo.ts:15` · `getStockTotals()` in `src/data/productsRepo.ts:40`.
IDs (S1.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`. S1.3 and S1.4 are retired (removed 2026-10-22).

```
DashboardScreen()                                                    line 38
│
├─ TopAppBar large     S1.0  caption "FY 2026–27 overview" (fyLabel) above     64
│                            the H2 "Dashboard"; no action buttons
│
├─ ScrollView                side padding 20, gap 16, bottom = useContentInset  65
│    │                       (clears the nav + FAB); maxWidth max(720, 90 %)
│    │
│    ├─ Card hero      S1.1  padding 20, gap 6                                  72
│    │    ├─ row (space-between)                                               73
│    │    │    ├─ overline "Total billed · FY"                                 74
│    │    │    └─ Badge "N invoice(s)"  (kpis.invoiceCount, this FY)           75
│    │    └─ ₹ kpis.billedPaise   type.hero (Bebas 44), shrinks to fit         80
│    │
│    └─ row            S1.2  3 cells, flex 1 each, gap 12                       85
│         └─ StatTile × 3  (stockTiles, line 56)                               24
│              ├─ IconChip  36×36 blue tint, blue icon 18                      27
│              ├─ label     13 #666, 2 lines, min height 36 (so values align)  28
│              └─ value     type.figure (Bebas 28), shrinks to fit             31
│
│         S1.2.a  "Products Sold"  stock.soldQty   shopping-cart               57
│         S1.2.b  "Balance Stock"  stock.avlQty    box                         58
│         S1.2.c  "Actual Stock"   stock.stockQty  layers                      59
│
└─ FAB                 S1.5  "+ New invoice", phones only → nav.openCreate()   93
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `fyLabel(d)` | 18 | "FY 2026–27 overview": the April–March year that contains today |
| `StatTile({kpi, theme})` | 24 | one kit stat tile: small glass card (`Card small`), icon chip, label, figure |
| `load()` | 46 | runs `getKpis()` and `getStockTotals()` in parallel; reruns whenever `nav.refreshKey` changes (any save anywhere) |
| `qty(n)` | 55 | rounds a stock number for display |
| `stockTiles` | 56 | the three tile definitions: label · value · icon |
| `getKpis()` | dashboardRepo.ts:15 | invoice count and Σ total for the current FY, excluding void |
| `getStockTotals()` | productsRepo.ts:40 | Σ `stock_qty`, Σ sold (same `SOLD_SQL` as the Products screen), avl = stock − sold |

## Where to change what

| You want to change | Go to |
| --- | --- |
| the header caption ("FY … overview") | `fyLabel()`, line 18 |
| the title "Dashboard" | line 64 |
| the hero card's overline or badge text | lines 74-78 |
| the hero figure size | `type.hero` in `src/ui/tokens.ts` (44) |
| a tile's label, icon or which number it shows | `stockTiles`, lines 56-60 |
| tile order, or add a fourth tile | add to `stockTiles`; every tile shares the row's width (`flex: 1`) |
| tiles in a 2-column grid instead of 3 across | the row at line 85: add `flexWrap: 'wrap'` and give each cell `minWidth` |
| the tile's inside (chip, label size, gap) | `StatTile`, lines 24-36 |
| gap between the card and the tiles | `gap: layout.gap` (16) at line 67 |
| screen side padding | `layout.side` (20) at line 67 |
| the FAB's text or action | line 93; its look is the shared `FAB` (C9, `src/ui/components.tsx:586`) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## Tablet (md+)

Same blocks, no branch in the layout: only the FAB disappears (`bp.isPhone`, line 93) because the rail's "+" takes its place, and the bottom padding drops to the gesture inset (`useContentInset(false)`, line 42).

## On the Screen scaffold (Prompt 47, 2026-10-23)

`DashboardScreen()` (line 38) now returns `<Screen header={TopAppBar} fab={FAB on phones}>` with `DashboardMain` (line 73) as Main: the scrolling body (hero card, stat tiles) whose bottom padding is `useMainInset()`. `useContentInset` is gone. Phone screenshot before / after: pixel-identical. The full Three-Slot restructure (numbers block, state hook) is still to come.
