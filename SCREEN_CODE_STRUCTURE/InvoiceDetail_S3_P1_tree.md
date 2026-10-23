# Invoice detail (S3) and Record payment (P1) — Three-Slot tree

**File:** `src/features/invoices/InvoiceDetail.tsx` (321 lines; line numbers as of 2026-10-23) · **Reached by:** tapping an invoice row on S2 (`InvoicesScreen.tsx:216`): `nav.showInvoice(id, true)` when `bp.panes === 1`, else `nav.selectInvoice(id)` · **Data:** `getInvoice()` `src/data/invoicesRepo.ts:35`, `getLines()` `src/data/invoicesRepo.ts:45`, `paidPaiseForInvoice()` `src/data/paymentsRepo.ts:54`; actions `setStatus()` `src/data/invoicesRepo.ts:126`, `recordPayment()` `src/data/paymentsRepo.ts:23`, `logAudit()` `src/data/auditRepo.ts:8`, `exportInvoicePdfAndShare()` `src/export/pdf.ts:60`, `shareFile()` `src/export/pdf.ts:49`, `exportInvoicesXlsx()` `src/export/xlsx.ts:41` · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S3 and § P1 · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

One invoice in full: who it is for, its lines, its totals, and the actions on it (record a payment, share, edit, void). S3 is a **hosted screen**, so it is an embeddable Main: there is no `<Screen>` wrapper and no header or footer of its own, and it has one layout at every width. The host decides where it goes: with `bp.panes === 1` (xs, sm, md) the shell shows it under the "Invoice" back bar as the `invoice-detail` overlay (`src/shell/App.tsx:128-134` on phones, `:157-163` beside the rail on md); on lg+ S2's `DetailPane` renders it in the right pane (`src/features/invoices/InvoicesScreen.tsx:275-279`). P1 lives in the same file and switches on `bp.isPhone` inside `Sheet` (C10): bottom sheet on phones, centred dialog on tablets.

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | the host's, not this file's: `TopAppBar title="Invoice"` with a back button (`nav.closeOverlay`) when one pane (`App.tsx:131`, `:161`); on lg+ none, `DetailPane` shows the Main under S2's own header | — | — |
| Main | one `ScrollView` capped at the reading width: header row, bill-to, actions, items, totals, Edit / Void | `DetailMain` | 167-181 |
| Footer | none (the actions sit in Main as S3.3 and S3.6, so they scroll with the invoice; the host owns the back bar) | — | — |
| FAB | none (no `<Screen>`, nothing to add from here) | — | — |
| Nav / rail | owned by the shell (S0): no bottom nav under the overlay on phones, the rail stays on md | — | — |
| Sheet | P1 on top of everything, `visible={s.payOpen}` | `PaymentSheet` | 304-321 |

## 2. The file in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `PAY_MODES` | 29 | the P1 payment modes, in order: Cash · UPI · NEFT · Cheque |
| 2 | `S3` | 33-38 | every number specific to this screen |
| 3 | `useInvoiceDetail(invoiceId)` | 44-134 | all state, data and actions (no JSX); `DetailState` and `Loaded` types at 135-137 |
| 4 | `InvoiceDetail()` | 142-160 | the spinner until the invoice loads, then `DetailMain` + `PaymentSheet`; no `<Screen>` |
| 5 | `DetailMain` · `HeaderRow` · `BillToCard` · `ActionRow` · `ItemsCard` · `ItemsHeader` · `LineRow` · `TotalsCard` · `EditVoidRow` | 167-300 | one function per region, in on-screen order |
| 6 | `PaymentSheet` (P1) | 304-321 | the Record-payment sheet |

## 3. Tree

