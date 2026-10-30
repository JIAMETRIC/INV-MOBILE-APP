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

## Session 2026-10-30 (Prompt 6): Phase 2, host core

Built the desktop host as a Node service plus the shared sync engine; design and file map in `LAN_SYNC_TRACKING.md` § "Phase 2 as built".

### Smoke run of the real entry point

`node desktop/dist/desktop/host/main.js --data <scratch>/host-smoke --port 7499 --pair`:

```
Invoice ERP host "ADIT-PC" listening on port 7499
Phones connect to: http://10.23.172.181:7499
Pairing link (one phone, until 8:52:05 pm): invoiceerp://pair?h=10.23.172.181&p=7499&i=…&s=…
GET  /health     -> {"app":"invoice-erp-host","protocol":1,"host_id":"…","host_name":"ADIT-PC"}
POST /sync/pull  (unknown device) -> {"error":"unknown_device"}
files: host.db (+ WAL), backups/host-2026-10-30.db
```

### `npm run test:sync` (new, `scripts/run-sync-tests.mjs`)

The real host on 127.0.0.1 and three phones (A, B, C), each with its own copy of the compiled app code and its own in-memory database, talking HTTP with sealed bodies.

First run: 12 / 14. The two failures were real problems:

1. **Pull clash on `invoices.invoice_no`**: phone C had its own `INV-001` from before pairing and pulled the desktop's `INV-001`. Fix: `client.giveWay` moves C's invoice to its series (`INV-C001`), logs `invoice.renumber`, pushes it.
2. **A repeated push re-numbered identical rows**: harmless, but extra pull traffic. Fix: `hostSync.unchanged` acknowledges identical products / invoices without writing.

While writing the product-name scenario, found that deriving every product uid from its name lets a renamed product and a new product with the old name share a uid. Changed to name-based uids for the seeded catalog only (see TRACKING).

Final: 14 / 14.

```
PASS host starts: health answers, seeded catalog numbered, backup written
PASS phone A has data before pairing (the shop's existing phone, D6)
PASS pairing: series A and B, one-time QR, wrong secret and unknown device refused
PASS phone A seeds the desktop: invoices, stock, payment, company details
PASS phone B downloads everything
PASS both phones work offline, then converge: B invoice + payment on A's invoice, two restocks add up
PASS a void made on the desktop beats an offline edit on the phone
PASS price edits: a stale phone edit loses to a newer desktop edit; an edit on the latest version wins
PASS a delete on one phone reaches the desktop and the other phone
PASS a second phone that already has its own INV-001: refused, then moved to its own series
PASS the same product name made on two devices becomes one product
PASS repeating a push changes nothing (Wi-Fi dropped before the reply)
PASS a blocked phone is refused
PASS final state: A, B and the desktop agree; sync log written
```

### Other changes

- `tsconfig.json`: excludes `desktop/` (the Expo base config has no Node types); `npm run typecheck` now also runs `tsc -p desktop/tsconfig.json --noEmit`.
- `package.json`: `host:build`, `host:start`, `test:sync`.
- `.gitignore`: `.tmp-*/` (test build folders). `desktop/dist/` is already covered by `dist/`.
- `src/data/auditRepo.ts`: action `invoice.renumber`.
- `src/data/schema.ts`, `dbCore.ts`: seeded products get name-based uids; others random (integration test updated).

### Results

```
npm run test:sync          14 PASS
npm run test:integration   26 PASS
npm run typecheck          clean (app + desktop)
npm run test:money / test:xlsx / test:columns   pass
```

Not covered: the pull window (`more` = true needs > 2000 changes in one pull); real Wi-Fi between two machines (Phase 6).

## Session 2026-10-30 (Prompt 8): Phase 2, Electron app and installer

Design and file map: `LAN_SYNC_TRACKING.md` § "Phase 2 as built: Electron app and installer".

### Steps and findings

