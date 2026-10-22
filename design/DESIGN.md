# Mobile Design Spec: Flat Glass · Brand Blue

This file holds everything needed to reproduce the **Weather**, **SaaS Dashboard**, **Music Player** and **Sign In** screens exactly: colours, shadows, fonts, sizes, spacing, radii, components and layouts.

> **Using an AI coding assistant?** Paste this file in and say: *"Apply this design spec exactly to my mobile app."*

---

## 1. Look & feel in one paragraph

Flat, calm and premium. Every screen sits on **one solid background colour**, with no gradients, no blurred colour blobs and no images behind the content. Content lives on **frosted white cards**: white at 55–65% opacity with a 1px white border, a backdrop blur and a soft **blue-tinted shadow**. **Brand blue `#2596be`** is the only accent. It marks the primary action, the active state, data and icons. Text is pure black, with `#666666` for secondary text. Corners are large and round, and type is **Inter** in light and medium weights.

---

## 2. Design tokens

### 2.1 Colours (use only these)

| Token | Hex | Use |
|---|---|---|
| `--primaryColor` | `#2596be` | Primary buttons, active tab/nav, selected items, chart lines, progress, icons, badges |
| `--secondaryColor` | `#666666` | Secondary text: labels, captions, times, inactive icons |
| `--tertiaryColor` | `#ebeaea` | Background of light screens, dividers, empty progress tracks |
| `--darkColor` | `#000000` | Main text on light screens; background of the dark screen |
| `--lightColor` | `#ffffff` | Text and icons on primary blue; all text on the dark screen; glass fill |

### 2.2 Derived colours (made from the tokens above)

| Token | Value | Use |
|---|---|---|
| `--primaryTint` | `rgba(37,150,190,0.14)` | Icon chips, status pills ("▲ 12.4%", "Connected") |
| `--primaryFill` | `rgba(37,150,190,0.12)` | Area under chart lines |
| `--focusRing` | `0 0 0 3px rgba(37,150,190,0.35)` | Focused input or control |
| `--linkColor` | `#1a6f8e` | Text links on light screens (darker blue for contrast) |
| `--glass` | `rgba(255,255,255,0.55)` | Card fill (light) |
| `--glassStrong` | `rgba(255,255,255,0.60)` | Icon-button fill (light) |
| `--glassNav` | `rgba(255,255,255,0.65)` | Bottom nav fill (light) |
| `--glassBorder` | `rgba(255,255,255,0.85)` | Card border (light) |
| `--glassBorderStrong` | `rgba(255,255,255,0.90)` | Button and nav border (light) |
| `--glassDark` | `rgba(255,255,255,0.08)` | Card, input and button fill (dark screen) |
| `--glassDarkBorder` | `rgba(255,255,255,0.16)` | Card and button border (dark screen) |
| `--dividerDark` | `rgba(255,255,255,0.18)` | Dividers (dark screen) |

### 2.3 Shadows

| Token | Value | Use |
|---|---|---|
| `shadow.primary` | `0 4px 8px rgba(20,71,108,0.15)` | **Small** items: icon buttons, tab switch, stat tiles, active chips, info bars |
| `shadow.secondary` | `0 8px 16px rgba(20,71,108,0.20)` | **Large** items: main cards, bottom nav, album frame, big primary buttons, app logo |

### 2.4 Glass (frosted) recipes

| Recipe | Fill | Border | Blur | Shadow |
|---|---|---|---|---|
| **Card** | `--glass` | 1px `--glassBorder` | `blur(20px) saturate(160%)` | secondary (big) / primary (tiles) |
| **Icon button** | `--glassStrong` | 1px `--glassBorderStrong` | `blur(12px)` | primary |
| **Bottom nav** | `--glassNav` | 1px `--glassBorderStrong` | `blur(24px) saturate(160%)` | secondary |
| **Dark card** | `--glassDark` | 1px `--glassDarkBorder` | `blur(28px) saturate(160%)` | secondary + `inset 0 1px 0 rgba(255,255,255,0.2)` |

> Backgrounds are flat, so the blur has very little to show. Cards read as soft translucent white panels. Keep the blur anyway: it adds depth when content scrolls underneath (e.g. the bottom nav).

---

## 3. Typography

