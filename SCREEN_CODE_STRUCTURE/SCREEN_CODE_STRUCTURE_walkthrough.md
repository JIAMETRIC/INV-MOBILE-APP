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
