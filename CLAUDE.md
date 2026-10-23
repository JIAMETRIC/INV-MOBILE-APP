# Project design rules

This app uses the **Flat Glass · Brand Blue** design system. Every screen and component you build or change in this project must follow it exactly.

- **Full spec (read before any UI work):** @design/DESIGN.md
- **Reference screens:** `design/screens/` has a PNG to look at and an HTML file to read exact values from:
  - `01-weather` · `02-dashboard` · `03-music-player` · `04-sign-in` (dark)
- **Workflow and documentation rules:** @AGENTS.md (topic folders, prompt logs, README). They apply to every session.

## Non-negotiables

1. **Colours: only these five tokens** (plus the see-through variants defined in DESIGN.md §2.2):
   - `primaryColor #2596be`: primary buttons, active and selected states, icons, charts, progress
   - `secondaryColor #666666`: secondary text and inactive icons
   - `tertiaryColor #ebeaea`: background of light screens, dividers, empty tracks
   - `darkColor #000000`: main text (light screens); background of dark screens
   - `lightColor #ffffff`: text on blue and on dark screens; glass fill
2. **Shadows: only these two**, both tinted blue:
   - `shadow.primary = 0 4px 8px rgba(20,71,108,0.15)` for small items (icon buttons, tiles, chips, tabs)
   - `shadow.secondary = 0 8px 16px rgba(20,71,108,0.20)` for large items (cards, bottom nav, big primary buttons)
3. **No gradients.** Each screen background is one flat colour. No colour blobs, gradient fills or background images.
4. **Glass cards:** white at 55% opacity, 1px white border at 85%, `blur(20px) saturate(160%)`, radius 24.
5. **Font: Inter** in weights 300, 400, 500 and 600 only (never 700+). Big numbers use 300; headings use 600.
6. **Corner radii:** 14 for buttons and inputs, 24 for cards and nav, 999 for pills, 50% for avatars and round media buttons.
7. **Touch targets** are at least 44×44. Icon-only buttons need an accessibility label.
8. **Icons:** line style (Lucide/Feather), stroke 1.8, round caps. Media controls are filled.

## Project exceptions (decided by the owner, 2026-10-22)

These override the rules above for this app only. Don't "fix" them back.

- **Numbers use Bebas Neue** (`font.numeric` in `src/ui/tokens.ts`): amounts, quantities, KPI values and the PDF number columns. All other text is Inter 300–600.
- **Blue buttons keep white text** on `#2596be`, exactly as in the reference screens, even though small labels are below WCAG AA (DESIGN.md §9).
- **Real status colours** (paid = green, error/oversold/void = red) are allowed alongside the five tokens, as DESIGN.md §11 permits ("green/red only for real status").
- **No backdrop blur** on Android: the glass fills and borders are exact, but React Native can't blur what's behind a view without a new native module (expo-blur) and a dev-client rebuild.
- **Dark mode follows the phone**, using the Sign In screen's dark-glass recipe.
- **Tighter corner radii** than rule 6 (`radius` in `src/ui/tokens.ts`): chip 10 · buttons, inputs and icon buttons 12 · active nav item 14 · info bar 16 · **cards and nav 16** · dialogs 18 · frames 16 · pills 999.

## How to work

- Put the tokens in **one theme file** (colours, shadows, radii, type scale) and reference them everywhere. Never hard-code hex values in components. Here that file is `src/ui/tokens.ts`.
- Build the reusable pieces first (GlassCard, IconButton, PrimaryButton, SegmentedControl, ListRow, BottomNav, Badge, ProgressBar), then compose screens from them. They live in `src/ui/`.
- When asked to restyle or build a screen, match the closest reference screen's layout, spacing and hierarchy.
- When unsure about a value, look it up in `design/DESIGN.md` or the reference HTML. Don't guess.
- After a UI change, compare the result to the reference PNG and list any differences.
- **Screen code is organised with the Three-Slot Screen method** (`/three-slot-screen`, `.claude/skills/three-slot-screen/SKILL.md`): Header / Main / Footer, rows and columns inside Main, one named function per region in on-screen order, a state hook, and an `S<n>` block for the screen's numbers. S2 Invoices is the finished example; each screen's tree file is in `SCREEN_CODE_STRUCTURE/`.
