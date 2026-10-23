# What's inside InvoiceDetail (S3) and the Record-payment sheet (P1)

File: `src/features/invoices/InvoiceDetail.tsx` (321 lines). Line numbers as of 2026-10-23 (Prompt 54, Three-Slot Screen).
Reached by tapping an invoice row on S2 (phone and md: `nav.showInvoice(id, true)` → full-screen overlay; lg+: `nav.selectInvoice(id)` → the right pane of S2, S2.7).
IDs (S3.x, P1) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

The screen has **one layout** at every width; only its wrapper differs (see "How it is wrapped"). S3 is an **embeddable Main**: it has no header or footer of its own and no `<Screen>` wrapper, because the shell draws the phone back bar and S2's `DetailPane` hosts it on tablets.

## How the file reads (top to bottom)

| Block | Line | What it is |
| --- | --- | --- |
| `PAY_MODES` | 29 | Cash · UPI · NEFT · Cheque (P1) |
| `S3` | 33 | every number specific to this screen: `itemColumns` (the S3.4 flex shares), `readWidth` 720, `bottomPad` 32, `paisePerRupee` 100 |
| `useInvoiceDetail(id)` | 44 | all state, data and actions, no JSX |
| `InvoiceDetail()` | 142 | the spinner until the invoice loads, then `DetailMain` + `PaymentSheet` |
| `DetailMain` | 167 | the one scroller with the six regions in order |
| `HeaderRow` | 184 | S3.1 |
| `BillToCard` | 201 | S3.2 |
| `ActionRow` | 214 | S3.3 |
| `ItemsCard` | 227 | S3.4, with `ItemsHeader` (238, S3.4.h) and `LineRow` (253, S3.4.r, memo) |
| `TotalsCard` | 272 | S3.5 |
| `EditVoidRow` | 293 | S3.6 |
| `PaymentSheet` | 304 | P1 |

