"""Build SCREEN_CODE_STRUCTURE/screen-map.html: one function map per screen.

Each map is a wireframe of the screen (phone / one pane on the left, tablet
panes on the right) in which every block carries the FUNCTION that draws it,
its layout ID from SCREEN_LAYOUT_REFERENCE.md, a one-line "what", and, for a
row, its cells. The owner can then point at "DateRangeRow, first column".

Usage:  python -I scripts/screen-map.py            (writes the page)
Edit:   the SCREENS data below (one entry per screen; nodes nest).
        A node is a dict: fn · id · what · cells (list of cell labels) · kids (list of nodes)
        · columns (true when the kids sit side by side) · dashed (an optional part).
        A screen may carry `small`: one line on what a 5-inch phone (360 x 640 dp) shows, from a size check.
Source of truth for the data: the tree file of each screen
(SCREEN_CODE_STRUCTURE/<Screen>_<ID>_tree.md, sections 1 and 3).
"""
import html, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "SCREEN_CODE_STRUCTURE", "screen-map.html")
APP = "Invoice ERP"
DATE = "2026-10-26"

def n(fn, id="", what="", cells=None, kids=None, columns=False, dashed=False):
    return dict(fn=fn, id=id, what=what, cells=cells or [], kids=kids or [], columns=columns, dashed=dashed)

