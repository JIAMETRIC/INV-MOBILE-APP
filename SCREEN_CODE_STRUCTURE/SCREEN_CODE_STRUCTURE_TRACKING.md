# SCREEN_CODE_STRUCTURE — Tracking

Restructuring screen files so a non-expert can read a screen top-down and change one part (a row, a column, a gap, a colour, a label) without touching the rest. Starts with S2 Invoices (`src/features/invoices/InvoicesScreen.tsx`).

## Rationale

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| Own topic folder, separate from `SCREEN_LAYOUT_REFERENCE/` | That topic documents screens for prompting; this one changes how the screen code is organised. The reference file gets updated when the code moves, but the decisions live here. | Logging under SCREEN_LAYOUT_REFERENCE: rejected, it would mix a documentation topic with code restructuring. |
| Framework conventions: React Native + TypeScript function components (PascalCase), `View` rows and columns, a hook for state | What the rest of `src/features/` already does (`StatTile`, `AvlBadge`, `Stepper`, `CatalogSheet` are local components in their screen files). | Class components or StyleSheet objects: not used anywhere in the project. |

## Prompt 1 — Plan for InvoicesScreen (2026-10-23) — proposed, awaiting the owner's OK

See the plan in `SCREEN_CODE_STRUCTURE_walkthrough.md`. Specs will be recorded here once approved and applied.

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