```
InvoiceDetail({ invoiceId })                                          line 142
│
├─ S3.0  Loading        centred spinner (padding 32) until s.inv loads  146-152
│                       below it every region takes Loaded (inv non-null) 153
│
├─ DetailMain                 ScrollView: sides 20, top 4, bottom S3.bottomPad (32);  167
│    │                        gap 16; maxWidth S3.readWidth (720); no useMainInset()
│    │
│    ├─ HeaderRow       S3.1  row, space-between, centred                 184
│    │    ├─ left column (flex 1, minWidth 0, gap 2)                      188
│    │    │    ├─ invoice_no   type.title (24/600), one line              189
│    │    │    └─ "date · due date"  type.bodyMedium, muted               190
│    │    └─ StatusGlyph pill  (statusStyle[inv.status], C-kit)           195
│    │
│    ├─ BillToCard      S3.2  Card, gap 4                                 201
│    │    ├─ overline "Bill to"  (rendered upper-case)                    204
│    │    ├─ party_name  type.heading (16/600), or "(no party)"           205
│    │    ├─ s.party   "address, city, pincode"   only when present       206
│    │    └─ s.contact "Ph mobile · email"        only when present       207
│    │
│    ├─ ActionRow       S3.3  row, flexWrap, gap 12                       214
│    │    ├─ Button "Record payment"  solid, icon credit-card             217
│    │    │                            only when s.canPay → s.askPayment
│    │    ├─ Button "Share PDF"       tonal if canPay, else solid;        218
│    │    │                            busy spinner while s.busy === 'pdf'
│    │    └─ Button "Excel"           outline, icon grid;                 220
│    │                                 busy spinner while s.busy === 'xlsx'
│    │
│    ├─ ItemsCard       S3.4  Card                                        227
│    │    ├─ SectionTitle "Items (n)"  (n = s.lines.length)               230
│    │    ├─ ItemsHeader  S3.4.h  ITEM | QTY | RATE | AMOUNT              238
│    │    │          overline, muted, one line each; flex from            241
│    │    │          S3.itemColumns (2.6 : 0.8 : 1.3 : 1.3); cols 2-4 right
│    │    └─ LineRow × n  S3.4.r  React.memo; keyed by sno; divider       253
│    │               between rows (none after the last)                   258
│    │               description (type.label, 2 lines max, marginEnd 8)   261
│    │               | qty | rate | amount  MoneyText small (Bebas 15)    263-265
│    │               the same S3.itemColumns                              254
│    │
│    ├─ TotalsCard      S3.5  Card                                        272
│    │    ├─ TotalRow "Gross"                                             276
│    │    ├─ TotalRow "Discount (n%)"   only if discount_paise > 0        277-279
│    │    ├─ TotalRow "Round off"                                         280
│    │    ├─ TotalRow "Total"  strong (rule above, larger Bebas)          281
│    │    ├─ TotalRow "Paid"            only if paid > 0                  282
│    │    ├─ TotalRow "Balance due"     only if paid > 0 and due > 0      283
│    │    ├─ amount_in_words  type.caption, italic, marginTop 8           284-286
│    │    └─ notes            type.bodyMedium, only when present          287
│    │
│    └─ EditVoidRow     S3.6  row, gap 12; hidden when void (line 178)   293
│         ├─ Button "Edit"  outline, icon edit-2 → s.openEdit (S4 edit)  296
│         └─ Button "Void"  ghost, danger, icon x-circle → s.voidInvoice 297
│
└─ PaymentSheet         P1    Sheet visible={s.payOpen}, onClose closePayment 304
     ├─ title "Record payment" + ✕ Close   (drawn by Sheet, C10)          306
     ├─ "invoice_no · outstanding ₹n"  bodyMedium, muted, marginBottom 16 307-309
     ├─ Input "Amount (₹)"  decimal-pad, tabular, placeholder 0.00;       310
     │                      error text = s.payError; typing clears it
     ├─ label "Mode"  type.labelMedium, muted, marginBottom 8             312
     ├─ SegmentedControl  PAY_MODES  [Cash] [UPI] [NEFT] [Cheque]         313
     │                    accessibility label "Payment mode"; marginBottom 24
     └─ button row, flex-end, gap 8                                       315
          ├─ Button "Cancel"       ghost → s.closePayment                 316
          └─ Button "Save payment" solid → s.submitPayment()              317

Hosts:  one pane  TopAppBar "Invoice" ← nav.closeOverlay  + InvoiceDetail   App.tsx 131-132, 161-162
        lg+       S2 DetailPane (50 %, or 42 % with the activity pane)       InvoicesScreen.tsx 275-279
```

## 4. The `S3` numbers

