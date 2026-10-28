# SCREEN_CODE_STRUCTURE — Walkthrough

## Prompt 1 — Inspect InvoicesScreen and plan the restructure (2026-10-23, session 14)

**Framework:** React Native 0.88 / Expo SDK 58, TypeScript. Layout primitives are `View` with `flexDirection: 'row' | 'column'`, `FlatList` for the list, tokens from `src/ui/tokens.ts`.

**Files InvoicesScreen uses**

| File | What is used |
| --- | --- |
| `src/ui/components.tsx` | `TopAppBar`, `SearchField`, `IconButton`, `SegmentedControl`, `Input`, `Card`, `ListItem`, `initials`, `MoneyText`, `StatusGlyph`, `EmptyState`, `FAB` |
| `src/ui/tokens.ts` | `layout` (side 20, gap 16, grid 12), `space`, `type` |
| `src/ui/useBreakpoint.ts`, `src/ui/navMetrics.ts` | `bp.isPhone`, `bp.panes`; `useNavInset()` |
| `src/shell/providers.tsx`, `src/shell/navigation.tsx` | `useTheme()`; `useNav()` → `refreshKey`, `selectedInvoiceId`, `selectInvoice`, `showInvoice`, `openCreate` |
| `src/data/invoicesRepo.ts`, `src/data/money.ts`, `src/data/types.ts` | `listInvoices(filters)`, `formatPaise`, `formatDateDisplay`, `Invoice`, `InvoiceStatus` |
| `src/export/xlsx.ts`, `src/export/pdf.ts`, `src/ui/alert.ts` | `exportInvoicesXlsx`, `exportConsolidatedRegister`, `shareFile`, `alert` |
| `src/features/invoices/InvoiceDetail.tsx` | tablet detail pane |

**Current structure (159 lines, one function):** `STATUSES` constant → 4 hooks + 7 `useState` → `load` / `runExport` → three derived flags → a 55-line `listPane` JSX constant holding the filter row, status tabs, date fields, list card (with the row renderer nested inside `renderItem`) and the FAB → an `appBar` constant → a phone/tablet `return` at the bottom. Every gap, width and clearance is an inline number (`gap: 10`, `marginBottom: -space[4]`, `52 + layout.gap`, `'42%'`, `'50%'`, `'26%'`).

The proposed function tree is in the chat plan; it is copied here once approved.

## Prompts 2–5 — Q&A on the New invoice button and the Create screen (2026-10-23, session 14)

| Question | Answer (summary) |
| --- | --- |
| Where is the "+ New invoice" button layout? | Placed by one line in each screen (S2.6 `InvoicesScreen.tsx:114`); looks and position come from the shared `FAB` component (C9, `components.tsx:586`) and `useNavInset()`. |
| Its function name? | `FAB`; the tap runs `nav.openCreate()` (`navigation.tsx:54`). |
| What's inside `nav.openCreate()`? | Not a modal: it sets `overlay = { k: 'create-invoice' }` and `App.tsx:121/155` swaps in `CreateInvoiceScreen` (S4) full-screen. |
| A file with the S4 phone tree | `SCREEN_CODE_STRUCTURE/CreateInvoiceScreen_S4_tree.md`: component tree with S4 IDs and line numbers, a function table and a "where to change what" table. Printed in a terminal tab with `Get-Content`. |

## Prompts 6–8 — Tree files for every screen, overlay, document and C1–C4 (2026-10-23, session 14)

Written from the real source by four parallel sub-agents, then spot-checked. No source file changed. The S4 file was extended with the tablet layouts and renamed `CreateInvoiceScreen_S4_tree.md`.

| File | Covers | Lines |
| --- | --- | --- |
| `AppShell_S0_tree.md` | App.tsx, navigation.tsx, Nav.tsx, navMetrics.ts: start-up, phone / tablet shells, overlays, BottomTabs, Rail, Back order | 107 |
| `DashboardScreen_S1_tree.md` | S1.0–S1.2, S1.5 | 67 |
| `InvoicesScreen_S2_tree.md` | S2.0–S2.8 (noted: restructure pending) | 95 |
| `InvoiceDetail_S3_P1_tree.md` | S3.0–S3.6, P1 | ~110 |
| `CreateInvoiceScreen_S4_tree.md` | S4.L1 phone, S4.L2, S4.L3, S4.E, P2 | ~170 |
| `ProductsScreen_S5_P3_tree.md` | S5.0–S5.5, P3 (S5.6, S5.7) | ~130 |
| `SettingsScreen_S6_tree.md` | S6.1–S6.5 | ~110 |
| `InvoicePdf_D1_tree.md` | pdfTemplate.ts D1.0–D1.6, pdf.ts | — |
| `ExcelExports_D2_tree.md` | xlsx.ts D2.1–D2.3 | — |
| `SharedComponents_C1-C4_tree.md` | TopAppBar, Button, IconButton, Input / MoneyInput | — |

**Found while mapping (verified against the code):**

| Finding | Where | Action |
| --- | --- | --- |
| S3 items table columns are `flex 2.6 : 0.8 : 1.3 : 1.3`, not `3 : 1 : 1 : 1` | `InvoiceDetail.tsx:148` | corrected in `SCREEN_LAYOUT_REFERENCE.md` S3.4 and its TRACKING |
| Snackbar offset is `NAV_HEIGHT + 52 + 2*16 + 8` (= 160), not `NAV_BAR_HEIGHT + 72` | `App.tsx:95` | corrected in `SCREEN_LAYOUT_REFERENCE.md` S0.5 |
| **Bug:** D2.2 `exportConsolidatedRegister` pushes one Invoices_Register row per *joined line item*, so an invoice with 3 items appears 3 times on that sheet | `xlsx.ts:77` | reported to the owner, not changed (data-layer fix, separate task) |
| `Button` `tonal` and `outline` render identically (one `glassBtn` branch) | `components.tsx:69-73` | noted in the C1–C4 file only |
| S3–S6 and D1 line numbers in `SCREEN_LAYOUT_REFERENCE.md` have drifted 2–20 lines | — | the tree files carry today's numbers; the reference now points to them |

## Prompt 9 — Fix D2.2: one register row per invoice (2026-10-23, session 14)

**Root cause** (`src/export/xlsx.ts`): the register query `LEFT JOIN`s `invoice_items`, so it returns one row per line item, and the loop pushed an `Invoices_Register` row for every joined row. An invoice with n items was listed n times.

**Fix**

| Change | Where |
| --- | --- |
| Push the register row only when `invoice_no` changes (`lastInvoiceNo` marker, kept across the 500-row batches) | `xlsx.ts:75-90` |
| `ORDER BY i.id DESC, li.sno` so line items come out in order inside each invoice (same-invoice rows were already contiguous) | `xlsx.ts:80` |
| Row collection moved into `collectRegisterRows()` (exported); `exportConsolidatedRegister()` now just wraps it in the two sheets | `xlsx.ts:64`, `:103` |