1. **Versions** (published at least two weeks before 2026-10-30, except where noted): `npm audit` flagged `electron` 44.7.2 (high, GHSA-jr5w-w6x2-84p9, fixed after 44.9.0), so the patched **44.9.3** (2026-10-21) is used. Then 0 vulnerabilities.
2. **Encrypted SQLite without a compiler:** no Visual Studio on this PC. `better-sqlite3-multiple-ciphers` 13.0.3 ships N-API prebuilds (`prebuilds/win32-x64.node`) and loaded in Node (SQLite 3.53.4).
3. **Smoke run 1** (`INVOICE_ERP_DATA=<scratch>/electron-smoke npx electron . --smoke`): `{"ok":true,"electron":"44.9.3","port":7420,"dbEncrypted":true,"backupEncrypted":true,"products":12,"pairing":true}`.
4. **Second start failed**: `Error while decrypting the ciphertext provided to safeStorage.decryptString`. No `Local State` had been written in `%APPDATA%\Invoice ERP Desktop` (only GPU caches): Chromium writes it on clean shutdown only. Replaced `safeStorage` with DPAPI through PowerShell (`cipherDb.ts`). Three starts in a row on one folder: all `ok:true`.
5. **Backup key check** (Node, known key): `VACUUM INTO` copy has no plain SQLite header, opens with the key (`{ x: 42 }`), refuses a wrong key (`SQLITE_NOTADB`).
6. **Page check** in the browser pane with sample data (served from `desktop/renderer` on 127.0.0.1): light at full width, pairing dialog, dark at 380 px. Fixed: the status badge kept its red "Not running" class after a later successful render; the Sync log heading wasn't centred in its 52 px row; Block / Unblock ran past the card edge at 380 px (now wraps under the name below 520 px). No horizontal scroll at 380 px.
7. **Installer:** first `npm run dist` stopped at `@electron/rebuild` (no Visual Studio) → `npmRebuild: false`. Second: packaged, but NSIS "Can't open output file" on the final exe (file locked while being written); a clean retry built `release/InvoiceERP-Desktop-Setup-1.0.1.exe` (132 MB).
8. **Packaged app smoke** (`release/win-unpacked/Invoice ERP Desktop.exe --smoke`): `ok:true`, database and backup encrypted; the native module is unpacked to `app.asar.unpacked`.

### Results

```
desktop smoke (dev, 3 starts) / packaged smoke   ok:true, dbEncrypted, backupEncrypted
npm run test:sync          14 PASS (terminal host path, node:sqlite)
npm run test:integration   26 PASS
npm run typecheck          clean (app + desktop host); desktop tsconfig.electron.json clean
npm run test:money / test:xlsx / test:columns   pass
```

