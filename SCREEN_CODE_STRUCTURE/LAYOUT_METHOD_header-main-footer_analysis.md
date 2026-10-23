# The Header / Main / Footer method, checked against the mobile rules

Written 2026-10-23 (session 14, Prompt 20). The method under review:

```
┌──────────────────────────┐
│ HEADER   title · buttons │  fixed, never scrolls
├──────────────────────────┤
│ MAIN     rows            │  scrolls (or a list), takes the remaining height
│   row                    │
│   row  [ col | col ]     │
│   row                    │
├──────────────────────────┤
│ FOOTER   action bar      │  fixed, rises with the keyboard
└──────────────────────────┘
   bottom nav (global, owned by the app shell, not by the screen)
```

Facts this rests on, checked in the repo today: React Native 0.88 / Expo SDK 58, Android only; `windowSoftInputMode="adjustResize"` (AndroidManifest.xml:19); `edgeToEdgeEnabled=true` (gradle.properties:53); safe-area insets from `react-native-safe-area-context`; breakpoints xs/sm/md/lg/xl/xxl in `src/ui/useBreakpoint.ts`; the Flat Glass kit in `design/DESIGN.md`.

## 1. Verdict in one paragraph

The method is sound. It is the same structure that React Native's flexbox, Material Design 3, Apple's HIG and this project's own design kit all assume, so it adds no new mechanism and breaks no rule. Its real costs are three couplings it creates (footer height ↔ main padding, keyboard ↔ footer, columns ↔ screen width), and each has a known fix that the scaffold can own once instead of every screen repeating it. The one place it bends is wide screens, where "footer" stops being a global bar and becomes a per-pane action row; that matches Material's guidance, so it is a rule to write down, not a flaw.

## 2. Rule-by-rule

