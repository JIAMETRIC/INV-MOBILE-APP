# Shared components (C1–C16) — Three-Slot tree

**Files:** `src/ui/components.tsx` (610 lines) · `src/ui/Sheet.tsx` (94) · `src/ui/Snackbar.tsx` (79) · `src/ui/alert.ts` (28) · `src/ui/Nav.tsx` (116) · `src/ui/Screen.tsx` (60) · `src/ui/Columns.tsx` (60) + `src/ui/columnsMode.ts` (27) · `src/ui/tokens.ts` (231) · `src/ui/useBreakpoint.ts` (34) · `src/ui/navMetrics.ts` (24); line numbers as of 2026-10-23 · **Reached by:** imported by every screen (S1–S6) and the shell (S0) · **Data:** none (presentation only; `Theme` comes in as a prop, or from `useTheme()` in `Screen`) · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § C (IDs C1–C16) · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

The UI kit every screen is composed from. Change one of these and every screen that uses it changes at once; to change a single screen, change the props at that screen's call site or wrap the component there. The kit is the Flat Glass · Brand Blue system (`design/DESIGN.md`) with the owner's exceptions: numbers in Bebas Neue (`font.numeric`), tighter radii (`radius` in `tokens.ts`), no backdrop blur on Android, and real green / red only for status. Colours are always `theme.*`; the only hex values live in `tokens.ts` (section 4). The file keeps its old name (`C1-C4`) but now covers the whole kit.

## 1. Which slot each component belongs to

| Slot | Components | ID | Where |
| --- | --- | --- | --- |
| Header | `TopAppBar` (the header itself; pads the status-bar inset) · `IconButton` (its glass action and back buttons) | C1 · C3 | `components.tsx` 319 · 92 |
| Main | `Card` · `ListItem` / `ListRow` · `Input` / `MoneyInput` · `SearchField` · `SegmentedControl` · `Badge` / `StatusGlyph` · `MoneyText` · `TotalRow` · `SectionTitle` · `IconChip` · `Chip` · `EmptyState` · `Columns` (a row of cells) | C6 · C7 · C4 · C5 · C8a · C12 · C13 · C13 · C13 · C6a · C8 · C13 · C15 | `components.tsx`; `Columns.tsx` 21 |
| Footer / floating | `FAB` (the `fab` slot of `<Screen>`, phones) · `Button` rows (an action bar in the `footer` slot, or inside a pane) | C9 · C2 | `components.tsx` 588 · 39 |
| Shell (S0) | `BottomTabs` / `Rail` (`Nav.tsx`) · `Sheet` · `SnackbarProvider` / `useSnackbar` · `alert()` | S0.4 · C10 · C11 · C14 | `Nav.tsx` 45 / 69 · `Sheet.tsx` 22 · `Snackbar.tsx` 19 / 15 · `alert.ts` 13 |
| Scaffold | `Screen` with `useMainInset()` and `useFabClearance()`; `useNavBottom()` / `useNavInset()` in `navMetrics.ts` | C16 · S0.4.4 | `Screen.tsx` 23 / 55 / 48 · `navMetrics.ts` 9 / 17 |

`Button` is not a slot of its own: a screen puts it in Footer (S4 `TotalBar`, Next), in a pane (S3 actions, S5 editor) or in a sheet (P1 Cancel and Save payment). `Chip` and `SearchField` have no ID in the slot list of the method but are Main components (C8, C5).

## 2. The file in reading order (`src/ui/components.tsx`)

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | imports · `IconName` (Feather icon names) | 1-14 | the icon set |
| 2 | `ripple(theme, borderless)` · `pressedDim` (web only) · `pressScale` (0.98 / 0.96) | 17-23 | press feedback for every pressable in the kit |
| 3 | `ButtonProps` · `Button` (C2) | 25-87 | the four button looks |
| 4 | `IconButton` (C3) | 92-117 | glass / ghost icon buttons |
| 5 | `InputProps` · `Input` (C4) | 119-188 | labelled text field |
| 6 | `MoneyInput` (C4) | 192-215 | rupee field bound to integer paise |
| 7 | `SearchField` (C5) | 218-245 | search box with clear button |
| 8 | `MoneyText` (C13) | 247-262 | an amount in Bebas Neue |
| 9 | `TotalRow` (C13) | 264-279 | label · amount row |
| 10 | `StatusGlyph` (C12) | 282-297 | invoice status pill (glyph + text) |
| 11 | `Badge` (C12) | 299-311 | plain tinted pill |
| 12 | `BarAction` · `TopAppBar` (C1) | 313-356 | the screen header |
| 13 | `SectionTitle` (C13) | 359-369 | overline with a right slot |
| 14 | `Card` (C6) | 375-393 | the glass card |
| 15 | `IconChip` (C6a) | 396-405 | 36 × 36 tinted icon |
| 16 | `ListRow` (C7) | 408-429 | free-form table row |
| 17 | `initials(name)` (C7a) | 432-437 | avatar letters |
| 18 | `ListItem` (C7) | 443-490 | the kit list row |
| 19 | `EmptyState` (C13) | 492-503 | icon · title · text · action |
| 20 | `Chip` (C8) | 506-541 | filter pill |
| 21 | `SegmentedControl` (C8a) | 545-584 | Day / Week / Month style tabs |
| 22 | `FAB` (C9) | 588-610 | the floating primary button |

