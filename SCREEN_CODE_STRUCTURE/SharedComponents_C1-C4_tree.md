# What's inside the shared components C1–C4

File: `src/ui/components.tsx` (608 lines). Line numbers as of 2026-10-23.
IDs (C1–C4) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

> **These four are shared. Change one here and every screen that uses it changes at once.** To change a single screen, change the props at that screen's call site instead, or wrap the component there.

All sizes come from `src/ui/tokens.ts`: `touch` (min 44, input 50, button 52), `radius` (chip 10, control 12), `space` (1=4 · 2=8 · 3=12 · 4=16 · 5=24), `shadow` / `theme.tileShadow`, and the `type` scale. Colours are always `theme.*`, never hex.

Shared helpers at the top of the file: `ripple(theme)` Android ripple (line 18), `pressedDim` web-only dim (21), `pressScale` the kit's press shrink 0.98 / 0.96 (23).

---

## C1 · TopAppBar — line 319

The flat screen header (no gradient, no fill: it sits on the screen background). Two shapes, chosen by `large`.

```
TopAppBar({ title, subtitle, onBack, actions, theme, large })        319
│
├─ pad   paddingTop = status bar + 8 · sides 20 · bottom 12          327
│
├─ large = true  (top-level tabs: Dashboard, Invoices, Products,      328-337
│  │              Settings)
│  └─ row (gap 12, centred)                                           330
│       ├─ column, flex 1                                             331
│       │    ├─ subtitle   14 grey, 1 line  (shown ABOVE the title)   332
│       │    └─ title      24/600 black, 1 line                       333
│       └─ row of glass IconButtons, gap 10  (actions)                335
│
└─ large = false  (Create invoice, Invoice detail, Settings drill-in) 342-355
   └─ row (gap 12, min height 44)                                     343
        ├─ left box, width = sideWidth                                344
        │    └─ glass back button "chevron-left"  (when onBack)       345
        ├─ column, flex 1, centred                                    347
        │    ├─ title      16/600 black                               348
        │    └─ subtitle   12 grey  (shown BELOW the title)           350
        └─ right box, width = sideWidth, buttons right-aligned        353
             sideWidth = n × 44 + (n−1) × 10, n = max(back?1:0,       340-341
             actions); equal boxes keep the title centred
```

| Prop | Does |
| --- | --- |
| `title` | the heading text (always shown) |
| `subtitle` | caption: above the title when `large`, below it otherwise |
| `onBack` | shows the glass back button and runs on tap |
| `actions` | `[{ icon, label, onPress, busy }]` → one glass `IconButton` each (type `BarAction`, line 313) |
| `large` | picks the big left-aligned shape |
| `theme` | colours |

Used by: Dashboard (`DashboardScreen.tsx:64`, large) · Invoices (`InvoicesScreen.tsx:119`, large + 2 actions) · Products (`ProductsScreen.tsx:272`) · Settings (`SettingsScreen.tsx:313` large; `:287` drill-in with back) · Create invoice (`CreateInvoiceScreen.tsx:505`, `538`, `582`, with back) · phone Invoice detail (`App.tsx:131`, "Invoice" + back).

| You want to change | Go to |
| --- | --- |
| header side padding or top gap | `pad`, line 327 (`layout.side`, `layout.top` in tokens) |
| title size or weight | `type.title` (large, 333) / `type.heading` (small, 348) in tokens; or the inline style at those lines for this bar only |
| subtitle colour | `theme.textMuted` at 332 / 350 |
| gap between action buttons | `gap: 10` at 335 and 353 |
| put the subtitle below the title on large bars | swap lines 332 and 333 |
| the back icon | `icon="chevron-left"`, line 345 |

---

## C2 · Button — line 39

One component, four looks picked by `variant`.