**Font:** [Inter](https://fonts.google.com/specimen/Inter) in weights **300, 400, 500 and 600**.
Fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

| Style | Size / weight | Letter-spacing | Example |
|---|---|---|---|
| Display XL | 96 / 300, line-height 1 | -0.04em | Weather "21°" |
| Display | 40 / 300 | -0.03em | "$48,290" |
| H1 | 28 / 600 | -0.02em | "Welcome back" |
| Value L | 28 / 300 (+ unit 15/500) | 0 | "12 km/h" |
| Title | 26 / 600 | -0.02em | "Golden Hour" |
| KPI | 26 / 500 | -0.02em | "3,812" |
| H2 | 24 / 600 | -0.02em | "Alex" |
| Subtitle | 18 / 500 | 0 | "Partly cloudy" |
| Body L | 16 / 400–600 | 0 | Location, artist, button labels |
| Body | 15 / 400–500 | 0 | Inputs, list values |
| Body S | 14 / 400–500 | 0 | List titles, captions |
| Caption | 13 / 400–500 | 0 | Hour labels, field labels |
| Overline | 12 / 600, UPPERCASE | 0.06em | "TODAY", "REVENUE", "WIND" |
| Micro | 11 / 400–600 | 0–0.08em | Chart axis, "PLAYING FROM" |

---

## 4. Spacing, sizes & shape

**Base unit:** 4px. Values used: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 56, 88.

| Item | Value |
|---|---|
| Design frame | 390 × 844 (iPhone 14/15) |
| Screen padding | top **56**, sides **20** (Weather, Dashboard) / **24** (Player, Sign In), bottom 24–32 |
| Vertical gap between blocks | **16** (Weather, Dashboard), **24** (Player), **28** (Sign In) |
| Gap in 2-column grids | 12 |
| Card padding | 16 (standard), 20 (hero chart card), 24 (form card), list cards 8 vertical × 16 horizontal |

| Radius | Used on |
|---|---|
| 999 (pill) | Segmented control, badges, progress bars |
| 50% | Avatars, round media buttons |
| 12 | Icon chips (36×36) |
| 14 | Icon buttons, inputs, standard buttons |
| 16 | Selected hour cell, active nav item |
| 20 | Info bar, app logo |
| 22 | Album art (inner) |
| 24 | Cards, bottom nav |
| 28 | Form card (dark) |
| 32 | Album frame |

**Touch targets:** at least **44×44** everywhere.

| Control | Size |
|---|---|
| Icon button | 44 × 44 |
| Nav item | 48 × 48 |
| Segmented tab | height 36, inside 4px padding |
| Input | height 50 |
| Primary button | height 52 |
| Social button | height 50 |
| Media buttons | 44 (ghost), 56 (glass), **80 (primary play/pause)** |
| Avatar | 44 (header), 36 (list) |
| Progress bar | 6 tall (thumb 16 with 3px blue ring); weekly range bars 5 tall |

---

## 5. Icons

- Line icons in the **Lucide / Feather** style, drawn on a 24×24 grid
- Stroke width **1.8** (2.0 for small 14–18px icons), round caps and joins
- Sizes: **20** in icon buttons, **22** in nav and lists, **14** in overlines, **84** for the hero weather icon
- Colours: `#000000` by default, `#2596be` for accent or data icons, `#666666` when inactive, `#ffffff` on blue
- Media controls (play, pause, prev, next) are **filled**, not stroked

---

## 6. Components

### Icon button (light)
44×44, radius 14, glass "Icon button" recipe, black icon 20px.

### Primary button
Fill `#2596be`, text `#ffffff` 16/600, height 52, radius 14, `shadow.secondary`, no border.
Pressed: `transform: scale(0.98)`. Focus: `--focusRing`.

### Segmented control (Day / Week / Month)
Pill container, glass card fill, 4px padding, `shadow.primary`.
Tabs: height 36, radius 999, 14/500 `#666666`.
**Active tab:** `#2596be` fill, `#ffffff` 14/600, `shadow.primary`.

### Card
Glass "Card" recipe, radius 24. Inside, a header row with an **Overline** label in `#666666`.

### Stat tile
Glass card, radius 24, padding 16, `shadow.primary`. Contains a 36×36 icon chip (`--primaryTint` fill, radius 12, blue icon 18), then a label (13 `#666666`), then a value (KPI style).

### List row
Padding 12/10 vertical, gap 12, divider `1px solid #ebeaea` between rows (none after the last).
Leading item: a 36 avatar (blue with white initials, or `#ebeaea` with black initials), a title (14/500) with a caption under it (12 `#666666`), and a trailing value (14/600).

### Badge / pill
Padding 4 × 10, radius 999, 12/600, fill `--primaryTint`, text `#000000`.

### Progress / range bar
Track: `#ebeaea` (or `rgba(255,255,255,0.8)` on the player). Fill: `#2596be`. Thumb: 16 white circle with `0 0 0 3px #2596be` ring + `shadow.primary`.

### Hourly cell
Column: label 13 `#666666`, icon 22, value 15/500. **Selected ("Now"):** `#2596be` fill, white text and icon, radius 16, `shadow.primary`.

### Bottom navigation
Floating bar 20px from the left, right and bottom edges, height 68, radius 24, glass "Bottom nav" recipe. 4 items, evenly spread.
Active item: 48×48, radius 16, `#2596be` fill, white icon, `shadow.primary`. Inactive: `#666666` icon.

### Text input (dark screen)
Height 50, radius 14, padding 0 16, fill `--glassDark`, border `1px rgba(255,255,255,0.2)`, text white 15/400, placeholder `rgba(255,255,255,0.6)`.
**Focused:** border `1px #2596be` + `--focusRing`.
Label above: 13/500 `#ebeaea`, gap 8.

### Checkbox
18×18, `accent-color: #2596be`, label 14 `#ebeaea`, row min-height 44.

### Chart (line + area)
Line: `#2596be`, stroke 2.4, round caps. Area: `#2596be` at 12% opacity. End dot: 4.5 radius, white fill, 2.4 blue stroke. No gridlines. Axis labels 11 `#666666`.

---

## 7. Screen layouts

### 7.1 Weather (light: background `#ebeaea`)
1. **Top bar:** Menu icon button · location pin (blue) + "San Francisco" 16/600 · Search icon button
2. **Hero (centred):** weather icon 84 (sun stroke blue, cloud stroke black with 70% white fill) → "21°" Display XL → "Partly cloudy" Subtitle → "H 24° · L 15° · Feels like 20°" 14 `#666666`
3. **Hourly card** (shadow.secondary): overline "TODAY" → 5-column grid of hourly cells, first one selected
4. **2-column tiles** (shadow.primary): *Wind*, "12 km/h", "Light breeze, NW" · *UV index*, "5 Moderate" + a 6px progress bar at 45%
5. **Weekly card** (shadow.secondary): rows laid out as `56px | 28px | 1fr`: day 15/500 · icon 22 · low (`#666666`) → 5px range bar (blue segment) → high 15/500

### 7.2 SaaS Dashboard (light: background `#ebeaea`)
1. **Header:** "Good morning," 14 `#666666` / "Alex" H2 · Bell icon button (blue 8px dot with a white 2px ring) · Avatar 44 (blue, white "A" 18/600, white 2px ring + shadow.primary)
2. **Segmented control:** Day · **Week** (active) · Month
3. **Revenue card** (padding 20): overline "REVENUE" + badge "▲ 12.4%" → "$48,290" Display → line chart 96 tall → weekday labels M–S
4. **2 stat tiles:** Active users "3,812" · Conversion "4.7%"
5. **Recent activity card:** 2 list rows
6. **Floating bottom nav:** Home (active) · Analytics · Messages · Settings (screen bottom padding 112 so content clears the nav)

### 7.3 Music Player (light: background `#ebeaea`)
1. **Top bar:** Chevron-down icon button · "PLAYING FROM" Micro `#666666` / "Sunday Slow Mornings" 14/600 · More (•••) icon button
2. **Album frame:** 300×300, radius 32, padding 14, fill `rgba(255,255,255,0.45)`, border `--glassBorderStrong`, shadow.secondary. Art inside: radius 22, solid `#2596be`, a 150 white circle, and a 70px frosted strip at the bottom (`rgba(255,255,255,0.25)`, blur 10, top border `rgba(255,255,255,0.6)`)
3. **Track row:** "Golden Hour" Title / "Lumen Coast" 16 `#666666` · Like button 48 round glass with a filled blue heart
4. **Progress bar** at 37% + times "1:23" / "3:44" 12/500 `#666666`
5. **Controls:** Shuffle (44 ghost, `#666666`) · Prev (56 glass) · **Pause (80, blue, white icon, shadow.secondary)** · Next (56 glass) · Repeat (44 ghost)
6. **Device bar** (pinned to the bottom with `margin-top: auto`): blue monitor icon · "Living Room Speaker" 14/500 · badge "Connected", radius 20, padding 12×14, shadow.primary

### 7.4 Sign In (dark: background `#000000`, all text `#ffffff`)
Padding top 88, gap 28.
1. **Logo:** 64×64, radius 20, `#2596be` fill, white cube icon 30, shadow.secondary
2. **Heading:** "Welcome back" H1 / "Sign in to continue to your workspace" 15 `#ebeaea`
3. **Form card** (dark glass, radius 28, padding 24, gap 16): Email (shown focused) · Password row with a "Forgot?" link (13/600 white) and a show-password eye button (44) inside the input · "Keep me signed in" checkbox · **Sign in** primary button
4. **Divider:** 1px `rgba(255,255,255,0.18)` lines with "or continue with" 13 `#ebeaea`
5. **2 social buttons:** "Magic link" · "SSO". Height 50, radius 14, dark glass, shadow.primary, 15/500
6. **Footer** (pinned to the bottom): "New here? **Create an account**" 14 `#ebeaea`, link 600 white

---

## 8. Motion

- Duration 150–200ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`
- Buttons: press `scale(0.98)`. Glass buttons: fill goes to `rgba(255,255,255,0.8)` on hover or press
- Tabs and selections: animate background colour only
- Respect reduced-motion settings (`prefers-reduced-motion`, iOS Reduce Motion, Android "Remove animations")

---

## 9. Accessibility

- `#000000` on `#ebeaea` = **17.4:1** ✅ · `#666666` on `#ebeaea` = **4.7:1** ✅ (don't go lighter than `#666666`)
- `#ffffff` on `#2596be` = **~3.4:1** ⚠️ This is fine for icons and large text (≥ 24px, or ≥ 18.7px bold) but **below AA for small button labels**. To pass, either:
  - use `#1a6f8e` (≈ 5.9:1) as the fill of buttons that carry small text, **or**
  - use `#000000` text on `#2596be` (≈ 6.2:1)
- Every icon-only button needs an accessibility label ("Menu", "Search city", "Pause"…)
- Focus is shown with `--focusRing`; never remove it

---

## 10. Platform code

### 10.1 CSS (web / hybrid / Capacitor / Ionic)

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap");

:root {
  --primaryColor: #2596be;
  --secondaryColor: #666666;
  --tertiaryColor: #ebeaea;
  --darkColor: #000000;
  --lightColor: #ffffff;

  --primaryTint: rgba(37,150,190,0.14);
  --primaryFill: rgba(37,150,190,0.12);
  --linkColor: #1a6f8e;
  --focusRing: 0 0 0 3px rgba(37,150,190,0.35);

  --glass: rgba(255,255,255,0.55);
  --glassStrong: rgba(255,255,255,0.60);
  --glassNav: rgba(255,255,255,0.65);
  --glassBorder: rgba(255,255,255,0.85);
  --glassBorderStrong: rgba(255,255,255,0.90);
  --glassDark: rgba(255,255,255,0.08);
  --glassDarkBorder: rgba(255,255,255,0.16);

  --shadowPrimary: 0 4px 8px rgba(20,71,108,0.15);
  --shadowSecondary: 0 8px 16px rgba(20,71,108,0.20);

  --radiusSm: 12px; --radiusMd: 14px; --radiusLg: 24px; --radiusPill: 999px;
  --font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.card {
  background: var(--glass);
  border: 1px solid var(--glassBorder);
  border-radius: var(--radiusLg);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  box-shadow: var(--shadowSecondary);
}
.btn-primary {
  height: 52px; border: 0; border-radius: var(--radiusMd);
  background: var(--primaryColor); color: var(--lightColor);
  font: 600 16px var(--font); box-shadow: var(--shadowSecondary);
}
```

### 10.2 Flutter

```dart
// pubspec: google_fonts
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const primary   = Color(0xFF2596BE);
  static const secondary = Color(0xFF666666);
  static const tertiary  = Color(0xFFEBEAEA);
  static const dark      = Color(0xFF000000);
  static const light     = Color(0xFFFFFFFF);
  static const primaryTint = Color(0x242596BE); // 14%
  static const glass       = Color(0x8CFFFFFF); // 55%
  static const glassBorder = Color(0xD9FFFFFF); // 85%
}

class AppShadows {
  static const primary   = [BoxShadow(color: Color(0x2614476C), offset: Offset(0, 4), blurRadius: 8)];
  static const secondary = [BoxShadow(color: Color(0x3314476C), offset: Offset(0, 8), blurRadius: 16)];
}

ThemeData appTheme() => ThemeData(
  useMaterial3: true,
  scaffoldBackgroundColor: AppColors.tertiary,
  colorScheme: const ColorScheme.light(
    primary: AppColors.primary, onPrimary: AppColors.light,
    secondary: AppColors.secondary, surface: AppColors.tertiary, onSurface: AppColors.dark,
  ),
  textTheme: GoogleFonts.interTextTheme().apply(bodyColor: AppColors.dark, displayColor: AppColors.dark),
);

class GlassCard extends StatelessWidget {
  const GlassCard({super.key, required this.child, this.padding = 16, this.small = false});
  final Widget child; final double padding; final bool small;
  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(24),
        boxShadow: small ? AppShadows.primary : AppShadows.secondary),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          padding: EdgeInsets.all(padding),
          decoration: BoxDecoration(
            color: AppColors.glass,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.glassBorder),
          ),
          child: child,
        ),
      ),
    ),
  );
}
```

### 10.3 SwiftUI

```swift
extension Color {
    static let primaryBrand = Color(red: 37/255, green: 150/255, blue: 190/255) // #2596be
    static let secondaryText = Color(white: 0.4)                                 // #666666
    static let tertiaryBg   = Color(red: 235/255, green: 234/255, blue: 234/255) // #ebeaea
}

