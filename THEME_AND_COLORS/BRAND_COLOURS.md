# Brand colours

These are the root colours in [`src/ui/tokens.ts`](../src/ui/tokens.ts) (`brand`, line 37). The light and dark themes are both built from them, so changing a value here recolours the whole app.

| Key | Colour | What it drives |
| --- | --- | --- |
| `navy` | `#0C476F` | header start (light), strong borders, header end (dark) |
| `navyDeep` | `#0A2236` | header start (dark) |
| `blue` | `#1F7FA6` | header end (light) |
| `primary` | `#00668B` | accent, buttons, focus and ripple (light) |
| `primaryDark` | `#7FCFF3` | the same roles in dark mode |
| `primaryDarkSoft`, `onPrimaryDark` | `#9BDCF0`, `#003549` | dark-mode deep accent and text on filled buttons |
| `container`, `onContainer`, `containerDark` | `#C4E7FF`, `#001E2C`, `#004C69` | light-blue containers and the "Issued" badge |

These are the readable versions of the JIAMETRIC brand colours. The original blue `#2596be` and cyan `#5bc1da` aren't readable enough as text, or with text on top of them, so they stay in a code comment for reference.

Backgrounds, greys, text, error red and the green/amber/grey status badges are set separately in each theme, so changing the brand colours won't shift them.

To rebrand, follow the steps in [THEME_AND_COLORS_TRACKING.md](THEME_AND_COLORS_TRACKING.md#how-to-rebrand).
