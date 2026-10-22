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

## Prompt 4 — Screen background and KPI cards (2026-10-22)

| Change | Light | Dark | Why |
| --- | --- | --- | --- |
| `bg` (every screen's background) | `#F2F7FB` → **`#E9F0F4`** | unchanged `#0C1520` | User spec. Light only: `#E9F0F4` as a dark-mode background would put light text on a light surface. |
| new role `kpiSurface` (Dashboard KPI tiles, S1.1; the only KPI cards in the app) | **`#FFFFFF`** | `#142233` (= the previous filled-card colour, so dark looks unchanged) | A dedicated role, so the other filled cards (Bill-to etc.) and `surfaceContainer` (nav bar, rail) keep their colour. |

Contrast on the new `bg` (WCAG AA needs 4.5:1 for text, 3:1 for outlines): text 13.99 · textMuted 5.61 · accent 5.57 · error 5.61 · outline 3.89. All pass.

Side effect: `surfaceContainer` `#EBF2F7` (bottom nav bar, rail, other filled cards) is now nearly the same as `bg` (1.02:1), so those surfaces barely stand out from the background.

## Prompt 5 — Background #F1F5F9; nav bar, rail and filled cards stand out (2026-10-22)

The user changed the screen background again mid-task, from `#E9F0F4` to **`#F1F5F9`**, which replaces Prompt 4's value. Light theme only; dark is unchanged.

| Surface | Before | Now (light) | vs bg | Lowest text contrast on it |
| --- | --- | --- | --- | --- |
| `bg` (screens) | `#E9F0F4` | **`#F1F5F9`** | — | textMuted 5.90 · outline 4.09 |
| `surfaceContainer`: filled cards (Bill-to, review, empty/ship cards), S4 phone total bar | `#EBF2F7` | **`#E2E8F0`** | 1.13 (was 1.03) | textMuted 5.24 · accent 5.20 · outline 3.63 |
| new `navSurface`: bottom nav bar, rail | `#EBF2F7` | **`#FFFFFF`** | 1.10, plus hairline | textMuted 6.46 |
| new `navBorder`: top edge of the nav bar, right edge of the rail | — | **`#DBE7EE`** (= `border`), 1dp | — | — |
| `kpiSurface` | `#FFFFFF` | unchanged | 1.10 | textMuted 6.46 |

Dark theme: `navSurface` `#142233` (= old surfaceContainer) and `navBorder` `transparent`, so it looks unchanged.

**Why:** a white nav bar with a hairline is the clearest separation that keeps the active-tab pill (`secondaryContainer` `#D3E5F2`) visible: 1.29:1 on white, but only 1.05:1 on a darker tint. Filled cards go a step darker (`#E2E8F0`, the slate pair of `#F1F5F9`), so they still read as tinted next to white outlined cards and KPI tiles.
**Rejected:** putting everything on one darker tint (nav pill would vanish); making filled cards white (they would look the same as outlined cards).

## Prompt 7 — FAB colour (2026-10-22)

| Role | Light | Dark | Contrast |
| --- | --- | --- | --- |
| `fab` (= `brand.action`) | `#25BDC3` | `#25BDC3` | — |
| `onFab` (= `brand.onAction`) | `#001E2C` | `#001E2C` | 7.48:1 on `#25BDC3` (white would be 2.30:1, failing AA) |

The same in both themes: the dark label works on the teal fill whatever the background. Used by the shared `FAB` (components.tsx); the rail's "+" still uses `primaryContainer`.

## Prompt 8 — Box shadows (2026-10-22)

`shadow` in tokens.ts (CSS box-shadow strings, drawn by React Native's `boxShadow`, which needs the New Architecture; this app has it on):

| Token | Value | Used on |
| --- | --- | --- |
| `shadow.primary` (`--primaryShadow`) | `0 4px 8px rgba(20, 71, 108, 0.15)` | Dashboard KPI cards (`elevation.card`); solid and tonal `Button`s at rest |
| `shadow.secondary` (`--secondaryShadow`) | `0 8px 16px rgba(20, 71, 108, 0.2)` | solid and tonal `Button`s while pressed; `FAB` and the rail "+" (`elevation.fab`, replacing Android `elevation: 6` / `3`) |

**Why this mapping:** primary is the resting depth; secondary is the "lifted" depth, used for press feedback and for the floating buttons, which sit above all content.
**Left flat:** outline and text (ghost) buttons, which have no fill to cast from, and disabled buttons. The Snackbar keeps Android `elevation: 6` (not a card or button).
**Dark theme:** the same navy shadow, which shows little on dark surfaces; that's accepted, since depth there comes from the tonal surfaces.

## Prompts 9–10 — Typography: Inter (2026-10-22)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| **Inter** for the app and the invoice PDF | A UI typeface built for screens, with tabular figures (`tnum`) for amounts and a ₹ glyph. One family across app and print keeps invoices on-brand. SIL OFL, so bundling is allowed. | **Roboto** (the previous system default): no change in look, nothing gained. **IBM Plex Sans + Plex Mono**: two families to load. **Courier/monospace** for the PDF: Android has no Courier New, so PDFs were printing in Cutive Mono / Roboto anyway (seen via `pdffonts`). |
| App: `@expo-google-fonts/inter` + `useFonts` at runtime, weights 400/500/600/700, imported per subpath | Works in the dev client, release and web with no `expo prebuild`; subpath imports bundle 4 TTFs (~1.4 MB) instead of all 18. | The expo-font config plugin (build-time embedding): would need `prebuild`, which wipes the 3 local `android/` edits. |
| One family name per weight (`font.*`), with no `fontWeight` in `type` | Android can fake-bold a single-weight custom family when `fontWeight` is set; naming the weight file is exact. The 2 inline `fontWeight: '700'` uses became `font.bold`. | — |
| Tracking tightened (e.g. body 0.5 → 0.1) | M3's letter-spacing was tuned for Roboto and looks loose in Inter. | Keeping the M3 values. |
| PDF: base64 WOFF2 **subset** (Latin-1 + dashes/quotes + ₹ + minus), 400 + 700, ~31 KB in total, generated by `scripts/build-pdf-fonts.py` | Full TTFs would add ~900 KB of base64 to HTML that the Create invoice live preview re-renders on every keystroke. Data URIs work in the print WebView, the preview WebView and the web tier alike. | Reading TTFs at runtime with expo-asset: async I/O inside a sync template, and a new dependency. `file://` font URLs: not tried; they would depend on the WebView's file-access settings and wouldn't work on the web tier. |
| Font stack `'Inter', 'Roboto', sans-serif` | Characters outside the subset (e.g. Tamil party names) fall back per character instead of showing boxes. | — |
| Start-up screen uses the system font until Inter loads; a font load error doesn't block the app | No "font not loaded" warnings, and no lock-out if a font asset fails. | — |

## Prompt 11 — Bebas Neue for numbers (2026-10-22)

User spec: regular text in Inter, numbers in **Bebas Neue** (SIL OFL 1.1, `@expo-google-fonts/bebas-neue`, one weight, 400).

Font check (fonttools): it has ₹, `%`, `×`, `−`; every digit is 400 units wide, so figures line up in columns without extra settings; its letter height is 0.70 of the font size against Inter's 0.73, so the same sizes sit well together.

| Where | Style |
| --- | --- |
| Amounts and quantities (MoneyText, TotalRow values, invoice item table, Products table and price) | `type.number`: Bebas Neue 16, tracking 0.5 |
| KPI values, Create invoice TOTAL bar | new `type.figure`: Bebas Neue 26/32 (was Inter SemiBold 22) |
| **Number input fields** (qty, rate, amounts, dates) | new `type.numberField`: Inter Medium, tabular. Kept in Inter on purpose, so typed values are easy to check; switch `Input` to `type.number` to change that |
| Strong amounts (e.g. Total) | Bebas has one weight, so it's set larger (20, or 18 small) in `accentDeep` instead of bold |
| PDF `td.n` (QTY, RATE, AMOUNT) and `.tot td.v` (totals) | Bebas Neue 11.5px, letter-spacing 0.4px; a 4 KB digits subset in `PDF_FONT_CSS` (renamed from `INTER_PDF_FONT_CSS`) |

Labels that contain numbers ("Avl 8" badges, "Items (3)", "PRE-001", dates in subtitles) stay in Inter: they're text with numbers, not figures. The PDF TOTAL row asks for weight 700, which Bebas lacks. pdffonts also lists a second (Type 3) copy of Bebas, probably the PDF engine's synthesized bold for that row; on the rendered page the total looks only slightly heavier.

## Prompt 12 — Flat Glass · Brand Blue design kit (2026-10-22)

The owner supplied a design kit (CLAUDE.md, DESIGN.md spec, apply-design skill, 4 reference screens with HTML). It **replaces** the palette and shadows of Prompts 1–8 and the background of Prompts 4–6. Prompt 11's Bebas Neue numbers stay, by the owner's choice.

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| `brand` = the kit's 5 colours (+ link `#1a6f8e`); every role is one of them or a §2.2 variant | Kit rule 1, "only these five tokens" | Keeping the AA-tuned navy palette: rejected, the kit is explicit |
| Light: `#ebeaea` flat background, white glass cards (55%, 85% border), black / `#666` text | Kit §7.1–7.3 | — |
| Dark (phone in dark mode): the Sign In recipe (black, 8% glass, 16% border, `#ebeaea` secondary text, inner highlight) | Owner chose "Follow the phone" | "Always light" |
| Blue buttons: `#2596be` + white 16/600 | Owner chose "Exactly as the screens". The kit notes 3.4:1 < AA for small labels (§9) | The kit's `#1a6f8e` fill; black labels |
| Numbers stay in Bebas Neue (`type.number` / `figure` / `hero`) | Owner chose "Keep Bebas Neue" (kit says Inter 300) | Inter 300 per the kit |
| Inter weights now 300/400/500/600; 700 removed (`Inter_300Light` added, `Inter_700Bold` dropped) | Kit rule 5 | — |
| Real-status green/red kept (Paid, in-stock, oversold, errors, Void/Delete) | DESIGN.md §11 allows it | All-blue statuses: would lose meaning |
| Shadows per kit: primary on small items (icon buttons, tiles, chips, tabs, search), secondary on large (cards, nav, primary buttons, FAB, sheets, snackbar) | Kit rule 2 / §2.3 | Prompt 8's mapping (tiles primary, buttons primary→secondary on press): superseded |
| No backdrop blur | React Native can't blur what's behind a view without expo-blur (a native module and a dev-client rebuild); the kit says the blur "has very little to show" on flat backgrounds | Adding expo-blur: deferred |
| Solid white (black) sheets instead of glass | Glass over the dark scrim reads grey | Glass sheets |
| Inactive chips use the input border (`#666` at 35%) | A 90% white border vanishes on the white sheet | Kit white border |

**Theme roles added:** `glass`, `glassStrong`, `glassNav`, `glassBorder`, `glassBorderStrong`, `cardShadow`, `tileShadow`, `primaryTint`, `primaryFill`, `focusRing`, `link`, `inputFill`, `inputBorder`, `divider`, `sheet`.
**Theme roles removed:** `headerFrom`, `headerTo`, `onHeader`, `onHeaderMuted` (no gradient header any more).
**Not changed:** the PDF (D1) keeps its black-on-white print styling; it's a document, not a screen.

## Prompt 13 — Tighter corner radii (2026-10-22)

The owner set new `radius` values, replacing the kit's (DESIGN.md §4). The change is recorded as an exception in `CLAUDE.md`.

| Token | Kit | Now | Used on |
| --- | --- | --- | --- |
| `chip` | 12 | **10** | icon chips, ghost icon buttons |
| `control` | 14 | **12** | buttons, glass icon buttons, inputs, search, FAB, snackbar |
| `item` | 16 | **14** | active nav / rail item |
| `bar` | 20 | **16** | info bar, logo (not used yet) |
| `card` | 24 | **16** | glass cards, list cards, bottom nav, TOTAL bar, sheet top corners, preview frame |
| `form` | 28 | **18** | tablet dialogs |
| `frame` | 32 | **16** | album-style frames (not used yet) |
| `pill` | 999 | 999 | unchanged |

Circles (avatars 36 → radius 18, stepper 28 → 14) are not tokens and are unchanged.

## How to rebrand

1. Edit `brand` in `src/ui/tokens.ts`.
2. Check contrast: primary on white ≥ 4.5:1, white on primary ≥ 4.5:1, primaryDark on the dark surfaces (`#101C2B`, `#0C1520`) ≥ 4.5:1, onPrimaryDark on primaryDark ≥ 4.5:1, onContainer on container ≥ 4.5:1.
3. Reload the app (Metro) in both light and dark system themes.
