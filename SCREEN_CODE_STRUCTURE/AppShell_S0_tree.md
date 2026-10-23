# What's inside the app shell (S0: start-up, navigation, bottom nav, rail)

Files: `src/shell/App.tsx` (162 lines) · `src/shell/navigation.tsx` (90) · `src/ui/Nav.tsx` (116) · `src/ui/navMetrics.ts` (27). Line numbers as of 2026-10-23.
This is the frame every screen sits in: it unlocks the database, loads the fonts, owns the current tab and overlay, and draws the bottom nav (phones) or the rail (tablets).
IDs (S0.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

```
App()                                              App.tsx  31
├─ SafeAreaProvider
├─ ThemeProvider          light / dark from the phone  (providers.tsx)
├─ StatusBar "auto"
└─ Root()                                                   43
     ├─ useFonts   Inter 300/400/500/600 + Bebas Neue       48
     ├─ effect     getDb() → syncNextSeq() → ready;          57
     │             ensureDailyBackup() in the background
     │
     ├─ S0.1.1 Loading   (also while fonts load)             71
     │    └─ centred column, gap 12: spinner (blue) ·
     │       "Invoice ERP" (title) · "Unlocking database…"
     ├─ S0.1.2 Error                                         81
     │    └─ centred column: alert-circle 40 (red) ·
     │       "Cannot open the database" · error text
     └─ S0.1.3 Ready                                         92
          └─ NavProvider (isPhone)                           93
               └─ SnackbarProvider  bottomOffset on phones   95
                    │   = nav 68 + FAB 52 + 2×16 + 8
                    └─ Shell()                              102
                         ├─ tabContent  switch on nav.tab:   107
                         │     dashboard → DashboardScreen (S1)
                         │     invoices  → InvoicesScreen  (S2)
                         │     products  → ProductsScreen  (S5)
                         │     settings  → SettingsScreen  (S6)
                         │
                         ├─ S0.2 PHONE  (bp.isPhone)        120
                         │    ├─ overlay create-invoice →   121
                         │    │    CreateInvoiceScreen (S4) full screen, no tabs
                         │    ├─ overlay invoice-detail →   128
                         │    │    TopAppBar "Invoice" (back = closeOverlay)
                         │    │    + InvoiceDetail (S3)
                         │    └─ otherwise                   136
                         │         ├─ tab screen (flex 1)
                         │         └─ BottomTabs   S0.4.2    139
                         │
                         └─ S0.3 TABLET                      144
                              └─ row
                                   ├─ Rail        S0.4.3    147
                                   │   labels at xl+; "+" = openCreate()
                                   └─ overlay create-invoice ? S4 : tab screen  155
                                      (invoice-detail never overlays here:
                                       S3 opens inside S2's right pane)

Nav.tsx
├─ TABS                S0.4.1  4 destinations: home · file-text · tag · settings   12
├─ NavItem             S0.4.2a 48×48, radius 14; on = blue fill, white icon 22,  21
│                              shadow.primary; off = #666 icon
├─ BottomTabs          S0.4.2  absolute; 20 from left/right; bottom = useNavBottom();  45
│                              68 tall, radius 16, glass nav fill + 1px border,
│                              shadow.secondary; items space-around
└─ Rail                S0.4.3  width 88, glass nav fill, 1px right border;          69
     ├─ "+" button             52×52, radius 12, blue, white plus 22                88
     └─ NavItem ×4 (+ caption label under each at xl+)                            101

navMetrics.ts          S0.4.4
├─ NAV_HEIGHT = 68                                                                  7
├─ useNavBottom()      max(gesture inset, 20) — the nav's distance from the bottom  9
├─ useNavInset()       phone: bottom + 68 + 16; tablet: inset + 16                 17
└─ (useContentInset retired, Prompt 47: Main's bottom padding is useMainInset() /
   useFabClearance() from src/ui/Screen.tsx, C16)
```

## What each function does

| Function | File:line | Does |
| --- | --- | --- |
| `App()` | App.tsx:31 | providers + status bar + `Root` |
| `Root()` | App.tsx:43 | loads fonts, opens the DB, picks Loading / Error / Ready |
| `Shell()` | App.tsx:102 | picks the tab screen; phone vs tablet frame; renders overlays |
| `NavProvider` | navigation.tsx:45 | holds `tab`, `overlay`, `selectedInvoiceId`, `refreshKey`; registers the Android Back handler |
| `useNav()` | navigation.tsx:30 | gives any screen the `NavApi` below |
| `goTab(t)` | navigation.tsx:53 | switch tab and close any overlay |
| `openCreate({draftId?, invoiceId?})` | navigation.tsx:54 | overlay → Create / Edit invoice (S4) |
| `closeOverlay()` | navigation.tsx:57 | back to the tab screen |
| `showInvoice(id, phone)` | navigation.tsx:58 | phone → S3 overlay; tablet → Invoices tab + select the row |
| `selectInvoice(id)` | navigation.tsx:85 | the row highlighted in S2's tablet list |
| `refresh()` / `refreshKey` | navigation.tsx:52 | bump the key; every screen reloads its data |
| `pushBack(fn)` / `useBackIntercept(fn)` | navigation.tsx:62 / 38 | a screen claims Android Back while mounted (S4 stepper, S6 drill-in) |
| Back handler | navigation.tsx:71 | order: innermost interceptor → close overlay → go to Home → leave the app |
| `BottomTabs`, `Rail`, `NavItem` | Nav.tsx:45 / 69 / 21 | see the tree |
| `useNavBottom` / `useNavInset` | navMetrics.ts:9 / 17 | the bottom spacings the nav, FAB, sheets and list cards share; a screen's Main pads with `useMainInset()` from `Screen.tsx` |

## Where to change what

| You want to change | Go to |
| --- | --- |
| the start-up texts "Invoice ERP" / "Unlocking database…" | App.tsx:76-77 |
| the error screen text | App.tsx:86 |
| which screen a tab opens | the `switch` in `Shell`, App.tsx:108 |
| tab order, icons or spoken labels | `TABS`, Nav.tsx:12 |
| nav bar height | `NAV_HEIGHT`, navMetrics.ts:7 (feeds the bar, every screen's bottom padding and the snackbar) |
| nav bar distance from the edges | `layout.side` (left/right) in tokens.ts; `useNavBottom()` for the bottom |
| nav bar fill, border, corners, shadow | `BottomTabs` style, Nav.tsx:52-58 (`theme.navSurface`, `theme.navBorder`, `radius.card`, `shadow.secondary`) |
| active item colour or size | `NavItem`, Nav.tsx:31-38 (`theme.fillStrong`, `touch.nav`, `radius.item`) |
| rail width or its "+" button | Nav.tsx:78 / 88-100 |
| when the rail shows labels | `labels={bp.atLeast('xl')}`, App.tsx:151 |
| the phone / tablet switch point | `isPhone` in `src/ui/useBreakpoint.ts` (xs + sm, i.e. < 600 dp) |
| what Android Back does | navigation.tsx:71-81 |
| snackbar height above the nav | `bottomOffset`, App.tsx:95 |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in these files) |

## md tablets (Prompt 32, 2026-10-23)

`useBreakpoint`: md now has `panes: 1`. The tablet shell (`App.tsx`) keeps the rail at md and renders the `invoice-detail` overlay inside the content area (`TopAppBar "Invoice"` + `InvoiceDetail`) when `bp.panes === 1`, the same as the phone shell does full-screen. Screens that switch on `bp.panes === 1`: S2 (list only, tap → overlay), S6 (list + drill-in), S5 (`showTable` false at 513 dp → phone rows). `bp.isPhone` still means "floating bottom nav, FAB" (xs, sm only).