| Key | Value | ID | Means |
| --- | --- | --- | --- |
| `itemColumns` | `[2.6, 0.8, 1.3, 1.3]` | S3.4.h / S3.4.r | Item · Qty · Rate · Amount flex shares; the header (line 244) and the rows (line 254) both read it, so the four columns stay on one grid |
| `readWidth` | `maxReadWidth` (720) | Main | the scroll content's maximum width |
| `bottomPad` | `space[6]` (32) | Main | the end of the scroll; S3 has no nav under it, so no `useMainInset()` |
| `paisePerRupee` | 100 | P1 | the typed amount is rupees; `submitPayment` rounds it to paise |

Shared spacing comes from `src/ui/tokens.ts`: `layout.side` 20, `layout.gap` 16, `layout.grid` 12.

## 5. Rows and columns

| Row | Function | Cells | Rule |
| --- | --- | --- | --- |
| S3.1 header row | `HeaderRow` | 2: text column · status pill | never stacks: the pill keeps its own width, the text column takes the rest (`flex: 1, minWidth: 0`) and the number truncates to one line |
| S3.3 actions | `ActionRow` | 2 or 3 buttons | `flexWrap: 'wrap'`, gap 12: a button that does not fit goes to the next line and comes back up on a wider pane; the count depends on `canPay`. Not a `Columns` row: the cells are natural-width buttons, not equal shares |
| S3.4 items table | `ItemsHeader` + `LineRow` | 4: item · qty · rate · amount, flex 2.6 : 0.8 : 1.3 : 1.3 | **never stacks, and deliberately not `Columns`** (SKILL.md § 3 names it as the example): a table needs the header and every row on the same column grid, and `Columns` measures each row on its own and would stack or wrap cells independently, so the numbers would no longer line up under their labels. The shares live once in `S3.itemColumns`; the description wraps to two lines instead of the row stacking. The cost is the tight header under 340 dp (section 8) |
| S3.6 Edit / Void | `EditVoidRow` | 2 buttons | never stacks: two short labels, gap 12, no wrap |
| P1 buttons | `PaymentSheet` | 2 buttons | right-aligned (`justifyContent: 'flex-end'`), gap 8 |

## 6. State and actions (`useInvoiceDetail()`)

| Name | Does |
| --- | --- |
| `inv`, `lines`, `paid` | the invoice (`null` until loaded), its lines, the paid total in paise |
| `load()` | `getInvoice` → then `getLines` and `paidPaiseForInvoice`; reruns when `invoiceId` or `nav.refreshKey` changes (line 65) |
| `outstanding` | `inv.total_paise - paid` (0 before load) |
| `canPay` | `inv` loaded, status not `void` and not `paid`, outstanding > 0: shows "Record payment" and turns "Share PDF" tonal |
| `party`, `contact` | address, city, pincode joined with ", "; `Ph mobile` and email joined with " · "; blanks skipped |
| `busy` | `'pdf'`, `'xlsx'` or `null`: which share button shows a spinner |
| `share(kind)` | PDF (D1) via `exportInvoicePdfAndShare(inv.id)`, or a one-invoice Excel (D2.1) via `exportInvoicesXlsx([inv])` then `shareFile`; failure → `alert('Export failed', …)`; always clears `busy` |
| `voidInvoice()` | `alert` confirm (Cancel · Void, destructive) → `setStatus(inv.id, 'void')` → `logAudit('invoice.void', …)` → `nav.refresh()` → snackbar "invoice_no voided" |
| `openEdit()` | `nav.openCreate({ invoiceId: inv.id })`: S4 in edit mode |
| `DetailState` / `Loaded` | `ReturnType<typeof useInvoiceDetail>`; `Loaded = DetailState & { inv: Invoice }`: `InvoiceDetail()` casts once after the spinner (line 153), so no region handles `null` |

### P1

