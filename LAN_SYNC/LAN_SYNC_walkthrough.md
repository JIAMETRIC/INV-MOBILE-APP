# LAN_SYNC walkthrough

## Session 2026-10-30: feasibility check and plan (no code changed)

Read to find what blocks multi-device sync:

- `src/data/schema.ts` (v8): integer autoincrement keys on every table; `meta.next_seq` holds the invoice counter; `payments.invoice_ids` is a CSV of integer ids; no `deleted_at`.
- `src/data/invoicesRepo.ts`: `saveInvoice` allocates the number on the device (`allocateInvoiceNo`), `deleteInvoice` hard-deletes, editing deletes and re-inserts all lines.
- `src/data/productsRepo.ts`: Sold / Avl computed from invoice lines (sync-friendly); `stock_qty` is a stored balance next to the `restocks` ledger (not sync-friendly).
- `src/data/db.ts`: `withTx` uses `withExclusiveTransactionAsync`.
- `scripts/run-integration-tests.mjs`: wraps Node's built-in `node:sqlite` to look like expo-sqlite and runs the real repo code. This is what makes a Node desktop host reuse the app's data layer.
- `android/app/src/release/AndroidManifest.xml`: INTERNET removed in release builds.
- `../digital-invoice`: Flask + pywebview desktop app, older schema (REAL money, DD-MM-YYYY, GST, clients). Not a fit as the host.

Result: plan and open decisions D1–D6 written to `LAN_SYNC_TRACKING.md`.

## Session 2026-10-30 (Prompt 2): Phase 1, schema v9

Owner accepted the recommended answers to D1–D6.

### Changes

| File | Change |
| --- | --- |
| `src/data/schema.ts` | `SCHEMA_VERSION` 9; sync columns on `products`, `restocks`, `invoices`, `payments`, `meta`; `invoices.created_by`; new `payment_invoices`, `sync_tombstones`, `sync_state`; `SYNC_TABLES` and `SYNC_SQL` (uid indexes + insert / update / delete triggers) |
| `src/data/dbCore.ts` | `createSchema` runs `SYNC_SQL` before seeding (so seeded products get uids); new step `addSyncColumns` (v8 → v9); `addPaymentMode` now stamps 8 instead of `SCHEMA_VERSION`; `migrate` exported (for the test); the clean-rebuild drop list includes the new tables |
| `src/data/paymentsRepo.ts` | `recordPayment` writes `payment_invoices` rows; paid sums join `payment_invoices` instead of `LIKE` on the CSV |
| `src/data/dashboardRepo.ts` | `getAging` paid sum joins `payment_invoices` |
| `src/data/syncRepo.ts` (new) | `getSyncState()`, `pendingChanges()` (dirty rows per table + pending deletes) for the Phase 4 sync status |
| `scripts/run-integration-tests.mjs` | see below |
| `scripts/fixtures/schema-v8.sql` (new) | `SCHEMA_SQL` exactly as shipped in build 4 (from `git show 3fc1e93:src/data/schema.ts`) |

### Integration test was already broken

Before any change, `npm run test:integration` failed to compile: `src/export/pdf.ts` imports `modules/whatsapp-share`, which sits outside the harness's `--rootDir src` (TS6059). Its expectations were also still at schema v4 (60 size rows, `PRE-` prefix, `size` in `upsertProduct`). Fixed:

- compile with `--rootDir .` and load from `.tmp-integration/src/...`
- v9 / `INV-` / 12 products, one per name / no `size` input
- 7 new tests: uid + origin + dirty on every row; local edit re-dirties and bumps `rev` while host-applied writes don't; company details mark `meta` dirty but numbering and prefix don't; deletes leave tombstones except host-applied ones; payments link through `payment_invoices`; Stock = Σ ledger; v8 → v9 upgrade from the fixture (data kept, drifted product gets one correcting row, CSV `1,12` / `12` / `99` → 3 links, triggers live, same schema shape as a fresh v9 database, second migrate is a no-op)

The first, still-broken run had emitted `modules/whatsapp-share/index.js` next to `index.ts` (Metro could pick it up). Deleted it; later runs don't recreate it.

### Results

```
npm run test:integration   24 PASS  All integration tests passed.
npm run typecheck          clean
npm run test:money         All money-core tests passed.
npm run test:xlsx          All xlsx-writer tests passed.
npm run test:columns       All columns tests passed.
```

Not yet checked: opening a real v8 database on the emulator or phone (needs a build). The upgrade runs once, on first open after the update; take a backup from Settings first.

## Session 2026-10-30 (Prompts 4–5): user tracking for the admin pages, still v9

Prompt 4 asked for admin pages to track each user and the overall picture; the design (A1 Overview … A5 Sync log) is in `LAN_SYNC_TRACKING.md`. Prompt 5: add the missing data to v9 (unreleased) instead of a later v10.

| File | Change |
| --- | --- |
| `src/data/schema.ts` | `created_by` moved into the common sync columns (all synced tables); `audit_logs` added to `SYNC_TABLES` with the sync columns; `sync_state.user_uid`; insert trigger fills `created_by` from it |
| `src/data/dbCore.ts` | v8 → v9 adds `created_by` per synced table (replaces the invoices-only ALTER); `audit_logs` upgraded through the same loop |
| `src/data/auditRepo.ts` | actions `auth.signin`, `auth.failed`, `auth.locked`, `auth.recovered`; `recentAudit()` also returns `created_by`, `origin_device` |
| `src/data/settingsRepo.ts` | `updateSettings` logs `settings.update` (changed field names) after the transaction; nothing logged when no field changes |
| `src/data/invoicesRepo.ts` | `setStatus(…, 'void')` logs `invoice.void` with the invoice number |
| `src/auth/authStore.ts` | `check()` logs wrong PIN / recovery code (`auth.failed`, or `auth.locked` when a wait starts) and a successful recovery |
| `src/auth/LockProvider.tsx` | `auth.signin` when the unlock flow finishes (one-line change on `onDone`) |
| `scripts/run-integration-tests.mjs` | `SYNCED` list incl. `audit_logs`; new tests "new rows record the signed-in user; host rows keep theirs" and "settings saves and voids are logged"; migration fixture gets an audit row |

Results: `test:integration` 26 PASS · `typecheck` clean · `test:money`, `test:xlsx`, `test:columns` pass. Sign-in logging is not covered by the harness (authStore needs expo-secure-store on a device): check on the emulator with the next build.

Note: the data-file line numbers quoted in the `SCREEN_CODE_STRUCTURE/*_tree.md` headers (e.g. `invoicesRepo.ts:126`, "as of 2026-10-23") have shifted by a few lines with the v9 work; the screen files themselves are unchanged.
