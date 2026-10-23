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
