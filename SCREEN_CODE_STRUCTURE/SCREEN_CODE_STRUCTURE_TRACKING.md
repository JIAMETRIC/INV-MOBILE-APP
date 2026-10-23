# SCREEN_CODE_STRUCTURE — Tracking

Restructuring screen files so a non-expert can read a screen top-down and change one part (a row, a column, a gap, a colour, a label) without touching the rest. Starts with S2 Invoices (`src/features/invoices/InvoicesScreen.tsx`).

## Rationale

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| Own topic folder, separate from `SCREEN_LAYOUT_REFERENCE/` | That topic documents screens for prompting; this one changes how the screen code is organised. The reference file gets updated when the code moves, but the decisions live here. | Logging under SCREEN_LAYOUT_REFERENCE: rejected, it would mix a documentation topic with code restructuring. |
| Framework conventions: React Native + TypeScript function components (PascalCase), `View` rows and columns, a hook for state | What the rest of `src/features/` already does (`StatTile`, `AvlBadge`, `Stepper`, `CatalogSheet` are local components in their screen files). | Class components or StyleSheet objects: not used anywhere in the project. |

## Prompt 1 / 12 — InvoicesScreen restructure (planned 2026-10-23, applied the same day)

Approved as proposed. Behaviour, props on the kit components, and the rendered screen are unchanged (verified on the phone emulator); the file went from 159 lines in one function to 265 lines in 11 named pieces.

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| Order inside the file: `STATUSES` and `S2` (text and numbers) → `useInvoiceList()` (state) → `InvoicesScreen()` (the switch) → one function per region, in on-screen order | A non-expert reads it top to bottom and meets the things they edit most first; the regions appear in the same order as on the phone. | Screen function first (React habit): hides the editable constants at the bottom. |
| All screen-specific numbers in one `S2` constant, each with its ID in a comment (`filterGap`, `dateRowPull`, `longList`, `fabClearance`, `detailWidth`, `activityWidth`) | Changing a pane width or the FAB clearance is a one-line edit with no searching; shared spacing stays in `tokens.ts`. | Inline numbers (as before): the three `'50%' / '42%' / '26%'` were indistinguishable. Adding them to `tokens.ts`: they are not shared. |
| One state hook `useInvoiceList()` returning a plain object; pieces take `list` + `theme` | The screen function shrinks to the phone / tablet switch, and each piece shows at its call site what it depends on. `ReturnType<typeof useInvoiceList>` keeps the prop type in step with the hook. | State at the top of `InvoicesScreen()` and prop drilling: simpler to trace, but the function stays ~60 lines. A context: overkill for one screen. |
| `ListPane` keeps `SegmentedControl` and `FAB` as one-liners instead of wrapping them | Wrapping a one-line kit component in a function adds a name without adding clarity. | A `StatusTabs` function: rejected. |
| `InvoiceRow` is its own function with explicit props (`item`, `alt`, `last`, `selected`, `onPress`) | The row was four levels deep inside `renderItem`; now "what a row shows" is one small function. | Keep it inline. |
| One file, not a folder | 265 lines is still one screen to read; the layout reference and the tree file map by file. | `invoices/list/` with one file per piece: more files to open for a change that usually touches one region. |
| Line-number column in `SCREEN_LAYOUT_REFERENCE.md` S2 replaced by function names | Names don't drift; the tree file carries today's line numbers. | Keep updating line numbers by hand. |

Not done on purpose: no change to `components.tsx` or `tokens.ts`; no tablet verification on a device (phone AVD only).

## Prompts 5–8 — Tree files, one per screen / overlay / document / component (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| One `*_tree.md` per source file, named `<Component>_<ID>_tree.md` (`InvoiceDetail_S3_P1_tree.md`), inside this topic folder | The owner reads them in the terminal (`Get-Content`), so one file per screen is the unit they open. Overlays (P1–P3) sit in their screen's file because they live in that source file. | One big file: too long for a terminal. A folder per screen: more to type. |
| Fixed four-part format: header · fenced ASCII tree with IDs and start lines · "What each function does" · "Where to change what" | The same shape every time, so a vibecoder knows where to look; the last table is the one they use most. | Prose descriptions: slower to scan. |
| Line numbers are taken from the code on the day and dated in the header | They are the fastest way to jump to code; the IDs (S4.B.3) stay stable when they drift. | No line numbers: every lookup becomes a search. |
| `SCREEN_LAYOUT_REFERENCE.md` keeps the IDs and the cross-screen map; it now points here for per-screen detail | Two documents with two jobs: the reference answers "what is S4.B.3", the tree file answers "where exactly, and what do I edit". | Folding the trees into the reference: it would double in size. |

