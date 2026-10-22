# SCREEN_LAYOUT_REFERENCE — Walkthrough

## Prompt 1 — Complete layout & architecture reference (2026-10-22, session 13)

**Method:** read every UI source file in full: `src/shell/{App,navigation,providers}.tsx`, `src/ui/{Nav,components,Sheet,Snackbar}.tsx`, `src/ui/{tokens,useBreakpoint,alert}.ts`, all 6 `src/features/**` screens, and `src/export/{pdfTemplate,xlsx}.ts`. Wireframes and tables were written from the JSX (flex ratios, widths, conditions), not from screenshots. The one screenshot taken this session (phone Dashboard on `emulator-5554`) matches S1's phone wireframe.

**Line-number check:** grep spot-checks on Nav.tsx, tokens.ts, SettingsScreen, InvoiceDetail, InvoicesScreen, navigation.tsx. Nav.tsx and tokens.ts were off by one and were corrected; the others matched.

**Output:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`. No code changed.

**Findings:** the three items under "Observations" in the tracking file.

## Prompt 2 — Fix the 3 gaps (2026-10-22, session 13)

**Code diffs**

- `src/data/types.ts`: `AgingRow` + `invoice_id: number`.
- `src/data/dashboardRepo.ts` (`getAging`): pushes `invoice_id: o.id`.
- `src/features/dashboard/DashboardScreen.tsx` (S1.3.1): `key={a.invoice_id}`, `onPress={() => nav.showInvoice(a.invoice_id, bp.isPhone)}`.
- `src/features/invoices/CreateInvoiceScreen.tsx`:
  - S4.L3: `showsCatalogPanel = bp.atLeast('xl')` plus an effect that loads `listProducts(catalogSearch)` on entering xl (lines 166-171).
  - S4.B.6: City | Pincode row added under the ship Address field (autosave on blur, pincode numeric with max 6).

**Tests**

- `npm run typecheck`: clean.
- `npm run test:integration`: all PASS (includes the dashboard aging/KPI test).

**Emulator (`emulator-5554`, debug build, Metro restarted to pick up the JS)**

| Check | Result |
| --- | --- |
| Phone: tap the Outstanding (aging) row PRE-001 | opens the Invoice detail overlay for PRE-001 ✔ |
| Phone: Edit PRE-001 → Items → toggle "Ship to address" | card shows Consignee, Address, City \| Pincode ✔ (left without saving; edit mode doesn't autosave unless a field blurs) |
| Landscape plus `wm density 320` (1200dp wide = xxl, the three-panel layout) → Rail **+** | Products panel lists products immediately (Acid Wash T-Shirt · L/M/S …) with Avl badges ✔ |
| Display restored | `wm density reset`, `user_rotation 0`; back on the phone Dashboard |

The dev LogBox toast "Open debugger to view warnings" during the checks was logcat's `Cannot connect to Expo CLI … URL: 10.0.2.2:8081`. That comes from the dev client's link to the CI-mode Metro, not from app code.

Reference doc: S1.3.1, S4.B.6 and S4.L3 text updated; S4 line numbers shifted (+7 after line 166, +19 after the shipping card); the 3 fixed cookbook rows removed.