Not done here: running the installer (system-wide install + firewall rule: the owner's step), the tray and "Start with Windows" by hand, and pairing a real phone (Phase 4).

## Session 2026-10-30 (Prompt 10): Phase 4, phone sync

Design and file map: `LAN_SYNC_TRACKING.md` § "Phase 4 as built". Screen docs: `SCREEN_LAYOUT_REFERENCE.md` § S6 (S6.7 rows and functions), `SCREEN_CODE_STRUCTURE/SettingsScreen_S6_tree.md` and `AppShell_S0_tree.md` (2026-10-30 addenda).

### Dependencies

- `expo-camera` ~58.0.14 through `npx expo install` (the version Expo SDK 58 expects), plugin with `recordAudioAndroid: false`. Its Android manifest adds only CAMERA.
- `@noble/ciphers` ^2.4.0 (2026-08-27, pure JS, no native code).
- `npm audit --omit=dev` lists 12 issues, all in Expo's own CLI / config packages (`node-forge`, `zod`, `deepmerge`, `uuid`), already there before; the two new packages add none.

### `npm run test:sync`: 19 / 19

Five new tests with phone D running the app's own `src/sync/service.ts`:

```
PASS phone sealing (@noble/ciphers) and desktop sealing (node:crypto) read each other
PASS pairing link: parsed; anything else refused
PASS phone service pairs from the link (first address dead), then syncs both ways
PASS phone service: wrong desktop, blocked, forgotten and offline are told apart
PASS pairing with a different desktop sends everything again, without duplicates
```

### Other checks

```
npm run typecheck          clean (app + desktop host)
npm run test:integration   26 PASS
npm run test:money / test:xlsx / test:columns   pass
npx expo export --platform android   bundle builds
```

### On the emulator (Medium_Phone_API_37.0)

- Release APK, x86_64 only, versionCode 5, EAS key: `gradlew assembleRelease -PreactNativeArchitectures=x86_64` in 2 min 19 s (44.7 MB).
- `adb install -r` over build 4: Success, data kept. `dumpsys`: versionCode 5, INTERNET (granted) and CAMERA declared, no RECORD_AUDIO.
- First start: no database error, PIN screen shown, so the **real v8 → v9 upgrade** of the emulator's database worked.
- The app was behind a PIN set in the 2026-10-29 session and never written down (Prompt 11). With the owner's go-ahead (Prompt 12), `adb shell pm clear com.jiametric.invoiceerp` wiped the emulator's app data (its 2 test invoices). A new random test PIN was created and, with the one-time recovery code, saved to `credentials/emulator-test-lock.txt` (git-ignored); see `AUTH_AND_LOCK_walkthrough.md`.

### On the emulator: pairing and sync through the UI (Prompts 11–12)

Test desktop: `node desktop/dist/desktop/host/main.js --data <scratch>/emu-host --pair` on port 7420; pairing link typed into S6.7.1 with `h=10.0.2.2` (the emulator's address for this PC).

| Step | Result |
| --- | --- |
| Settings | five sections; header "Company, sync, security, backup"; "Sync with desktop" second |
| S6.7.1 not paired | Desktop card, Scan pairing code, link input, Pair disabled until a link is in |
| Pair (link) | S6.7.2: Desktop ADIT-PC · Invoice series INV-A001, INV-A002 … · Last sync today 10:38 PM |
| Desktop side | `devices`: "Google sdk_gphone64_x86_64", series A, app "1.0.1 (5)"; `sync_log`: pair, push 12 (the phone's catalog, no refusals), pull 12; still **12 products** (seeded uids match, no duplicates) |
| Desktop → phone | Hoodie price set to ₹649.00 in the desktop DB → Sync now → Products shows ₹649.00 |
| Phone → desktop (old trigger) | Hoodie stock 0 → 25 in the editor: **not** sent within 4 s. Products saves don't call `nav.refresh()`, so the 1.5 s after-save trigger never fired; the 60 s tick sent it (desktop: stock 25, restock `edit +25`, log `product.upsert`) |
| Fix | `SyncProvider` checks for waiting changes every 5 s (`hasPending()`, one local query), on every screen, skipped while the last round failed; rebuilt (18 s, bundle checked for `hasPending`), reinstalled |
| Phone → desktop (new trigger) | Hoodie stock 25 → 30, Save, no Sync tap: desktop stock **30 after 3 s**; restocks `+25 → 25`, `+5 → 30` |
| Desktop off | Sync now → red "Desktop not reachable. Check that this phone is on the shop Wi-Fi and Invoice ERP Desktop is running." Cards and buttons stay usable |
| Unlock after reinstall | the recorded test PIN opens the app; Dashboard shows the synced stock (25) |

Not tried on the emulator: scanning a QR (the emulator has no real camera; on a phone, scan the desktop's Add phone code), Unpair, two phones at once (covered by `test:sync`). After the 5 s change: `test:sync` 19 PASS, `test:integration` 26 PASS, typecheck clean.

## Session 2026-10-30 (Prompt 17): Phase 5, people and limits

Design and file map: `LAN_SYNC_TRACKING.md` § "Phase 5 as built". Screen docs: S7, S5, S3, S6 rows in `SCREEN_LAYOUT_REFERENCE.md` and addenda in the four `SCREEN_CODE_STRUCTURE` trees. Lock: `AUTH_AND_LOCK` TRACKING / walkthrough.

### Schema v10

- `scripts/fixtures/schema-v9.sql` (new): `SCHEMA_SQL` + `SYNC_SQL` exactly as shipped in build 5 (compiled from `git show f9ddb86:src/data/schema.ts`).
- A first draft of the migration would have let the v8 → v9 step create `sync_tombstones` from the v10 definitions, and v10 would then have tried to add `user_uid` twice. Fixed before running: v10 adds columns only where missing, and v9 leaves the triggers to v10.
- `test:integration` 28 PASS. New: "v10: edits record who made them; deletes record who deleted", "v9 -> v10 upgrade (phones on build 5) ends like a fresh v10 build". The v8 → v10 shape test passes too.

### `test:sync` 24 PASS (5 new)

```
PASS desktop people: rules for names, PINs and owners
PASS people reach the phones; the phone checks PINs the desktop set
PASS staff limits: the desktop refuses price, restock, void and delete, and the phone takes them back
PASS switches: stock for Meena, everything for the owner, nothing once switched off
PASS a phone on the old protocol is told to update
```

### Emulator (build 6, `versionCode` 6, x86_64 test build)

- Test desktop on the scratch `emu-host` folder via a small script (its v9 database upgraded to v10, `/health` protocol 2), two test people (Owner, Ravi; PINs in `credentials/emulator-test-lock.txt`).
- Install over build 5: database v9 → v10, data kept.
- **Bug found:** the first sync ran under the device-PIN screen and pulled the 2 people (host `sync_log`: pull 2 at 18:11:13); the device PIN then opened the Dashboard. Fixed in `LockProvider` (`refreshPeople` switches an `unlock` gate, `unlocked` sends a right device PIN on to `person`); rebuilt (18 s) and reinstalled.
- After the fix: "Who's using Invoice ERP?" with Owner (blue OW) and Ravi (grey RA, Staff) → "Hi, Ravi", 6 dots, "Not Ravi? Choose another person" → Ravi's PIN → Dashboard.
- As Ravi: Products without "Add product"; editor with name / price / stock read-only, no Quick pick, no buttons, the explanatory line, stock history shown; Settings → Security "Signed in as Ravi · Staff · Switch person", no device-PIN card.

### Desktop

- Browser-pane check of the page with sample data: People card (initials, Owner / Staff summaries with switches, "Switched off" badge, Edit) and the Add a person dialog (Name, Staff / Owner switch, four switches, PIN, error line "There is already someone called Ravi."). Initials changed to the phone's rule (one word → first two letters).
- Electron smoke after the host changes: `ok:true`, database and backup encrypted.

### Other results

```
npm run typecheck (app + desktop) clean · desktop tsconfig.electron.json clean
test:money, test:xlsx, test:columns pass
```

Not done: a phone-ready (arm64 + x86_64) build 6 APK; the people dialog in the real Electron window (checked in the browser pane with sample data).