Files (10): `AppShell_S0_tree.md` · `DashboardScreen_S1_tree.md` · `InvoicesScreen_S2_tree.md` · `InvoiceDetail_S3_P1_tree.md` · `CreateInvoiceScreen_S4_tree.md` (P2 inside; phone + tablet layouts) · `ProductsScreen_S5_P3_tree.md` · `SettingsScreen_S6_tree.md` · `InvoicePdf_D1_tree.md` · `ExcelExports_D2_tree.md` · `SharedComponents_C1-C4_tree.md`.

**Maintenance:** when a screen changes, refresh its tree file's line numbers and date in the same session. Add new IDs at the end of a section, never renumber.

## Prompt 9 — D2.2 register dedupe (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| Dedupe in the loop with a `lastInvoiceNo` marker, keeping the single joined query | Smallest change; one query, one pass, batches unchanged. Rows of one invoice are contiguous under `ORDER BY i.id`, so a marker is enough and it survives batch boundaries. | Two queries (invoices, then items): clean, but changes the batching and the `MAX_ROWS` rule. `GROUP BY` / `DISTINCT`: would need a second query for the items anyway. |
| Extract `collectRegisterRows()` and export it | Lets the integration harness assert on rows without parsing an .xlsx. | Parsing the workbook in the test: the xlsx tests have an unzip helper, but it is far more code for the same assertion. |
| Harness compiles `src/export/xlsx.ts` with `--rootDir src` and mocks `expo-file-system` + `./pdf` | `xlsx.ts` must share the same compiled `db.js` as the repos (one in-memory DB), so it joins the existing compile instead of a second one. | A second `tsc` run into another folder: a second `getDb()` and an empty database. |

## Prompt 21 — The method gets a name and a page (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| Name: **Three-Slot Screen (3SS)** | Says the whole method in three words: three slots (Header / Main / Footer), and "screen" because it is applied per screen file; rows and columns are the inside of Main. No clash with existing names in the repo. | "Frame-Row-Column" (FRC): accurate but a mouthful. "Slot-Row-Column" (SRC): clashes with `src/`. "Shelf layout": too vague. |
| It is a **skill** (`three-slot-screen`), not a design document | The method is a procedure the assistant runs on a file (inspect → plan → split → verify), which is what `.claude/skills/*/SKILL.md` holds (`apply-design` is the precedent). `design/DESIGN.md` describes what things look like; it stays as is. The analysis file is the skill's reference. | Adding a "Layout" chapter to DESIGN.md: it would mix how code is organised into a visual spec. |
| A web page, `SCREEN_CODE_STRUCTURE/three-slot-screen.html`, styled with the app's own tokens | The owner asked for a page with copyable snippets that looks exactly like the mobile UI: it reuses the kit's five colours, glass recipes, the two shadows, Inter 300–600, Bebas Neue numbers and the owner's radii (10/12/14/16/18), and borrows the reference layouts (large header, hero card, stat tiles, segmented control, list rows, pinned device bar). Dark mode follows the Sign In recipe. Published as a private artifact as well. | A plain Markdown page: no copy buttons, no kit styling. |

The skill was created in Prompt 24: `.claude/skills/three-slot-screen/SKILL.md`.

