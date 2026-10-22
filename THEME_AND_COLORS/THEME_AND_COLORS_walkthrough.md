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

## Prompt 7 — FAB colour #25BDC3 (2026-10-22, session 13)

Added `brand.action` / `brand.onAction` and theme roles `fab` / `onFab`; `FAB` uses them. Contrast check: white 2.30, `#0C476F` 4.26, `#003549` 5.70, `#001E2C` 7.48 on `#25BDC3`, so `#001E2C` was chosen. Verified on the emulator (pixel `#25BDC3`, dark label). Size and layout changes are logged in SCREEN_LAYOUT_REFERENCE (Prompt 3).

## Prompt 8 — Box shadows for KPI cards and buttons (2026-10-22, session 13)

**Diffs:** `tokens.ts` gains `shadow.primary/secondary` and `elevation.card`, and `elevation.fab` becomes `{ boxShadow: shadow.secondary }`. `components.tsx` Button: `raised` (solid or tonal, not disabled) → `boxShadow: pressed ? secondary : primary`. `DashboardScreen.tsx` KpiTile: `...elevation.card`. `Nav.tsx` rail "+": `elevation: 3` → `...elevation.fab`.

**Verification:** `tsc --noEmit` OK. Emulator pixel columns under each element (bg `#F1F5F9`):

| Element | Pixels below the edge (4-6 px steps) |
| --- | --- |
| KPI card | `#D6E0E8 → #E5EBF0` (shadow fading out) |
| FAB | `#CDD9E3 → #DCE4EC` (deeper, secondary) |
| Share PDF at rest | `#D6E0E8 → #F1F5F9` within about 36 px |
| Share PDF pressed (`input motionevent DOWN`, then `CANCEL`, so nothing was shared) | `#CCD8E2 → #E8EDF3` (darker and longer) |

The button's `overflow: hidden` (kept for the ripple) does not clip the shadow.

## Prompt 9 — What fonts are used (2026-10-22, session 13)

Answered in chat: there were no custom fonts. Screens used Roboto (the Android system font); the PDF asked for Courier New with a monospace fallback; Ionicons for icons; `type.code` was unused.

## Prompt 10 — Inter for the app and the PDF (2026-10-22, session 13)

**Diffs**

- `package.json`: `@expo-google-fonts/inter` ^0.4.2 (`npx expo install`).
- `src/shell/App.tsx`: `useFonts` (4 subpath imports); the loading screen waits for fonts (or a font error) and uses the system font meanwhile.
- `src/ui/tokens.ts`: `font` map; `type.*` use `fontFamily`, with no `fontWeight`, and tighter tracking.
- `src/ui/components.tsx` (MoneyText strong) and `src/ui/Nav.tsx` (active tab label): `fontWeight: '700'` → `fontFamily: font.bold`.
- `scripts/build-pdf-fonts.py` (new) generates `src/export/pdfFonts.ts` (new, 42 KB): two `@font-face` rules with WOFF2 data URIs (400: 15 KB, 700: 16 KB).
- `src/export/pdfTemplate.ts`: injects `INTER_PDF_FONT_CSS`; body font `'Inter', 'Roboto', sans-serif`, line-height 1.35 → 1.4.
- `src/export/pdf.ts`: **bug fix found while verifying.** A second "Share PDF" for the same invoice failed with "FileSystemFile.moveSync … Destination already exists"; it now deletes the old `<no>.pdf` before moving.

**Verification**

- `tsc --noEmit` OK; `test:integration`, `test:money`, `test:xlsx` all pass.
- fonttools: Inter has U+20B9 (₹) and the `tnum` feature.
- Emulator (Metro `--clear`): Dashboard renders in Inter (flagged "1", ₹ glyph), with no font warnings in logcat.
- PDF: "Share PDF" on PRE-001 → file replaced (19:37, 13 KB, previously 75 KB). `pdffonts` shows `Inter-Bold` + `Inter-Regular` (CID TrueType, embedded subset); the old file showed `CutiveMono-Regular` + `Roboto-Regular`. Rendered with `pdftoppm`: Inter throughout, ₹ in "TOTAL (₹)", bold headings and total; "Amount in words" italic is a synthesized oblique (no italic face embedded).