The other files hold one component each: `Sheet.tsx` (`Sheet`, 22-94), `Snackbar.tsx` (`useSnackbar` 15, `SnackbarProvider` 19-79), `alert.ts` (`alert` 13-28), `Nav.tsx` (`TABS` 12, `NavItem` 21, `BottomTabs` 45, `Rail` 69), `Screen.tsx` (`Screen` 23, `useFabClearance` 48, `useMainInset` 55), `Columns.tsx` (`Columns` 21) with `columnsMode.ts` (`columnsMode` 11, `CELL_MIN` 27).

## 3. Trees

### Header: TopAppBar (C1) and IconButton (C3)

```
TopAppBar({ title, subtitle, onBack, actions, theme, large })        319
│   pad: top = status inset + layout.top 8 · sides layout.side 20 · bottom 12   327
│   actions → one glass IconButton each, keyed by label               324
│
├─ large (S1, S2, S5, S6 top level)                                   328-337
│    └─ row, gap 12, centred                                           330
│         ├─ column flex 1: subtitle (bodyMedium, muted, 1 line)        332
│         │                 ABOVE title (type.title 24/600, header role) 333
│         └─ row of action buttons, gap 10                             335
│
└─ small (S4, S6 drill-in, S0 "Invoice" bar)                          340-355
     │   sideWidth = n × 44 + (n − 1) × 10, n = max(back ? 1 : 0, actions)  340-341
     └─ row, gap 12, minHeight 44                                      343
          ├─ left box (sideWidth): glass "chevron-left" "Navigate up" when onBack  344-345
          ├─ column flex 1, centred: title (heading 16/600) then subtitle (caption)  347-351
          └─ right box (sideWidth), right-aligned action buttons, gap 10  353

IconButton({ icon, label, onPress, theme, color, busy, size = 20, selected, glass })   92
└─ Pressable 44 × 44 (touch.min), centred                             98-113
     ├─ glass: radius.control 12 · glassStrong fill · 1px glassBorderStrong · tileShadow · icon theme.text   107-111
     ├─ ghost (default): radius.chip 10 · transparent · icon theme.textMuted · borderless ripple   104-109
     ├─ selected → primaryTint fill (either look)                      109
     ├─ press: scale motion.pressScaleSmall 0.96                       112
     └─ busy ? ActivityIndicator : Feather icon (size, colour = color ?? look default)   114
```

### Buttons: Button (C2), FAB (C9), Chip (C8), SegmentedControl (C8a)

```
Button({ label, onPress, theme, variant = 'solid', icon, danger, disabled, busy, style, labelStyle })   39
└─ Pressable row, centred, gap 8, radius.control 12, clipped          49-75
     │   minHeight: solid 52 (touch.button) · tonal / outline 50 (touch.input) · ghost 44   57
     │   paddingHorizontal: ghost 12 · others 24                       58
     ├─ solid     fillStrong (error when danger), no border, shadow.secondary   67
     ├─ tonal / outline (same look, `glassBtn`)  glassStrong (errorContainer when danger),
     │            1px glassBorderStrong, tileShadow                    69-73
     ├─ ghost     no fill, no border                                   —
     ├─ off (disabled or busy) → opacity 0.38, no shadow               67, 72, 74
     ├─ busy → ActivityIndicator instead of icon + label               76
     ├─ Feather icon 18 (when icon)                                    78
     └─ label 1 line: solid type.heading · ghost type.label semibold · glass type.body medium   79-82
          colour: solid onFillStrong (onError when danger) · danger error · glass text · ghost link   45-47

FAB({ icon, label, onPress, theme, extended = true })                 588
└─ View absolute: end layout.side 20 · bottom useNavInset() · radius.control · shadow.secondary · theme.fab   591-593
     └─ Pressable 52 tall, minWidth 52, paddingHorizontal 24 when extended, gap 8   594-603
          ├─ Feather icon 20, theme.onFab                              605
          └─ label type.heading onFab (extended only)                  606

Chip({ label, active, onPress, theme, icon })                         506
└─ Pressable height 36, paddingHorizontal 16, marginEnd 8, marginVertical 4, radius.pill, gap 6   511-533
     │   role checkbox, checked = active; hitSlop 4 top / bottom       513-515
     ├─ on:  fillStrong, no border, shadow.primary, label semibold onFillStrong   528-532
     ├─ off: glassStrong, 1px inputBorder (a white border would vanish on the sheet), label medium textMuted   528-531
     ├─ Feather icon 16 (when icon)                                    535
     └─ label type.label, 1 line                                       536-538

SegmentedControl({ options, value, onChange, theme, style, label })   545
└─ View row (tablist), padding 4, radius.pill, glass fill, 1px glassBorder, tileShadow   550-558
     └─ Pressable per option (tab): flex 1, height 36, radius.pill, paddingHorizontal 8   562-575
          ├─ on: fillStrong + shadow.primary, label semibold onFillStrong   572-577
          └─ off: transparent, label medium textMuted                  572-577
```

### Inputs: Input and MoneyInput (C4), SearchField (C5)