## Prompt 24 — The `three-slot-screen` skill (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| Same shape as `apply-design`: frontmatter (name, description with trigger phrases), numbered steps, a checklist, a "report" line | One skill format in the repo; the assistant already follows it. | A long essay: harder to execute step by step. |
| Step 1 ends with "wait for the owner's OK" | The S2 restructure was approved from a plan first; that is the owner's preferred flow. | Edit straight away. |
| Step 5 names what must not change (behaviour, kit components, tokens, IDs) and hands restyling to `/apply-design` | Keeps the two skills separate: one reorganises code, the other changes looks. | One combined skill. |
| Step 7 makes the docs part of the skill (tree file, layout reference, topic files) | Otherwise the tree files drift the first time the method is applied without me. | Leaving docs to AGENTS.md alone. |
| `CLAUDE.md` gets one line under "How to work" naming the method and the skill | So every future session knows screens follow it, even without the skill being invoked. | — |

## Prompt 28 — Memoised rows and the `Columns` helper (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| List rows are `React.memo` components with a stable `onPress` that takes the id / row (`useCallback`) | Rule 5 of the method. Without a stable handler, `memo` is useless: a new arrow per render changes the props. S2 `InvoiceRow`; S5 `ProductTableRow` and `ProductListRow`. | Memo without the stable handler: no effect. `useMemo` on `renderItem`: still recreates the row element. |
| `Columns` (`src/ui/Columns.tsx`, C15): children become equal `flex: 1` columns (or `weights`), gap 12; stacks at `stackAt` or narrower, or when a cell would be under `minCell` (44) | Rule 4 written once. Any new row gets the touch-minimum guard for free and states its stacking rule in one prop. | A rule in the skill only: nothing enforces it. A `Row` with no guard: same as today. |
| Used now in S2.3a and S5's two editor rows; S4 and S6 rows wait for their own restructures | Those files are about to be rewritten; touching them twice is churn. | Convert every 2-column row now. |
| Products' bare `52 + layout.gap` became `touch.button + layout.gap` | The last bare FAB-clearance literal; the scaffold will replace the constant with a measurement later. | — |

## Prompt 30 — `Columns` wrap mode, tablet sizes and the `tablet-check` skill (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| `Columns` gets a `kind` preset for the usable minimum per cell: `touch` 44 (default, icon buttons), `input` 128 (labelled fields), `button` 96; `minCell` still overrides | The touch floor alone let four inputs sit at 71 dp each on a 360 dp phone. A labelled input needs about ten characters: 128 keeps two inputs side by side down to 320 dp (134 each) and sends three or four to the next line. | One global minimum: either too big for icon rows or too small for inputs. |
| `wrap` mode: `flexWrap` with `flexBasis = minCell`, `flexGrow 1`; falls back to `stack` when fewer than two cells fit a line | "The 4th column goes down": four inputs become 2 + 2 on a phone and one row again on a tablet. A lone last cell stretches to the full width (flex-wrap behaviour), which reads fine for inputs. | Only stacking (previous behaviour): one cell per line is a waste at 360 dp. CSS-grid-like equal columns per line: not in Yoga. |
| The decision lives in a pure function, `src/ui/columnsMode.ts`, with `scripts/run-columns-tests.mjs` (10 cases, `npm run test:columns`) | The row / wrap / stack choice is arithmetic; testing it needs no React or emulator. | Testing through the emulator at four widths: slow and indirect. |
| Tablet checks run on the **phone AVD resized** with `wm size` / `wm density` to 800×1280@213 (601×961 dp, md), 1280×800@213 (961×601 dp, xl), 1200×1920@240 (800×1280 dp, lg) and 1920×1200@240 (1280×800 dp, xxl); the `Tablet_8in` / `Tablet_10in` AVDs were created but are not used | The two tablet AVDs on the API 37 image would not run on the host GPU here (GL context errors, device offline) and under `-gpu swiftshader_indirect` the guest rebooted mid-tour and `screencap` aborted (`hasReadColorBufferDma`). The layout code only reads the window size in dp, so a resized phone shows the same layout. | Fixing the AVD (more RAM, `angle_indirect`): possible later; the resize route works today and is faster. |
| `scripts/tablet-tour.py` finds controls through `uiautomator` content-desc / text, not fixed coordinates | The same script works at every size and after layout changes; taps that cannot land are logged as `MISSING`, which is itself information (no stepper at md+, editor is a pane at lg+). | Hard-coded tap coordinates per size: break on every change. |
| A separate `tablet-check` skill, called from `three-slot-screen` step 6 | Verification is a procedure of its own, used by both the restructure skill and plain "is it responsive" questions. | Folding the steps into `three-slot-screen`: it would be run only after restructures. |