```
InvoiceDetail({ invoiceId })                                         line 142
│
├─ S3.0  Loading        centred spinner until the invoice loads        146-150
│
├─ DetailMain           ScrollView: side 20, top 4, bottom S3.bottomPad 167
│   │                   (32); gap 16; maxWidth S3.readWidth (720)
│   │
│   ├─ HeaderRow   S3.1  (row, space-between)                          184
│   │    ├─ left column: invoice_no (title 24/600) ·                   190
│   │    │               "date · due date" (14 #666)                   191-194
│   │    └─ right: StatusGlyph pill (Issued / Partial / Paid / Void)   196
│   │
│   ├─ BillToCard  S3.2  Card (gap 4)                                  201
│   │    ├─ overline "BILL TO"                                         204
│   │    ├─ party name (16/600) or "(no party)"                        205
│   │    ├─ "address, city, pincode"  (only when present)              206
│   │    └─ "Ph mobile · email"       (only when present)              207
│   │
│   ├─ ActionRow   S3.3  (row, wraps, gap 12)                          214
│   │    ├─ Button "Record payment"  blue, icon credit-card            217
│   │    │                            only when s.canPay
│   │    ├─ Button "Share PDF"       tonal if canPay, else blue;       218
│   │    │                            spinner while exporting
│   │    └─ Button "Excel"           outline, icon grid                220
│   │
│   ├─ ItemsCard   S3.4  Card                                          227
│   │    ├─ SectionTitle "Items (n)"                                   230
│   │    ├─ ItemsHeader  S3.4.h  ITEM | QTY | RATE | AMOUNT            238
│   │    │          flex from S3.itemColumns (2.6 : 0.8 : 1.3 : 1.3),
│   │    │          numbers right-aligned
│   │    └─ LineRow × n  S3.4.r  (React.memo; divider between rows)    253
│   │               description (2 lines max) | qty | rate | amount
│   │               the same S3.itemColumns; numbers in Bebas Neue
│   │
│   ├─ TotalsCard  S3.5  Card                                          272
│   │    ├─ TotalRow "Gross"                                           276
│   │    ├─ TotalRow "Discount (n%)"  only if discount > 0             277-279
│   │    ├─ TotalRow "Round off"                                       280
│   │    ├─ TotalRow "Total"  strong (larger Bebas)                    281
│   │    ├─ TotalRow "Paid"            only if paid > 0                282
│   │    ├─ TotalRow "Balance due"     only if paid > 0 and due > 0    283
│   │    ├─ amount in words  (italic caption)                          284-286
│   │    └─ notes            (only when present)                       287
│   │
│   └─ EditVoidRow S3.6  (row, gap 12; hidden when Void: line 180)     293
│        ├─ Button "Edit"  outline, icon edit-2 → s.openEdit (S4 edit) 296
│        └─ Button "Void"  ghost red, icon x-circle → s.voidInvoice    297
│
└─ PaymentSheet  P1  Sheet (visible = s.payOpen)                       304
     ├─ title "Record payment" + ✕  (from Sheet, C10)                  306
     ├─ "PRE-001 · outstanding ₹950.00"  (14 #666)                     307-309
     ├─ Input "Amount (₹)"  decimal keyboard, placeholder 0.00,        310
     │                      red error text when invalid
     ├─ label "Mode"  (13/500 #666)                                    312
     ├─ SegmentedControl  PAY_MODES  [Cash] [UPI] [NEFT] [Cheque]      313
     └─ button row, right-aligned, gap 8                               315
          ├─ Button "Cancel"       ghost → s.closePayment              316
          └─ Button "Save payment" blue  → s.submitPayment()           317
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `useInvoiceDetail(invoiceId)` | 44 | the whole state: `inv`, `lines`, `paid`, `busy`, the P1 fields; returns them with the actions below plus `outstanding`, `canPay`, `party`, `contact`, `closePayment`, `openEdit` |
| `load()` | 56 | fetches the invoice, its lines and the paid total; reruns when `invoiceId` or `nav.refreshKey` changes |
| `voidInvoice()` | 67 | native confirm dialog → `setStatus('void')` → audit log → refresh → snackbar "PRE-001 voided" |
| `askPayment()` | 83 | clears the amount and error, opens P1 |
| `outstanding` | 89 | total − paid |
| `submitPayment()` | 91 | amount must be > 0 (else inline error) → closes P1 → `recordPayment` (today, chosen mode, `S3.paisePerRupee`) → audit → refresh → snackbar |
| `share('pdf' \| 'xlsx')` | 114 | PDF (D1) via `exportInvoicePdfAndShare`, or a one-invoice Excel (D2.1) → share sheet; spinner on that button |
| `canPay` | 124 | not void, not paid, outstanding > 0: shows "Record payment" and turns "Share PDF" tonal |
| `party`, `contact` | 125-126 | join address parts with ", " and contact parts with " · ", skipping blanks |
| `openEdit()` | 132 | `nav.openCreate({ invoiceId })`: S4 in edit mode |
| `InvoiceDetail()` | 142 | spinner, then `DetailMain` + `PaymentSheet`; below the spinner every region takes `Loaded` (the invoice is non-null) |
| `DetailMain` … `PaymentSheet` | 167-304 | one function per region, see the tree |

## Where to change what

| You want to change | Go to |
| --- | --- |
| payment modes (add "Card", rename "NEFT"…) | `PAY_MODES`, line 29 |
| the items table column widths | `S3.itemColumns` (one place: the header and the rows both read it) |
| the text of a button | its `label=` in `ActionRow`, `EditVoidRow` or `PaymentSheet` |
| which buttons show | `canPay` (line 124) for Record payment; `s.inv.status !== 'void'` in `DetailMain` (line 180) for Edit / Void |
| the order of the blocks | reorder the six lines inside `DetailMain` (lines 174-180) |
| gap between blocks / side padding | `gap: layout.gap` and `paddingHorizontal: layout.side` in `DetailMain` |
| the reading width or the bottom padding | `S3.readWidth`, `S3.bottomPad` |
| the void confirm wording | the `alert(...)` strings in `voidInvoice`, line 69 |
| the snackbar wording | lines 78 and 111 |
| the sheet's look (handle, corners, dialog on tablets) | `src/ui/Sheet.tsx` (C10; changes P2 and P3 too) |
| colours, radii, fonts | `src/ui/tokens.ts` |
| the look of every Card / Button / TotalRow | `src/ui/components.tsx` (changes all screens) |

## How it is wrapped (phone vs tablet)

| Width | Wrapper | Where |
| --- | --- | --- |
| One pane (xs, sm, md) | `App.tsx` shows it full-screen (beside the rail on md) when `overlay.k === 'invoice-detail'`: a `TopAppBar title="Invoice"` with a glass back button (`nav.closeOverlay`) above `<InvoiceDetail>`; no bottom nav | `src/shell/App.tsx` |
| lg+ | S2 renders `<InvoiceDetail key={id} invoiceId={id} />` in `DetailPane` (50% wide, or 42% at xl+), with no extra app bar | `src/features/invoices/InvoicesScreen.tsx` `DetailPane` |

P1 opens as a bottom sheet on phones and as a centred dialog on tablets; that switch lives in `Sheet` (C10), not here.

## Three-Slot restructure (Prompt 54, 2026-10-23)

208 → 321 lines: one 191-line component → `PAY_MODES` · `S3` · `useInvoiceDetail()` · `InvoiceDetail()` (the spinner, then Main + P1) · `DetailMain` · `HeaderRow` · `BillToCard` · `ActionRow` · `ItemsCard` + `ItemsHeader` + `LineRow` (memo) · `TotalsCard` · `EditVoidRow` · `PaymentSheet`. The column flexes, duplicated in the header and the rows before, are read from `S3.itemColumns` in both places. Phone screenshots before / after (opened from the list, and scrolled to the bottom): 0.000 % differing pixels. P1 could not be opened on the device (PRE-001 totals ₹0, so `canPay` is false and the button is hidden); its code path was checked by reading: same props, same handlers. `/size-check` md: full-width overlay beside the rail, items header complete; lg: in S2's 50 % pane, as before.

## Tablet check (Prompt 30)

Checked on 2026-10-23 with `/size-check` (then `/tablet-check`) (phone AVD resized): **md** 601×961 dp (8-inch portrait) · **xl** 961×601 dp (8-inch landscape) · **lg** 800×1280 dp (10-inch portrait) · **xxl** 1280×800 dp (10-inch landscape).

| Size | Seen | Verdict |
| --- | --- | --- |
| md 601 | ~~in a 300 dp pane, header truncated~~ → **since Prompt 32** S3 opens as a full-width overlay (≈ 513 dp) under a back bar: header ITEM · QTY · RATE · AMOUNT complete, one line each | ok |
| xl 961 | pane ≈ 370 dp: readable, item names wrap to 2 lines | ok |
| lg 800 | pane ≈ 370 dp: readable; the RATE and AMOUNT header labels touch (re-seen in Prompt 54, unchanged by the restructure) | ok, tight |
| xxl 1280 | pane ≈ 460 dp: everything on one line | ok |

Proposed fix (not applied): the S3.4 header labels get `numberOfLines={1}` with `adjustsFontSizeToFit`, or `S3.itemColumns` becomes `[2.2, 0.8, 1.3, 1.5]` under 340 dp.

## Size check, phones (Prompt 44)

| Size | Seen | Verdict |
| --- | --- | --- |
| xs 320 | overlay; Share PDF and Excel wrap to two rows; items header "RATEAMOU…" (the AMOUNT label clips at 320 dp) | **tight** (same header issue as md before Prompt 32) |
| sm 360, phone 411 | ok | ok |
| phone landscape (lg) | S3 in the 50 % pane, scrolls | ok |

Proposed fix (not applied): header labels with `adjustsFontSizeToFit` / `numberOfLines={1}`, or "AMT" under 340 dp.