# ---------------------------------------------------------------------------
# The data: one entry per screen. "phone" = one pane (xs, sm, md), "tablet" = lg+ panes.
# ---------------------------------------------------------------------------
SCREENS = [
  dict(key="S1", title="Dashboard", file="src/features/dashboard/DashboardScreen.tsx",
    note="One layout at every width; only the FAB (phones) and the bottom padding change.",
    small="5-inch phone, 360 × 640 dp (checked 2026-10-23): Header, hero, three tiles (labels on two lines), FAB above the nav; about 200 dp of empty space below the tiles.",
    phone=[
      n("Header", "S1.0", "TopAppBar large: fyLabel() caption · Dashboard"),
      n("DashboardMain", "", "Main: one ScrollView; bottom = useMainInset()", kids=[
        n("HeroCard", "S1.1", "Card: overline Total billed · FY | Badge N invoices; ₹ figure",
          cells=["overline", "Badge"]),
        n("StatTilesRow", "S1.2", "three equal cells, never stacks", cells=["StatTile a", "StatTile b", "StatTile c"]),
        n("StockPieCard", "S1.6", "Card: overline Stock split; row: PieChart3D (128, 96 under 360 dp) | legend", cells=["PieChart3D: Sold blue · Balance grey", "legend: Sold · Balance · divider · Actual · Oversold by N (red, when Balance < 0)"]),
      ]),
      n("fab slot", "S1.5", "FAB New invoice → nav.openCreate() (phones)"),
    ],
    tablet=[
      n("Header", "S1.0", "same"),
      n("DashboardMain", "", "same blocks, capped at 90 % of the window; no FAB", kids=[
        n("HeroCard", "S1.1"), n("StatTilesRow", "S1.2", cells=["a", "b", "c"]), n("StockPieCard", "S1.6"),
      ]),
    ]),

  dict(key="S2", title="Invoices", file="src/features/invoices/InvoicesScreen.tsx",
    note="One pane when bp.panes === 1. Under 600 dp of height the filter row (FilterRow) moves inside InvoiceListCard as the list header (same order on screen). The Draft tab is removed: the list shows issued invoices only, so there is no status SegmentedControl.",
    phone=[
      n("Header", "S2.0", "TopAppBar large: N invoices · Invoices · one action: download = Export all invoices to Excel (every invoice, all details, ignores the filters)"),
      n("ListPane", "", "Main: the column below, sides 20, gap 16", kids=[
        n("FilterRow", "S2.1", "plain row (not Columns); the calendar button and date range were removed", cells=["SearchField · full width"]),
        n("InvoiceListCard", "S2.5", "Card with the one FlatList; marginBottom useNavInset(); long lists pad useFabClearance()", kids=[
          n("InvoiceRow × n", "S2.5.r", "React.memo; onPress from useCallback", cells=["avatar", "party · no · date", "₹ total / StatusGlyph"]),
        ]),
      ]),
      n("fab slot", "S2.6", "FAB New invoice (phones)"),
    ],
    tablet=[
      n("Header", "S2.0", "same"),
      n("panes", "", "View row", columns=True, kids=[
        n("ListPane", "", "flex 1 · the same rows", kids=[n("FilterRow"), n("InvoiceListCard", "", "selected row tinted")]),
        n("DetailPane", "S2.7", "S2.detailWidth: 50 % (2 panes) · 42 % (3 panes)", kids=[n("InvoiceDetail", "S3", "hosted; its own file")]),
        n("ActivityPane", "S2.8", "26 %, xxl only, with a row selected", dashed=True),
      ]),
    ]),

  dict(key="S3", title="Invoice detail · Issued", file="src/features/invoices/InvoiceDetail.tsx",
    note="An embeddable Main: no Screen wrapper, no header or footer of its own. One pane: the shell's Invoice back bar hosts it (App.tsx); lg+: S2's DetailPane. The only action buttons are Share (inside BillToCard) and Edit / Delete (EditDeleteRow). The old ActionRow is removed; no button opens the payment sheet now.",
    phone=[
      n("host: TopAppBar Invoice", "S0", "back = nav.closeOverlay (App.tsx, not this file)", dashed=True),
      n("DetailMain", "", "Main: one ScrollView, maxWidth 720, bottom S3.bottomPad", kids=[
        n("HeaderRow", "S3.1", "row, space-between", cells=["invoice_no / date · due", "StatusGlyph (Issued)"]),
        n("BillToCard", "S3.2", "Bill to · party · address · Ph contact; last child = Share Button (solid blue, share-2 icon, alignSelf start) → s.share(): saves <invoice no>.png, then asks WhatsApp / Save to phone", cells=["overline Bill to", "party name", "address", "contact", "Button Share"]),
        n("ItemsCard", "S3.4", "Items (n)", kids=[
          n("ItemsHeader", "S3.4.h", "flex from S3.itemColumns", cells=["ITEM 2.6", "QTY 0.8", "RATE 1.3", "AMOUNT 1.3"]),
          n("LineRow × n", "S3.4.r", "React.memo; the same S3.itemColumns", cells=["description", "qty", "rate", "amount"]),
        ]),
        n("TotalsCard", "S3.5", "TotalRow × Gross · Discount (if > 0) · Round off · Total · Paid (if > 0) · Balance due; words; notes"),
        n("EditDeleteRow", "S3.6", "row, gap 12", cells=["Edit (blue)", "Delete (red)"]),
      ]),
      n("PaymentSheet", "P1", "Sheet: outstanding line · Input Amount · SegmentedControl PAY_MODES · Cancel | Save payment. Not reachable now (Record payment button removed; s.askPayment has no caller)", dashed=True),
      n("InvoiceImage", "", "off screen (left -IMAGE_WIDTH * 2), captured by the Share button; top row: business | Payment (Cash or UPI) | invoice no · date; no business address", dashed=True),
    ],
    tablet=[
      n("host: S2 DetailPane", "S2.7", "InvoiceDetail inside the pane, under S2's header", dashed=True),
      n("DetailMain", "", "the same blocks", kids=[n("HeaderRow", "S3.1"), n("BillToCard", "S3.2", "incl. Share button"), n("ItemsCard", "S3.4"), n("TotalsCard", "S3.5"), n("EditDeleteRow", "S3.6")]),
      n("PaymentSheet", "P1", "centred dialog on tablets (Sheet, C10)", dashed=True),
    ]),

  dict(key="S4", title="Create / Edit invoice", file="src/features/invoices/CreateInvoiceScreen.tsx",
    note="An overlay (no nav under it). No drafts: leaving closes the screen and unsaved input is lost. Phones: Header · below = Stepper · one step at a time · footer = TotalBar. md / lg: form pane (+ preview at lg). xl: three panes.",
    phone=[
      n("Header", "S4.L1", "TopAppBar: f.title · f.previewNo · back = f.leave"),
      n("below: Stepper", "S4.L1.1", "STEPS × 3, tap = f.setStep", cells=["Bill to", "Items", "Review"]),
      n("StepBody", "S4.L1.2", "Main: one ScrollView, pad = useScrollPad()", kids=[
        n("step 0 · BillToCard", "S4.A", "Card (sheet fill)", kids=[
          n("SectionTitle Bill to"), n("Input Customer name *"), n("Input Mobile"),
          n("DatesRow", "S4.A", "one Input, Invoice date (YYYY-MM-DD); pulls the card bottom up", cells=["Invoice date"]),
        ]),
        n("step 1 · ItemsSection", "S4.B", "gap 16", kids=[
          n("SectionTitle Items (n) + Add from products", "S4.B.1", "button hidden at xl; → f.openCatalog (P2)"),
          n("EmptyItemsCard", "S4.B.2", "when no lines", dashed=True),
          n("LineItemCard × n", "S4.B.3", "Card per line", kids=[
            n("row", "", "", cells=["overline Item n · From products / Free line", "IconButton trash (red)"]),
            n("Input Description"),
            n("row", "", "Columns kind=\"input\" weights S4.lineWeights [1, 1.2, 1.25]; stacks under 96 dp per cell (360 dp phones)", cells=["Size (Dropdown)", "Qty: StepperInput − n +", "Rate (₹)"]),
            n("row", "", "space-between", cells=["Amount", "MoneyText"]),
          ]),
          n("Button Add free line", "S4.B.4", "alignSelf start"),
          n("PaymentCard", "S4.B.5", "Card: SectionTitle Payment · SegmentedControl Cash | UPI (saved with the invoice; does not record money received)"),
        ]),
        n("step 2 · ReviewSection", "S4.D", "Bill to summary card · Items card (Edit / Delete icon buttons, rows: description | qty × rate | amount) · TotalsCard (S4.C) · amount in words"),
      ]),
      n("footer: TotalBar", "S4.L1.3", "glass bar", cells=["Total ₹", "Next (steps 1–2) · or ActionButtons = Issue invoice / Update (step 3)"]),
      n("CatalogSheet", "P2", "bottom sheet: SearchField · ListItem × 60 → f.addLine", dashed=True),
    ],
    tablet=[
      n("Header", "S4.L1", "md: eye / pencil toggles preview"),
      n("panes", "", "md / lg: [ FormPane 720 | PreviewPane 40 % (lg) ] · xl: [ 25 | 38 | 37 ]", columns=True, kids=[
        n("CatalogPanel", "S4.L3", "xl only, 25 %: Products · SearchField · list → f.addLine", dashed=True),
        n("FormPane", "S4.L2", "ScrollView: BillToCard · ItemsSection (with PaymentCard) · TotalsCard · ActionButtons (S4.F)", kids=[
          n("BillToCard", "S4.A"), n("ItemsSection", "S4.B", "ends with PaymentCard S4.B.5"), n("TotalsCard", "S4.C", "Subtotal · Discount (if > 0) · Round off · Total"),
          n("ActionButtons", "S4.F", "flex-end; the Save draft button and draft autosave are removed", cells=["Issue invoice / Update"]),
        ]),
        n("PreviewPane", "S4.E", "overline Preview | A4 / Letter; page frame", kids=[n("WebView page")]),
      ]),
      n("CatalogSheet", "P2", "md / lg: centred dialog; xl: none (the panel)", dashed=True),
    ]),

  dict(key="S5", title="Products", file="src/features/products/ProductsScreen.tsx",
    note="One pane: list only, the editor is the P3 sheet. lg+: list | editor pane 38 %. The table shows when the list pane is at least 520 dp wide, else card rows.",
    small="5-inch phone, 360 × 640 dp (checked 2026-10-23): Search, then four list rows visible; the FAB floats over the fifth. P3 opens as a bottom sheet at 92 % height: name, quick-pick chips wrapping in 2 to 3 per line.",
    phone=[
      n("Header", "S5.0", "TopAppBar large: N items · Products · New product (md+) · download"),
      n("ListPane", "S5.1–S5.3", "Main: column, sides 20, gap 16", kids=[
        n("SearchRow", "S5.1", "SearchField Search products"),
        n("ProductListCard", "S5.2 / S5.3", "hugging Card with the one FlatList; marginBottom useNavInset(); long lists pad useFabClearance()", kids=[
          n("TableHeader", "S5.2", "only when showTable", cells=["NAME", "SIZE", "PRICE", "STOCK", "SOLD", "AVL"], dashed=True),
          n("ProductTableRow × n", "S5.2.r", "memo; when showTable", dashed=True),
          n("ProductListRow × n", "S5.3", "memo; otherwise", cells=["avatar", "name · size", "₹ price · Avl"]),
        ]),
      ]),
      n("fab slot", "S5.4", "FAB Add product → p.startEdit() (phones)"),
      n("EditorSheet", "P3", "Sheet wide → EditorBody", kids=[
        n("ProductForm", "S5.6", "", kids=[
          n("Input Product name", "S5.6.1"), n("QuickPickChips", "S5.6.2", "wraps"), n("SizeChips", "S5.6.3", "wraps"),
          n("PriceStockRow", "S5.6.4", "Columns kind=\"input\"", cells=["Price (₹)", "Stock"]),
          n("EditorActions", "S5.6.5", "row, wraps, right", cells=["Delete", "Restock", "Save"]),
          n("StockHistory", "S5.6.6"),
        ]),
        n("RestockForm", "S5.7", "mode = restock", kids=[
          n("info line", "S5.7.1"), n("row", "S5.7.2", "Columns kind=\"input\"", cells=["Qty to add", "New price (₹)"]),
          n("Input Note", "S5.7.3"), n("buttons", "S5.7.4", cells=["Back", "Add to stock"]),
        ], dashed=True),
      ], dashed=True),
    ],
    tablet=[
      n("Header", "S5.0", "same"),
      n("panes", "", "View row", columns=True, kids=[
        n("ListPane", "", "flex 1", kids=[n("SearchRow", "S5.1"), n("ProductListCard", "S5.2", "table (≥ 520 dp) or rows")]),
        n("EditorPane", "S5.5", "ScrollView width S5.editorWidth 38 %, flexGrow 0, flexShrink 0", kids=[
          n("Card", "", "SectionTitle editorTitle", kids=[n("EditorBody", "", "ProductForm / RestockForm, or EmptyState")]),
        ]),
      ]),
    ]),

  dict(key="S6", title="Settings", file="src/features/settings/SettingsScreen.tsx",
    note="One pane: the section list, or the open section under a back header. lg+: list 300 | section capped at 720. No footer: Save is the last row of CompanyForm.",
    phone=[
      n("Header", "S6.0", "TopAppBar large: Settings · Company, backup; section open → its label + back"),
      n("SectionScroll", "", "Main: one ScrollView; bottom = useNavInset()", kids=[
        n("SectionList", "S6.1", "Card list: ListItem × 3 + VERSION_LABEL", cells=["Company", "Backup & restore", "Activity log"]),
        n("SectionBody (switch)", "", "one of:", kids=[
          n("CompanyForm", "S6.2", "", kids=[
            n("BusinessCard", "S6.2.1", "FieldRow × 2 = Columns kind=\"input\"", cells=["City | Pincode", "PAN | Contact"]),
            n("BankCard", "S6.2.2", "FieldRow × 2", cells=["Bank | Branch", "A/C no | IFSC"]),
            n("NumberingCard", "S6.2.3", "FieldRow", cells=["Prefix", "Next number"]),
            n("Button Save", "S6.2.4", "→ saveCompany()"),
          ]),
          n("BackupPane", "S6.4", "", kids=[
            n("ExportRestoreRow", "", "plain row, flex 1 each", cells=["Export", "Restore"]),
            n("RecentBackups", "", "when any", dashed=True),
          ], dashed=True),
          n("ActivityPane", "S6.5", "Card list: ListItem × n", dashed=True),
        ]),
      ]),
    ],
    tablet=[
      n("Header", "S6.0", "large, no back"),
      n("panes", "", "View row, gap 16", columns=True, kids=[
        n("SectionListPane", "", "width S6.listWidth 300", kids=[n("SectionList", "S6.1", "selected row tinted"), n("VERSION_LABEL")]),
        n("SectionScroll", "", "maxWidth S6.paneMaxWidth 720", kids=[n("SectionBody(section)", "S6.2, S6.4, S6.5")]),
      ]),
    ]),
]

# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
CSS = """
  :root { --primary:#2596be; --secondary:#666666; --tertiary:#ebeaea; --dark:#000000; --light:#ffffff; --link:#1a6f8e;
    --bg:var(--tertiary); --text:var(--dark); --text-muted:var(--secondary);
    --glass:rgba(255,255,255,0.55); --glass-strong:rgba(255,255,255,0.60); --glass-nav:rgba(255,255,255,0.65);
    --glass-border:rgba(255,255,255,0.85); --glass-border-strong:rgba(255,255,255,0.90);
    --divider:var(--tertiary); --input-border:rgba(102,102,102,0.35); --primary-tint:rgba(37,150,190,0.14);
    --focus-ring:0 0 0 3px rgba(37,150,190,0.35);
    --shadow-primary:0 4px 8px rgba(20,71,108,0.15); --shadow-secondary:0 8px 16px rgba(20,71,108,0.20);
    --card-shadow:var(--shadow-secondary); --tile-shadow:var(--shadow-primary);
    --font:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; --font-numeric:"Bebas Neue","Inter",sans-serif;
    --mono:ui-monospace,"Cascadia Mono","SF Mono",Menlo,Consolas,monospace;
    --r-chip:10px; --r-control:12px; --r-card:16px; --r-pill:999px; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg:var(--dark); --text:var(--light); --text-muted:var(--tertiary);
    --glass:rgba(255,255,255,0.08); --glass-strong:rgba(255,255,255,0.08); --glass-nav:rgba(0,0,0,0.88);
    --glass-border:rgba(255,255,255,0.16); --glass-border-strong:rgba(255,255,255,0.16);
    --divider:rgba(255,255,255,0.18); --input-border:rgba(255,255,255,0.2); --primary-tint:rgba(37,150,190,0.24); --link:var(--light);
    --card-shadow:var(--shadow-secondary), inset 0 1px 0 rgba(255,255,255,0.2); --tile-shadow:var(--shadow-primary), inset 0 1px 0 rgba(255,255,255,0.2);
    color-scheme:dark; } }
  :root[data-theme="dark"] {
    --bg:var(--dark); --text:var(--light); --text-muted:var(--tertiary);
    --glass:rgba(255,255,255,0.08); --glass-strong:rgba(255,255,255,0.08); --glass-nav:rgba(0,0,0,0.88);
    --glass-border:rgba(255,255,255,0.16); --glass-border-strong:rgba(255,255,255,0.16);
    --divider:rgba(255,255,255,0.18); --input-border:rgba(255,255,255,0.2); --primary-tint:rgba(37,150,190,0.24); --link:var(--light);
    --card-shadow:var(--shadow-secondary), inset 0 1px 0 rgba(255,255,255,0.2); --tile-shadow:var(--shadow-primary), inset 0 1px 0 rgba(255,255,255,0.2);
    color-scheme:dark; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:400 15px/1.4 var(--font); -webkit-font-smoothing:antialiased; }
  a { color:var(--link); text-decoration:none; } :focus-visible { outline:none; box-shadow:var(--focus-ring); }
  .page { max-width:960px; margin:0 auto; padding:56px max(20px,env(safe-area-inset-left,0px)) 32px max(20px,env(safe-area-inset-right,0px)); display:flex; flex-direction:column; gap:16px; }
  .top { display:flex; align-items:center; gap:12px; } .top .titles { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
  .caption { font:400 14px/20px var(--font); color:var(--text-muted); } h1 { font:600 28px/34px var(--font); letter-spacing:-0.02em; margin:0; }
  h2 { font:600 20px/26px var(--font); letter-spacing:-0.02em; margin:0; } p { margin:0; }
  .overline { font:600 12px/16px var(--font); letter-spacing:0.06em; text-transform:uppercase; color:var(--text-muted); }
  code { font:400 0.93em var(--mono); background:var(--primary-tint); padding:1px 6px; border-radius:6px; }
  .icon-btn { width:44px; height:44px; flex:none; display:inline-flex; align-items:center; justify-content:center; border-radius:var(--r-control); background:var(--glass-strong); border:1px solid var(--glass-border-strong); box-shadow:var(--shadow-primary); color:var(--text); cursor:pointer; padding:0; }
  svg.i { width:20px; height:20px; stroke:currentColor; fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .card { background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--r-card); box-shadow:var(--card-shadow); padding:16px; display:flex; flex-direction:column; gap:12px; min-width:0; }
  .badge { display:inline-flex; align-items:center; padding:3px 8px; border-radius:var(--r-pill); background:var(--primary-tint); color:var(--text); font:600 11px/14px var(--font); white-space:nowrap; }
  .seg { display:flex; padding:4px; gap:2px; background:var(--glass); border:1px solid var(--glass-border); border-radius:var(--r-pill); box-shadow:var(--shadow-primary); position:sticky; top:env(safe-area-inset-top,0px); z-index:5; }
  .seg button { flex:1; height:36px; border:0; border-radius:var(--r-pill); background:transparent; color:var(--text-muted); font:500 13px var(--font); cursor:pointer; }
  .seg button[aria-selected="true"] { background:var(--primary); color:var(--light); font-weight:600; box-shadow:var(--shadow-primary); }
  body::before { content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:10; background:var(--bg); }
  section[hidden] { display:none; } section { display:flex; flex-direction:column; gap:16px; }
  .two { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; align-items:start; }
  @media (max-width:720px) { .two { grid-template-columns:1fr; } }
  .dev { background:var(--glass-nav); border:1px solid var(--glass-border-strong); border-radius:var(--r-card); padding:10px; box-shadow:var(--shadow-primary); display:flex; flex-direction:column; gap:8px; }
  .dev .lbl { font:600 12px/16px var(--font); letter-spacing:0.06em; text-transform:uppercase; color:var(--text-muted); padding:2px 4px; }
  .blk { border:1px solid var(--input-border); border-radius:var(--r-control); padding:6px 8px; background:var(--glass-strong); display:flex; flex-direction:column; gap:4px; min-width:0; }
  .blk.dashed { border-style:dashed; background:transparent; }
  .blk.grp { background:var(--primary-tint); border-color:transparent; }
  .blk .hd { display:flex; align-items:center; gap:8px; }
  .blk .fn { font:500 12px/16px var(--mono); color:var(--link); flex:1; min-width:0; overflow-wrap:anywhere; }
  .blk .what { font:400 11px/15px var(--font); color:var(--text-muted); }
  .cells { display:flex; gap:4px; flex-wrap:wrap; }
  .cells span { flex:1 1 auto; min-width:0; border:1px dashed var(--input-border); border-radius:8px; padding:3px 6px; font:400 11px/15px var(--font); color:var(--text-muted); background:var(--glass); text-align:center; }
  .kids { display:flex; flex-direction:column; gap:6px; } .kids.cols { flex-direction:row; align-items:flex-start; } .kids.cols > .blk { flex:1; }
  @media (max-width:520px) { .kids.cols { flex-direction:column; } }
  .devbar { margin-top:8px; display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:var(--r-card); background:var(--glass); border:1px solid var(--glass-border); box-shadow:var(--shadow-primary); }
  .devbar .t { flex:1; min-width:0; font:500 14px/20px var(--font); }
"""