| Name | Does |
| --- | --- |
| `payOpen` | whether the sheet is shown; `closePayment()` sets it false |
| `payAmount`, `payError`, `payMode` | the typed rupees (string), the inline error, the chosen mode (starts at `'Cash'`) |
| `askPayment()` | clears the amount and the error, opens the sheet |
| `submitPayment()` | `Number(payAmount.trim())` must be > 0, else `payError` "Enter the amount received, in rupees."; closes the sheet → `recordPayment` (today's date, `inv.party_name`, `[inv.id]`, `payMode`, no reference, amount × `S3.paisePerRupee`, remarks "Payment against invoice_no") → `logAudit('payment.record', …)` → `nav.refresh()` → snackbar "₹n recorded (mode)" |
| `PAY_MODES` | the `SegmentedControl` options, `{ value, label }` from the four names |

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| the payment modes (add "Card", rename "NEFT") | `PAY_MODES`, line 29 |
| the items table column widths | `S3.itemColumns`, line 34 (one place: `ItemsHeader` and `LineRow` both read it) |
| the items header labels | the array in `ItemsHeader`, line 241 |
| the text of a button | its `label=` in `ActionRow` (217-220), `EditVoidRow` (296-297) or `PaymentSheet` (316-317) |
| which buttons show | `canPay`, line 124, for Record payment; `s.inv.status !== 'void'` in `DetailMain`, line 178, for Edit / Void |
| the order of the blocks | reorder the six lines inside `DetailMain`, lines 173-178 |
| gap between blocks / side padding | `gap: layout.gap` and `paddingHorizontal: layout.side` in `DetailMain`, lines 170-171 |
| the reading width or the bottom padding | `S3.readWidth`, `S3.bottomPad` |
| the void confirm wording | the `alert(...)` strings in `voidInvoice`, line 69 |
| the snackbar wording | lines 77 and 111 |
| the amount validation message | `submitPayment`, line 95 |
| how many rupees make a paisa | `S3.paisePerRupee` |
| the "Invoice" back bar (one pane) | `src/shell/App.tsx`, lines 131 and 161 |
| the pane width on lg+ | `S2.detailWidth` in `src/features/invoices/InvoicesScreen.tsx`, line 46 |
| the sheet's look (handle, corners, dialog on tablets) | `src/ui/Sheet.tsx` (C10; changes P2 and P3 too) |
| the look of every Card / Button / TotalRow / StatusGlyph | `src/ui/components.tsx` (changes all screens) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## 8. Sizes

| Size | Layout | Last checked |
| --- | --- | --- |
| xs 320 | overlay under the back bar; Share PDF and Excel wrap to a second row; the AMOUNT header label clips ("RATEAMOU…"): **tight** | Prompt 44 |
| sm 360 · phone 411 | overlay under the back bar, every block on one column, header labels complete | Prompt 44 (phones), Prompt 54 (phone 411, pixel-identical before / after the restructure, opened from the list and scrolled to the bottom) |
| phone landscape (lg) | in S2's 50 % pane, scrolls | Prompt 44 |
| md 601 (8-inch portrait) | since Prompt 32 a full-width overlay (≈ 513 dp) beside the rail, under the back bar; ITEM · QTY · RATE · AMOUNT complete, one line each (before Prompt 32 it sat in a 300 dp pane with a truncated header) | Prompt 30, Prompt 32, Prompt 54 |
| lg 800 (10-inch portrait) | S2's 50 % pane (≈ 370 dp): readable; the RATE and AMOUNT header labels touch: **ok, tight** | Prompt 30, re-seen in Prompt 54 (unchanged by the restructure) |
| xl 961 (8-inch landscape) | S2's 50 % pane (≈ 370 dp): readable, item names wrap to two lines | Prompt 30 |
| xxl 1280 (10-inch landscape) | S2's 42 % pane beside the activity pane (≈ 460 dp): everything on one line | Prompt 30 |

P1 was not opened on the device in Prompt 54: the sample invoice totals ₹0, so `canPay` is false and the button is hidden; its code path was checked by reading (same props, same handlers as before the restructure).

Open findings (not applied): the S3.4.h header labels at 320 dp (AMOUNT clips) and in the lg pane (RATE and AMOUNT touch). The labels already have `numberOfLines={1}` (line 242); the proposed fix is `adjustsFontSizeToFit` on them, or a narrower item share under 340 dp (`S3.itemColumns` `[2.2, 0.8, 1.3, 1.5]`, or the label "AMT").