```
Input({ label, value, onChange, onBlur, theme, placeholder, keyboardType = 'default', autoCapitalize,
        multiline, editable = true, tabular, helper, error, maxLength })   138
└─ View, marginBottom 16 (the gap to the next field)                  145
     ├─ label  type.labelMedium textMuted (error → theme.error), marginBottom 8   146-148
     ├─ TextInput                                                      149-180
     │    minHeight 50 (touch.input), 96 when multiline; paddingHorizontal 16; paddingVertical 12 multiline / 0   166-168
     │    1px border: error → theme.error · focused → theme.focus · else inputBorder   143
     │    radius.control 12 · inputFill · text colour text (textMuted when not editable)   171-173
     │    focused and no error → boxShadow theme.focusRing              175
     │    font: tabular → type.numberField (Inter, tabular digits) · else type.body   177
     │    placeholder textDisabled · cursor focus · selection primaryTint · a11y label = label ?? placeholder   155, 161-163
     └─ helper / error  type.caption, marginTop 4; error wins          181-185

MoneyInput({ valuePaise, onChangePaise, ...Input props })             192
└─ Input with keyboardType decimal-pad, tabular, placeholder '0.00'   202-207
     fmt: 0 → '' · else (p / 100).toFixed(2)                           195
     toPaise: max(0, round(Number(t) × 100))                           197
     text state resyncs only when valuePaise changes from outside     198-200
     onChange: strip non [0-9.], keep one dot, then onChangePaise      208-212

SearchField({ value, onChange, placeholder, theme, style })           218
└─ View row, height 50, radius.control, glassStrong, 1px glassBorderStrong, tileShadow, paddingStart 16   223-228
     ├─ Feather "search" 20 textMuted                                  229
     ├─ TextInput type.body, flex 1, paddingHorizontal 12, height 48, returnKeyType search   230-239
     └─ value ? IconButton "x" "Clear search" : 8 spacer               240-242
```

### Cards and lists: Card (C6), IconChip (C6a), ListItem / ListRow (C7), initials (C7a), SectionTitle and EmptyState (C13)

```
Card({ children, theme, style, small, list })                         375
└─ View  theme.glass · 1px glassBorder · radius.card 16               380-389
     padding 16; `list` → 8 vertical × 16 horizontal                  385-387
     shadow: small → theme.tileShadow · else theme.cardShadow         388
     `variant` is accepted by the type but not read                   377

IconChip({ icon, theme })                                             396
└─ View 36 × 36, radius.chip 10, primaryTint · Feather 18 theme.accent   398-402

ListItem({ title, subtitle, leadingIcon, leadingText, leadingAlt, trailing, onPress, chevron, theme,
           divider = true, selected, flush, titleLines = 1 })         443
└─ Pressable row, gap 12, paddingVertical 12, paddingHorizontal 16 (0 when flush)   453-465
     │   minHeight 60 with subtitle, else 44 · bottom divider 1px theme.divider · selected → primaryTint fill
     │   disabled and no button role without onPress                   454-457
     ├─ leading: IconChip (leadingIcon) · or 36 avatar radius 18       467-479
     │    avatar fill primaryContainer (blue) · leadingAlt → theme.border (grey)
     │    initials type.label semibold; > 2 chars → 11 with letterSpacing −0.2   474-475
     ├─ column flex 1: title type.label (titleLines) · subtitle type.caption muted, 2 lines   480-485
     ├─ trailing (any node)                                            486
     └─ chevron → Feather "chevron-right" 20 textMuted                 487

ListRow({ children, onPress, theme, divider = true, flush })          408
└─ Pressable minHeight 44, paddingHorizontal 16 (0 flush), paddingVertical 12, bottom divider   412-427

initials(name)  '' → '—' · one word → first two letters · else first letter of the first two words; upper-case   432-437

SectionTitle({ title, theme, right })                                 359
└─ View row space-between, minHeight 32, marginBottom 8, gap 8        361-364
     ├─ title type.overline textMuted (header role)                    365
     └─ right slot                                                     366

EmptyState({ text, theme, icon, title, action })                      492
└─ View centred, paddingVertical 32, paddingHorizontal 24, gap 8      496
     ├─ Feather icon 36 textMuted (when icon)                          497
     ├─ title type.heading (when title)                                498
     ├─ text type.bodyMedium textMuted                                 499
     └─ action in a View, marginTop 8 (when action)                    500
```

### Badges and money: StatusGlyph / Badge (C12), MoneyText / TotalRow (C13)

```
StatusGlyph({ status, theme })                                        282
│   s = statusStyle[status] (tokens 225-231: icon · label · tone); t = theme.tone[s.tone]   283-284
└─ View row, gap 4, alignSelf flex-end, t.bg, radius.pill, padding 4 × 10, a11y "Status <label>"   286-291
     ├─ Feather s.icon 12, t.icon                                       293
     └─ s.label type.caption semibold, t.fg                            294

Badge({ label, tone, theme })                                         299
│   tone 'error' → errorContainer / onErrorContainer · else theme.tone[tone]   302
└─ View t.bg, radius.pill, padding 4 × 10, alignSelf flex-end         304-307
     └─ label type.caption semibold t.fg, 1 line                       308

MoneyText({ paiseText, theme, strong, small })                        247
└─ Text type.number (Bebas 16/22) · small → 15/20 · strong → 22/26 (18/26 when small); theme.text, right-aligned   251-257
     Bebas Neue has one weight, so strong means larger, not bolder    254

TotalRow({ label, value, theme, strong })                             264
└─ View row space-between, paddingVertical 4 (8 strong)               268-272
     │   strong → 1px top border theme.divider, marginTop 4
     ├─ label type.bodyMedium textMuted · strong → type.heading theme.text   273
     └─ MoneyText value, strong passed through                         276
```

### Shell: Sheet (C10), Snackbar (C11), Nav (S0.4), alert (C14)

