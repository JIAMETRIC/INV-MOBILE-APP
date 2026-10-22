---
name: apply-design
description: Apply the Flat Glass · Brand Blue design system to a mobile screen, component or the whole app. Use when the user asks to restyle, theme, redesign or build UI, or says "apply the design", "match the design" or "use our design system".
---

# Apply the Flat Glass · Brand Blue design

## 1. Load the source of truth
- Read `design/DESIGN.md` in full.
- Look at the reference screens in `design/screens/*.png`. When you need exact values (sizes, spacing, opacity), read the matching `.html` file.

## 2. Detect the stack
Find the framework from the project files:
- `pubspec.yaml` → Flutter
- `package.json` with `react-native` or `expo` → React Native
- `*.xcodeproj` / `Package.swift` → SwiftUI
- `build.gradle(.kts)` with Compose → Jetpack Compose
- otherwise web (CSS / Tailwind / Ionic)

Use that platform's code in DESIGN.md §10 as the starting point.

## 3. Set up the theme (once per project)
If there's no theme file yet, create one with:
- the 5 colour tokens + the variants in DESIGN.md §2.2
- `shadow.primary` and `shadow.secondary`
- radii (12, 14, 16, 20, 24, 28, 32, 999)
- the type scale in DESIGN.md §3, using the Inter font (add the font files or package)

Wire it into the app root (ThemeData / ThemeProvider / Environment / MaterialTheme / CSS `:root`).

## 4. Build shared components (if missing)
GlassCard (normal + small shadow), IconButton (44, glass), PrimaryButton (52, blue), SegmentedControl, StatTile, ListRow, Badge, ProgressBar, BottomNav (floating, 68 tall), TextField (dark + light), MediaButton (44 / 56 / 80).
Match DESIGN.md §6 exactly.

## 5. Apply to the target screen(s)
- Flat background: `#ebeaea` (light) or `#000000` (dark). No gradients.
- Screen padding: top 56, sides 20–24. Gap between blocks: 16–28.
- Replace hard-coded colours, shadows, fonts and radii with theme tokens.
- Keep the app's existing logic, data and navigation. Change only the presentation.

## 6. Check before finishing
- [ ] Only the 5 colours (and their defined variants) are used
- [ ] Only the 2 shadows are used
- [ ] No gradients anywhere
- [ ] Inter at weights 300–600 only
- [ ] Touch targets ≥ 44; icon buttons have accessibility labels
- [ ] Layout matches the closest reference PNG

Report what changed and anything that couldn't be matched.