| Rule set | What the rule says | Method | Fit | Trade-off / what to watch |
| --- | --- | --- | --- | --- |
| **React Native / Yoga flexbox** | `View` = column; `flexDirection: 'row'` = row; `flex: 1` fills what is left; never nest two scrollers of the same direction | A column of three children; Main is `flex: 1`; rows inside Main | ✅ native | Main must hold exactly **one** scroller (a `ScrollView` for forms, a `FlatList` for lists). The scaffold must not wrap Main in its own `ScrollView`, or every list screen breaks virtualisation. |
| **Material Design 3 (Android)** | Top app bar; navigation bar at the bottom (global); bottom app bar / action bar for compact widths; FAB anchored bottom-end above the nav; canonical layouts (list-detail, supporting pane) for medium/expanded widths; window size classes compact < 600, medium 600–840, expanded ≥ 840 | Header = top app bar · Footer = bottom action bar · nav global · tablet Main = row of panes | ✅ | M3's medium/large top app bars **collapse on scroll**; the method's header is fixed. Fine for this app (short headers), but it rules out the collapsing-title effect. M3 keeps the bottom action bar for **compact** width only: on tablets, actions move into the pane that owns them (S4.F already does this). |
| **Apple HIG (if ever ported)** | Navigation bar / content / toolbar or tab bar; respect safe areas; keyboard does **not** resize the window | Same three slots | ✅ structure | iOS needs `KeyboardAvoidingView` around the column for the footer to rise (Android's `adjustResize` does it for free). The scaffold is the one place to add it; `Sheet.tsx` already does this for sheets. |
| **System bars & safe areas** (status bar, gesture bar, edge-to-edge on Android 15+) | Content may draw under system bars; the app must pad for them | Header pads `insets.top + 8` (C1); footer and FAB pad `max(insets.bottom, 20)` (`useNavBottom`) | ✅ already done per component | With `edgeToEdgeEnabled=true` this is mandatory, not optional. The scaffold should own both insets so a new screen cannot forget them. Landscape adds left/right insets; the shell's `SafeAreaView edges={['left','right']}` covers tablets, phones in landscape are not handled today (pre-existing). |
| **Touch targets** (kit 44 × 44; Material 48 dp) | Every tappable ≥ 44 | Unaffected by the slots; affected by **columns** | ⚠️ columns | A row of 3 columns on a 360 dp phone gives ≈ 105 dp cells: fine for buttons, tight for labels ("Products Sold" wraps to 2 lines, S1.2). Rule: ≤ 3 columns on phones, ≤ 2 when the cell has a label and a value; a tappable cell is never narrower than 44. |
| **Responsive reflow** (orientation, foldables, tablets) | Layouts must re-arrange by width, not by device | Rows become columns and panes appear by breakpoint (`bp.isPhone`, `bp.panes`) | ✅ with care | Every row that splits into columns needs a stated rule for when it stacks (xs?). Today most rows keep 2 columns down to 320 dp, which works because inputs are flexible. Write the rule once in the tree file so a new row follows it. |
| **Lists and scrolling** | Long lists virtualise (`FlatList`); the last item must not hide under a fixed footer or nav; sticky section headers are allowed inside the list | Main holds the list; Footer is fixed | ⚠️ coupling | **Footer height → Main bottom padding.** Today each screen hard-codes it (`useContentInset(true)` = nav + 52 + 16; S2's `fabClearance`). The scaffold can measure the footer with `onLayout` and pad Main automatically (one extra layout pass on first render, then cached). Until then, keep the constants in each screen's `S<n>` block. |
| **Keyboard** | The focused field must stay visible; the primary action should stay reachable | Footer in the flex column; `adjustResize` shrinks the window, column reflows | ✅ on Android | On a 360 × 800 phone with the keyboard open, S4 keeps ≈ 300 dp for the form (800 − keyboard ≈ 300 − header 100 − stepper 60 − TOTAL bar 80). Acceptable; the common refinement is to **hide the footer while the keyboard is open** when it is taller than one row. Decide per screen. |
| **Accessibility / screen readers** (TalkBack) | Reading order follows the view tree; headings marked; actions reachable | Tree order = Header → Main rows (left-to-right inside a row) → Footer | ✅ naturally | This is the method's quiet win: the structure *is* the reading order. Add `accessibilityRole="header"` to the header title (C1 can do it once). Footer actions come last, after the content, which is the expected order. |
| **RTL** | Rows mirror; use `start`/`end`, not `left`/`right` | Flex rows mirror automatically | ✅ | One pre-existing `left`/`right` in `Nav.tsx:53` (symmetric, so harmless). Keep `marginStart`/`end` in new rows. |
| **Performance** | Avoid needless re-renders; list rows should be cheap | Rows as small components | ⚠️ one habit | Passing the whole `list` object (as S2 does) re-renders every piece on any state change. Negligible for a screen; for **list rows** wrap the row in `React.memo` (S2's `InvoiceRow` is not yet; pre-existing behaviour, every visible row re-renders per keystroke in search). The scaffold itself adds one `View`: no measurable cost. |
| **The project's design kit** (DESIGN.md §4, §7) | One flat background; top padding 56, sides 20; floating nav 20 from the edges; content bottom padding 112 so it clears the nav; the Music Player pins its device bar to the bottom with `margin-top: auto` | Header / Main / Footer / nav | ✅ exact | The kit's four reference screens are literally header, body, footer. The scaffold is where "one flat background" and "sides 20" get set once. |
| **Sheets / dialogs** (P1–P3) | Title row, scrolling body, action row; max 92 % height on phones | Same three slots, inside `Sheet` | ✅ | Already the shape of `Sheet.tsx` (title + ✕, `ScrollView`, children). No change needed; worth naming the slots the same way for consistency. |

## 3. The pitfalls table, re-checked

| Pitfall | Correct? | Precise statement |
| --- | --- | --- |
| `FlatList` inside a `ScrollView` | Yes | RN warns; the list stops virtualising and renders every row. The scaffold must never wrap Main in a `ScrollView`. |
| Forgetting `flex: 1` on Main | Yes (wording fixed) | Main then takes only its content height: the footer sits right under the last row, and tall content pushes it off-screen. |
| Footer vs keyboard | Yes, with the real reason | Android `adjustResize` shrinks the window; the column reflows, so a footer in the column rises (so would an absolute `bottom: 0` one). Breaks only under `adjustPan` or on iOS without `KeyboardAvoidingView`. |
| Per-screen bottom nav | Yes | Tab switches unmount screens; a nav inside them would be rebuilt each switch. It stays in the shell. |

## 4. Trade-offs, summarised

| You gain | You pay |
| --- | --- |
| One reading order for every screen, matching the on-screen order and the screen-reader order | A few more lines per screen (function signatures, comments); S2 went 159 → 265 |
| Insets, background, side padding, keyboard handling written **once** in the scaffold | One more shared component to maintain (`src/ui/Screen.tsx`, ~40 lines) |
| Edits become "open the named region" instead of "search the JSX" | Pieces that take the whole state object re-render together (fine for screens; memoise list rows) |
| Rows/columns map 1-to-1 to flexbox, Material and the kit | Columns need a stacking rule per breakpoint, and ≤ 3 on phones |
| The footer is a real slot (S4 has one; others are empty or FAB-only) | Footer height couples to Main's bottom padding until the scaffold measures it |
| Tablets: Main becomes a row of panes with no change to the method | On wide screens "footer" becomes per-pane (M3), so the rule has two forms by width |

## 5. Conventions to adopt (the method, made precise)

1. **Header**: fixed; pads the status-bar inset; title carries `accessibilityRole="header"`; actions are glass icon buttons (C1).
2. **Main**: exactly one scroller: `ScrollView` for forms, `FlatList` for lists; side padding 20, gap 16; bottom padding = nav inset + footer height (+ FAB when one floats).
3. **Footer**: compact widths only; sits in the flex column (so it rises with the keyboard); pads the gesture inset; hide it while the keyboard is open if it is taller than one row. On medium/expanded widths actions live in the pane that owns them.
4. **Rows and columns**: a row is `flexDirection: 'row'` with `gap: 12`; equal columns are `flex: 1`; ≤ 3 columns on phones; a tappable cell is ≥ 44 wide; every split row states when it stacks (xs by default).
5. **Lists**: rows are their own `React.memo` component; the last row clears the footer and nav.
6. **Navigation**: the bottom nav and the tablet rail belong to the shell (S0), never to a screen.

## 6. Recommendation

Adopt the method. Build `src/ui/Screen.tsx` (header / main / footer, insets, background, `flex: 1`, optional footer measuring) and apply it screen by screen, S4 first because it already has all three parts and is the longest file; confirm each screen in the emulator before the next. Record each screen's row/column stacking rule in its tree file.
