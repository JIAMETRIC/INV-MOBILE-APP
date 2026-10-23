---
name: three-slot-screen
description: Restructure a React Native screen file with the Three-Slot Screen method (Header / Main / Footer, rows and columns inside Main, one named function per region, a state hook, an S-numbers block) without changing behaviour. Use when the user asks to restructure, split, reorganise or "apply the three-slot method" to a screen, or names a screen ID (S1–S6) and asks to make its code readable.
---

# Three-Slot Screen (3SS)

Every screen is a column of three slots. Inside Main, rows stack top to bottom and a row may split into columns. Each slot and each row is a named function in the screen file, so an edit means opening the region by name.

```
HEADER   title · buttons        fixed, never scrolls
MAIN     rows, [col | col]      exactly one scroller, takes the remaining height
FOOTER   action bar             phones only, in the flex column, rises with the keyboard
bottom nav                      owned by the app shell (S0), never by a screen
```

Reference: `SCREEN_CODE_STRUCTURE/LAYOUT_METHOD_header-main-footer_analysis.md` (rules and trade-offs), `SCREEN_CODE_STRUCTURE/three-slot-screen.html` (snippets), `SCREEN_CODE_STRUCTURE/InvoicesScreen_S2_tree.md` (a finished example: S2).

## 1. Inspect before touching anything
- Open the screen file and every file it imports from `src/ui`, `src/shell`, `src/data`, `src/export`.
- Read its tree file in `SCREEN_CODE_STRUCTURE/<Screen>_<ID>_tree.md` and its section in `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`; the IDs there (S4.B.3) go into the new function comments.
- Note every inline number (gaps, widths, clearances, pane percentages) and every piece of state.
- Show the owner the current structure and the proposed function tree. **Wait for their OK** before editing.

## 2. The file order (reading order)
Write the file so it reads top to bottom:
1. **Labels**: constants for text that appears on screen (`STATUSES`, step names).
2. **`S<n>` block**: every number specific to this screen, one per line, each with its ID in a trailing comment (`detailWidth: { 2: '50%', 3: '42%' }, // S2.7`). Shared spacing stays in `src/ui/tokens.ts` (`layout.side` 20, `layout.gap` 16, `layout.grid` 12).
3. **`use<Screen>()` hook**: all state, effects, data loading and actions. No JSX. Return a plain object; type it with `ReturnType<typeof use<Screen>>`.
4. **`<Screen>Screen()`**: the phone / tablet switch only, ~20 lines. Phone = `Header` + `Main` (+ `Footer`); tablet = `Header` + a row of panes.
5. **One function per region**, in on-screen order: `Header`, then the rows of Main (`FilterRow`, `DateRangeRow`, `InvoiceListCard`, `InvoiceRow` …), then `Footer`, then tablet-only panes (`DetailPane`, `ActivityPane`).

Each region function starts with a one-line comment: its ID and what it draws (`// S2.3a — one row, two equal columns: From | To`). Pieces take `theme` plus only what they use; the state object may be passed whole for brevity, but list rows get explicit props and `React.memo`.

## 3. Rows and columns
- A row is `<View style={{ flexDirection: 'row', gap: layout.grid }}>`; equal columns are children with `flex: 1`; a wider one gets `flex: 1.4`; a fixed one gets `width`.
- ≤ 3 columns on phones; ≤ 2 when a cell carries a label and a value. A tappable cell is ≥ 44 wide.
- Every split row states when it stacks (`bp.bp === 'xs' ? 'column' : 'row'` by default, or "never" in its comment).
- Keep `marginStart` / `End`, never `left` / `right`.

## 4. Slots
- **Header**: `TopAppBar` (C1). It pads the status inset itself. Never scrolls.
- **Main**: exactly one scroller: `ScrollView` for forms, `FlatList` for lists. Never nest one in the other. Side padding `layout.side`, gap `layout.gap`. Bottom padding clears the nav plus the footer or FAB (`useContentInset(withFab)`, `useNavInset()`, or the screen's `S<n>.fabClearance`).
- **Footer**: phones only (`bp.isPhone`). It lives in the flex column so Android's `adjustResize` lets it rise with the keyboard; it pads the gesture inset (`useNavBottom()`). On tablets, actions stay in the pane that owns them.
- **Bottom nav / rail**: stays in `src/shell/App.tsx` and `src/ui/Nav.tsx`. A screen only reserves space above it.
- When `src/ui/Screen.tsx` exists, use `<Screen header={…} footer={…}>{main}</Screen>`; otherwise the screen function builds the same column by hand (`flex: 1` on Main).

## 5. What must not change
- Behaviour, data calls, navigation calls, the kit components and their props, the rendered screen.
- `src/ui/components.tsx` and `src/ui/tokens.ts` (this skill reorganises screens; it does not restyle them; use `/apply-design` for that).
- IDs in `SCREEN_LAYOUT_REFERENCE.md`: keep them; add new ones at the end of a section, never renumber.

## 6. Verify
- [ ] `npm run typecheck` is clean
- [ ] Reload the dev client (`adb shell am force-stop` + the `invoiceerp://expo-development-client/?url=…` deep link, so Metro sends a fresh bundle), open the screen, exercise each region (toggle filters, open sheets), and compare a screenshot with one taken before the change: identical
- [ ] When the change touches a breakpoint branch (`bp.isPhone`, `bp.panes`, `bp.atLeast`) or a `Columns` row, run `/size-check` (resizes the phone emulator to the phone and tablet profiles and screenshots every screen); otherwise say which sizes were read only
- [ ] Only one scroller inside Main; `flex: 1` on Main; no `FlatList` inside a `ScrollView`

## 7. Document
- Rewrite the screen's tree file (`SCREEN_CODE_STRUCTURE/<Screen>_<ID>_tree.md`) for the new functions and today's line numbers.
- In `SCREEN_LAYOUT_REFERENCE.md`, replace that screen's line-number column with the function names.
- Record the decisions in `SCREEN_CODE_STRUCTURE/SCREEN_CODE_STRUCTURE_TRACKING.md` and the verification in `_walkthrough.md`; append the prompt to `_session-prompts.md` (AGENTS.md rules).

Report what moved, what was renamed, and what could not be verified.