```
Sheet({ visible, onClose, title, theme, wide, children })             22
│   bottom = bp.isPhone (xs, sm): a bottom sheet; md and up: a centred dialog   23-25
└─ Modal transparent, status and navigation bars translucent, slide (phone) / fade, onRequestClose = onClose   27-34
     └─ KeyboardAvoidingView (padding on Android)                     35-38
          └─ scrim Pressable theme.overlay, a11y "Close", onPress onClose; flex-end (phone) / centre   39-46
               └─ panel Pressable (claims the touch; accessibilityViewIsModal)   47-68
                    phone: width 100 %, maxHeight 92 %, theme.sheet, top radii radius.card 16,
                           1px glassBorder (no bottom), shadow.secondary, paddingBottom = bottom inset   50-58
                    dialog: width 86 % (wide) / 92 %, maxWidth maxReadWidth 720 (wide) / 560, maxHeight 86 %,
                           radius.form 18, 1px glassBorder, shadow.secondary   59-67
                    ├─ handle 36 × 5 pill theme.border, paddingTop 12 (phone only)   69-73
                    ├─ title row: paddingStart 24, paddingEnd 8, paddingTop 4 (phone) / 12   74-82
                    │    ├─ title type.subtitle semibold (18/600), 1 line, header role   78
                    │    └─ IconButton "x" "Close" (ghost)             81
                    └─ ScrollView paddingHorizontal 24, paddingTop 8, paddingBottom 24, taps persist   83-88

SnackbarProvider({ children, theme, bottomOffset })                   19
│   useSnackbar() → show(message, action?)                            15, 31-37
│   show: clear timer · set snack · announceForAccessibility · fade in 200 ms · auto-hide after 4000 ms (6000 with an action)   31-37
│   hide: fade out 150 ms, then unmount                               27-29
└─ Animated.View absolute, start / end layout.side 20, bottom = bottom inset + bottomOffset + 8, opacity + translateY 16 → 0, live region polite   50-58
     └─ bar row minHeight 48, maxWidth 560 centred, inverseSurface, radius.control 12, paddingStart 16, paddingEnd 8, shadow.secondary   60-63
          ├─ message type.bodyMedium inverseOnSurface, paddingVertical 12   64
          └─ action Pressable minHeight 48, paddingHorizontal 12: label semibold inversePrimary; runs onPress then hides   65-73
     bottomOffset from App.tsx:95 = NAV_HEIGHT + 52 + 2 × 16 + 8 = 160 on phones, 0 on tablets

Nav.tsx
├─ TABS  dashboard "home" · invoices "file-text" · products "tag" · settings "settings"   12-17
├─ NavItem({ on, icon, label, onPress, theme })  48 × 48 (touch.nav), radius.item 14, tab role, borderless ripple   21-41
│    on → fillStrong + shadow.primary, icon 22 onFillStrong · off → icon 22 textMuted   34-38
├─ BottomTabs({ active, onSelect, theme })  absolute, left / right 20, bottom useNavBottom(), height NAV_HEIGHT 68,
│    radius.card 16, navSurface, 1px navBorder, shadow.secondary, items space-around, tablist   45-65
└─ Rail({ active, onSelect, theme, labels, onNew })  width 88, navSurface, 1px right border navBorder, shadow.secondary,
     paddingTop = top inset + 16, paddingBottom = bottom inset, gap 12   69-87
     ├─ "New invoice" Pressable 52 × 52, radius.control, theme.fab, shadow.secondary, marginBottom 24, press scale 0.96, "plus" 22 onFab   88-100
     └─ NavItem × 4; `labels` → type.caption under each (on: text semibold · off: textMuted medium)   101-113

alert(title, message?, buttons?)                                      13
├─ native → Alert.alert unchanged                                     14-17
└─ web: 0 or 1 button → window.alert, then the first button's onPress   19-23
        more → window.confirm: negative = style 'cancel' or text /cancel|close|keep|no$/i; affirmative = the last other button   24-27
```

### Scaffold: Screen (C16) and Columns (C15)

```
Screen({ header, below, footer, fab, overlay = false, children })     23
│   ScreenContext { fab: !!fab, overlay }                              20-21, 35
└─ View column flex 1, backgroundColor theme.bg (useTheme())          36
     ├─ header                                                         37
     ├─ below                                                          38
     ├─ Main: View flex 1, minHeight 0 → children                      39
     ├─ footer in a View paddingBottom useNavBottom() (when footer)    40
     └─ fab                                                            41
useFabClearance()  fab ? touch.button 52 + layout.gap 16 : 0           48-51
useMainInset()     (overlay ? space[6] 32 : useNavInset()) + useFabClearance()   55-60

Columns({ children, gap = layout.grid 12, weights, kind = 'touch', minCell, stackAt, wrap, style })   21
│   kids = children with falsy entries dropped · min = minCell ?? CELL_MIN[kind]   33-34
│   mode = columnsMode({ width: measured ?? window width, side: measured ? 0 : 20, n, gap, minCell: min, bp, stackAt, wrap })   35-38
│   onLayout stores the rounded row width when it changes             39-42
└─ View  row (or column when 'stack'), flexWrap when 'wrap', gap     44-47
     └─ cell View per kid                                              48-57
          wrap  → flexGrow 1, flexBasis min, minWidth 0
          row   → flex = weights[i] ?? 1, minWidth 0
          stack → flex undefined, minWidth 0
```

## 4. The kit numbers (`src/ui/tokens.ts`)