## Prompt 31 — The two tablet bugs (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| S5.5 editor: `flexGrow: 0, flexShrink: 0` on the `ScrollView` next to `width: '38%'` | A React Native `ScrollView` carries `flexGrow: 1` in its base style, so a percentage width is only its flex basis and it takes the leftover space too; the list pane shrank to ≈ 25 % and the fixed table columns (328 dp) left nothing for NAME. Pinning the pane restores the 38 % the layout reference specifies. | Wrapping the ScrollView in a `View` of 38 %: same result, one more node. A `minWidth` on the list pane alone: hides the cause. |
| `Columns` measures its own width with `onLayout` and decides from that; until the first layout it uses the window width minus the side padding | Inside a pane (the xl three-panel form is ≈ 290 dp wide) the window width says "plenty of room" while the cells are 122 dp. Measuring the row itself makes the rule true everywhere. The first frame may show a row that becomes a stack after one layout pass on tablets; on phones the estimate and the measurement agree. | Passing the pane width down as a prop: every pane would have to know and forward it. |
| S4.A row 5 (Invoice date \| Due date) becomes `<Columns kind="input">`; the other S4.A rows wait for the S4 restructure | Only the date row carries a value long enough to clip; the fix is one row, and the restructure will convert the rest. | Convert all five S4.A rows now: churn before the planned rewrite. |
| S4.L2 / S4.L3 `ScrollView`s keep their default `flexGrow` | The form growing into leftover space is harmless there (the preview and products panels keep their widths); pinning it would narrow the form and change what the owner sees for no gain. Noted in the S4 tree file. | Pin them for spec purity. |
| S5.2 table only when the list pane is ≥ 480 dp (`showTable`); at lg (10-inch portrait) the phone rows are used beside the editor | After pinning the editor to 38 %, the list pane at lg is ≈ 410 dp; the fixed columns (328 dp) leave ≈ 40 dp for NAME. The 6-column table needs ≈ 480 dp; the phone rows carry the same data (name, size, stock, sold, price, avl) and read well at 410 dp. The width is computed from the window (62 % minus the rail) rather than measured, so the first frame is already right. | Dropping SOLD at lg: still only ≈ 100 dp for NAME. Editor as a sheet at lg: loses the side-by-side editing the reference specifies for lg+. |

## Prompt 32 — md is one pane (2026-10-23)

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| `useBreakpoint` md `panes: 1`; screens switch on `bp.panes === 1` for "one pane" and keep `bp.isPhone` for "bottom nav + FAB" | An 8-inch tablet in portrait is 601 dp, one dp over Material's compact line; two panes left ≈ 235–300 dp per pane and every list, header and table was truncated. One pane with the rail keeps the tablet affordance (rail, "+") and gives screens the full 513 dp. Two different questions ("how many panes" vs "which nav") get two flags. | Keeping two panes with a list floor: the detail pane would be ≈ 170 dp. Treating md as `isPhone`: loses the rail and brings the floating nav to a tablet. |
| The tablet shell renders the `invoice-detail` overlay beside the rail when `panes === 1` | S2 at one pane opens S3 as an overlay (`showInvoice(id, true)`); the phone shell already did this full-screen, the tablet shell only knew `create-invoice`. | Routing md through the phone shell: loses the rail. |
| S5 `showTable` threshold 480 → 520 and `paddingEnd` on NAME | At md the list pane is 513 dp: a 6-column table there truncates NAME and SIZE touches it (finding 5). 520 sends md to the phone rows while xl (541) and xxl keep the table; the padding keeps NAME off SIZE at xl. | Hiding SOLD at md: still a crowded table at 513 dp. |
| Tour script: the sheet's ✕ is the **last** "Close" node (`nth=-1`); the scrim is the first | The tour missed Settings on md and lg because tapping the first "Close" hit the sheet body. | — |