struct GlassCard<Content: View>: View {
    var small = false
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(16)
            .background(.white.opacity(0.55), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.white.opacity(0.85), lineWidth: 1))
            .shadow(color: Color(red: 20/255, green: 71/255, blue: 108/255).opacity(small ? 0.15 : 0.20),
                    radius: small ? 4 : 8, y: small ? 4 : 8) // SwiftUI radius ≈ CSS blur / 2
    }
}
// Font: add Inter .ttf files to the app and use .font(.custom("Inter-Light", size: 96)) etc.
```

### 10.4 React Native

```js
export const colors = {
  primary: '#2596be', secondary: '#666666', tertiary: '#ebeaea', dark: '#000000', light: '#ffffff',
  primaryTint: 'rgba(37,150,190,0.14)', glass: 'rgba(255,255,255,0.55)', glassBorder: 'rgba(255,255,255,0.85)',
};
export const shadows = {
  primary:   { shadowColor: '#14476C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  secondary: { shadowColor: '#14476C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.20, shadowRadius: 8, elevation: 6 },
};
export const card = {
  backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1, borderRadius: 24, padding: 16,
  ...shadows.secondary,
}; // blur: wrap in <BlurView intensity={40} tint="light"> from expo-blur
// Fonts: @expo-google-fonts/inter → Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold
```

### 10.5 Jetpack Compose

```kotlin
object AppColors {
    val Primary = Color(0xFF2596BE); val Secondary = Color(0xFF666666); val Tertiary = Color(0xFFEBEAEA)
    val Dark = Color(0xFF000000); val Light = Color(0xFFFFFFFF)
    val Glass = Color.White.copy(alpha = 0.55f); val GlassBorder = Color.White.copy(alpha = 0.85f)
}
val ShadowTint = Color(0xFF14476C)

@Composable
fun GlassCard(small: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    Column(
        Modifier
            .shadow(if (small) 4.dp else 8.dp, shape, ambientColor = ShadowTint, spotColor = ShadowTint)
            .clip(shape)
            .background(AppColors.Glass)
            .border(1.dp, AppColors.GlassBorder, shape)
            .padding(16.dp),
        content = content
    )
}
// Font: res/font/inter_light.ttf, inter_regular.ttf, inter_medium.ttf, inter_semibold.ttf → FontFamily(...)
```

---

## 11. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Use one flat background colour per screen | Use gradients, colour blobs or background images |
| Use `#2596be` as the only accent | Add other accent colours (green/red only for real status) |
| Put small shadows on small items and big shadows on big items | Use dark or black shadows |
| Black text, `#666666` for secondary | Use lighter greys than `#666666` for text |
| Keep touch targets ≥ 44px | Shrink icon buttons below 44px |
| Use Inter 300 for large numbers and 600 for headings | Use bold (700+) weights |