| Key | Value | Line | Means |
| --- | --- | --- | --- |
| `brand` | primary `#2596be` · secondary `#666666` · tertiary `#ebeaea` · dark `#000000` · light `#ffffff` · link `#1a6f8e` | 14-21 | the five kit colours plus the link colour; every theme value is one of these or an `alpha()` of one |
| `shadow.primary` | `0 4px 8px rgba(20, 71, 108, 0.15)` | 35 | small items: icon buttons, tiles, chips, tabs, info bars |
| `shadow.secondary` | `0 8px 16px rgba(20, 71, 108, 0.2)` | 36 | large items: cards, nav, big primary buttons, sheets, snackbar |
| `status` | green `#2e7d32` / `#66bb6a` (dark) · red `#c62828` / `#ef5350` (dark) | 40-43 | real status only: `tone.success`, `error` |
| `light` theme | bg tertiary · glass 55 % / 60 % / 65 % white · borders 85 % / 90 % white · text dark, muted secondary · sheet white · `cardShadow` = secondary, `tileShadow` = primary | 87-112 | the light screens |
| `dark` theme | bg dark · glass 8 % white · borders 16 % · text light, muted tertiary · nav 88 % black · sheet black · both shadows add a 1px inner highlight | 115-141 | follows the phone's colour scheme (`ThemeProvider`) |
| `space` | 0: 0 · 1: 4 · 2: 8 · 3: 12 · 4: 16 · 5: 24 · 6: 32 · 7: 48 · 8: 64 | 144 | the 4 px scale |
| `layout` | side 20 · sideWide 24 · gap 16 · grid 12 · top 8 | 145-151 | screen side padding, block gap, column gap, header top gap |
| `radius` | none 0 · chip 10 · control 12 · item 14 · bar 16 · card 16 · form 18 · frame 16 · pill 999 | 156-158 | owner's tightened radii (kit was 12 / 14 / 16 / 20 / 24 / 28 / 32) |
| `border` | hairline 1 · strong 2 | 159 | border widths |
| `touch` | min 44 · nav 48 · input 50 · button 52 · comfortable 56 | 161 | icon button · nav item · input and glass button · primary button and FAB |
| `maxReadWidth` | 720 | 162 | wide sheets and reading columns |
| `font` | light `Inter_300Light` · regular `Inter_400Regular` · medium `Inter_500Medium` · semibold `Inter_600SemiBold` · numeric `BebasNeue_400Regular` | 171-178 | each weight is its own family; styles pick a family, never a weight |
| `motion` | pressScale 0.98 · pressScaleSmall 0.96 | 222 | press shrink on buttons / icon buttons |
| `statusStyle` | draft circle neutral · issued clock info · partial pie-chart warning · paid check-circle success · void x-circle neutral | 225-231 | what `StatusGlyph` draws |
| `gray` | `#FFFFFF` … `#000000` in 12 steps | 4-8 | print greys for the PDF only, not used on screen |

The type scale (`type`, lines 181-219): size / line height / family.

| Name | Size / line | Family | Extra | Used for |
| --- | --- | --- | --- | --- |
| `h1` | 28 / 34 | semibold | letterSpacing −0.56 | kit H1 |
| `title` | 24 / 30 | semibold | letterSpacing −0.48 | large `TopAppBar` title |
| `subtitle` | 18 / 24 | medium | | `Sheet` title (set semibold there) |
| `heading` | 16 / 22 | semibold | | small `TopAppBar` title, solid `Button`, `FAB`, strong `TotalRow`, `EmptyState` title |
| `bodyLarge` | 16 / 22 | regular | | kit Body L 400 |
| `body` | 15 / 21 | regular | | `Input`, `SearchField`, glass `Button` (medium) |
| `bodyMedium` | 14 / 20 | regular | | large bar subtitle, `TotalRow` label, `EmptyState` text, snackbar message |
| `label` | 14 / 20 | medium | | `ListItem` title, `Chip`, `SegmentedControl`, ghost `Button` (semibold), avatar initials |
| `labelMedium` | 13 / 18 | medium | | `Input` label |
| `caption` | 12 / 16 | regular | | `ListItem` subtitle, small bar subtitle, `Badge` / `StatusGlyph` (semibold), `Input` helper, rail labels |
| `overline` | 12 / 16 | semibold | letterSpacing 0.72, upper-case | `SectionTitle` |
| `micro` | 11 / 14 | semibold | letterSpacing 0.88, upper-case | kit Micro |
| `number` | 16 / 22 | numeric (Bebas) | letterSpacing 0.5, tabular | `MoneyText` |
| `figure` | 28 / 32 | numeric | letterSpacing 0.5, tabular | KPI values, S4 TOTAL bar |
| `hero` | 44 / 48 | numeric | letterSpacing 0.5, tabular | S1 hero figure |
| `numberField` | 15 / 21 | regular (Inter) | tabular | `Input tabular` |
| `code` | 14 / 20 | monospace | | code |

Breakpoints (`useBreakpoint.ts` 6-19): xs 0 · sm 360 · md 600 · lg 768 · xl 960 · xxl 1200 (window width in dp). `panes` 1 up to md, 2 at lg, 3 at xl+; `isPhone` = xs or sm; `isTablet` = md and up; `atLeast(bp)`; `isLandscape` = width > height. `navMetrics.ts`: `NAV_HEIGHT` 68 (line 7); `useNavBottom()` = max(bottom inset, 20) (9-12); `useNavInset()` = nav bottom + 68 + 16 on phones, bottom inset + 16 on tablets (17-22).

## 5. Columns and Screen