**Test** (`scripts/run-integration-tests.mjs`): new case "consolidated register: one row per invoice, one per line item": issues a 3-line invoice, then asserts register rows = `COUNT(invoices)`, no invoice_no twice, line-item rows = `COUNT(invoice_items)`, and the 3-line invoice appears once with 3 items. To load `xlsx.ts` the harness now compiles `src/export/xlsx.ts` too (`--rootDir src`, outputs under `data/` and `export/`) and mocks `expo-file-system` (`File`) and `./pdf` (`docsDir`, `isWeb`, `webBlobDownload`).

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run test:integration` | 15/15 pass (the first run failed on my own assumption that PRE-001 still had several lines; the test now creates its own invoice) |
| `npm run test:xlsx` | pass |

Not verified on the device: the export itself (share sheet) is unchanged code; only the rows fed to it changed.

## Prompts 10–11 — Commits (2026-10-23, session 14)

Two commits on `master`, so the bug fix stays separate from the documentation:

| Commit | Contents |
| --- | --- |
| `a142bab` Fix duplicate rows in the consolidated Excel register | `src/export/xlsx.ts`, `scripts/run-integration-tests.mjs` |
| (next) Add per-screen tree files (SCREEN_CODE_STRUCTURE) | the 10 tree files, this topic's 3 files, the layout-reference corrections, README cross-references, session logs in MOBILE_APP_CONVERSION and SCREEN_LAYOUT_REFERENCE |

## Prompt 12 — InvoicesScreen restructure applied (2026-10-23, session 14)

`src/features/invoices/InvoicesScreen.tsx` rewritten per the Prompt 1 plan (one file, state hook, named pieces). No other source file changed.

| Before | After |
| --- | --- |
| 1 function, 159 lines; a 55-line `listPane` JSX constant; row renderer nested in `renderItem`; inline numbers (`gap: 10`, `'42%'` …) | `STATUSES` · `S2` numbers block · `useInvoiceList()` · `InvoicesScreen()` (24 lines) · `Header` · `ListPane` · `FilterRow` · `DateRangeRow` · `InvoiceListCard` · `InvoiceRow` · `DetailPane` · `ActivityPane`; 265 lines |

Kept exactly: the kit components and their props, the FlatList settings (`flexGrow: 0`, FAB clearance rule `> 6 rows`), the tablet widths, the tap behaviour, the export flow. `fabClearance` is now `touch.button + layout.gap` (= 52 + 16, the same value as the old literal). `setStatusF` was renamed `setStatus` (local to the hook).

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| Emulator (phone, sm): relaunched the dev client for a fresh bundle (`Bundled 28ms (1 module)`), opened Invoices, toggled the date range | header, search + tinted calendar button, status tabs, From \| To row, list card with the PRE-001 row, FAB, nav: all as before the change (screenshots compared) |
| Tablet panes (S2.7, S2.8) | read only; no tablet AVD in this session |

Docs: `InvoicesScreen_S2_tree.md` rewritten for the new functions; `SCREEN_LAYOUT_REFERENCE.md` S2 tables now name functions instead of line numbers; rationale in `SCREEN_CODE_STRUCTURE_TRACKING.md`.

## Prompts 14–20 — Q&A on the restructure and the Header / Main / Footer method (2026-10-23, session 14)

| Question | Answer (summary) |
| --- | --- |
| Meaning of "restructured" (before vs after) | Same screen, reorganised code: one 159-line function → named regions in on-screen order; behaviour unchanged. |
| Which is best? | The restructured version; the only cost is line count. Apply next to S4. |
| Is my method "rows and columns"? | Yes: `View` = column, `flexDirection: 'row'` = row, `flex` = column widths; the function names now say which is which. |
| Header / Main / Footer for every screen? | Suggested a shared `Screen` scaffold (`src/ui/Screen.tsx`) and three functions per screen; S4 already has all three parts. |
| Does it break the React Native rule? | No: it is a flex column with three children. Pitfalls (nested scrollers, missing `flex: 1`, keyboard, per-screen nav) and how the scaffold avoids them. |
| Is the pitfalls table correct? | Mostly; two refinements: the `flex: 1` wording, and the keyboard reason is Android `adjustResize` (AndroidManifest.xml:19), not the flex column alone. |
| Deep analysis against all mobile rules | `LAYOUT_METHOD_header-main-footer_analysis.md`: rule-by-rule table (flexbox, Material 3, HIG, safe areas / edge-to-edge, touch targets, reflow, lists, keyboard, accessibility, RTL, performance, the kit, sheets), the pitfalls re-checked, trade-offs, 6 conventions, recommendation. |

## Prompt 21 — Name, skill vs design, and the method page (2026-10-23, session 14)

1. **Name:** Three-Slot Screen (3SS). 2. **Skill** (`three-slot-screen`) rather than a design doc; rationale in the TRACKING file. 3. **Page:** `SCREEN_CODE_STRUCTURE/three-slot-screen.html` (single file, HTML + CSS + JS, no libraries; Inter and Bebas Neue from Google Fonts).

Page contents: large header with a light/dark button · hero card with the three-slot phone diagram · 3 stat tiles (slots 3 · max columns 3 · touch 44) · segmented control switching four panels: **Method** (name, the six pieces as list rows, the reading order of a screen file) · **Rules** (six conventions, fit with 12 rule sets, pitfalls) · **Code** (5 snippets with copy buttons: the `Screen` scaffold, a screen file in reading order, a row with two columns, a list with a memoised row, a footer action bar) · **Prompts** (5 copyable prompt templates and the S1–S6 slot map) · pinned device bar. Copy uses `navigator.clipboard` inside the click handler with a select-and-`execCommand` fallback; the active tab is remembered per browser; a bare `#code`-style hash opens a panel.

Styling check against the kit: colours are the five tokens plus §2.2 variants only; cards 55 % white / 85 % border / radius 16 / `shadow.secondary`; tiles `shadow.primary`; icon buttons 44, radius 12; primary buttons 52, radius 12, white 16/600; segmented control pill with 4 px padding; overline 12/600 0.06em; numbers in Bebas Neue; dark theme = black, 8 % glass, 16 % borders, inner highlight. Not matched (browser vs app): the page has `backdrop-filter`-free glass to stay identical to Android, where there is no blur.

## Prompt 22 — The analysis as a web page (2026-10-23, session 14)

`SCREEN_CODE_STRUCTURE/three-slot-analysis.html`: the same single-file build and kit stylesheet as the method page (the `<style>` block is copied verbatim, so the two pages stay identical in look). Header with a link to the method page and the light/dark button · Verdict card with the three couplings drawn as slots · 3 stat tiles (13 rule sets · 3 need care · 6 conventions) · segmented control: **Rule by rule** (13 list rows: the rule, the method, a fit badge, what to watch) · **Pitfalls** (re-checked table) · **Trade-offs** (gain / pay table, S2 before-and-after tiles) · **Conventions** (six numbered rows, recommendation, button to the method page) · pinned bar naming the source Markdown. Published as a private artifact.

## Prompt 23 — The analysis page is the discussion itself (2026-10-23, session 14)

The owner wanted the chat reply as a page, verbatim in order, from "Verdict" to the "Recommendation" line, not the tabbed re-cut of Prompt 22. `three-slot-analysis.html` was rebuilt as one scrolling document with those sections: Verdict (three couplings, the "where it bends" note) · Rule by rule (short-form table, 13 rows) · Your pitfalls table, re-checked · Trade-offs in one view · The six conventions · Recommendation. Same kit stylesheet; the segmented control was dropped because the page is read top to bottom. Republished at the same link.

## Prompt 24 — Skill created and everything committed (2026-10-23, session 14)

`.claude/skills/three-slot-screen/SKILL.md`: 7 steps (inspect and wait for OK · file order · rows and columns · slots · what must not change · verify · document). `README.md` lists it in the tree; `CLAUDE.md` names the method under "How to work". Committed together with the two pages, the analysis Markdown and the session logs (see `git log`).

## Prompts 25–28 — Skill folders Q&A, the three risks, memoised rows + `Columns` (2026-10-23, session 14)

**Q&A (25–27):** only `SKILL.md` is required for a skill (folder = `/name`, `description` = trigger); `CLAUDE.md` is for rules that apply without invoking, `README.md` is the AGENTS.md convention. The two skills are separate folders under `.claude/skills/` (hidden folder; opened in Explorer). The three "⚠️" rows of the analysis are risks, not bugs today.

