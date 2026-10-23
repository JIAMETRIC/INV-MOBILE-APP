# The Header / Main / Footer method, checked against the mobile rules

Written 2026-10-23 (session 14, Prompt 20); §7 and §8 added the same day after the method was applied to all six screens (Prompts 21–57). The method under review:

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
| **Touch targets** (kit 44 × 44; Material 48 dp) | Every tappable ≥ 44 | Unaffected by the slots; affected by **columns** | ⚠️ columns → ✅ closed (§7.1) | A row of 3 columns on a 360 dp phone gives ≈ 105 dp cells: fine for buttons, tight for labels ("Products Sold" wraps to 2 lines, S1.2). Rule: ≤ 3 columns on phones, ≤ 2 when the cell has a label and a value; a tappable cell is never narrower than 44. |
| **Responsive reflow** (orientation, foldables, tablets) | Layouts must re-arrange by width, not by device | Rows become columns and panes appear by breakpoint (`bp.isPhone`, `bp.panes`) | ✅ with care | Every row that splits into columns needs a stated rule for when it stacks (xs?). Today most rows keep 2 columns down to 320 dp, which works because inputs are flexible. Write the rule once in the tree file so a new row follows it. |
| **Lists and scrolling** | Long lists virtualise (`FlatList`); the last item must not hide under a fixed footer or nav; sticky section headers are allowed inside the list | Main holds the list; Footer is fixed | ⚠️ coupling → ✅ closed (§7.2) | **Footer height → Main bottom padding.** Today each screen hard-codes it (`useContentInset(true)` = nav + 52 + 16; S2's `fabClearance`). The scaffold can measure the footer with `onLayout` and pad Main automatically (one extra layout pass on first render, then cached). Until then, keep the constants in each screen's `S<n>` block. |
| **Keyboard** | The focused field must stay visible; the primary action should stay reachable | Footer in the flex column; `adjustResize` shrinks the window, column reflows | ✅ on Android | On a 360 × 800 phone with the keyboard open, S4 keeps ≈ 300 dp for the form (800 − keyboard ≈ 300 − header 100 − stepper 60 − TOTAL bar 80). Acceptable; the common refinement is to **hide the footer while the keyboard is open** when it is taller than one row. Decide per screen. |
| **Accessibility / screen readers** (TalkBack) | Reading order follows the view tree; headings marked; actions reachable | Tree order = Header → Main rows (left-to-right inside a row) → Footer | ✅ naturally | This is the method's quiet win: the structure *is* the reading order. Add `accessibilityRole="header"` to the header title (C1 can do it once). Footer actions come last, after the content, which is the expected order. |
| **RTL** | Rows mirror; use `start`/`end`, not `left`/`right` | Flex rows mirror automatically | ✅ | One pre-existing `left`/`right` in `Nav.tsx:53` (symmetric, so harmless). Keep `marginStart`/`end` in new rows. |
| **Performance** | Avoid needless re-renders; list rows should be cheap | Rows as small components | ⚠️ one habit → ✅ closed (§7.3) | Passing the whole `list` object (as S2 does) re-renders every piece on any state change. Negligible for a screen; for **list rows** wrap the row in `React.memo` (S2's `InvoiceRow` is not yet; pre-existing behaviour, every visible row re-renders per keystroke in search). The scaffold itself adds one `View`: no measurable cost. |
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

## 7. What was built afterwards: the three warnings closed

Status on 2026-10-23 after Prompts 21–57. Each ⚠️ row of §2 now has a piece of code that enforces the rule, so a new screen cannot get it wrong by habit.

### 7.1 Columns (touch targets, reflow) → `src/ui/Columns.tsx` + `columnsMode.ts` (C15)

| Problem | Solution |
| --- | --- |
| Three columns at 360 dp ≈ 105 dp each: fine for buttons, tight for labelled inputs; every row had its own stacking rule, or none | `<Columns kind="input">`: each child becomes a column; `kind` sets the usable minimum per cell (`touch` 44, `input` 128, `button` 96; `minCell` overrides); `weights={[1, 1.4]}` for unequal cells; `stackAt="sm"` forces a stack at that breakpoint and narrower |
| A 4th column had nowhere to go but a full stack | `wrap`: cells flow onto more lines, each at least `minCell` wide (4 inputs → 2 + 2 on a phone, back to one row on a tablet); it falls back to a stack when fewer than 2 cells fit a line |
| A row inside a tablet pane decided from the **window** width | `Columns` measures its own width with `onLayout` and decides from that; until the first layout it uses the window width minus the side padding |
| No way to test the rule | `columnsMode()` is a pure function; `npm run test:columns` runs 10 cases (`scripts/run-columns-tests.mjs`) |

Used in 8 rows across S2 (date range), S4 (city | pincode, mobile | email, dates, chips), S5 (search row, price | stock), S6 (the six two-column form rows via `FieldRow`). Rows that are **not** `Columns`, with the reason in their comment: S1's three stat tiles (the kit is 3-across at every width, one figure per cell) and S3's items table (a table with a header, flexes from `S3.itemColumns`).

### 7.2 Lists and the footer / FAB coupling → `src/ui/Screen.tsx` (C16)

| Problem | Solution |
| --- | --- |
| Each screen hard-coded the nav + FAB clearance (`useContentInset(true)`, `S2.fabClearance`, `52 + 16` in three files) | `<Screen header below footer fab overlay>`; **`useMainInset()`** = the nav inset (or 32 in an overlay) + the FAB clearance when the `fab` slot is set; **`useFabClearance()`** for a list card that hugs its rows. `useContentInset` was deleted; `grep` finds no clearance arithmetic outside `Screen.tsx` |
| "Measure the footer with `onLayout`" (the §2 proposal) | Not needed, and documented as a decision: a footer in the flex column takes its own space, so Main never overlaps it; the only floating things are the nav (a shell constant, 68) and the FAB (a kit token, 52). Measuring would add a layout pass for a number that is already known |
| On short screens (phone landscape, 914 × 411 dp) the filters above S2's list left the list card 0 dp tall | Under `S2.shortScreen` (600 dp) the filters move into the `FlatList`'s `ListHeaderComponent`, so the one scroller holds them and the card keeps its height (the generic rule in §8.5) |

### 7.3 Performance → memoised rows

| Problem | Solution |
| --- | --- |
| Every visible row re-rendered per keystroke in search | Every list row is `React.memo` with explicit props: `InvoiceRow` (S2), `LineRow` (S3), `ProductTableRow` / `ProductListRow` (S5), `DraftRow` (S6); their `onPress` / `onOpen` / `onDelete` come from `useCallback` in the screen's hook |

### 7.4 Also decided while applying the method

| Topic | Decision |
| --- | --- |
| md (600–767 dp, an 8-inch tablet in portrait at 601 dp) | **one pane** with the rail (`panes: 1`); two panes left the list, the items header and the products table cramped. `bp.isPhone` (xs, sm) decides nav + FAB vs rail; `bp.panes === 1` (xs, sm, md) decides one pane vs master-detail |
| Hosted screens (S3 Invoice detail) | an **embeddable Main**: no `<Screen>` wrapper, no header or footer of its own; the shell's back bar hosts it on one pane, S2's `DetailPane` on lg+ |
| Pane widths | percentages of the row (`'38%'`, `'42%'`); a `ScrollView` pane needs `flexGrow: 0, flexShrink: 0` or it grows past its width |
| Tables | S5's six-column table needs ≥ 520 dp (`S5.tableMinWidth`); narrower, the rows become card rows. S2's activity pane shows only at xxl. A narrow list cell may wrap its title (`ListItem titleLines={2}`) |
| The `Loaded` pattern | a screen with an early spinner casts once (`type Loaded = State & { inv: Invoice }`) so no region handles `null` |
| One source for shared numbers | the S3 items table header and rows read the same `S3.itemColumns`; the S5 table its `S5.columns` |
| Verification | `/size-check`: the phone AVD resized with `wm size` / `wm density` to eight profiles (xs 320, sm 360, phone 411, phone landscape = lg, 8-inch portrait = md, 8-inch landscape = xl, 10-inch portrait = lg, 10-inch landscape = xxl), the dev client relaunched, every screen screenshotted from **one** process. For a restructure, phone screenshots before and after are compared pixel by pixel (target 0.000 %) |
| Portability | the rules, the helpers and the tour script are bundled as the user-level skill `~/.claude/skills/responsive-screens/` for the next app |

## 8. Best practices: the final list

1. **Three slots on `<Screen>`.** Header fixed; Main = exactly one scroller (or a row of panes) with `flex: 1`; Footer phones-only, in the flex column, padded by the gesture inset. The nav and rail belong to the shell.
2. **Clearance from one place.** Main's scroller ends with `useMainInset()`; a list card that hugs its rows adds `useFabClearance()`. Never write `52 + 16` or `NAV_HEIGHT` in a screen.
3. **Rows are `<Columns>`.** `kind` by content (`input` 128, `button` 96, `touch` 44), `wrap` when a 4th cell is possible, `stackAt` when the design says stack. A row that is deliberately not `Columns` says why in its comment.
4. **≤ 3 columns on phones; ≤ 2 when a cell carries a label and a value;** a tappable cell ≥ 44 wide; `marginStart` / `End`, never `left` / `right`.
5. **Short screens:** anything above a list goes into the list's header so the one scroller owns it and the list card cannot collapse.
6. **Lists:** `FlatList` for lists, `ScrollView` for forms, never nested; rows `React.memo` with handlers from `useCallback`.
7. **Branch on the window, not the device:** `bp.isPhone` for nav + FAB vs rail, `bp.panes === 1` for one pane vs master-detail; md is one pane. Phones in landscape are lg and get the tablet layout.
8. **Panes:** percentage widths; `flexGrow: 0, flexShrink: 0` on a `ScrollView` pane; a table has a minimum width and a card-row fallback.
9. **Hosted screens are embeddable Mains:** no `<Screen>` wrapper, no header or footer of their own.
10. **The file order:** labels → `S<n>` numbers (one per line, with IDs) → `use<Screen>()` (no JSX) → `<Screen>Screen()` (the switch) → one named function per region in on-screen order; shared numbers read from one place.
11. **Verify every layout change** with `/size-check` at the profiles the change touches, all eight for a new screen; a restructure must be pixel-identical on the phone before and after.
12. **Document:** the screen's tree file (regions, IDs, "where to change what"), the layout reference by function name, the decision in TRACKING, the verification in the walkthrough.
