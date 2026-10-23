# What's inside InvoiceDetail (S3) and the Record-payment sheet (P1)

File: `src/features/invoices/InvoiceDetail.tsx` (208 lines). Line numbers as of 2026-10-23.
Reached by tapping an invoice row on S2 (phone: `nav.showInvoice(id, true)` → full-screen overlay; tablet: `nav.selectInvoice(id)` → the right pane of S2, S2.7).
IDs (S3.x, P1) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

The screen has **one layout** at every width; only its wrapper differs (see the end of this file).

```
InvoiceDetail({ invoiceId })                                         line 18
│
├─ S3.0  Loading        centred spinner until the invoice loads        42-48
│
├─ ScrollView           padding 20 sides, 4 top, 32 bottom; gap 16;    111
│   │                   maxWidth 720
│   │
│   ├─ S3.1  Header row  (row, space-between)                          115
│   │    ├─ left column: invoice_no (title 24/600) ·                   117
│   │    │               "date · due date" (14 #666)                   118-121
│   │    └─ right: StatusGlyph pill (Issued / Partial / Paid / Void)   123
│   │
│   ├─ S3.2  Bill-to Card  (gap 4)                                     126
│   │    ├─ overline "BILL TO"                                         127
│   │    ├─ party name (16/600) or "(no party)"                        128
│   │    ├─ "address, city, pincode"  (only when present)              129
│   │    └─ "Ph mobile · email"       (only when present)              130
│   │
│   ├─ S3.3  Primary actions  (row, wraps, gap 12)                     134
│   │    ├─ Button "Record payment"  blue, icon credit-card            135
│   │    │                            only when canPay (line 103)
│   │    ├─ Button "Share PDF"       tonal if canPay, else blue;       136
│   │    │                            spinner while exporting
│   │    └─ Button "Excel"           outline, icon grid                138
│   │
│   ├─ S3.4  Items Card                                                142
│   │    ├─ SectionTitle "Items (n)"                                   143
│   │    ├─ S3.4.h  header row: ITEM | QTY | RATE | AMOUNT             144-152
│   │    │          flex 2.6 : 0.8 : 1.3 : 1.3, numbers right-aligned
│   │    └─ S3.4.r  one row per line (divider between rows)            153-165
│   │               description (2 lines max) | qty | rate | amount
│   │               numbers in Bebas Neue (MoneyText small)
│   │
│   ├─ S3.5  Totals Card                                               168
│   │    ├─ TotalRow "Gross"                                           169
│   │    ├─ TotalRow "Discount (n%)"  only if discount > 0             170-172
│   │    ├─ TotalRow "Round off"                                       173
│   │    ├─ TotalRow "Total"  strong (larger Bebas)                    174
│   │    ├─ TotalRow "Paid"            only if paid > 0                175
│   │    ├─ TotalRow "Balance due"     only if paid > 0 and due > 0    176
│   │    ├─ amount in words  (italic caption)                          177-179
│   │    └─ notes            (only when present)                       180
│   │
│   └─ S3.6  Secondary actions  (row, gap 12; hidden when Void)        183-189
│        ├─ Button "Edit"  outline, icon edit-2 → opens S4 edit mode   185
│        └─ Button "Void"  ghost red, icon x-circle → voidInvoice()    187
│
└─ P1  Record-payment Sheet  (visible = payOpen)                       191
     ├─ title "Record payment" + ✕  (from Sheet, C10)                  192
     ├─ "PRE-001 · outstanding ₹950.00"  (14 #666)                     193-195
     ├─ Input "Amount (₹)"  decimal keyboard, placeholder 0.00,        196
     │                      red error text when invalid
     ├─ label "Mode"  (13/500 #666)                                    198
     ├─ SegmentedControl  [Cash] [UPI] [NEFT] [Cheque]                 199
     │                    options built at line 107 (`modes`)
     └─ button row, right-aligned, gap 8                               201
          ├─ Button "Cancel"       ghost → closes the sheet            202
          └─ Button "Save payment" blue  → submitPayment()             203
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `load()` | 31 | fetches the invoice, its lines and the paid total; reruns when `invoiceId` or `nav.refreshKey` changes |
| `voidInvoice()` | 50 | native confirm dialog → `setStatus('void')` → audit log → refresh → snackbar "PRE-001 voided" |
| `askPayment()` | 65 | clears the amount and error, opens P1 |
| `outstanding` | 71 | total − paid |
| `submitPayment()` | 73 | amount must be > 0 (else inline error) → closes P1 → `recordPayment` (today, chosen mode) → audit → refresh → snackbar |
| `share('pdf' \| 'xlsx')` | 94 | PDF (D1) via `exportInvoicePdfAndShare`, or a one-invoice Excel (D2.1) → share sheet; spinner on that button |
| `canPay` | 103 | not void, not paid, outstanding > 0 — shows "Record payment" and turns "Share PDF" tonal |
| `party`, `contact` | 104-105 | join address parts with ", " and contact parts with " · ", skipping blanks |
| `modes` | 107 | the four payment-mode options for P1 |

## Where to change what

| You want to change | Go to |
| --- | --- |
| payment modes (add "Card", rename "NEFT"…) | the array at line 107 |
| the items table column widths | `flex` values at line 148 (header) **and** lines 158-163 (rows) — keep both the same |
| the text of a button | its `label=` on lines 135-139, 185-187, 202-203 |
| which buttons show | the conditions: `canPay` (line 103) for Record payment; `inv.status !== 'void'` (line 183) for Edit / Void |
| the order of the blocks | move whole `<Card>` / `<View>` blocks inside the ScrollView (lines 115-189) |
| gap between blocks / side padding | `gap: layout.gap` and `paddingHorizontal: layout.side` at lines 112-113 |
| the void confirm wording | the `alert(...)` strings at line 51 |
| the snackbar wording | lines 59 and 91 |
| the sheet's look (handle, corners, dialog on tablets) | `src/ui/Sheet.tsx` (C10; changes P2 and P3 too) |
| colours, radii, fonts | `src/ui/tokens.ts` |
| the look of every Card / Button / TotalRow | `src/ui/components.tsx` (changes all screens) |

## How it is wrapped (phone vs tablet)

| Width | Wrapper | Where |
| --- | --- | --- |
| Phone | `App.tsx` shows it full-screen when `overlay.k === 'invoice-detail'`: a `TopAppBar title="Invoice"` with a glass back button (`nav.closeOverlay`) above `<InvoiceDetail>`; no bottom nav | `src/shell/App.tsx:128-134` |
| Tablet (md+) | S2 renders `<InvoiceDetail key={id} invoiceId={id} />` in its detail pane (50% wide, or 42% at xl+), with no extra app bar | `src/features/invoices/InvoicesScreen.tsx:138-142` |

P1 opens as a bottom sheet on phones and as a centred dialog on tablets; that switch lives in `Sheet` (C10), not here.

## Tablet check (Prompt 30)

Checked on 2026-10-23 with `/tablet-check` (phone AVD resized): **md** 601×961 dp (8-inch portrait) · **xl** 961×601 dp (8-inch landscape) · **lg** 800×1280 dp (10-inch portrait) · **xxl** 1280×800 dp (10-inch landscape).

| Size | Seen | Verdict |
| --- | --- | --- |
| md 601 | ~~in a 300 dp pane, header truncated~~ → **since Prompt 32** S3 opens as a full-width overlay (≈ 513 dp) under a back bar: header ITEM · QTY · RATE · AMOUNT complete, one line each | ok |
| xl 961 | pane ≈ 370 dp: readable, item names wrap to 2 lines | ok |
| lg 800 | pane ≈ 370 dp: readable | ok |
| xxl 1280 | pane ≈ 460 dp: everything on one line | ok |

Proposed fix (not applied): the S3.4 header labels get `numberOfLines={1}` with `adjustsFontSizeToFit`, or the flex ratio moves to `2.2 : 0.8 : 1.3 : 1.5` under 340 dp; depends on the S2 pane fix above.