**Changes (28):**

| File | Change |
| --- | --- |
| `src/ui/Columns.tsx` (new, C15) | one row of equal columns; `weights`, `gap`, `minCell` (44), `stackAt`; stacks when a cell would be too narrow or at the named breakpoint |
| `src/features/invoices/InvoicesScreen.tsx` | `InvoiceRow` is `React.memo` with `onPress(id)`; `InvoiceListCard` has a `useCallback` `onPressRow`; `DateRangeRow` uses `Columns` |
| `src/features/products/ProductsScreen.tsx` | `tableRow()` and the inline phone `ListItem` became `ProductTableRow` / `ProductListRow` (`React.memo`, `onPress(p)`); `startEdit` is a `useCallback`; S5.6.4 and S5.7.2 use `Columns`; the bare `52 + layout.gap` became `touch.button + layout.gap` |

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| Emulator (restarted: Metro + AVD had been stopped with the previous Claude Code process); fresh bundle `Bundled 507ms (807 modules)` | Products: 60 rows, same layout, FAB clearance kept · Invoices with the date range open: From \| To row identical · Product editor sheet: Price \| Stock row identical |
| Tablet table rows (S5.2.r) | read only; no tablet AVD |

Docs: S2 tree file line numbers refreshed; S5 tree file carries a shift note (+40 after the two row components) rather than a full renumber; `SCREEN_LAYOUT_REFERENCE.md` gained C15; rationale in TRACKING.

## Prompts 29–30 — `Columns` wrap, tablet AVDs, the tablet tour and its findings (2026-10-23, session 14)

**Columns** (`src/ui/Columns.tsx`, decision in `src/ui/columnsMode.ts`): `kind` presets (`touch` 44 · `input` 128 · `button` 96), `wrap` mode (flex-wrap, `flexBasis = minCell`), `stackAt`. `scripts/run-columns-tests.mjs` (`npm run test:columns`): 10 cases, all pass; `npm run typecheck` clean. The three existing uses (S2.3a, S5.6.4, S5.7.2) now pass `kind="input"`; at phone widths nothing changes (2 inputs: 142 dp each ≥ 128).

**AVDs:** `Tablet_8in` (800×1280 @ 213) and `Tablet_10in` (1200×1920 @ 240) created on the installed API 37 image. Neither was usable here: on the host GPU the 8-inch one came up `offline` with "DisplaySurfaceGlContextHelper context was preempted" errors; with `-gpu swiftshader_indirect` it booted, but `screencap` aborted (`Assertion failed: !rcEnc->featureInfo()->hasReadColorBufferDma`) and the guest rebooted itself mid-tour (boot animation, adb offline). Switched to the phone AVD resized with `wm size` / `wm density`, which is what the layout code reads (`useWindowDimensions`).

**Tour:** `scripts/tablet-tour.py` (also the new `/tablet-check` skill). Four profiles, 7–9 screenshots each; `MISSING` taps were expected ones (no "Items" stepper at md+, no "Acid Wash T-Shirt" text when the table shows only sizes, "Close" on the sheet has no label). The emulator was restored to 1080×2400 afterwards.