### `Columns` (C15, `Columns.tsx` 21; decision in `columnsMode.ts` 11; tests `npm run test:columns` → `scripts/run-columns-tests.mjs`)

| Prop | Default | Does |
| --- | --- | --- |
| `kind` | `'touch'` | usable minimum per cell from `CELL_MIN` (`columnsMode.ts` 27): `touch` 44 (icon buttons) · `input` 128 (labelled fields, about ten characters) · `button` 96 |
| `minCell` | `CELL_MIN[kind]` | overrides that minimum |
| `weights` | every cell 1 | `flex` per cell in row mode (S4 qty · rate row passes `S4.qtyRateWeights`) |
| `wrap` | off | when cells would be narrower than the minimum, flow onto more lines (`flexBasis` = minimum) instead of stacking; only when at least two fit per line, else stack |
| `stackAt` | none | force a stack at that breakpoint and narrower (`ORDER` xs → xxl) |
| `gap` | `layout.grid` 12 | gap between cells, on both axes |
| `style` | none | extra style on the row view |

The decision (`columnsMode`): 1 child → row · `stackAt` reached → stack · cell = (width − 2 × side − gap × (n − 1)) / n; cell ≥ minimum → row · no `wrap` → stack · per line = floor((width − 2 × side + gap) / (minimum + gap)); ≥ 2 → wrap, else stack. Width is the row's own measured width (so a row inside a tablet pane is right); until the first `onLayout` it is the window width with `layout.side` 20 taken off each side. Every call site today passes `kind="input"`; none passes `wrap`, `stackAt` or `minCell`.

### `Screen` (C16, `Screen.tsx` 23)

| Prop | Default | Does |
| --- | --- | --- |
| `header` | none | the fixed header (`TopAppBar` pads the status inset itself) |
| `below` | none | a fixed row under the header (the S4 stepper) |
| `children` | required | Main: exactly one scroller, or a row of panes; `flex: 1, minHeight: 0` |
| `footer` | none | an action bar in the flex column, wrapped in `paddingBottom: useNavBottom()` so it clears the gesture inset and rises with the keyboard (Android `adjustResize`) |
| `fab` | none | a floating node over Main (the kit `FAB` positions itself above the nav with `useNavInset()`) |
| `overlay` | `false` | the screen has no bottom nav under it (S4, S3 overlay): Main pads 32 at the end instead of the nav inset |

| Hook | Returns | Lines |
| --- | --- | --- |
| `useFabClearance()` | 52 + 16 when the `fab` slot is set, else 0; a list card that hugs its rows adds it to its content (S2 211, S5 281) | 48-51 |
| `useMainInset()` | (`overlay` ? 32 : `useNavInset()`) + `useFabClearance()`; the bottom padding of Main's scroller (S1 100, S4 446) | 55-60 |

The clearance numbers live only here; the method forbids writing `52 + 16` or `NAV_HEIGHT` in a screen. A hosted screen (S3) uses no `<Screen>`: the shell puts the "Invoice" `TopAppBar` above it (`App.tsx` 131, 161).

## 6. Props

