# SCREEN_LAYOUT_REFERENCE — Tracking

## Rationale

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| One reference file, [`SCREEN_LAYOUT_REFERENCE.md`](SCREEN_LAYOUT_REFERENCE.md), in its own topic folder | It is a navigation aid for prompting, not a design spec, so it stays apart from `MOBILE_APP_CONVERSION/` (rationale, schema, build history). | Appending it to `MOBILE_APP_CONVERSION_TRACKING.md`: rejected, that file is already long and is a history document. |
| Stable IDs (`S<screen>.<section>.<row>`, `P` overlays, `C` components, `D` documents) | Lets a prompt name a region exactly ("in S4.B.3 …") without quoting code; the IDs survive line drift. | File:line only: breaks on the next edit. Component names only: many regions are inline JSX constants with no component name. |
| ASCII wireframes per breakpoint | Layout branches by breakpoint (phone stepper vs 2-pane vs 3-panel), so a single picture would mislead. | Screenshots: go stale and can't be diffed or searched. |
| Line numbers marked "as of session 13" | Useful for jumping straight to code, but they drift. | Leaving them out: slower to locate the code. |

## Specs captured (2026-10-22)

- 7 screens (S0–S6), 3 overlays (P1–P3), 2 document layouts (D1 PDF, D2 Excel), 14 shared components (C1–C14), tokens table.
- Breakpoints: xs < 360 · sm 360 · md 600 · lg 768 · xl 960 · xxl 1200 (`src/ui/useBreakpoint.ts`).
- Width budgets: S2 detail pane 50% (2 panes) / 42% + activity 26% (3 panes); S4.L3 25% / 38% / 37%; S4.L2 preview 40%; S5 editor 38%; S6 section list 300dp; Rail 88dp; BottomTabs 80dp.
- S5 table columns: NAME flex 3 · SIZE 52 · PRICE 84 · STOCK 60 · SOLD 56 · AVL 76 (dp).
- S3 items table: flex 3 : 1 : 1 : 1.

## Observations found while mapping — fixed in Prompt 2

| Gap | Fix | Why this way | Alternative rejected |
| --- | --- | --- | --- |
| S4.L3 catalog panel empty until the user typed a search | `useEffect` keyed on `showsCatalogPanel = bp.atLeast('xl')` calls `listProducts(catalogSearch)` | Loads only when the panel is actually on screen. Phones and md/lg keep loading lazily in `openCatalog()`, and rotating into xl reloads. | Loading on every mount: a wasted query on phones, where P2 loads anyway. |
| S4.B.6 had no City / Pincode inputs although D1.2, the schema and `saveInvoice` all carry them | added a City \| Pincode row (1:1, pincode numeric, max 6), the same pattern as S4.A row 3 | No data-layer change was needed: `ship_city` / `ship_pincode` were already persisted and loaded in edit mode. | — |
| S1.3.1 aging rows not tappable | `AgingRow` gained `invoice_id` (the query already selected `id`); the row calls `nav.showInvoice(a.invoice_id, bp.isPhone)`, and the React key changed to `invoice_id` | Same behaviour as S1.2.1; the id avoids a lookup by invoice number. | Looking up the id from `invoice_no`: an extra query and fragile. |

## Maintenance

When a screen's layout changes, update its section in `SCREEN_LAYOUT_REFERENCE.md`. Keep existing IDs; add new ones at the end of the section instead of renumbering.
