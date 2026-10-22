# Brand colours

The app follows the **Flat Glass · Brand Blue** design kit (`design/DESIGN.md`, rules in `CLAUDE.md`). Its five colours are the root set in [`src/ui/tokens.ts`](../src/ui/tokens.ts) (`brand`, line 14). Every theme value is one of them or a see-through variant of one, so changing a value here recolours the whole app.

| Key | Colour | What it drives |
| --- | --- | --- |
| `primary` | `#2596be` | primary buttons, FAB, active nav item and tab, selected states, icons, data, progress |
| `secondary` | `#666666` | secondary text (captions, labels, overlines), inactive icons |
| `tertiary` | `#ebeaea` | light screen background, dividers, grey avatars; secondary text on dark screens |
| `dark` | `#000000` | main text on light screens; dark-mode background |
| `light` | `#ffffff` | text and icons on blue; text on dark screens; the glass fill (at 55–65%) |
| `link` | `#1a6f8e` | text links on light screens (the kit's darker blue, for contrast) |

**See-through variants** (DESIGN.md §2.2):
- blue tint at 14% (icon chips, badges, selected rows);
- white glass at 55 / 60 / 65% (cards / icon buttons / nav) with 85 / 90% white borders;
- dark glass at 8% with 16% borders;
- the focus ring at 35% blue.

**Shadows:** only the kit's two, `0 4px 8px rgba(20,71,108,0.15)` and `0 8px 16px rgba(20,71,108,0.2)`.

**Real status colours** (allowed by DESIGN.md §11, "green/red only for real status"): green for Paid and in-stock badges, red for errors, oversold stock and Void/Delete actions.

**Owner's exceptions to the kit** (also in `CLAUDE.md`):
- Numbers use Bebas Neue.
- Blue buttons keep white text, as in the reference screens, although small labels are below AA (DESIGN.md §9).

The earlier JIAMETRIC palette (navy `#0C476F`, `#00668B`, `#7FCFF3`, the FAB teal `#25BDC3`, the `#F1F5F9` background) was replaced by this kit on 2026-10-22; see the tracking file, Prompt 12.

To rebrand, follow the steps in [THEME_AND_COLORS_TRACKING.md](THEME_AND_COLORS_TRACKING.md#how-to-rebrand).
