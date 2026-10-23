# App shell (S0) — Three-Slot tree

**Files:** `src/shell/App.tsx` (170 lines) · `src/shell/navigation.tsx` (90) · `src/shell/providers.tsx` (15) · `src/ui/Nav.tsx` (116) · `src/ui/navMetrics.ts` (24) · `src/ui/useBreakpoint.ts` (34); line numbers as of 2026-10-23 · **Reached by:** the app's entry point; every screen sits inside it · **Data:** `getDb()` `src/data/db.ts`, `syncNextSeq()` `src/data/settingsRepo.ts`, `ensureDailyBackup()` `src/data/backupRepo.ts` (App.tsx:60-63) · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S0 · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

The shell is the frame the Three-Slot method leaves out of every screen: it unlocks the database, loads the fonts, holds the current tab and overlay, and draws the floating bottom nav (phones) or the rail (md and up). It is not a screen, so it has no `S0` block and no state hook of its own: its state is `NavProvider`, and its numbers live in `navMetrics.ts`, `useBreakpoint.ts` and `tokens.ts`. `bp.isPhone` (xs, sm) decides bottom nav versus rail; `bp.panes === 1` (xs, sm, md) decides whether the Invoice detail overlay is drawn at all.

## 1. What the shell owns and what a screen owns

| Side | Slot or piece | What it is | Where |
| --- | --- | --- | --- |
| Shell | Providers | `SafeAreaProvider` → `ThemeProvider` (light or dark from the phone) → `NavProvider` → `SnackbarProvider` | App.tsx:33-34, 93-95 |
| Shell | Status bar | `StatusBar style="auto"`; the Loading and Error states set it explicitly from `theme.dark` | App.tsx:36, 74, 84 |
| Shell | Start-up states | S0.1.1 Loading · S0.1.2 Error · S0.1.3 Ready | App.tsx:71-99 |
| Shell | Tab switch | `nav.tab` → S1 / S2 / S5 / S6 | App.tsx:107-114 |
| Shell | Bottom nav (phones) | `BottomTabs`, absolute over the tab screen, S0.4.2 | App.tsx:139, Nav.tsx:45 |
| Shell | Rail (md+) | `Rail` beside the content, "+" button and the four items, labels at xl+, S0.4.3 | App.tsx:147-153, Nav.tsx:69 |
| Shell | Overlays | `create-invoice` → S4 full screen (phones) or in place of the tab screen beside the rail (md+); `invoice-detail` → S3 under the shell's "Invoice" back bar (phones, and md where `panes === 1`) | App.tsx:121-135, 155-165 |
| Shell | Back bar | `TopAppBar title="Invoice"` with `onBack = nav.closeOverlay`; S3 is a hosted Main and brings no header | App.tsx:131, 161 |
| Shell | Insets | md+: `SafeAreaView edges left, right` round the row and `edges bottom` round the content; phones: `edges bottom` round the Invoice overlay only; app bars pad the status inset and the nav bar the gesture inset themselves | App.tsx:118-119, 130, 145, 154 |
| Shell | Snackbar | `SnackbarProvider bottomOffset`: phones `NAV_HEIGHT + 52 + 2 * 16 + 8` (160), md+ 0 | App.tsx:95 |
| Shell | Android Back | innermost screen interceptor → close overlay → Home → leave the app | navigation.tsx:71-81 |
| Screen | Header | `TopAppBar` (C1), pads the status inset itself | each screen's `Header` |
| Screen | Main | exactly one scroller or a row of panes; end padding `useMainInset()` | each screen's `…Main` |
| Screen | Footer | phones only, in the flex column; `<Screen>` pads it with `useNavBottom()` | Screen.tsx:40 |
| Screen | fab | the `fab` slot of `<Screen>`; `FAB` (C9) floats `useNavInset()` above the bottom | Screen.tsx:41, components.tsx:591 |

The contract between the two sides is three hooks:

