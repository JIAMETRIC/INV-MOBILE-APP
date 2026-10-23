---
name: screen-map
description: Draw or refresh the function map of a screen: a wireframe (phone / one pane beside tablet panes) in which every block carries the function that draws it, its layout ID, and its cells, so the owner can point at "DateRangeRow, first column". Use when the user asks which function draws what, for a map or picture of a screen's layout, "show me the screen items and their functions", or after a screen is restructured with the Three-Slot method.
---

# Screen map

One page, `SCREEN_CODE_STRUCTURE/screen-map.html`, with a tab per screen. Each tab shows the phone / one-pane layout on the left and the tablet panes on the right, built from blocks. A block = a **function name** (or a kit component), its **layout ID** from `SCREEN_LAYOUT_REFERENCE.md`, a one-line "what", and, for a row, its **cells**. Blue blocks hold other blocks (a pane, a scroller, a card); dashed blocks are optional or belong to another file (a host, a sheet).

The page is generated, never hand-edited: `scripts/screen-map.py` holds the data (one entry per screen) and the renderer.

## 1. Where the data comes from
- The screen's tree file (`SCREEN_CODE_STRUCTURE/<Screen>_<ID>_tree.md`): section 1 (the three slots) gives the top-level blocks; section 3 (the tree) gives the nesting, the IDs and the cells; section 5 says which rows are `Columns` and with which `kind`.
- The screen file itself, for anything the tree file does not say. Every function name in the map must exist in the file; every ID must exist in the layout reference.
- Do not invent regions. If a region has no function of its own (a kit component placed inline, such as `SegmentedControl`), name the component and say `options = STATUSES` in the "what".

## 2. Write the entry
In `scripts/screen-map.py`, `SCREENS` has one dict per screen:

```python
dict(key="S2", title="Invoices", file="src/features/invoices/InvoicesScreen.tsx",
  note="one sentence: the one-pane rule and anything that moves between sizes",
  phone=[ n("Header", "S2.0", "TopAppBar large: …"),
          n("ListPane", "", "Main: …", kids=[
            n("DateRangeRow", "S2.3a", 'Columns kind="input"', cells=["From", "To"]),
            n("InvoiceListCard", "S2.5", "…", kids=[ n("InvoiceRow × n", "S2.5.r", "React.memo", cells=["avatar", "party", "₹ / pill"]) ]),
          ]),
          n("fab slot", "S2.6", "FAB …") ],
  tablet=[ n("Header", "S2.0", "same"),
           n("panes", "", "View row", columns=True, kids=[ n("ListPane", …), n("DetailPane", "S2.7", "50 % / 42 %"), n("ActivityPane", "S2.8", "xxl only", dashed=True) ]) ])
```
- `phone` is the on-screen order of the one-pane layout (xs, sm, md): Header, then Main's rows top to bottom, then the footer or fab slot, then sheets (dashed).
- `tablet` is the lg+ layout: Header, then a `panes` node with `columns=True` whose kids are the panes left to right.
- A hosted screen (S3) starts with a dashed "host" block naming where its header comes from.
- "what" is one line: the kit piece, the rule (`Columns kind="input"`, `never stacks`), the hook (`useMainInset()`), or the action (`→ nav.openCreate()`). No sentences about behaviour that the code does not show.
- Cells are the row's columns, left to right, with the flex or width when it matters (`SearchField · flex 1`, `IconButton · 44`).

## 3. Build and check
```
python -I scripts/screen-map.py
```
Open `SCREEN_CODE_STRUCTURE/screen-map.html` in a browser (every tab), then republish the artifact with the same file path so the owner's link stays current. Check: every block in the map is a function or component in the file; the order matches the screen; the cells match the row.

## 4. Record
Append the prompt to `SCREEN_CODE_STRUCTURE/SCREEN_CODE_STRUCTURE_session-prompts.md`; note the regeneration in `_walkthrough.md` (which screens changed and why). A restructure (`/three-slot-screen`) ends with this skill, so the map and the tree file change together.

Portable version for another app: the user-level skill `responsive-screens` carries `templates/scripts/screen-map.py` with an example entry; copy it, replace `SCREENS`, run it.