```
Button({ label, onPress, theme, variant='solid', icon, danger,       39
         disabled, busy, style, labelStyle })
│
└─ Pressable  = a row, centred, gap 8, radius 12, clipped             49-75
     │  min height: solid 52 · tonal/outline 50 · ghost 44           57
     │  side padding: ghost 12 · others 24                            58
     ├─ solid     blue fill (theme.fillStrong), no border,            67
     │            shadow.secondary; danger → red fill
     ├─ tonal /   glass fill (theme.glassStrong) + 1px white border   69-73
     │  outline   + tileShadow; danger → red tint fill
     │            (tonal and outline look the same today)
     ├─ ghost     no fill, no border: a text link                     —
     ├─ disabled or busy → opacity 0.38, no shadow                    74
     ├─ busy → ActivityIndicator instead of the content               76
     ├─ Feather icon 18  (when icon)                                  78
     └─ label, 1 line                                                 79-82
          solid: 16/600 white · ghost: 14/600 link blue ·
          glass: 15/500 black; danger → red text on glass/ghost
```

| Prop | Does |
| --- | --- |
| `label` | text; also the accessibility label |
| `onPress` | tap handler |
| `variant` | `solid` (primary, blue) · `tonal` / `outline` (glass) · `ghost` (text link) |
| `icon` | Feather icon name, drawn before the label at 18px |
| `danger` | red: fill on solid, text + tint on the others (Void, Delete) |
| `disabled` / `busy` | greys it out; `busy` also shows a spinner |
| `style` / `labelStyle` | extra styles for one call site (e.g. `flex: 1` in a row) |

Used by: Create invoice (`CreateInvoiceScreen.tsx`: Add from products ghost, Add free line outline, Save draft outline, Issue invoice / Update / Next solid) · Invoice detail (Record payment, Share PDF, Excel, Edit, Void) · Products (Save, Restock, Delete, Add to stock, Back) · Settings (Save, Export, Restore). The FAB (C9, line 586) and the tablet rail "+" are separate components built on the same recipe.

| You want to change | Go to |
| --- | --- |
| button height | `minHeight`, line 57 (`touch.button` / `touch.input` / `touch.min` in tokens) |
| corner radius | `radius.control` at 59 (tokens) — also changes inputs and icon buttons |
| blue colour / white text | `theme.fillStrong` / `theme.onFillStrong` (tokens, both themes) |
| label font per variant | line 80 |
| icon size | `size={18}`, line 78 |
| shadow | `shadow.secondary` (solid, 67) / `theme.tileShadow` (glass, 72) |
| press animation | `pressScale` 23 and `motion.pressScale` in tokens |
| make outline differ from tonal | the `glassBtn` branch at 69-73 (today both share it) |

---

## C3 · IconButton — line 92

A 44×44 square tap target with one icon. Two looks: `glass` (header buttons, back, calendar) or the default ghost (row actions, clear search, sheet close).

```
IconButton({ icon, label, onPress, theme, color, busy, size=20,      92
             selected, glass })
│
└─ Pressable  44 × 44, centred                                        98-113
     ├─ glass    radius 12, glass fill, 1px white border,            107, 109, 111
     │           tileShadow, black icon
     ├─ ghost    radius 10, transparent, grey icon (#666),            107, 109
     │           borderless ripple
     ├─ selected → blue tint fill (theme.primaryTint)                 109
     ├─ busy → spinner                                                114
     └─ Feather icon, size (20) and colour                            114
          colour: `color` prop, else black (glass) / grey (ghost)     96
```