| Hook | Returns | Used by |
| --- | --- | --- |
| `useNavBottom()` (navMetrics.ts:9) | `max(gesture inset, 20)`: the nav's distance from the bottom edge | `BottomTabs` `bottom` (Nav.tsx:48); the Footer's padding (Screen.tsx:33) |
| `useNavInset()` (navMetrics.ts:17) | phones: `useNavBottom() + 68 + 16`; md+: gesture inset + 16: the space a screen keeps clear above the nav | `FAB` (components.tsx:591); the list cards' `marginBottom` in S2, S5 and S6; `useMainInset()` |
| `useMainInset()` (Screen.tsx:55) | `useNavInset()` (or 32 in an overlay) plus `useFabClearance()` (52 + 16 when the `fab` slot is set) | every Main scroller; a card that hugs its rows adds `useFabClearance()` to its content instead |

A screen never writes `NAV_HEIGHT` or `52 + 16` itself: `navMetrics.ts` and `Screen.tsx` are the only files that know them.

## 2. The file in reading order (`App.tsx`)

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | imports: fonts per weight, the six screens, `BottomTabs` / `Rail`, `NAV_HEIGHT` | 1-29 | which fonts the app loads (one subpath per weight, so the bundle has five styles, not eighteen); which screen files the shell knows |
| 2 | `App()` | 31-41 | the provider stack and the status bar |
| 3 | `Root()` | 43-100 | fonts, the database, the Loading / Error / Ready switch, `NavProvider`, `SnackbarProvider` |
| 4 | `Shell()` | 102-170 | the tab switch; which overlay is drawn where; the phone frame and the md+ frame |

The companion files, in the order the tree below meets them:

| File | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| `providers.tsx` | `useTheme()` · `ThemeProvider` | 7-9 · 11-15 | `dark` or `light` from `useColorScheme()` |
| `navigation.tsx` | `Overlay` type · `NavApi` · `useNav()` · `useBackIntercept()` · `NavProvider` | 5-8 · 13-26 · 30-34 · 38-43 · 45-90 | overlays, the nav API, the Back order |
| `Nav.tsx` | `Tab` · `TABS` · `NavItem` · `BottomTabs` · `Rail` | 10 · 12-17 · 21-41 · 45-65 · 69-116 | destinations, the nav item, the floating bar, the rail |
| `navMetrics.ts` | `NAV_HEIGHT` · `useNavBottom()` · `useNavInset()` | 7 · 9-12 · 17-22 | the bottom spacings the nav, the FAB and the list cards share |
| `useBreakpoint.ts` | `STEPS` · `META` · `useBreakpoint()` | 6-8 · 10-19 · 21-34 | the width steps, `panes` per step, `isPhone`, `atLeast` |

## 3. Tree