| Component | Props (· = optional) | Default |
| --- | --- | --- |
| `TopAppBar` | `title`, `theme` · `subtitle` · `onBack` · `actions: BarAction[]` (`{ icon, label, onPress, busy? }`) · `large` | `large` off (small centred bar) |
| `IconButton` | `icon`, `label`, `onPress`, `theme` · `color` · `busy` · `size` · `selected` · `glass` | `size` 20; ghost look; icon colour black (glass) / muted (ghost) |
| `Button` | `label`, `onPress`, `theme` · `variant` · `icon` · `danger` · `disabled` · `busy` · `style` · `labelStyle` | `variant` `'solid'` |
| `FAB` | `icon`, `label`, `onPress`, `theme` · `extended` | `extended` true (no call site turns it off) |
| `Chip` | `label`, `active`, `onPress`, `theme` · `icon` | |
| `SegmentedControl<T>` | `options: { value: T; label }[]`, `value`, `onChange`, `theme`, `label` (a11y) · `style` | |
| `Input` | `value`, `onChange`, `theme` · `label` · `onBlur` · `placeholder` · `keyboardType` · `autoCapitalize` · `multiline` · `editable` · `tabular` · `helper` · `error` · `maxLength` | `keyboardType` `'default'`, `editable` true |
| `MoneyInput` | `valuePaise`, `onChangePaise`, `theme` · the `Input` props except `value`, `onChange`, `keyboardType`, `tabular` | `placeholder` `'0.00'` |
| `SearchField` | `value`, `onChange`, `placeholder`, `theme` · `style` | |
| `Card` | `children`, `theme` · `style` · `small` · `list` · `variant` (ignored) | large card shadow, padding 16 |
| `IconChip` | `icon`, `theme` | |
| `ListItem` | `title`, `theme` · `subtitle` · `leadingIcon` · `leadingText` · `leadingAlt` · `trailing` · `onPress` · `chevron` · `divider` · `selected` · `flush` · `titleLines` | `divider` true, `titleLines` 1 |
| `ListRow` | `children`, `theme` · `onPress` · `divider` · `flush` | `divider` true |
| `initials` | `name: string` → `string` | |
| `SectionTitle` | `title`, `theme` · `right: ReactNode` | |
| `EmptyState` | `text`, `theme` · `icon` · `title` · `action: ReactNode` | |
| `StatusGlyph` | `status: InvoiceStatus`, `theme` | |
| `Badge` | `label`, `tone: 'info' \| 'success' \| 'warning' \| 'neutral' \| 'error'`, `theme` | |
| `MoneyText` | `paiseText`, `theme` · `strong` · `small` | 16 / 22 |
| `TotalRow` | `label`, `value`, `theme` · `strong` | |
| `Sheet` | `visible`, `onClose`, `title`, `theme`, `children` · `wide` | dialog 92 % / max 560; `wide` 86 % / max 720 |
| `SnackbarProvider` | `children`, `theme`, `bottomOffset` | |
| `useSnackbar()` | → `show(message, action?: { label, onPress })` | 4 s, 6 s with an action |
| `alert` | `title` · `message` · `buttons: { text, onPress?, style? }[]` | |
| `BottomTabs` | `active: Tab`, `onSelect`, `theme` | |
| `Rail` | `active`, `onSelect`, `theme`, `labels`, `onNew` | |
| `Screen` | `children` · `header` · `below` · `footer` · `fab` · `overlay` | `overlay` false |
| `Columns` | `children` · `gap` · `weights` · `kind` · `minCell` · `stackAt` · `wrap` · `style` | `gap` 12, `kind` `'touch'` |
| `ripple` | `theme` · `borderless` → `android_ripple` config | `borderless` false |

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| a colour (text, fill, border, glass, status tint) | `light` / `dark` in `tokens.ts` (87 / 115); a brand colour itself in `brand` (14). Never hex in a component |
| the blue of buttons, active tabs, the FAB | `fillStrong` / `fab` in both themes (`tokens.ts` 91, 104 · 119, 133) |
| a radius (all buttons, inputs and icon buttons share `control`; cards, nav and the phone sheet share `card`) | `radius` (`tokens.ts` 156); one component only: its `borderRadius` line (section 3) |
| a font size or weight | `type` (`tokens.ts` 181-219); the family names in `font` (171); number faces `number` / `figure` / `hero` (198-212) |
| the gap between blocks, the side padding, the column gap | `layout.gap` / `layout.side` / `layout.grid` (`tokens.ts` 145-151) |
| touch sizes (44 / 48 / 50 / 52) | `touch` (`tokens.ts` 161); keep every target ≥ 44 |
| the nav height | `NAV_HEIGHT` (`navMetrics.ts` 7); `BottomTabs`, `useNavInset()` and the snackbar offset (`App.tsx` 95) follow it |
| how far above the nav the FAB floats | `useNavInset()` (`navMetrics.ts` 17-22: nav bottom + 68 + `layout.gap`) |
| the FAB clearance a scroller or list card keeps | `useFabClearance()` (`Screen.tsx` 48-51); the overlay end padding (32) in `useMainInset()` (59) |
| the sheet's maximum height | `Sheet.tsx` 52 (phone 92 %) and 62 (dialog 86 %); dialog widths 60-61 |
| phone sheet vs dialog | `const bottom = bp.isPhone` (`Sheet.tsx` 25) |
| the snackbar duration | `Snackbar.tsx` 36 (`action ? 6000 : 4000`); fade times 28 and 35 |
| where the snackbar sits | `bottomOffset` passed in `App.tsx` 95; the extra 8 in `Snackbar.tsx` 55 |
| a cell minimum for `Columns` | `CELL_MIN` (`columnsMode.ts` 27); then `npm run test:columns` |
| a breakpoint or how many panes it gets | `STEPS` / `META` (`useBreakpoint.ts` 6-19) |
| the header's side padding or top gap | `pad` (`components.tsx` 327): `layout.side`, `layout.top` |
| the back icon in headers | `icon="chevron-left"` (`components.tsx` 345) |
| the gap between header action buttons | `gap: 10` (`components.tsx` 335, 353) |
| the label font per `Button` variant | `components.tsx` 80 |
| make `outline` look different from `tonal` | the `glassBtn` branch (`components.tsx` 44, 69-73): today both share it |
| the gap below every `Input` | `marginBottom: space[4]` (`components.tsx` 145) |
| money formatting (decimals, negatives) | `fmt` 195 and `toPaise` 197; the character filter 209 |
| the avatar colours in `ListItem` | `components.tsx` 471 (`primaryContainer` / `border`) |
| a status's icon, label or tone | `statusStyle` (`tokens.ts` 225-231); the tone colours in `theme.tone` (105-110 · 134-139) |
| the tabs of the bottom nav and rail | `TABS` (`Nav.tsx` 12-17) |
| the web fallback of `alert()` (which button counts as "cancel") | `alert.ts` 24-25 |
| press feedback | `pressScale` / `pressedDim` (`components.tsx` 21-23), `motion` (`tokens.ts` 222) |

## 8. Used by

Screens: S0 shell (`src/shell/App.tsx`) · S1 Dashboard · S2 Invoices · S3 Invoice detail (P1 payment sheet) · S4 Create invoice (P2 catalogue sheet) · S5 Products (P3 editor sheet) · S6 Settings. Counts are JSX call sites in that file.