def esc(s): return html.escape(s, quote=False)

def render(node, depth=0):
    cls = "blk" + (" grp" if node["kids"] else "") + (" dashed" if node["dashed"] else "")
    out = [f'<div class="{cls}">', '<div class="hd">', f'<span class="fn">{esc(node["fn"])}</span>']
    if node["id"]: out.append(f'<span class="badge">{esc(node["id"])}</span>')
    out.append('</div>')
    if node["what"]: out.append(f'<span class="what">{esc(node["what"])}</span>')
    if node["cells"]: out.append('<div class="cells">' + "".join(f'<span>{esc(c)}</span>' for c in node["cells"]) + '</div>')
    if node["kids"]:
        out.append('<div class="kids' + (" cols" if node["columns"] else "") + '">' + "".join(render(k, depth + 1) for k in node["kids"]) + '</div>')
    out.append('</div>')
    return "".join(out)

def device(label, nodes, foot=""):
    tail = f'<span class="what" style="padding:2px 4px">{esc(foot)}</span>' if foot else ""
    return f'<div class="dev"><span class="lbl">{esc(label)}</span>' + "".join(render(x) for x in nodes) + tail + '</div>'

def page():
    tabs = "".join(f'<button role="tab" aria-selected="{"true" if i == 0 else "false"}" data-tab="{s["key"]}">{s["key"]}</button>' for i, s in enumerate(SCREENS))
    secs = []
    for i, s in enumerate(SCREENS):
        secs.append(f'''<section id="{s["key"]}" role="tabpanel"{"" if i == 0 else " hidden"}>
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2>{s["key"]} · {esc(s["title"])}</h2><span class="badge">{esc(os.path.basename(s["file"]))}</span></div>
    <p class="caption">{esc(s["note"])}</p>
    <p class="caption">Point at a piece as <code>Function</code> + cell: "DateRangeRow, first column". Blue blocks hold other blocks; dashed blocks are optional or belong to another file.</p>
  </div>
  <div class="two">{device("Phone · one pane (xs, sm, md)", s["phone"], s.get("small", ""))}{device("Tablet · panes (lg+)", s["tablet"])}</div>
</section>''')
    return f'''<title>Screen Map</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Bebas+Neue&display=swap">
<style>{CSS}</style>
<div class="page">
  <header class="top">
    <div class="titles"><span class="caption">{esc(APP)} · which function draws what</span><h1>Screen Map</h1></div>
    <button class="icon-btn" id="themeBtn" type="button" aria-label="Toggle light and dark"><svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></button>
  </header>
  <p class="caption">Every block is a function in the screen's file (or a kit component), with its layout ID from <code>SCREEN_LAYOUT_REFERENCE.md</code>. Left: the phone / one-pane layout. Right: the tablet panes. Generated by <code>scripts/screen-map.py</code> from the tree files.</p>
  <nav class="seg" role="tablist" aria-label="Screens">{tabs}</nav>
  {"".join(secs)}
  <div class="devbar"><svg class="i" viewBox="0 0 24 24" style="color:var(--primary)"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg><span class="t">Flat Glass · Brand Blue · one map per screen</span><span class="badge">{DATE}</span></div>
</div>
<script>
(function () {{
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.seg [role="tab"]'));
  var keys = tabs.map(function (t) {{ return t.dataset.tab; }});
  function show(k) {{ if (keys.indexOf(k) < 0) k = keys[0];
    tabs.forEach(function (t) {{ t.setAttribute('aria-selected', String(t.dataset.tab === k)); }});
    keys.forEach(function (x) {{ document.getElementById(x).hidden = x !== k; }});
    try {{ localStorage.setItem('map-tab', k); }} catch (e) {{}} }}
  tabs.forEach(function (t) {{ t.addEventListener('click', function () {{ show(t.dataset.tab); }}); }});
  var start = (location.hash || '').replace('#', '');
  if (keys.indexOf(start) < 0) {{ try {{ start = localStorage.getItem('map-tab') || keys[0]; }} catch (e) {{ start = keys[0]; }} }}
  show(start);
  var btn = document.getElementById('themeBtn'), root = document.documentElement;
  function cur() {{ var t = root.getAttribute('data-theme'); if (t) return t; return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }}
  btn.addEventListener('click', function () {{ var nx = cur() === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', nx); try {{ localStorage.setItem('tss-theme', nx); }} catch (e) {{}} }});
  try {{ var saved = localStorage.getItem('tss-theme'); if (saved) root.setAttribute('data-theme', saved); }} catch (e) {{}}
}})();
</script>
'''

if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page())
    print("wrote", os.path.relpath(OUT, ROOT), "with", len(SCREENS), "screens")
