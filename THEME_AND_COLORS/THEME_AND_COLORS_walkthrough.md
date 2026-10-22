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