| Component | Screens (call sites) |
| --- | --- |
| `TopAppBar` | S1 `Header` 90 (large) · S2 135 (large, 2 export actions with `busy`) · S4 `Header` 383 (back; an eye / pencil action when `eye`, passed as `md` at 363) · S5 236 (large; "New product" action off phones, export with `busy`) · S6 `Header` 224 (`large={!open}`, back when a section is `open`) · S0 `App.tsx` 131 and 161 ("Invoice" + back above the hosted S3) |
| `IconButton` | inside `TopAppBar` (325, 345), `SearchField` (241), `Sheet` (81) · S4 586 (trash per line) · S6 405 (delete draft, as a `ListItem` trailing) |
| `Button` | S3 (7: Record payment 217, Share PDF 218 tonal or solid with `busy`, Excel 220 outline with `busy`, Edit 296 outline, Void 297 ghost danger, P1 Cancel 316 ghost and Save payment 317) · S4 (5: Add from products 551 ghost, Add free line 558 outline, Save draft 707 outline, Update / Issue invoice 708 solid, Next 794 solid in `TotalBar`) · S5 (5: Delete 465 ghost danger, Restock 466 tonal, Save 467, Back 513 ghost, Add to stock 514) · S6 (3: Save 305, Export 431, Restore 432 outline, all with `busy`). Not on S1 or S2 |
| `FAB` | S1 81 "New invoice" · S2 109 "New invoice" · S5 220 "Add product"; phones only (`bp.isPhone`) |
| `Chip` | S4 619 "Ship to address" (icon truck) · S5 421 (quick names), 436 (sizes), 439 "No size" |
| `SegmentedControl` | S2 155 "Status" · S3 313 "Payment mode" (P1) · S4 720 "Page size" |
| `Input` | S2 (2: From / To dates 195, 197, tabular, maxLength 10) · S3 (1: payment amount 311, P1, with `error`) · S4 (14, among them City 505, Pincode 506 maxLength 6, dates 534 and 537 tabular, Qty 591 tabular, Discount % 614 tabular, notes 626 multiline) · S5 (4: Product name 403 with `error`, Stock 452 with `helper`, Qty to add 504 with `error`, Note 509) · S6 (15, among them Address 318 multiline, Pincode 321, PAN 324, A/C no 345, IFSC 346, Next number 364 `editable={false}`) |
| `MoneyInput` | S4 594 "Rate (₹)" · S5 450 "Price (₹)" and 506 "New price (₹)" with `placeholder` and `helper` |
| `SearchField` | S2 181 · S4 747 (catalogue pane) and 807 (P2) · S5 269 |
| `Card` | S1 (2: hero, stat tile 149 `small`) · S2 (2: list card 220 `list`, `ActivityPane` card 289 `small` on 3-pane tablets) · S3 (3) · S4 (8; 677 and 748 `list`) · S5 (2; 283 `list`) · S6 (8; 259, 379, 442, 459 `list`) |
| `ListItem` | S2 254 (invoice row: `initials`, `leadingAlt`, `selected` on panes, `chevron` on phones) · S4 754 (catalogue pane, `titleLines` 2 in a narrow pane) and 812 (P2) · S5 345 (phone card row, `leadingAlt`) · S6 261 (sections, `leadingIcon`), 396 (drafts, `initials`), 444 (backups, "archive"), 462 (activity, "clock") |
| `ListRow` | S5 327 (table row, `flush`) |
| `initials` | S2 257 · S6 399 |
| `IconChip` | S1 150 (stat tiles) · inside `ListItem` for `leadingIcon` (S6 261, 444, 462) |
| `SectionTitle` | S3 (1) · S4 (5: Bill to, Items with a `right` slot 550, Adjustments, Products) · S5 (2: editor title, Stock history) · S6 (7) |
| `EmptyState` | S2 (3) · S4 (3) · S5 (3) · S6 (2); `icon` and `title` are used, `action` is not |
| `StatusGlyph` | S2 267 (list row) · S3 195 |
| `Badge` | S1 121 (invoice count) · S4 762 and 824 (`Avl n`: error / neutral / success) · S5 65 (same rule) |
| `MoneyText` | S2 266 (`small`) · S3 263-265 (items table, `small`) · S4 599, 691 (`small`), 823 (`small`) |
| `TotalRow` | S3 276-283 (Gross, Discount, Round off, Total `strong`, Paid, Balance due) · S4 653-658 (Subtotal, Discount, Round off, Total `strong`) |
| `Sheet` | S3 306 P1 "Record payment" · S4 806 P2 "Add from products" (`wide`) · S5 388 P3 editor (`wide`) |
| `SnackbarProvider` / `useSnackbar` | provider `App.tsx` 95 · `snack()` in S3 (void, payment), S4 (issued / updated, saved to drafts), S5 (saved, deleted, restocked), S6 (settings saved, restored, draft deleted) |
| `alert` | S2 78 (export failed) · S3 69 (Void?), 120 · S4 259, 264 (validation) · S5 140 (Delete?), 181, 188 · S6 122, 136 (Restore?), 153, 160 (Delete draft?) |
| `BottomTabs` / `Rail` | `App.tsx` 139 (phones) · 147 (tablets, `labels={bp.atLeast('xl')}`) |
| `Screen` | S1 79 (`header`, `fab`) · S2 114 (`header`, `fab`) · S4 334, 348, 363 (`overlay`, `header`) · S5 222 (`header`, `fab`) · S6 198, 209 (`header`). Not S3 (hosted) |
| `useMainInset` / `useFabClearance` | S1 100, S4 446 · S2 211, S5 281 |
| `Columns` | S2 193 (From · To) · S4 504, 516, 531, 590 (Qty · Rate with `weights`) · S5 449 (Price · Stock), 503 (Qty to add · New price) · S6 295 (`FieldRow` wrapper); all `kind="input"` |
| `useBreakpoint` | S1, S2, S4, S5, S6, the shell, `Sheet`, `Columns`, `navMetrics` (not S3) |