**Findings** (details and proposed fixes in each screen's tree file, "Tablet check" section):

| # | Where | Size | What | Severity |
| --- | --- | --- | --- | --- |
| 1 | S5 Products table | lg, xl, xxl | **NAME column collapses to nothing; SOLD / AVL cut.** The editor `ScrollView` with `width: '38%'` grows (`flexGrow: 1` default) and leaves the list ≈ 25 %; the fixed columns (328 dp) then eat the card | bug |
| 2 | S4.A dates | xl (S4.L3) | date inputs clip the first digit in the 38 % form (cells ≈ 134 dp) | bug |
| 3 | S2 list pane | md, xl | search placeholder, status tabs, From/To and row text truncated at ≈ 235–280 dp | tight |
| 4 | S3 items header | md | "QTY", "AMOUNT" truncated in the 300 dp pane | tight |
| 5 | S5 table | md | NAME truncated; SIZE glyph touches the ellipsis (no column gap) | tight |
| 6 | S4.L3 products panel | xl | product names truncated at 25 % (≈ 240 dp) | cosmetic |
| — | S1, S6, P3, S4.L2, S2/S3 at lg and xxl | all | as designed | ok |

The 8-inch tablet in portrait is **md (601 dp)**, not phone width: the rail and two panes appear, and most of the "tight" findings are at that size. Material's compact class ends at 600 dp, so this is one dp over the line; treating md as single-pane (phone layout + rail) would remove findings 3, 4 and 5 at once. That is a decision for the owner.

## Prompt 31 — The two tablet bugs fixed and re-checked (2026-10-23, session 14)

| Fix | Where | Re-check |
| --- | --- | --- |
| Products editor pane pinned to 38 % (`flexGrow: 0, flexShrink: 0` on the `ScrollView`) | `ProductsScreen.tsx` S5.5 | xl and xxl: all six columns, names readable |
| Table only when the list pane is ≥ 480 dp (`showTable`); phone rows otherwise | `ProductsScreen.tsx` S5.2 | lg: rows with full names beside the editor |
| `Columns` decides from its own measured width (`onLayout`), window width only until the first layout | `src/ui/Columns.tsx` | — |
| S4.A row 5 (dates) is `<Columns kind="input">` | `CreateInvoiceScreen.tsx` | xl: the two dates stack, values complete; lg and xxl: side by side |

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean (after one slip: a JSX comment inside the ternary branch broke the parse; fixed, re-run) |
| `npm run test:columns` | 10/10 |
| Tour at xl (1280×800 @ 213), lg (1200×1920 @ 240), xxl (1920×1200 @ 240); S4 and S5 screenshots reviewed | as in the table above; `MISSING Items` / `Date range (set)` expected |
| Emulator | restored to 1080×2400 |

Process note: killing the tour's `python.exe` does not stop the Bash `for` loop that launched it, so two leftover loops kept running and reset the emulator mid-run twice. Fixed by killing every process whose command line contains the script name and running the three profiles from one Python driver. The skill text should say: run the profiles from one process.

Still open (tight, not bugs): S2 list pane at md / xl, S3 items header at md, S5 NAME + SIZE gap at md, S4.L3 product names at xl; and the md-as-single-pane decision.

## Prompt 32 — md single-pane, re-checked (2026-10-23, session 14)

| Change | File |
| --- | --- |
| md `panes: 1` | `src/ui/useBreakpoint.ts` |
| tablet shell shows the `invoice-detail` overlay (back bar + S3) beside the rail at one pane | `src/shell/App.tsx` |
| S2 one-pane branch and row tap on `bp.panes === 1` | `InvoicesScreen.tsx` |
| S6 drill-in and section titles on `bp.panes === 1` | `SettingsScreen.tsx` |
| S5 table threshold 520 dp; NAME `paddingEnd` | `ProductsScreen.tsx` |
| tour: ✕ is the last "Close" node | `scripts/tablet-tour.py` |

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| Tour at md (800×1280 @ 213 = 601×961 dp) | S1 rail + dashboard · S2 full-width list, complete tabs and placeholders · S3 overlay under "Invoice" back bar with ITEM · QTY · RATE · AMOUNT complete · S4 single pane with the eye toggle · S5 phone rows, full names · P3 sheet · S6 list then Company drill-in, Back returns (separate check, since the tour's Close tap hit the sheet body) |
| Other sizes | not re-run; the changes only affect `panes === 1` (xs, sm, md) and the S5 threshold (xl 541 ≥ 520 keeps the table, verified by arithmetic) |
| Emulator | restored to 1080×2400 |

Open after this: S2 list at xl (3 panes at 961 dp; show `ActivityPane` only at xxl), S4.L3 product names at xl. Both cosmetic.

## Prompt 33 — xl cosmetics fixed and re-checked (2026-10-23, session 14)

| Change | File |
| --- | --- |
| `S2.activityFrom = 'xxl'`; `showActivity`; detail width 42 % only with the activity pane | `InvoicesScreen.tsx` |
| `ListItem` `titleLines` prop (default 1) | `src/ui/components.tsx` (C7) |
| `narrowCatalog` (panel < 300 dp): name on two lines, "size · ₹price" subtitle | `CreateInvoiceScreen.tsx` S4.L3 |

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean (first run caught `Invoice \| null` reaching `ActivityPane`; guarded with `&& list.selected`) |
| Tour at xl (1280×800 @ 213 = 961×601 dp) | S2: two panes, list ≈ 450 dp, tabs All · Issued · Partial · Paid · Void complete, row "PRE-001 · 22 Oct 26" on one line; S3 in the 50 % pane; S4.L3: "Acid Wash / T-Shirt" on two lines, "L · ₹500.00" below, Avl badge beside |
| Emulator | restored to 1080×2400 |

Every tablet finding from Prompt 30 is now closed: 1 and 2 in Prompt 31, 3, 4 and 5 in Prompt 32, 3 (xl) and 6 here.

## Prompt 36 — S4 inspected; plan for the Screen scaffold + S4 restructure (2026-10-23, session 14)

**Current structure of `CreateInvoiceScreen.tsx` (689 lines):** 3 helpers (`emptyParty`, `emptyShip`, `blankForm`) → one 557-line component: 6 hooks + 11 `useState` + a ref → mount effect (settings / edit invoice / draft / next number) → `totals`, `patch`, `autosave`, `previewInvoice`, `previewHtml` → catalog effect → `openCatalog`, `addLine`, `addBlankLine`, `updateLine`, `removeLine`, `issue`, `saveAsDraft`, `leave`, `useBackIntercept` → seven JSX constants (`partySection` 45 lines, `itemsSection` 90, `totalsBlock`, `reviewSection`, `previewPane`, `actionButtons`, `catalogSheet`) → three `return`s (phone stepper with the TOTAL bar; xl three panels; md/lg two panes) → `Stepper` and `CatalogSheet` components at the bottom. Inline numbers: `'25%'`, `'38%'`, `'37%'`, `'40%'`, `width: 180`, `minHeight: 400`, 28-px stepper circles, `flex: 1.4`, `paddingBottom: space[6]`, `300` (narrow catalog), `-space[4]` pulls.

The proposed tree is in the chat (Prompt 36); it is copied here once approved.

## Prompt 37 — `Screen` scaffold built, S4 restructured, re-checked (2026-10-23, session 14)

**New:** `src/ui/Screen.tsx` (C16, 60 lines): `header` · `below` · Main · `footer` · `fab` · `overlay`; `useMainInset()`, `useFabClearance()`.

**S4** (`CreateInvoiceScreen.tsx`, 689 → 831 lines): one 557-line component → `STEPS` · `S4` numbers block (10 values) · `blankForm` · `useInvoiceForm()` (all state and actions) · `CreateInvoiceScreen()` (58 lines, three `<Screen>` branches) · `Header` · `Stepper` · `useScrollPad` · `StepBody` · `FormPane` · `BillToCard` + `CityPincodeRow` · `MobileEmailRow` · `DatesRow` · `ItemsSection` + `EmptyItemsCard` · `LineItemCard` · `AdjustmentsCard` · `ShippingFields` · `TotalsCard` · `ReviewSection` · `ActionButtons` · `PreviewPane` · `CatalogPanel` · `TotalBar` · `CatalogSheet`. The five hand-written two-column rows are `Columns kind="input"` (Qty | Rate with `S4.qtyRateWeights`). The TOTAL bar is the `footer` slot (its `marginBottom: navBottom` moved into `Screen`). The catalog search handler became `searchCatalog` in the hook (it was duplicated in the sheet and the panel).

**S2:** `InvoicesScreen()` builds on `<Screen>`; the FAB is the `fab` slot; `InvoiceListCard` reads `useFabClearance()`; `S2.fabClearance` removed.

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean first time |
| Phone, before vs after (`imgdiff.py`, status bar excluded): S4 step 0, Items, Review, Dashboard after leaving | **0.000 % differing pixels** |
| Phone, catalog sheet (P2) | 0.066 % in the sheet's left column: the slide-in animation caught a frame apart; identical to the eye (crops compared) |
| Phone, S2 | FAB and nav where they were |
| Tour at md, lg, xxl (S4) | as before the restructure |
| Tour at xl (S4.L3) | **one visible difference:** City \| Pincode and Mobile \| Email now stack like the dates, because they are `Columns kind="input"` in a 289-dp form (cells 122 dp < 128). Before, only the dates stacked (the others were hand-written rows that clipped nothing because they were empty). Consistent with rule 4; kept |
| Emulator | restored to 1080×2400 |

Not memoised: `LineItemCard` (see TRACKING). Not changed: `components.tsx` and `tokens.ts` (`ListItem titleLines` was Prompt 33), the data calls, the navigation calls.

Docs: `CreateInvoiceScreen_S4_tree.md` rewritten; `SCREEN_LAYOUT_REFERENCE.md` S4 tables name functions, C16 added, S2.6 updated; `InvoicesScreen_S2_tree.md` updated; rationale in TRACKING.

## Session 14 close (2026-10-23)

Everything is committed (`master` at `fa792f7` plus this log; no remote). Metro and the phone emulator were stopped. Next up when the owner returns: `/three-slot-screen` on S5 Products, then S6, S3, S1; the `Tablet_8in` / `Tablet_10in` AVDs exist but the tablet check runs on the resized phone AVD (`/tablet-check`).

## Prompts 43–44 — `size-check` (was `tablet-check`) and the first phone run (2026-10-23, session 14)

**Renamed:** `.claude/skills/tablet-check` → `size-check` (profile table with four phone rows and four tablet rows), `scripts/tablet-tour.py` → `size-tour.py`; references in README, CLAUDE.md, `three-slot-screen` step 6 and the tree files. The tour now goes Back after S3 on one-pane sizes (the first xs/sm runs tapped into the S3 overlay for the rest of the tour; detected, fixed, re-run).

**Phone profiles run:** xs 640×1136 @ 320 (320×568 dp), sm 720×1600 @ 320 (360×800 dp), phoneL 2400×1080 @ 420 (914×411 dp, **lg**). The 411 default is the baseline already checked at every step.

| # | Where | Size | What | Severity |
| --- | --- | --- | --- | --- |
| 1 | S2 list card | phone landscape (914×411, lg), date range open | **the list card collapses to an empty strip**: header + search + tabs + dates take ≈ 330 of 411 dp and the hugging card (`flexShrink: 1`) is the only thing that gives. Without the date range the row shows | **bug** |
| 2 | S2 filters | xs 320 | search placeholder, status tabs and From / To placeholders truncated; row date wraps | tight |
| 3 | S3 items header | xs 320 | "AMOUNT" clips ("RATEAMOU…") | tight |
| — | S4 | xs 320 | `Columns` stacks City / Pincode, Mobile / Email and the dates (cells 118 dp < 128): rule 4 working as designed; stepper, cards, TOTAL bar fine | ok |
| — | S5, P3, S6 | xs 320 | phone rows, the editor sheet, the settings list and drill-in all fine; the FAB floats over the list as on every phone | ok |
| — | everything | sm 360 | complete, nothing truncated | ok |
| — | S3, S4 (form \| preview), S5 (rows \| editor), S6 | phone landscape | the lg layouts fit in 411 dp of height and scroll | ok |

Proposed fixes (not applied): #1 a `minHeight` of about two rows on `InvoiceListCard`, or the filter rows as the FlatList's `ListHeaderComponent` on short screens; #2 / #3 shorter labels or `adjustsFontSizeToFit` under 340 dp (xs is the floor, so "tight but readable" may be acceptable).

Emulator restored to 1080×2400.

## Prompt 45 — S2 short-screen fix, re-checked at phoneL (2026-10-23, session 14)

| Change | File |
| --- | --- |
| `S2.shortScreen = 600`; `ListPane` builds the filters once and, on short screens, passes them to `InvoiceListCard` as `header` with `fill` | `InvoicesScreen.tsx` |
| `InvoiceListCard`: `fill` → card `flex: 1`, list `flex: 1`; `header` → `ListHeaderComponent`; `keyboardShouldPersistTaps` | `InvoicesScreen.tsx` |

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `/size-check` phoneL (2400×1080 @ 420 = 914×411 dp) | S2 without dates: card fills the pane, search · tabs · row visible; with the date range open: search · tabs · From \| To visible, the row scrolls into view below; nothing collapses. S3 in the pane as before |
| Phone portrait (1080×2400), S2 with the date range | unchanged (filters fixed, hugging card) |
| Emulator | restored to 1080×2400 |

Pushed to origin/master.

## Prompt 47 — Last FAB-clearance copies removed (2026-10-23, session 14)

| Change | File |
| --- | --- |
| `<Screen header fab>`; `DashboardMain` (the ScrollView) pads with `useMainInset()` | `DashboardScreen.tsx` |
| `<Screen header fab>`; `ProductListCard` (the hugging card + FlatList) pads long lists with `useFabClearance()`; unused `touch` import dropped | `ProductsScreen.tsx` |
| `useContentInset` removed | `src/ui/navMetrics.ts` |

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| Phone before / after (`imgdiff.py`): S1, S5 top | 0.000 % differing pixels |
| Phone S5 scrolled | 6 % differing, the fling landed half a row apart; the rows and layout are the same (pair compared) |

`grep useContentInset\|52 + layout.gap\|touch.button + layout.gap src` outside `Screen.tsx`: nothing. The third risk of the analysis is now closed in every screen.

## Prompt 48 — S5 inspected; plan for the restructure (2026-10-23, session 14)

**Current structure of `ProductsScreen.tsx` (372 lines):** helpers `blank`, `num`, `AvlBadge` → the two memoised rows (`ProductTableRow`, `ProductListRow`, Prompt 28) → one 265-line component: 5 hooks + 14 `useState` → `load`, `loadHistory`, `startEdit`, `save`, `remove`, `openRestock`, `applyRestock`, `exportXlsx` → four JSX constants (`restockFields` S5.7, `historyBlock` S5.6.6, `editorFields` S5.6, `headerRow` S5.2) → `editorTitle`, `showTable` → one `return` on `<Screen>` (Prompt 47) with the search, `ProductListCard`, the lg+ editor pane and the P3 sheet → `ProductListCard` (Prompt 47) at the bottom. Inline numbers: the six column widths `52 · 84 · 60 · 56 · 76`, `520` (table threshold), `'38%'`, `88` (rail), `0.62`, `padding: 20`, `> 6` (FAB clearance rule), `slice`-free. The editor is rendered in two places (pane or sheet) from the same constants.

The proposed tree is in the chat (Prompt 48); it is copied here once approved.

## Prompt 49 — S5 Products restructured, re-checked (2026-10-23, session 14)

`ProductsScreen.tsx` 372 → 518 lines: one 265-line component → `SIZES` · `QUICK_PICKS` · `S5` (columns, table minimum, editor width, rail, padding, long-list rule) · `blank` · `num` · `AvlBadge` · `useProducts()` (14 state values and the eight actions) · `ProductsScreen()` (18 lines on `<Screen header fab>`) · `Header` · `ListPane` · `SearchRow` · `ProductListCard` · `TableHeader` · `ProductTableRow` · `ProductListRow` · `EditorPane` · `EditorSheet` · `EditorBody` · `ProductForm` · `QuickPickChips` · `SizeChips` · `PriceStockRow` · `EditorActions` · `StockHistory` · `RestockForm`.

Kept exactly: every repo and audit call, the kit components and their props, the memoised rows and their stable `startEdit`, the 520-dp table rule, the pinned 38 % editor pane. Two structural improvements with no visual effect: the editor body is defined once and placed in the pane or the sheet; the table's column widths are one list (`S5.columns`) read by the header and the rows.

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean first time |
| Phone before vs after (`imgdiff.py`): list, editor sheet, Restock view, Back, closed | **0.000 % differing pixels** on all five |
| `/size-check` md, lg, xl, xxl (S5 and P3) | md: phone rows full width · lg: rows beside the editor pane, editor open on the right · xl and xxl: six-column table, names readable, editor pane empty state; all as in Prompts 31–32 |
| `MISSING Date range (set)` / `MISSING Items` in the tour log | expected (no dates set; no stepper at md+) |
| Emulator | restored to 1080×2400 |

Docs: `ProductsScreen_S5_P3_tree.md` rewritten; `SCREEN_LAYOUT_REFERENCE.md` S5 tables name functions; rationale in TRACKING. Pushed to origin/master.

## Prompt 51 — S6 inspected; plan for the restructure (2026-10-23, session 14)

**Current structure of `SettingsScreen.tsx` (327 lines):** `VERSION_LABEL`, `Section`, `SECTIONS` → one 293-line component: 3 hooks + 7 `useState` → `useBackIntercept` → `load` → an early "Loading settings…" return → `setField`, `saveCompany`, `doExportBackup`, `doImportBackup` → a `row(a, b)` helper and a `last` style → four JSX constants (`companyForm` S6.2 with three cards and six hand-written two-column rows, `draftsPane` S6.3, `backupPane` S6.4, `activityPane` S6.5) → a `panes` map → `sectionList(phone)` → two `return`s (one pane: list or drill-in; lg+: 300-dp list | pane). Inline numbers: `300` (list width), `720` (pane max width), `-space[4]` (last-input pull), `-space[3]`, `50` (audit rows), `1024` (KB), `3` (zero-padding), the `maxLength`s 6 / 10 / 11.

The proposed tree is in the chat (Prompt 51); it is copied here once approved.

## Prompt 52 — S6 Settings restructured, re-checked (2026-10-23, session 14)

`SettingsScreen.tsx` 327 → 469 lines: one 293-line component → `SECTIONS` · `VERSION_LABEL` · `S6` (list width, pane max width, audit rows, input pull, the three length limits, the number padding) · `useSettings()` (7 state values, the five actions, the draft open / delete handlers, Back) · `SettingsScreen()` (37 lines: the loading line, then the one-pane or master-detail `<Screen header>`) · `Header` · `SectionScroll` · `SectionList` · `SectionListPane` · `SectionBody` · `FieldRow` · `CompanyForm` · `BusinessCard` · `BankCard` · `NumberingCard` · `DraftsPane` · `DraftRow` (memo) · `BackupPane` · `ExportRestoreRow` · `RecentBackups` · `ActivityPane`.

Kept exactly: every repo call, the document picker and the two confirm dialogs, the kit components and their props, the one-pane rule (phones and md), the 300-dp list and 720-dp reading width on lg+. The six hand-written two-column rows are `FieldRow` (`Columns kind="input"`); the `panes` record became a `switch`; `doExportBackup` / `doImportBackup` are `exportBackup` / `importBackup` in the hook.

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean first time |
| Phone before vs after (`imgdiff.py`): Settings list, Company, Drafts, Activity log, the list after Back | **0.000 % differing pixels** on all five |
| Phone, Backup & restore | checked by eye (the before run's tap missed: uiautomator encodes "&" as `&amp;`; the script now matches that): info card, Export \| Restore, four recent backups |
| `/size-check` md | list with chevrons and the version line, Company as a drill-in under a back bar beside the rail, as in Prompt 32 |
| `/size-check` lg | master-detail: 300-dp list with the tinted Company row and the version line, the form in the pane with its two-column rows |
| Emulator | restored to 1080×2400 |

Docs: `SettingsScreen_S6_tree.md` rewritten; `SCREEN_LAYOUT_REFERENCE.md` S6 tables name functions; rationale in TRACKING. Pushed to origin/master.

With S6 done, five of six screens are on the Three-Slot method (S2, S4, S5, S6 fully; S1 on the scaffold with a `DashboardMain` region, its small hook and numbers block still to come).

## Prompt 53 — S1 and S3 inspected; plans for both (2026-10-23, session 14)

**S1 `DashboardScreen.tsx` (108 lines):** `fyLabel`, `StatTile` → a 33-line component (2 `useState`, `load`, the three stock tiles built inline, `<Screen header fab>` from Prompt 47) → `DashboardMain` (hero card + tiles row inline). Inline numbers: `padding: 20`, `gap: 6`, `gap: 10`, `minHeight: 36`, `0.6` (font scale), `0.9` (max width share).

**S3 `InvoiceDetail.tsx` (208 lines):** one 191-line component: 8 `useState` → `load` → an early spinner return → `voidInvoice`, `askPayment`, `submitPayment`, `share` → derived `canPay`, `party`, `contact`, `modes` → one `return`: a `ScrollView` (header row, bill-to card, action row, items card with an inline header row and inline line rows, totals card, Edit / Void row) + the P1 `Sheet` inline. Inline numbers: the column flexes `2.6 : 0.8 : 1.3 : 1.3`, `maxWidth: 720`, `paddingBottom: space[6]`, `100` (paise), the four payment modes. S3 has **no header or footer of its own**: on phones the shell draws the "Invoice" back bar (`App.tsx`), on tablets S2's `DetailPane` hosts it.

The proposed trees are in the chat (Prompt 53); they are copied here once approved.

## Prompt 54 — S1 and S3 restructured, re-checked (2026-10-23, session 14)

`DashboardScreen.tsx` 108 → 159 lines: `STOCK_TILES` · `S1` (hero padding and gap, tile gap, label height, figure min scale, read-width share) · `fyLabel` · `useDashboard()` · `DashboardScreen()` · `Header` · `DashboardMain` · `HeroCard` · `StatTilesRow` · `StatTile`.

`InvoiceDetail.tsx` 208 → 321 lines: one 191-line component → `PAY_MODES` · `S3` (item column flexes, read width, bottom pad, paise per rupee) · `useInvoiceDetail()` (8 state values, `load`, `voidInvoice`, `askPayment`, `submitPayment`, `share`, the derived `outstanding` / `canPay` / `party` / `contact`) · `InvoiceDetail()` (spinner, then Main + P1) · `DetailMain` · `HeaderRow` · `BillToCard` · `ActionRow` · `ItemsCard` + `ItemsHeader` + `LineRow` (memo) · `TotalsCard` · `EditVoidRow` · `PaymentSheet`. No `<Screen>` wrapper: S3 is an embeddable Main (shell back bar on one pane, S2's `DetailPane` on lg+).

Kept exactly: every repo and export call, the confirm dialog, the snackbar texts, the kit components and their props, the 2.6 : 0.8 : 1.3 : 1.3 columns (now one array), the 720-dp reading width.

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean first time |
| Phone before vs after (`imgdiff.py`): S1 Dashboard, S3 opened from the list, S3 scrolled to the bottom | **0.000 % differing pixels** on all three |
| P1 Record payment | not reachable on the device (PRE-001 totals ₹0 → `canPay` false, button hidden); code path checked by reading |
| `/size-check` md (8-inch portrait) | S3 as the full-width overlay beside the rail under the "Invoice" back bar; items header ITEM · QTY · RATE · AMOUNT complete; S1 full width, no FAB |
| `/size-check` lg (10-inch portrait) | S3 in S2's 50 % pane; RATE and AMOUNT header labels touch in the ≈ 370-dp pane, as noted in Prompt 30 (not caused by this change: the flexes and labels are identical) |
| Emulator | restored to 1080×2400 |

Docs: `DashboardScreen_S1_tree.md` and `InvoiceDetail_S3_P1_tree.md` rewritten; `SCREEN_LAYOUT_REFERENCE.md` S1, S3 and P1 tables name functions; rationale in TRACKING.

All six screens (S1–S6) are now on the Three-Slot method.

## Prompts 55–57 — the three risks re-verified; the portable skill (2026-10-23, session 14)

**Prompt 55 (all fixed?).** Re-checked on master: `React.memo` rows in S2 (`InvoiceRow`), S3 (`LineRow`), S5 (`ProductTableRow`, `ProductListRow`), S6 (`DraftRow`); 8 `<Columns>` rows across S2, S4, S5, S6; no `useContentInset` / `52 + layout.gap` / `touch.button + layout.gap` outside `src/ui/Screen.tsx`; `npm run test:columns` 10/10. All three risks closed.

**Prompts 56–57 (portable skill).** Created `C:\Users\admin\.claude\skills\responsive-screens\` (outside this repo, seen by every project on this machine):

| File | What |
| --- | --- |
| `SKILL.md` | set-up steps for a new app, the breakpoints table, the Three-Slot method (file order, slots, hosted screens), the Columns rules, lists / performance, the eight size-check profiles and the review list, the done checklist |
| `CLAUDE.md.snippet` | five bullets to paste into a new app's `CLAUDE.md` |
| `templates/ui/` | `layoutTokens.ts` (space, layout, touch, maxReadWidth), `useBreakpoint.ts`, `navMetrics.ts`, `columnsMode.ts`, `Columns.tsx`, `Screen.tsx` (with a `background` prop instead of `useTheme`) |
| `templates/scripts/` | `size-tour.py` (CONFIG block + `TOUR` step list, `&` escaped, non-Windows `adb` path), `run-columns-tests.mjs` (file path as argument) |

| Check | Result |
| --- | --- |
| `tsc --strict --jsx react-native --moduleResolution bundler` on the six template files alone (copied into a temp folder, this repo's `node_modules` for the RN types) | clean |
| `node run-columns-tests.mjs <template columnsMode.ts>` | 10/10 pass |
| `size-tour.py` | parses; not run (its CONFIG points at a placeholder app) |
| This repo | unchanged apart from the docs; the three project skills stay |

## Prompt 58 — solutions and best practices written into the method documents and the skills (2026-10-23, session 14)

| File | Change | Check |
| --- | --- | --- |
| `LAYOUT_METHOD_header-main-footer_analysis.md` | §7 "What was built afterwards" (7.1 Columns, 7.2 Screen and the list coupling, 7.3 memo rows, 7.4 decisions on the way) and §8 "Best practices: the final list" (12 items); the three ⚠️ cells of §2 marked closed with a pointer | read back |
| `three-slot-analysis.html` | status badges on the three couplings; the three warn rows and the trade-offs rewritten; the six conventions rewritten; the "What was built" card (`#solutions`); recommendation "adopted · 6 / 6"; v2 | rendered in the browser pane (verdict card with the three badges); tag balance checked; republished as https://claude.ai/artifact/QRZcV3LEKKUb35ofzk3GbE v3 |
| `three-slot-screen.html` | slot list, conventions, fit table, pitfalls (+5), size-check profiles card; snippets 1–4 replaced with the current code, 6 and 7 added; all six screens "done"; prompts 6 and 7; v2 | one stray `</section>` from the insertion removed; sections 4 / 4, 14 copy ids; republished as https://claude.ai/artifact/MBKMrWnRkEjQyqpgqG6WHE v2 |
| `.claude/skills/three-slot-screen/SKILL.md` | steps 2, 3, 4, 6 and the reference line updated | read back |
| `.claude/skills/size-check/SKILL.md` | uiautomator quirks, pixel compare, pointer to §7.4 | read back |
| `~/.claude/skills/responsive-screens/SKILL.md` | §6 "Pitfalls seen in practice, and the fix" (8 rows); checklist is §7 | read back (outside the repo) |

No source file changed; nothing to typecheck or screenshot.

## Prompt 59 — tree files replaced (2026-10-23, session 14)

All ten `*_tree.md` files in `SCREEN_CODE_STRUCTURE/` were rewritten from the sources as they are today, in the eight-section Three-Slot format (template kept in the session scratchpad; `DashboardScreen_S1_tree.md` was written first as the example, the other nine by parallel subagents, each briefed with the source file, the old tree file, the layout reference section, `Screen.tsx`, `Columns.tsx` and the skill).

| File | Lines | Notable corrections against the old file |
| --- | --- | --- |
| `DashboardScreen_S1_tree.md` | 111 | written fresh after the Prompt 54 restructure |
| `InvoicesScreen_S2_tree.md` | 144 | the date-range row's floor is 128 (`kind="input"`), not 44; the code comment at InvoicesScreen.tsx:190 corrected to match |
| `InvoiceDetail_S3_P1_tree.md` | 183 | the status pill comes from `statusStyle[status]` (draft included); `numberOfLines={1}` on the header labels is already in the code, so the open finding keeps only `adjustsFontSizeToFit` / a narrower item share; S3.3 gap is 12 and S3.4.h flex 2.6 : 0.8 : 1.3 : 1.3 (layout reference corrected) |
| `CreateInvoiceScreen_S4_tree.md` | 205 | dropped the claim that S5's FAB opens S4 (no such call); the "form may grow past 38 %" note holds for xl only; `narrowCatalog` is true under 1288 dp, so at xxl 1280 too |
| `ProductsScreen_S5_P3_tree.md` | 177 | the lg list pane is (800 − 88) × 0.62 = 441 dp, not 410 (code comment corrected); `S5.editorPadding` is used by the pane only; the Prompt 31 interim 480 threshold is history (code: 520); the hugging card uses `useNavInset()` + `useFabClearance()`, not `useMainInset()` |
| `SettingsScreen_S6_tree.md` | 184 | five `FieldRow` rows, not six; the sixth two-column row is `ExportRestoreRow`, a plain row of two buttons; `SectionScroll` ends with `useNavInset()` (equal to `useMainInset()` here: no fab, not an overlay); the lg+ pane end padding is `layout.side` 20; xs / sm were last checked before the company rows became `Columns` (Prompt 44), so whether they stack at 320 has not been observed |
| `AppShell_S0_tree.md` | 223 | file sizes 170 / 24; at md the Invoice detail overlay is drawn beside the rail (App.tsx:157-164), not inside S2's pane; S0.4 nav is 68 tall and the Rail is Nav.tsx:69-116 (layout reference corrected) |
| `InvoicePdf_D1_tree.md` | 185 | call-site and template line numbers refreshed; the layout reference's own D1 line column is stale (38-70, 72-85 …) and left for its next refresh |
| `ExcelExports_D2_tree.md` | 215 | call sites refreshed (S3 118-119, S4 196, S2 74-80 / 141-142, S5 187); D2.3 lines 132-161; `lastInvoiceNo` marker at 73 |
| `SharedComponents_C1-C4_tree.md` | 463 | `components.tsx` is 610 lines (Chip 506, SegmentedControl 545, FAB 588, EmptyState 492); one `TopAppBar` each in S4 (383) and S6 (224); Invoice detail has 7 buttons incl. P1's Cancel / Save payment; the Sheet's phone top radius is `radius.card` 16 (the code comment said 24; corrected) |

| Check | Result |
| --- | --- |
| Every file has the eight sections in order | yes (headings listed) |
| Declared-function line numbers cited in S0–S6 trees vs the sources (script) | 63 citations match; the 9 non-matches are second use sites (a component used twice), not errors |
| `npm run typecheck` after the three comment edits | clean |
| README and `SCREEN_LAYOUT_REFERENCE.md` | the description of the tree files updated to the new format |

Not re-run: the size checks. Section 8 of each file carries the breakpoint findings as recorded by the Prompt that observed them.

## Prompts 60–64 — the screen map (2026-10-23, session 14)

Prompts 60–62 were answered in chat (the S2 rows-and-columns tree; the status tabs are `SegmentedControl` fed by `STATUSES`, inside `ListPane`, and only on short screens inside `InvoiceListCard` as the list header). Prompt 63 got an inline map of S2. Prompt 64:

| Item | Where | Check |
| --- | --- | --- |
| Generator + data for S1–S6 | `scripts/screen-map.py` (data from the tree files, sections 1, 3 and 5) | runs; 6 screens |
| The page | `SCREEN_CODE_STRUCTURE/screen-map.html` (38 KB) | opened in the browser pane: tabs switch, S4 shows the stepper, the three step blocks with their Columns rows, the TotalBar footer and the sheet; published as https://claude.ai/artifact/2eSJt98Zy4PqVMXvF4QwKe |
| Skill | `.claude/skills/screen-map/SKILL.md`; `/three-slot-screen` step 7 ends with the map; `CLAUDE.md` and README point to it | read back |
| Portable | `~/.claude/skills/responsive-screens/templates/scripts/screen-map.py` (the generator with S2 as the example entry) and a new §7 in that skill | generated from the repo script by slicing the S2 entry |

Not done: no screenshots of the page at phone width (the browser pane here is small; the page uses the same responsive CSS as the two method pages, one column under 720 px).

## Prompts 65–66 — 5-inch phone: size check and the map (2026-10-23, session 14)

`python -I scripts/size-tour.py <out> phone5 720x1280 320` on the running phone AVD, then `reset` (confirmed back at 1080 × 2400). 11 screenshots. Seen:

| Screen | At 360 × 640 dp | Verdict |
| --- | --- | --- |
| S1 | header, hero, three tiles (two-line labels), FAB above the nav, empty space below the tiles | ok |
| S2 (+ date range) | filters as rows (640 > `S2.shortScreen` 600), one invoice row above the FAB | ok |
| S3 | back bar, header row, bill-to, Share PDF \| Excel, items table; RATE / AMOUNT labels nearly touch | ok, tight (known since Prompt 44 at xs; now seen at 360 too) |
| S4 Bill to / Items | stepper, four fields above the TOTAL bar; Items: title row, empty card, Add free line, adjustments below the fold | ok |
| P2 | the tap on "Add from products" did not open the sheet in time: the shot shows the Items step again | not seen |
| S5 / P3 | search, four rows, FAB over the fifth; sheet at 92 % with the chips wrapping | ok |
| S6 / Company | section list + version with room; Company: four fields above the nav | ok |

The map (`scripts/screen-map.py` → `screen-map.html`) now carries a `small` line per screen under the phone column with these observations; the page is republished at the same link. The profile is added to the size-check skill, the tour docstring, the portable skill and its tour template. Section 8 of each S1–S6 tree file has a `phone5` row.

Open: the RATE / AMOUNT header gap on S3 at 360 dp and under (proposed fix unchanged: `adjustsFontSizeToFit` on the header labels, or a narrower item share).

## Prompts 67–68 — S2 status tabs: only "All" (2026-10-23, session 15)

Prompt 67 was a review of the prompt (answered in chat). Prompt 68: `STATUSES` (S2.2, `src/features/invoices/InvoicesScreen.tsx`) now holds only `{ value: 'all', label: 'All' }`; Issued, Partial, Paid and Void are removed. `SegmentedControl`, `useInvoiceList` (status state and the filter) and every other screen are unchanged, so the Status control shows one "All" tab and the list is never filtered by status.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | no errors |
| On the emulator | not run |

## 2026-10-26: S3 screen map refreshed (Invoice detail · Issued)

`scripts/screen-map.py` S3 entry rewritten from `InvoiceDetail.tsx`: ActionRow now WhatsApp · Image · Save · Share PDF (Excel removed), `EditVoidRow` is `EditDeleteRow` (Edit blue, Delete red), and the off-screen `InvoiceImage` capture block was added. Regenerated `screen-map.html`. The `_tree.md` file for S3 still describes the old Excel / Void layout.

## 2026-10-26: screen map refreshed to the latest screens (S2, S3, S4, S6)

`scripts/screen-map.py`, then `screen-map.html` regenerated (date 2026-10-26):

- **S2 Invoices:** Draft tab and the status SegmentedControl removed; header has one action (download = Export all invoices to Excel, all details, ignores filters); book removed.
- **S3 Invoice detail:** ActionRow removed; WhatsApp is now the last child of BillToCard (fill #25D366, white icon and label). PaymentSheet marked unreachable (no button opens it).
- **S4 Create / Edit:** Save draft and draft autosave removed (leaving loses unsaved input); BillToCard is Customer name · Mobile · Invoice date; line item has Size | Qty | Rate; PaymentCard (Cash | UPI) added to ItemsSection.
- **S6 Settings:** Drafts section removed (three sections).
- The `small` (5-inch) notes for S2, S4 and S6 were dropped because they described layouts that changed; re-run `/size-check` to restore them.
- The S2, S3, S4 and S6 `_tree.md` files still describe the old layouts.

## 2026-10-27: S2 FilterRow, calendar button removed

`src/features/invoices/InvoicesScreen.tsx`: `FilterRow` is now only the `SearchField` (full width). Removed with it, since nothing else could open them: `DateRangeRow` (S2.3a), the `dateOpen` / `from` / `to` state, `datesSet`, `S2.filterGap`, `S2.dateRowPull`, and the `Columns`, `Input` and `IconButton` imports. `filtered` now means "search text is set". Docs: `scripts/screen-map.py` (then `screen-map.html` regenerated), `scripts/size-tour.py` (the date-range step), `SCREEN_LAYOUT_REFERENCE.md` (S2 wireframe, S2.3 / S2.3a rows, C15 users), `InvoicesScreen_S2_tree.md`, `SharedComponents_C1-C4_tree.md`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | no errors |
| Release APK (`gradlew assembleRelease`, `JAVA_HOME` = Android Studio `jbr`), `adb install -r` on `Medium_Phone_API_37.0` | installed over the existing release build; data kept (2 invoices) |
| S2 on the phone (411 dp) | search field spans the row under the header; no calendar button; list card, FAB and nav as before |
| Tablets / landscape | not checked |

## 2026-10-27: WhatsApp share image, address out and Cash/UPI in the top middle

`src/features/invoices/InvoiceImage.tsx`: the `from` line (Settings address, city, pincode) is gone; the top row has a centred middle column, overline "Payment" over `inv.payment_mode`. `scripts/screen-map.py` InvoiceImage note updated, `screen-map.html` regenerated.

| Check | Result |
| --- | --- |
| `npm run typecheck` | no errors |
| Debug build on `Medium_Phone_API_37.0` (Metro), WhatsApp tapped on INV-002 and INV-001; the PNG copied out of the app cache with `run-as` (WhatsApp is not installed, so the share stops after the capture) | both images: no "Tirupur, 641 607"; "PAYMENT / UPI" centred between the business name and the invoice block |
| Saved mode | both invoices are UPI in their Edit → Items → Payment card, so "UPI" is right; a Cash invoice was not captured (none exists) |
| Release build | rebuilt and reinstalled afterwards |

## 2026-10-27: S4 LineItemCard, Qty − / + stepper

`src/ui/components.tsx`: new `StepperInput`. `src/features/invoices/CreateInvoiceScreen.tsx`: Qty `Input` → `StepperInput`; `S4.lineWeights` [1, 1.2, 1.25]. Docs: `scripts/screen-map.py` (+ `screen-map.html`), `SCREEN_LAYOUT_REFERENCE.md` (S4.B.3, C4), `CreateInvoiceScreen_S4_tree.md`, `SharedComponents_C1-C4_tree.md`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | no errors |
| Debug build + Metro, phone 411 dp, New invoice → Items → Add free line (not saved) | row Size \| Qty \| Rate = 91 · 109 · 113 dp; + three times and − once: 1 → 3, Amount ₹750 at rate 250; typed qty 100 × rate 1250 = ₹1,25,000.00; "100" fits between the buttons |
| First weights tried, [1, 1.4, 1.2] | Size 84 ("Select" touched its chevron), Rate 104: rejected |
| 360 dp (`wm density 480`) | the row stacks; the stepper is full width, − left, + right |
| Rate field hugging its left edge right after typing | Android keeps the typing scroll; re-opening the step shows the normal 16 padding. Not caused by this change |
| Tablets | not checked (`/size-check` not run) |

## 2026-10-27: S1 Dashboard, Stock split 3D pie (S1.6)

New: `src/ui/PieChart3D.tsx` (C17), `chartShade` in `src/ui/tokens.ts`, dependency `react-native-svg` 15.16.0. `src/features/dashboard/DashboardScreen.tsx`: `useDashboard()` also returns `stock`; `StockPieCard` after `StatTilesRow`; `S1.pieWidth` / `pieWidthXs` / `pieTilt` / `pieDepth` / `swatch`. Docs: `scripts/screen-map.py` (+ `screen-map.html`), `SCREEN_LAYOUT_REFERENCE.md` (S1 wireframe, S1.6, C17), `DashboardScreen_S1_tree.md`, `README.md` (UI row).

| Check | Result |
| --- | --- |
| `npm run typecheck` | no errors (one fix: `parts[0]` possibly undefined under `noUncheckedIndexedAccess`) |
| Debug APK rebuilt (new native module), 411 dp, real data (Sold 2, Balance −2, Actual 0) | the disc is all blue with a darker blue wall; legend 2 / −2 / 0 and red "Oversold by 2" |
| Same, with sample values Sold 3 / Balance 5 / Actual 8 put in for one screenshot, then reverted | blue wedge 135° (3 / 8), grey the rest, each wall shaded; 1px white slice edges |
| Dark mode (`cmd uimode night yes`) | card dark glass, Balance dot light grey, red note lighter red; reset afterwards |
| 320 dp (`wm density 540`) | with a 128 pie the legend labels cut off; with 96 they fit; scrolled to the end the card clears the FAB |
| Tablets | not checked |

## 2026-10-27: Expo cloud APK, build 3

`eas build --platform android --profile preview --non-interactive` from commit `29f4d02` (uploads 3.5 MB; `.easignore` keeps `/android` out, so EAS prebuilds all ABIs). Remote keystore `XunsAMGKSH`, the same as build 2. Build `97fce4d7-1229-47b4-98df-4ca5aa366ccd`: FINISHED, version 1.0.1 / versionCode 3 (from `app-version.json`, already 3). Page: https://expo.dev/accounts/jiametrics-team/projects/invoice-erp/builds/97fce4d7-1229-47b4-98df-4ca5aa366ccd. Not installed on a phone yet; not downloaded into `release/`. README row added.