| Prop | Does |
| --- | --- |
| `icon` | Feather name |
| `label` | accessibility label (required: the button has no text) |
| `onPress` | tap handler |
| `glass` | the glass look; off = ghost |
| `selected` | blue-tint fill (S2's calendar button when a date range is on) |
| `color` | overrides the icon colour (S2 passes `theme.accent` when dates are set) |
| `size` | icon size, default 20 |
| `busy` | spinner instead of the icon (export buttons while working) |

Used by: `TopAppBar` (every action and the back button, lines 325, 345) · `SearchField` clear button (241) · Invoices calendar (`InvoicesScreen.tsx:66`) · Create invoice trash per line (`CreateInvoiceScreen.tsx:339`) · Settings · `Sheet.tsx` close button.

| You want to change | Go to |
| --- | --- |
| square size | `touch.min` at 106 (tokens; 44 is the kit minimum, keep ≥ 44) |
| glass radius / ghost radius | line 107 (`radius.control` / `radius.chip`) |
| default icon size | `size = 20`, line 92 |
| ghost icon colour | `theme.textMuted`, line 96 |
| selected tint | `theme.primaryTint`, line 109 |
| press shrink | `motion.pressScaleSmall`, line 112 |

---

## C4 · Input and MoneyInput — lines 138 and 192

```
Input({ label, value, onChange, onBlur, theme, placeholder,          138
        keyboardType, autoCapitalize, multiline, editable=true,
        tabular, helper, error, maxLength })
│
└─ column, marginBottom 16  (the gap to the next field)              145
     ├─ label      13/500 grey, 8 below; red when error              146-148
     ├─ TextInput  50 tall (96 when multiline), side padding 16,     149-180
     │             1px border, radius 12, glass fill
     │             border: grey (inputBorder) → blue when focused
     │                     → red when error                          143
     │             focused: blue focus ring (boxShadow)              175
     │             text: 15/400 Inter; `tabular` → Inter with         177
     │                   tabular digits (type.numberField)
     │             placeholder: theme.textDisabled                   155
     │             editable=false: grey text                         172
     └─ helper / error  12 caption below, 4 gap; error wins          181-185

MoneyInput({ valuePaise, onChangePaise, …Input props })              192
└─ an Input with: decimal keyboard, tabular digits, placeholder       202-213
   "0.00", value kept as typed text and converted to whole paise
   (non-digits stripped, one dot allowed, never negative)            197, 209
```

| Prop | Does |
| --- | --- |
| `label` | text above the field (optional; also the accessibility label) |
| `value` / `onChange` | the text and its setter (controlled) |
| `onBlur` | runs when the field loses focus (S4 autosaves here) |
| `placeholder` | hint text |
| `keyboardType` | `default` · `numeric` · `decimal-pad` · `phone-pad` · `email-address` |
| `autoCapitalize` | `words` for names, `none` for emails |
| `multiline` | 96 tall, text starts at the top (Address, Notes) |
| `editable` | false = read-only, grey (Next number in Settings) |
| `tabular` | number-friendly digits (dates, qty, pincode) |
| `helper` / `error` | caption under the field; `error` turns the label and border red |
| `maxLength` | character cap (10 for dates, 6 for pincodes) |
| `valuePaise` / `onChangePaise` | MoneyInput only: the amount as integer paise |

Used by: Create invoice (party, dates, description, qty, Rate ₹ MoneyInput, discount, shipping, notes) · Invoice detail P1 (payment amount) · Invoices (From / To dates) · Products (name, price MoneyInput, stock, restock) · Settings (company, bank, numbering).

| You want to change | Go to |
| --- | --- |
| field height | `touch.input` at 166 (tokens); multiline height `96` same line |
| gap below every field | `marginBottom: space[4]`, line 145 (set `0` and add gaps at call sites to control it per screen) |
| label size / gap | `type.labelMedium` and `marginBottom: space[2]`, line 147 |
| corner radius | `radius.control`, line 171 (shared with buttons) |
| border colours (rest / focus / error) | line 143 (`theme.inputBorder`, `theme.focus`, `theme.error`) |
| the focus ring | `theme.focusRing`, line 175 (tokens: 3px blue at 35%) |
| fill colour | `theme.inputFill`, line 173 |
| text font | `type.body` / `type.numberField`, line 177 (tokens) |
| placeholder colour | `theme.textDisabled`, line 155 |
| money formatting (decimals, negatives) | `fmt` 195 and `toPaise` 197 |