```
App()                                                                      App.tsx 31
├─ SafeAreaProvider                                                                33
├─ ThemeProvider                light / dark from the phone (providers.tsx 11)     34
├─ StatusBar "auto"                                                                36
└─ Root()                                                                          43
     ├─ useFonts                Inter 300 / 400 / 500 / 600 + Bebas Neue 400       48
     │                          fontsReady = loaded or failed (system font then)   52
     ├─ effect                  getDb() → syncNextSeq() → 'ready';                 57
     │                          then ensureDailyBackup() in the background
     ├─ S0.1.1 Loading          state 'loading', or the fonts not ready yet        71
     │    └─ centred column, gap 12: spinner (accent) ·
     │       "Invoice ERP" (type.title) · "Unlocking database…" (type.bodyMedium)
     ├─ S0.1.2 Error            state 'error'                                      81
     │    └─ centred column, padding 24, gap 8: alert-circle 40 (error) ·
     │       "Cannot open the database" (type.heading) · the message
     └─ S0.1.3 Ready                                                               92
          └─ NavProvider isPhone={bp.isPhone}                                      93
               └─ SnackbarProvider bottomOffset: phones 160, md+ 0                 95
                    └─ Shell()                                                    102
                         ├─ tabContent        switch (nav.tab)                    107
                         │     dashboard → DashboardScreen (S1)                   109
                         │     invoices  → InvoicesScreen  (S2)                   110
                         │     products  → ProductsScreen  (S5)                   111
                         │     settings  → SettingsScreen  (S6)                   112
                         │
                         ├─ S0.2 PHONES       bp.isPhone (xs, sm)                 120
                         │    ├─ overlay create-invoice                           121
                         │    │    └─ View → CreateInvoiceScreen (S4)             123
                         │    │       full screen, its own header, no nav
                         │    ├─ overlay invoice-detail                           128
                         │    │    └─ SafeAreaView edges bottom                   130
                         │    │         ├─ TopAppBar "Invoice", back = closeOverlay   131
                         │    │         └─ InvoiceDetail (S3), hosted Main        132
                         │    └─ no overlay                                       136
                         │         └─ View                                        137
                         │              ├─ View flex 1 → tabContent               138
                         │              └─ BottomTabs  S0.4.2  floats over it     139
                         │
                         └─ S0.3 md AND UP    rail                                144
                              └─ SafeAreaView edges left, right                   145
                                   └─ row                                         146
                                        ├─ Rail  S0.4.3  labels = atLeast('xl'),  147
                                        │                "+" → openCreate()       151-152
                                        └─ SafeAreaView edges bottom, flex 1, minWidth 0   154
                                             ├─ overlay create-invoice → CreateInvoiceScreen (S4)   156
                                             ├─ overlay invoice-detail, panes === 1 (md):   157
                                             │    TopAppBar "Invoice" + InvoiceDetail (S3)  161-162
                                             └─ otherwise → tabContent                      165
                                                  (lg+: S3 opens inside S2's DetailPane; the
                                                   overlay is never set there, see § 6)

Nav.tsx
├─ TABS         S0.4.1   home · file-text · tag · settings (spoken: Home, Invoices, Products, Settings)   12
├─ NavItem      S0.4.2a  touch.nav 48 × 48, radius.item 14, icon 22;                                  21
│                        on = theme.fillStrong, white icon, shadow.primary; off = theme.textMuted icon
├─ BottomTabs   S0.4.2   absolute; start / end = layout.side 20; bottom = useNavBottom();              45
│                        NAV_HEIGHT 68; radius.card 16; theme.navSurface + 1px theme.navBorder;
│                        shadow.secondary; four NavItems space-around
└─ Rail         S0.4.3   width 88; theme.navSurface; 1px right border; shadow.secondary;              69
     │                   paddingTop = status inset + 16; paddingBottom = gesture inset; gap 12
     ├─ "+" button       touch.button 52 × 52, radius.control 12, theme.fab, plus 22, marginBottom 24   88
     └─ NavItem × 4      + type.caption label under each when labels (semibold when on)                101

navMetrics.ts   S0.4.4
├─ NAV_HEIGHT = 68                                                                                      7
├─ useNavBottom()   max(gesture inset, layout.side 20)                                                  9
└─ useNavInset()    phones: useNavBottom() + 68 + 16; md+: gesture inset + 16                          17
                    (the FAB clearance is useMainInset() / useFabClearance() in Screen.tsx, C16)
```

## 4. The shell's numbers

The shell has no `S<n>` block. Each number below is read from the file named.

| Key | Value | ID | Means |
| --- | --- | --- | --- |
| `NAV_HEIGHT` (navMetrics.ts:7) | 68 | S0.4.2 | the floating bar's height; feeds `useNavInset()` and the snackbar offset |
| `layout.side` (tokens.ts) | 20 | S0.4.2 | the bar's distance from the left and right edges |
| `useNavBottom()` | max(gesture inset, 20) | S0.4.2 | the bar's distance from the bottom edge |
| `radius.card` (tokens.ts) | 16 | S0.4.2 | the bar's corners |
| `touch.nav` · `radius.item` · icon (Nav.tsx:32, 38) | 48 · 14 · 22 | S0.4.2a | one nav item |
| rail `width` (Nav.tsx:78) | 88 | S0.4.3 | the only inline number in the shell files |
| rail `paddingTop` · `gap` (Nav.tsx:82, 85) | status inset + 16 · 12 | S0.4.3 | `space[4]`, `space[3]` |
| rail "+" (Nav.tsx:94-96) | 52 × 52, radius 12, margin below 24, plus 22 | S0.4.3 | `touch.button`, `radius.control`, `space[5]` |
| rail labels (App.tsx:151) | from xl (960 dp) | S0.4.3 | `bp.atLeast('xl')` |
| `bottomOffset` (App.tsx:95) | phones 68 + 52 + 32 + 8 = 160; md+ 0 | S0.5 | the snackbar then adds the gesture inset + 8 (Snackbar.tsx:55); it does not change when an overlay hides the nav |
| Loading gap (App.tsx:73) | 12 | S0.1.1 | `space[3]` |
| Error padding · gap · icon (App.tsx:83, 85) | 24 · 8 · 40 | S0.1.2 | `space[5]`, `space[2]` |
| `STEPS` (useBreakpoint.ts:6-8) | xs 0 · sm 360 · md 600 · lg 768 · xl 960 · xxl 1200 | S0.3 | the width at which each breakpoint starts |
| `panes` (useBreakpoint.ts:10-19) | 1 at xs, sm, md · 2 at lg · 3 at xl, xxl | S0.3 | how many panes a screen may show; the shell reads it for the md Invoice overlay |

