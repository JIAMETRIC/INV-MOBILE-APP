# THEME_AND_COLORS — Tracking

## Rationale

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| A `brand` object of 10 **AA-tuned** root colours in `src/ui/tokens.ts`; `light`/`dark` reference it | One place to rebrand. Each root already passes WCAG AA in the role it fills, so swapping a value stays predictable. | **One seed colour with generated tonal palettes** (e.g. Material colour utilities): rejected for now. It adds a dependency and replaces hand-tuned shades whose AA ratios were measured (MOBILE_APP_CONVERSION_TRACKING.md, Prompt 21). It could still be added later. **Raw brand hexes (#2596be, #5bc1da) as roots**: rejected, both fail AA as text or fills under text. |
| Neutrals (bg, surfaces, borders, text), error and success/warning/neutral tones stay as literals per theme | They aren't brand colours; tying them to `brand` would make a rebrand shift greys and status colours unexpectedly. | Deriving neutrals as tints of navy: possible later, but needs contrast re-checks. |
| New theme roles `onError`, `inverseSurface`, `inverseOnSurface`, `inversePrimary`, `onHeaderMuted`, `paper` | These replace the last hard-coded colours (danger button text, Snackbar, app-bar subtitle, invoice preview). The names follow Material 3 roles. | Separate `snackbar.*` keys: rejected, M3 already names these inverse roles. |
| `paper` is white in both themes | It is the printed invoice; the PDF (D1) is black on white whatever the app theme. | Theming the preview dark: rejected, the preview must match the print. |
| `alpha(hex, a)` helper | Ripples follow the brand primary instead of copying its RGB into an rgba string. | — |

## Spec (2026-10-22)

`brand` (tokens.ts:37):

| Key | Hex | Used for |
| --- | --- | --- |
| navy | `#0C476F` | light: headerFrom, borderStrong, accentDeep · dark: headerTo |
| navyDeep | `#0A2236` | dark: headerFrom |
| blue | `#1F7FA6` | light: headerTo |
| primary | `#00668B` | light: accent, fillStrong, focus, ripple (14%) · dark: inversePrimary |
| primaryDark | `#7FCFF3` | dark: accent, fillStrong, focus, borderStrong, ripple (16%) · light: inversePrimary |
| primaryDarkSoft | `#9BDCF0` | dark: accentDeep |
| onPrimaryDark | `#003549` | dark: onFillStrong |
| container | `#C4E7FF` | light: primaryContainer, info badge bg · dark: onPrimaryContainer, info badge fg |
| onContainer | `#001E2C` | light: onPrimaryContainer, info badge fg |
| containerDark | `#004C69` | dark: primaryContainer, info badge bg |

New roles:

| Role | Light | Dark | Replaces |
| --- | --- | --- | --- |
| onError | `#FFFFFF` | `#690005` | components.tsx Button danger text |
| inverseSurface | `#26343E` | `#DCE7F0` | Snackbar bg |
| inverseOnSurface | `#EEF4F8` | `#10232F` | Snackbar text |
| inversePrimary | `#7FCFF3` | `#00668B` | Snackbar action |
| onHeaderMuted | `rgba(255,255,255,0.85)` | same | TopAppBar subtitle (2 places) |
| paper | `#FFFFFF` | `#FFFFFF` | CreateInvoiceScreen preview box + WebView |

Still outside tokens (left on purpose): `app.config.ts` adaptive-icon background `#FFFFFF`, a build-time Android asset setting. `pdfTemplate.ts` uses the `gray` scale from tokens.ts.

## How to rebrand

1. Edit `brand` in `src/ui/tokens.ts`.
2. Check contrast: primary on white ≥ 4.5:1, white on primary ≥ 4.5:1, primaryDark on the dark surfaces (`#101C2B`, `#0C1520`) ≥ 4.5:1, onPrimaryDark on primaryDark ≥ 4.5:1, onContainer on container ≥ 4.5:1.
3. Reload the app (Metro) in both light and dark system themes.
