# THEME_AND_COLORS — Walkthrough

## Prompt 1 — Show the colours (2026-10-22, session 13)

Answered in chat with a swatch widget of every theme token (light and dark) plus the colours hard-coded outside `tokens.ts`. Finding: no root colour existed; each role was a separate hex in `light` and `dark`.

## Prompt 2 — Root brand set + move hard-coded colours (2026-10-22, session 13)

**Diffs**

- `src/ui/tokens.ts`: added `brand` (10 roots), `white`, `alpha()`; the `Theme` type gains `onError`, `inverseSurface`, `inverseOnSurface`, `inversePrimary`, `onHeaderMuted`, `paper`; `light`/`dark` now reference `brand.*` for every brand-derived role.
- `src/ui/components.tsx`: Button danger text → `theme.onError`; TopAppBar subtitles → `theme.onHeaderMuted`.
- `src/ui/Snackbar.tsx`: bg/fg/action → `theme.inverseSurface` / `inverseOnSurface` / `inversePrimary`.
- `src/features/invoices/CreateInvoiceScreen.tsx`: preview box + WebView background → `theme.paper`.

**Verification**

- Value snapshot: a Node script (TypeScript `transpileModule` with `react-native` stubbed) dumped `light`/`dark` before and after. Result: **all existing values identical**. The new roles equal the literals they replaced.
- `grep` for `#rrggbb` / `rgba(` in `src/` outside tokens.ts: none.
- `npm run typecheck`: clean.
- Emulator: Metro restarted with `--clear`, fresh bundle (910 modules); the Invoices tab renders exactly as before (header gradient, chips, Issued badge, FAB, nav bar).

## Prompt 3 — Brand colours as a Markdown file (2026-10-22, session 13)

Wrote `THEME_AND_COLORS/BRAND_COLOURS.md`: the `brand` table (key, colour, what it drives) from the Prompt 2 summary, plus notes on the source brand hexes and a link to the rebrand steps. Values checked against `src/ui/tokens.ts`. No code changed.

## Prompt 4 — Screen background #e9f0f4, KPI cards #ffffff (2026-10-22, session 13)

**Diffs**

- `src/ui/tokens.ts`: light `bg` `#F2F7FB` → `#E9F0F4`; `Theme` + `kpiSurface`; light `kpiSurface: white`, dark `kpiSurface: '#142233'`.
- `src/features/dashboard/DashboardScreen.tsx`: KPI `Card` style adds `backgroundColor: theme.kpiSurface`.

**Verification**

- Contrast script: all text roles ≥ 5.5:1 on the new bg, outline 3.89:1 (see tracking).
- `npm run typecheck`: clean.
- Emulator (Metro restarted, fresh bundle): Dashboard screenshot pixels read back as screen bg `#E9F0F4`, KPI card `#FFFFFF`, bottom nav `#EBF2F7` (unchanged, now close to bg).

## Prompt 5 — Nav bar, rail and filled cards stand out; background #F1F5F9 (2026-10-22, session 13)

The user sent "Background of every screen: #f1f5f9" mid-task, so the colours were picked against `#F1F5F9`.

**Diffs**

- `src/ui/tokens.ts`: light `bg` → `#F1F5F9`, `surfaceContainer` → `#E2E8F0`; new roles `navSurface` (light white / dark `#142233`) and `navBorder` (light `#DBE7EE` / dark `transparent`).
- `src/ui/Nav.tsx`: BottomTabs → `navSurface` + 1dp top border; Rail → `navSurface` + 1dp right border.

**Verification**

- Contrast script on candidates (`#FFFFFF`, `#E2E8F0`, `#E3EAF0`, `#DCE5EC`): chose `#E2E8F0` (all text ≥ 5.20, outline 3.63).
- `tsc --noEmit`: exit 0.
- Emulator, fresh bundle. Dashboard pixels: bg `#F1F5F9`, KPI `#FFFFFF`, nav bar `#FFFFFF`, nav top border `#DBE7EE` (rows 2124-2125 = 1dp). Invoice detail: the Bill-to card is visibly tinted against the bg.