## 5. Breakpoints

`useBreakpoint()` (useBreakpoint.ts:21-34) picks the first step whose minimum the window width reaches and returns `bp`, `width`, `height`, the `META` row, `isLandscape`, `isPhone`, `isTablet` and `atLeast(min)`. The shell reads `isPhone`, `panes` and `atLeast('xl')`; `columns`, `gutter` and `margin` are returned for screens.

| `bp` | Width from | `columns` | `panes` | `gutter` | `margin` | `isPhone` | What the shell draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| xs | 0 | 4 | 1 | 12 | 16 | yes | tab screen + floating bottom nav; overlays full screen |
| sm | 360 | 4 | 1 | 16 | 16 | yes | same as xs |
| md | 600 | 8 | 1 | 16 | 24 | no | rail without labels; one pane; the Invoice overlay (back bar + S3) in place of the tab screen |
| lg | 768 | 8 | 2 | 20 | 24 | no | rail without labels; two panes; S3 inside S2's pane |
| xl | 960 | 12 | 3 | 24 | 32 | no | rail with labels; three panes |
| xxl | 1200 | 12 | 3 | 24 | 32 | no | same as xl |

md keeps `panes: 1` on purpose (useBreakpoint.ts:13-14): an 8-inch tablet in portrait is 601 dp, and two panes left the list and detail cramped (Prompt 30, decided in Prompt 32). A phone in landscape (914 × 411) is lg: rail, no bottom nav, two panes.

## 6. State and actions (`useNav()`, navigation.tsx)

| Name | Does | Lines |
| --- | --- | --- |
| `tab` · `goTab(t)` | the active tab (starts at `dashboard`); switching also clears the overlay | 46, 53 |
| `overlay` | `null`, `{ k: 'create-invoice', draftId?, invoiceId? }` or `{ k: 'invoice-detail', id }` | 5-8, 47 |
| `openCreate({ draftId?, invoiceId? })` | overlay → S4 (new, from a draft, or edit); the FAB on S1 and S2, the rail's "+", S6's drafts list (`draftId`), S3's Edit (`invoiceId`) | 54-56 |
| `closeOverlay()` | overlay → `null`; the "Invoice" back bar, S4's issue / save / leave | 57 |
| `showInvoice(id, phone)` | `phone` true → the `invoice-detail` overlay; false → the Invoices tab with the row selected. S2 passes `true` whenever `bp.panes === 1`, so at md the overlay is drawn beside the rail; S4's snackbar "View" passes `bp.isPhone`, so at md it selects the row instead | 58-61 |
| `selectedInvoiceId` · `selectInvoice(id)` | the row highlighted in S2's list and shown in its `DetailPane` (lg+) | 48, 85 |
| `isPhone` | the value `Root` passed in | 21, 45 |
| `refreshKey` · `refresh()` | a counter every screen's `load()` depends on; S3, S4 and S6 bump it after a save | 49, 52 |
| `pushBack(fn)` | registers a Back interceptor; returns the function that removes it | 62-65 |
| `useBackIntercept(fn)` | a screen claims Android Back while mounted through a ref, so `fn` need not be memoised: S4 (step back on the phone stepper, then leave), S6 (drill-in back to the section list) | 38-43 |
| Back handler | `hardwareBackPress`: the newest interceptor first → close the overlay → `dashboard` if on another tab → `false`, so the system leaves the app | 69-81 |
| `value` | one `useMemo` object, so screens re-render only when a field changes | 83-87 |

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| the start-up texts "Invoice ERP" / "Unlocking database…" | App.tsx:76-77 |
| the error title | App.tsx:86 |
| what runs at start-up, and in which order | the effect, App.tsx:57-69 |
| which fonts are loaded | App.tsx:8-12 and 48-50 (one import per weight) |
| light or dark mode rule | `ThemeProvider`, providers.tsx:13 |
| which screen a tab opens | the `switch`, App.tsx:108-112 |
| tab order, icons or spoken labels | `TABS`, Nav.tsx:12-17 |
| a fifth destination | `Tab` (Nav.tsx:10), `TABS` (Nav.tsx:12) and the `switch` (App.tsx:108) |
| the first tab after start-up, or where Back lands | `useState<Tab>('dashboard')` navigation.tsx:46 and the handler navigation.tsx:77 |
| which overlay is drawn where | `Shell`, App.tsx:121-135 (phones) and 155-165 (md+) |
| the overlay back bar's title | `TopAppBar title="Invoice"`, App.tsx:131 and 161 |
| what Android Back does | navigation.tsx:71-81 |
| nav bar height | `NAV_HEIGHT`, navMetrics.ts:7 (feeds the bar, every screen's bottom padding and the snackbar) |
| nav bar distance from the edges | `layout.side` in tokens.ts (sides); `useNavBottom()`, navMetrics.ts:9 (bottom) |
| nav bar fill, border, corners, shadow | `BottomTabs` style, Nav.tsx:52-58 (`theme.navSurface`, `theme.navBorder`, `radius.card`, `shadow.secondary`) |
| active item colour or size | `NavItem`, Nav.tsx:31-38 (`theme.fillStrong`, `touch.nav`, `radius.item`) |
| rail width, padding or gap | Nav.tsx:78-85 |
| the rail's "+" button | Nav.tsx:88-100 |
| when the rail shows labels | `labels={bp.atLeast('xl')}`, App.tsx:151 |
| the phone / rail switch point | `isPhone`, useBreakpoint.ts:29 (xs and sm, under 600 dp) |
| the breakpoint widths | `STEPS`, useBreakpoint.ts:6-8 |
| how many panes a breakpoint allows | `META`, useBreakpoint.ts:10-19 |
| the space a screen keeps above the nav | `useNavInset()`, navMetrics.ts:17; the FAB clearance is `useMainInset()` / `useFabClearance()`, Screen.tsx:48-60 |
| snackbar height above the nav | `bottomOffset`, App.tsx:95 |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in these files) |

## 8. Sizes

| Size | Layout | Last checked |
| --- | --- | --- |
| xs 320 · sm 360 · phone 411 | floating nav 20 from the sides and max(gesture inset, 20) from the bottom; the FAB 16 above it; S4 and the "Invoice" back bar + S3 full screen with no nav | Prompt 44 (phones), Prompt 54 (S1, pixel-identical before / after) |
| phone landscape 914 × 411 (lg) | rail, no bottom nav, no FAB; S2 in two panes | Prompt 44, Prompt 45 (S2 short-screen fix) |
| md 601 (8-inch portrait) | rail without labels; one pane: S2 full-width list, a tap opens the back bar + S3 beside the rail; S6 drill-in under a back bar; Back returns | Prompt 32, Prompt 54 (S1) |
| lg 800 (10-inch portrait) | rail without labels; S3 in S2's 50 % pane; S5 editor pinned to 38 % | Prompt 31, Prompt 54 (S1) |
| xl 961 (8-inch landscape) | rail with labels; S2 two panes (the activity pane only from xxl) | Prompt 33 |
| xxl 1280 (10-inch landscape) | rail with labels; S2 three panes | Prompt 30, Prompt 31 |

Open findings (not applied): none for the shell; the tablet findings of Prompt 30 were closed in Prompts 31 to 33, all inside screens.
