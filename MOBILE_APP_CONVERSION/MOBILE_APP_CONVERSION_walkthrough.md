# MOBILE_APP_CONVERSION — Walkthrough (verification log)

Session 2026-10-20: initial conversion of desktop Flask ERP to Expo Android app in `mobile/`.
Session 2026-10-20 (2): "Test with Simulators or your own method" — no Android emulator/SDK on this host, so verification was done with a headless SQLite integration harness running the real repository code (see "Integration harness" below).

## Source audit (desktop app)

- Entry points: `desktop_app.py` (pywebview shell + Waitress), `run.py` (dev CLI) — desktop-only, not ported.
- Schema: `database/schema.sql`, 13 tables, WAL, `PRAGMA user_version` migrations (`backend/db/migrations.py`, v7–8 incl. drafts).
- Money: floats + two-stage rounding in `backend/services/record_service.py::_compute_taxes`; GST flat 5%, TN (`state_code` contains `33`) → CGST 2.5+SGST 2.5, else IGST 5; whole-rupee round-off; Indian amount-in-words.
- Numbering: `company_settings` singleton (`id=1`) holds `invoice_prefix` (default `PRE-`) + `next_seq`; resync = max numeric suffix of issued invoices + 1 (`RecordService.sync_next_invoice_sequence`).
- Frontend: vanilla SPA `frontend/js/app.js` (~5.7k lines): overview KPIs, create-invoice form w/ drafts, invoices records w/ filters, GST/HSN summary, settings/backup/users.
- Dead routes found (frontend calls, backend lacks): `/api/products`, `/api/payments*`, customers CRUD, several export endpoints → mobile re-implements from schema DTOs.
- Date quirk: `invoice_date` stored `DD-MM-YYYY` TEXT with CASE-rewrite hacks in every query → mobile schema uses ISO dates.
- Exports: ReportLab Courier-grid PDF (`pdf_service.py`) + XlsxWriter/openpyxl Excel (`excel_service.py`); every create auto-archives PDF+XLSX to `storage/Invoices/`.

## Mobile build steps

| Step | Action | Result |
|---|---|---|
| 0 | `npx create-expo-app mobile --template blank-typescript` (Expo SDK 58.0.16, RN 0.88, React 19.3, TS 6.0.3) | PASS — scaffolded, `--no-install` then background npm install |
| 0 | `expo install expo-sqlite expo-secure-store expo-crypto expo-print expo-file-system expo-sharing expo-document-picker expo-font` + `exceljs`, `buffer`, `readable-stream`, `process`, `react-native-webview`, `react-native-safe-area-context` | PASS |
| 0 | app.config.ts: SQLCipher + secure-store plugins; `blockedPermissions` gated on `EAS_BUILD_PROFILE != development`; `allowBackup:false` | PASS |
| 1 | `src/data/` — schema.ts (ISO dates, integer paise), db.ts (Keystore key + `PRAGMA key`), 8 repositories | PASS — `tsc --noEmit` clean (strict + noUncheckedIndexedAccess) |
| 2 | tokens.ts / useBreakpoint.ts verbatim from plan §5/§8; components (Button/Input/Chip/ListRow/Sheet/Rail/BottomTabs) | PASS |
| 3–5 | Dashboard, Clients, Items, Invoices list+detail, Create-invoice (phone stepper / md-lg 2-pane / xl-xxl 3-panel), draft autosave | PASS — typechecks; device interaction not testable from this host |
| 6–7 | pdfTemplate + expo-print share flow, exceljs batched exporters (500-row batches, 50k cap), encrypted backup export/restore + daily auto-backup keep-7 | PASS |
| 8 | `npm run test:money` (7 suites: rounding, GST intra/inter, discount, round-off, words, numbering) | **PASS — all green** |
| 8 | `npx expo export --platform android` | **PASS — 731 modules, 3.4 MB hbc bundle; exceljs/webview/print resolve** |
| 8 | `npx expo prebuild --platform android` | **PASS** — `expo.sqlite.useSQLCipher=true` written to `android/gradle.properties`; SQLCipher+OpenSSL confirmed in expo-sqlite native gradle |
| 8 | `EAS_BUILD_PROFILE=preview expo config` | **PASS** — `blockedPermissions` includes INTERNET/ACCESS_NETWORK_STATE; development profile has none |

## Integration harness (`npm run test:integration`)

No Android emulator exists on this host (`sdkmanager`/`adb` absent), so the plan's testing was extended with a headless harness: `mobile/scripts/run-integration-tests.mjs` compiles the REAL `src/data/` modules with `tsc` and runs them against Node's built-in `node:sqlite` (`DatabaseSync`, in-memory) with `expo-sqlite` / `expo-secure-store` / `expo-crypto` mocked via a `Module._load` hook. The mock wrapper mirrors expo-sqlite semantics: statement queue (FIFO, transactions not deadlocked), `lastInsertRowId` naming, `PRAGMA user_version` row shape, BigInt→number row normalisation.

Scenario → Result matrix (all against real repository SQL, prefix `PRE-`, TN intra + Delhi inter):

| # | Scenario | Key assertions | Result |
|---|---|---|---|
| 1 | DB open, migrate, meta singleton | `user_version=1`, prefix `PRE-`, `next_seq=1` | PASS |
| 2 | Keystore key on first open | 64-hex chars under `db_key_v1` | PASS |
| 3 | Client CRUD + UNIQUE guard | duplicate `party_name` rejects inside tx, DB stays usable (rollback path exercised) | PASS |
| 4 | Item CRUD + stock adjust | `adjust_stock(-5)` → 115, case-normalized list | PASS |
| 5 | Issue INV #1 (intra, 10% discount) | atomic `PRE-001`, `next_seq→2`, gross 1,54,000.00 / disc 15,400 / taxable 13,860 / CGST=SGST 346.50 / **round-off 0** / total 1,45,530.00, amount-in-words matches `/^Rupees .+ Only$/` | PASS |
| 6 | Issue INV #2 (inter, IGST) | `PRE-002`, IGST 22.50, raw 472.50 → total 473.00, **round-off +0.50** (half-up, matches frontend `Math.round`) | PASS |
| 7 | Edit invoice | keeps `PRE-001`, lines replaced 2→1, totals overwritten | PASS |
| 8 | Draft autosave round-trip | save→update same id, `DRAFT-001`, payload JSON intact, delete empties list | PASS |
| 9 | Payments partial→paid | half payment → `partial`, remainder → `paid`, `paidPaise` sums exactly (exercises delimiter-safe CSV LIKE fix) | PASS |
| 10 | Void + KPIs + aging | voided `PRE-003` excluded from KPI (`invoiceCount=2`) and aging (`[PRE-002]`), FY April–March scoping | PASS |
| 11 | Delete + syncNextSeq | after deleting newest invoice, `Math.max` rule keeps `next_seq=4`; next issue is `PRE-004` — sequence never reuses a number | PASS |
| 12 | Audit trail | `logAudit` + `recentAudit` for client/item/payment/void/delete actions | PASS |

Full suite: 12/12 PASS. `test:money` still 7/7 PASS. `tsc --noEmit` clean.

> **Superseded by Prompt 14 (schema v2):** scenarios 1, 3, 5, 6, 9, 10, 12 above were v1
> (clients CRUD, intra/inter GST, client_id payments). The suite was rewritten for v2 —
> see "Prompt 14 — GST + Clients removal" at the end of this file for the current matrix.

### Bugs the harness found (app code)

- **`db.ts` migration could double-run:** `getFirstAsync('PRAGMA user_version')` returns the value under column `user_version`, not `v` — `row?.v` was always `undefined → 0`, so `migrate()` would re-apply the v1 block on every app start. Fixed in [src/data/db.ts:30](file:///c:/Users/admin/Desktop/WIP/Barathy-Invoive-App/digital-invoice/mobile/src/data/db.ts#L30) (harmless with `IF NOT EXISTS`/`OR IGNORE`, but wasted work and would break future `version < N` steps).
- **CSV `invoice_ids` LIKE false-positive:** payment-sum queries used `invoice_ids LIKE '%id%'`, so invoice 1 matched invoice 12. Fixed in [paymentsRepo.ts](file:///c:/Users/admin/Desktop/WIP/Barathy-Invoive-App/digital-invoice/mobile/src/data/paymentsRepo.ts) (2 queries) and [dashboardRepo.ts:~aging](file:///c:/Users/admin/Desktop/WIP/Barathy-Invoive-App/digital-invoice/mobile/src/data/dashboardRepo.ts) with `',' || invoice_ids || ',' LIKE '%,' || ? || ',%'`.

### Expectation corrections made during harness bring-up (test-side, not app bugs)

- Round-off expectations: `PRE-001` total is exactly whole-rupees (round-off 0, not −0.50), and `PRE-002` raw 472.50 rounds **up** to 473.00 — mobile deliberately follows the frontend's JS `Math.round` half-up semantics; note desktop Python `round()` is banker's rounding (`excel_service.py:1096`), so the rare `.5` paisa case can differ by ₹1 between desktop and mobile. Documented, not "fixed".
- Harness plumbing fixed along the way: expo-sqlite's non-queued transaction callback (emulating it queued caused a BEGIN/COMMIT deadlock), `lastInsertRowId` vs node:sqlite's `lastInsertRowid` spelling, row BigInt/null-prototype normalisation, and an un-awaited `assert.rejects` that crashed the process (unsettled rejection now caught by a harness-level `unhandledRejection` guard).
- `syncNextSeq` test expectation corrected to the implemented no-go-backwards `Math.max` rule (summary §3): deleting the newest invoice must NOT free its number, protecting already-exported PDFs from number reuse.

## Findings / fixes during verification

- `src/app/` folder name triggered Expo Router root detection in Metro (`Using src/app as the root directory for Expo Router`) → renamed to `src/shell/`; message gone, bundle unaffected.
- `expo-print`/`expo-sharing`/`expo-document-picker` are NOT config plugins — listing them in `plugins` breaks config resolution (`PluginError`) → removed; only `expo-sqlite` + `expo-secure-store` stay.
- SDK 58 API differences caught by typecheck: `SQLite.getDatabasePathAsync` doesn't exist (use `db.databasePath`), DocumentPicker result shape is `{canceled, assets}` (SDK 54+), `Directory.create({intermediates:true})` not `intermediateDirectories`, `File.writeSync(Uint8Array)` replaces legacy base64 write.
- Draft-no allocation switched from `COUNT+1` (collides after deletions) to max-suffix-of-last-50, mirroring desktop `draft_repo.get_next_draft_no`.

## Web preview tier (`expo start --web` + browser automation)

Session 2026-10-20 (4): no Android emulator on the host, so the UI itself was exercised in the embedded browser at `http://localhost:8081` (react-native-web 0.21.4, react-dom 19.3, expo-sqlite's built-in wa-sqlite/OPFS web driver — real SQL, real persistence in the browser profile).

Setup required (all committed):
- `npx expo install react-native-web react-dom @expo/metro-runtime`.
- `metro.config.js`: `resolver.assetExts.push('wasm')` — expo-sqlite's web worker imports `wa-sqlite.wasm`; without it Metro fails `Unable to resolve ./wa-sqlite/wa-sqlite.wasm` (per official SQLite web-setup docs).
- `app.config.ts`: `web.headers` COOP `same-origin` + COEP `credentialless` (SharedArrayBuffer for the SQLite worker).
- `src/data/dbKey.ts` + `dbKey.web.ts` (Keystore has no web build → `getKeyHex` returns `null`, `PRAGMA key` skipped) and `db.ts` split into `dbCore.ts` + `db.ts` / `db.web.ts` overrides, because Metro resolves `./db` inside `db.web.ts` back to itself (self require-cycle; console warns `Require cycle: src/data/db.web.ts -> src/data/db.web.ts`). `db.web.ts` drops `withTx` to sequential statements — expo-sqlite web throws `withExclusiveTransactionAsync is not supported on web`.
- `Platform.OS === 'web'` guards: `docsDir` throws Android-only, PDF share → HTML blob download, XLSX → blob download, backup export/restore → explicit error.
- `src/ui/alert.ts` wrapper added and used in all 5 feature screens: **react-native-web's `Alert.alert` is a silent no-op class (`class Alert { static alert() {} }`)**, so every validation/error/confirm dialog would have done nothing on web; the wrapper maps to `window.alert`/`window.confirm` on web and passes through unchanged on Android.

Drive results (browser-use, structural — the embedded panel was hidden so screenshots were unavailable):

| Check | Result |
|---|---|
| App boot: openDb + migrate + getKpis on wa-sqlite/OPFS | PASS — dashboard renders |
| Layout at 894x570 (lg) | PASS — navigation rail (not bottom tabs) as specced |
| Create-invoice 2-pane form + live HTML preview | PASS — totals row updates: subtotal 15,000.00, disc 10% -> taxable 13,500.00, CGST/SGST 337.50 each, total 14,175.00 |
| Issue invoice (allocateInvoiceNo + saveInvoice, no tx) | PASS — PRE-001, dashboard KPIs + recent list + aging update |
| Persistence | PASS — reload keeps invoice; Settings shows Next number PRE-002 |
| Master-detail invoices screen, detail totals + amount-in-words | PASS — "Rupees Fourteen Thousand One Hundred Seventy Five Only" |
| Void lifecycle via confirm (window.confirm mapping) | PASS — list + detail show ✕ Void; payment/edit actions disappear |
| Backup export guard | PASS — dialog text captured: "Backup failed / Backup export is Android-only" |
| Share PDF / Excel taps | PASS without errors (blob downloads fire silently; not visually verifiable in hidden panel) |
| Phone tier (xs/sm bottom tabs, stepper) | NOT REACHABLE — embedded viewport fixed at 894 px; `window.resizeTo` and popups blocked |

Not verified on web (by design): SQLCipher encryption, native PDF engine, Android share sheet, Keystore.

## Not verified (requires hardware / cloud build)

> **Superseded by Prompt 18 (2026-10-21, session 9)** — this host now has the Android SDK/AVD, the
> app builds and runs locally, and the phone tier (bottom tabs, stepper, sheets), SQLCipher open /
> migrate / seed and the XLSX write path have all been exercised on `emulator-5554`. The list below
> is kept as the pre-Prompt-18 state.

- No Android emulator or SDK exists on this host (`adb`/`sdkmanager` absent) — UI rendering, touch targets, breakpoint layouts and navigation were NOT exercised on any device or simulator. Data-layer SQL was covered headlessly instead (integration harness above). To run for real: `npm run android` (`expo run:android`) with Android Studio installed, or sideload via `eas build --profile preview`.
- Actual APK compile (`eas build --profile preview --platform android`) — needs EAS login + release keystore backup by the user (plan §12 risk).
- SQLCipher at-rest encryption (harness mocks `PRAGMA key`; only the key-generation/keystore flow is logic-tested), rotation/split-screen, TalkBack, Metro on a physical device.
- Phone-tier UI (bottom tabs, stepper) and all visual styling — the web preview session ran at lg width only and the in-app browser panel was not visible for screenshots.
- PDF glyph rendering fidelity inside `expo-print` WebView PDF engine; XLSX open-in-Excel verification (buffer generation itself is untested headlessly — exceljs needs the RN polyfill runtime).

## Prompt 5 — 5"/6" display responsiveness audit (session 5)

`useBreakpoint` switches on window width in dp, never physical inches — Android density
normalization means every modern phone reports roughly 320–411dp regardless of size or
panel resolution. Mapping of real device classes to plan §5 tiers:

| Device class | Native px | Density | dp width | Tier (portrait) | Tier (landscape / split-screen) |
| --- | --- | --- | --- | --- | --- |
| 5" 720p / FHD | 720–1080 | 1.5–3.0 | 360 | sm | xs |
| 5.5–6" FHD | 1080 | 2.75–3.0 | 393 | sm | xs |
| 6" QHD | 1440 | 4.0 | 360 | sm | xs |
| 6.5" FHD+ | 1080 | 2.6 | 411 | sm | xs |
| Legacy small (320dp) | — | — | 320 | xs | xs |

Phone tiers use flex layouts, 48dp touch targets and a 720dp reading cap, so all
5–6" phones land on the sm phone layout (bottom tabs, single pane, stepper).

**Caveat:** the browser pass only visually exercised lg (894dp); sm/xs tiers are
verified by construction (code review of useBreakpoint/tokens + App shell branching),
not by screenshot. 320dp under 130–200% Android font scaling is hardware-test territory.

## Prompt 6 — First real APK via EAS cloud build (session 5)

Host has no JDK/Android SDK, so building used **EAS remote builders** (`eas-cli` installed globally).

Setup steps:
1. `eas init` created/linked EAS project **@jiametrics-team/invoice-erp** (ID `21ed0c0e-a3a6-4bc5-8ac0-f4adfedd5280`).
   `eas init` cannot write to a dynamic `app.config.ts`, so `extra.eas.projectId` was added manually.
2. `owner: 'jiametrics-team'` added to app.config.ts so the build resolves against the team, not the
   token's personal robot account (`trap-logger-apk`, Admin role — account-level tokens work across
   all team projects; project-scope would have failed instantly rather than queueing).
3. `android/` stays gitignored → EAS runs `expo prebuild` remotely **with** `EAS_BUILD_PROFILE=preview`,
   which is what activates the `blockedPermissions` INTERNET-strip branch in app.config.ts. A locally
   prebuilt android/ dir would have baked INTERNET in.

Build: `eas build --platform android --profile preview` → id `bf6e93bb-5869-4917-a942-8265d751e8c2`,
started 22:42, finished 23:23 IST (~41 min cold build; NDK + SQLCipher source compile for 4 ABIs).

**Post-build verification (real, from the shipped APK):**
- Downloaded to `mobile/build/invoice-erp-preview-v1.0.0.apk` — 92.5 MB, valid ZIP magic.
- Binary `AndroidManifest.xml` parsed from the APK: `android.permission.INTERNET` → **absent**,
  `ACCESS_NETWORK_STATE` → **absent**; only declared permission is `android.permission.USE_BIOMETRIC`.
  Plan §12 offline guarantee confirmed in a production-profile artifact for the first time.

Install: EAS build page link / QR (preview profile = standalone APK, no Expo Go needed).
Unsigned with debug-ish cert from EAS — sideload only; Play Store needs `production` profile + upload key.

## Prompt 13 — U2 theme + I1 icons applied (session 6)

User picked **U2 (JIAMETRIC brand)** + **I1 (hairline Ionicons)** from the rendered option sheet
(U2 revised mid-review: left accent rail removed from cards per user feedback).

Changes:
- `src/ui/tokens.ts` — Theme gains `accent/accentDeep/accentSoft/accentOn/headerFrom/headerTo`;
  light = house palette (bg #F2F7FB, fillStrong #2596BE, navy #0C476F), dark = midnight-navy twin
  (bg #0C1520, accent #5BC1DA). `status` entries: `glyph` → Ionicons `icon` names
  (draft ellipse-outline, issued time-outline, partial **contrast-outline** — pie-outline doesn't
  exist in Ionicons; paid checkmark-circle, void close-circle-outline).
- `src/ui/Nav.tsx` — TABS use `icon`/`iconActive` (outline → filled when active), Ionicons 22/24px,
  active tint = theme.accent; Rail active bg = accentSoft; FAB = "add" icon on brand blue.
- `src/ui/components.tsx` — new `HeaderBand` (LinearGradient headerFrom→headerTo, white title);
  `StatusGlyph` renders Ionicons+label; `MoneyText strong` = accentDeep; `Button` gains `labelStyle`.
- Screens: Dashboard + Settings(phone) + App.tsx invoice-detail overlay now use HeaderBand above
  their ScrollViews; Dashboard KPI numerals → accentDeep.
- Deps: `expo install expo-linear-gradient @expo/vector-icons`.

Verification: tsc clean; 12/12 integration PASS; `expo export --platform web` OK; live browser pass —
gradient band computed as `linear-gradient(135deg, rgb(37,150,190), rgb(91,193,218))`, ionicons font
`loaded`, active tab rgb(37,150,190), Settings band + status rows confirmed. Phone-tier caveat
unchanged (verified at lg width only).

## Prompt 14 — GST + Clients removal (schema v2, session 7)

Scope decisions (user-approved via AskUserQuestion): free-text party snapshot replaces the
Clients module; clean rebuild (v1 DB wiped on version mismatch — only test data existed).
Kept-vs-dropped judgment calls: **company PAN kept** in Settings (income-tax ID, not GST),
**party PAN dropped**, **rupee round-off kept** (cash convention, not a GST artefact),
HSN/GSTIN/state codes/tax_type/taxable/CGST-SGST-IGST removed everywhere.

Code touched (all verified below):
- Data layer: `schema.ts` (SCHEMA_VERSION 2, `clients` table gone, invoices/items/payments/
  invoice_items trimmed as per TRACKING v2), `dbCore.ts` migrate → child-first DROP loop
  (incl. legacy `clients`) + recreate in one transaction, `types.ts`, `money.ts`
  (`computeTotals(lines, discountPercent)` → `{gross, discount, net, roundOff, total}`;
  `taxTypeForState`/GST_BP deleted), `invoicesRepo` (22-col INSERT), `dashboardRepo`
  (KPIs = count + billed only), `settingsRepo`/`itemsRepo`/`paymentsRepo`/`auditRepo`
  (`client.upsert` action removed). **Deleted:** `clientsRepo.ts`, `features/clients/`.
- UI: `Nav.tsx` 4 tabs (people-outline row removed), `App.tsx` clients case removed,
  `CreateInvoiceScreen.tsx` full rewrite (no client picker/catalog HSN/tax chips; stepper
  Party→Items→Review; "Party required" validation), `InvoiceDetail.tsx` (no client_id in
  payment; header/item columns fixed; totals Gross/Discount/Round off/TOTAL),
  `SettingsScreen.tsx` (State code/GSTIN inputs gone), `ItemsScreen.tsx` (HSN field gone).
- Exports: `pdfTemplate.ts` 7-col line table, no GSTIN/tax summary; `xlsx.ts` register
  columns Party/Round Off/Total, HSN columns removed from register+items sheets.
- Tests: `run-money-tests.mjs` rewritten (plain totals / discount+round-off / full-discount
  collapse / words / formatting); `run-integration-tests.mjs` rewritten for v2 incl. a new
  **schema-guard test** asserting `clients` is absent from `sqlite_master` and no banned
  column (tax_type, *_bp, taxable, hsn, gstin, state_code, client_id, party_pan) survives
  in `PRAGMA table_info(invoices)`.

Results:
| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | PASS — clean |
| `npm run test:money` | **7/7 PASS** (e.g. 69,650 − 10% → net 62,685 → total 62,700, round-off +15 paise) |
| `npm run test:integration` | **12/12 PASS** — incl. `user_version=2`, schema-guard test, invoice #1 gross 1,54,000 − 10% = 1,38,60.00 exact (round-off 0), invoice #2 47.25 → 47.00 round-off **−0.25**, payments partial→paid via party_name + CSV, void/KPI delete/syncNextSeq/audit scenarios |
| Live web E2E (browser-use, `expo start --web`) | PASS — boot detected v1 OPFS DB and **wiped to v2** (empty dashboard); 4-tab nav; created PRE-001 free-text party → issue ₹201.00 with round-off math shown in preview HTML; InvoiceDetail/Items/Settings render clean |
| Banned-word DOM scan (GST, CGST, SGST, IGST, HSN, GSTIN, taxable, client) across every screen | PASS — zero hits |

Residual mentions, intentional: `schema.ts` header note and the `dbCore.ts` wipe comment
(document the removal), and the `clients` entry in the DROP list (needed to clear legacy DBs).

Not re-verified this session (unchanged hardware gaps): phone-tier visuals, SQLCipher at-rest,
native PDF, backup restore on device. APK on store still predates Prompt 13/14 — rebuild offered.

## Prompt 15 — Items → Products rename (schema v3, session 8)

Scope (user-approved via AskUserQuestion): one row per **Name+Size**, **Sold auto from
non-void invoice lines** (Avl = Stock − Sold, computed live), **style_code dropped completely**.
Products table columns are exactly Name / Size / Price / Stock / Sold / Avl-Stock.

Code touched:
- Data layer: `schema.ts` (SCHEMA_VERSION 3; `products` replaces `items` with
  `uq_products_name_size` UNIQUE NOCASE index; `invoice_items` swaps style_code/uom for
  nullable `product_id REFERENCES products(id)` + `idx_invoice_items_product`;
  `PRODUCT_SEED_NAMES`/`PRODUCT_SIZES`/`productSeedSql()` = 60 idempotent seed rows),
  `dbCore.ts` (seed inside `createSchema`; DROP list `items`→`products`+legacy `items`;
  **user_version lie probe**: version==3 but `products` missing from `sqlite_master` ⇒
  forced child-first rebuild; migrate failures `console.error`-ed, never swallowed),
  `types.ts` (Item→Product/ProductRow with computed sold/avl; InvoiceLine gains product_id),
  **`productsRepo.ts` new** (SOLD_SQL correlated subquery, listProducts/getProduct/
  upsertProduct/deleteProduct-nulls-references, `ensureSeeded` count-based self-heal),
  `invoicesRepo.ts` (line INSERT carries product_id), `auditRepo.ts`
  (`item.upsert`→`product.upsert`). **Deleted:** `itemsRepo.ts`, `features/items/`.
- UI: `Nav.tsx` products tab (pricetags icons), `App.tsx` case, **`ProductsScreen.tsx` new**
  (6-col header NAME/SIZE/PRICE/STOCK/SOLD/AVL ≥md, phone row "size · Stock · Sold",
  negative Avl in accentDeep, name Quick-pick + Size chips, Sold caption),
  `CreateInvoiceScreen.tsx` (stepper Party→Products→Review, catalog adds
  `description = "Name - Size"` + product_id, Avl captions, "Product catalog" sheet),
  `InvoiceDetail.tsx` (style_code caption removed).
- Exports: `pdfTemplate.ts` line table 5 cols (#/ITEM/QTY/RATE/AMOUNT); `xlsx.ts`
  All_Line_Items Item-only columns, `exportItemsXlsx`→`exportProductsXlsx`
  (Name/Size/Price/Stock/Sold/Avl-Stock sheet).
- Tests: money fixtures re-keyed to `product_id`; integration suite extended — seed count
  test, product CRUD on seeded "Hoodie · L" + UNIQUE collision on fresh insert,
  sold/avl math incl. oversell negative and void exclusion, `product.upsert` audit action.

Results:
| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | PASS — clean |
| `npm run test:money` | **7/7 PASS** |
| `npm run test:integration` | **14/14 PASS** — user_version=3, schema-guard (no items/clients tables), 60-row seed, sold 75→void→50 with avl −10 oversell, next_seq never regresses |
| Web preview E2E | PASS — after the v3 bundle initially threw **`no such table: products`** while OPFS reported `user_version=3` (migration whose DDL never landed), the new version-lie probe forced a rebuild: Products tab renders all 60 seeded rows (Name + "size · Stock · Sold" + Price/Avl), console clean on re-boot, migrate quiet |
| Live write/issue flow in preview | not driven — RNW Pressable ignores synthetic pointer events in browser-use (Save/+New never fire); covered by the 14/14 headless harness running the identical `dbCore`/repos code paths |

Residual notes: ProductsScreen Quick-pick chips save the 12 canonical names and therefore also
seed the DB — intentional. The `items` entry stays in the DROP list to clear legacy DBs.
APK predates Prompts 13–15; rebuild with schema v3 available on request.

## Prompt 16 — Restock ledger (schema v4, session 8)

Asked "How to Add Stocks and Add Restock Option also" — answered (Stock today = editor field
overwrite) and built the missing feature per AskUserQuestion: ＋Restock per product **and**
full history (new `restocks` ledger table).

Design: `products.stock_qty` remains the running balance; every movement appends a row —
`kind='restock'` (Add to Stock action, optional re-price, note) or `kind='edit'` (editor
Stock overwrite logged as ±delta; new products with non-zero opening stock also logged).
Invariant **Stock = Σ delta** is asserted in the harness. `ON DELETE CASCADE` clears a
deleted product's history. Sold/Avl untouched — Avl reflects restocks instantly.

Code touched:
- `schema.ts`: SCHEMA_VERSION 4, `restocks` table + `idx_restocks_product`, header comment.
- `dbCore.ts`: `restocks` in the child-first DROP list; version-lie probe now requires both
  `products` and `restocks` in `sqlite_master`.
- `types.ts`: `Restock` interface. `productsRepo.ts`: `restockProduct(id, qty, newPricePaise, note)`
  (atomic UPDATE balance + ledger INSERT inside one `withTx`, returns fresh ProductRow),
  `listRestocks(productId, limit=50)` newest-first, ledger writes in `upsertProduct` edit and
  insert paths. `auditRepo.ts`: `product.restock` action.
- `ProductsScreen.tsx`: Restock button in the editor action row → restock panel (Qty to add,
  optional New price ₹ with decimals allowed and "Keep current" placeholder, Note) →
  Add to Stock validates qty>0, applies, audits, refreshes draft/history/list without closing
  the editor; **Stock history** block under the editor; Sheet + lg-pane titles switch to
  "Restock product"; editId change resets mode/history in `startEdit`.
- Action placed in the editor (not the list rows) to avoid nested-Pressable double-fire on RNW.
- `run-integration-tests.mjs`: user_version 4, schema-guard asserts `restocks`, new test
  'restock adds to balance, re-prices, and writes ledger history' (50+10 receipt, price kept
  on blank, editor −5 edit row, Σ-delta equals stock, cascade on delete).

Results:
| Check | Result |
|---|---|
| `npx tsc --noEmit` (strict) | PASS — clean |
| `npm run test:money` | **7/7 PASS** |
| `npm run test:integration` | **15/15 PASS** (incl. new restock-ledger test) |
| Web preview boot | PASS — v3 OPFS DB auto-rebuilt to v4, 60-row seed renders, console clean, no migrate warnings |
| Live restock tap-through | not driven — synthetic dispatch and uid-clicks are both blocked in auto mode this session; restock flows proven by the harness instead |

Not re-verified: phone-tier look of the restock panel; native transactional atomicity (web tier
has no transactions — statements run in order; Android wraps them in one exclusive tx).

## Prompt 17 — Relocation to standalone folder (2026-10-21, session 8)

Moved the Expo app out of the workspace: `digital-invoice\mobile\` → `Barathy-Invoive-App\MOBILE-APP\`
(rename on same volume; node_modules intact). Dev server on :8081 (PID 13384) had to be killed first
(user-confirmed; Metro's watch handles blocked the rename). Copies of the three
`MOBILE_APP_CONVERSION` docs and `invoice-app-plan.md` were placed inside `MOBILE-APP\`
(`MOBILE_APP_CONVERSION\` subfolder + plan at its root) — originals remain in this workspace per
AGENTS.md. README + TRACKING headers re-pointed to the new path.

Post-move verification from `MOBILE-APP\`: `npx tsc --noEmit` clean, money 7/7, integration 15/15,
`npx expo start --web` restarted from the new location (browser check follows below).

## Prompt 18 — Local Android build + on-device E2E (2026-10-21, session 9)

User chose **"Local build via emulator toolchain"** over a second EAS cloud build, so the whole
native Android pipeline now runs on this host for the first time.

### Toolchain resolved

| Piece | Value |
| --- | --- |
| Android SDK | `C:\Users\admin\AppData\Local\Android\Sdk` (platform-tools, platforms;android-37.x, build-tools) |
| JDK | `C:\Program Files\Android\Android Studio\jbr` — openjdk 25.0.3, works with Gradle 9.4.1 |
| NDK / CMake | 27.1.12297006 / 3.22.1 (+ 3.31.6 installed as part of the ninja fix below) |
| AVD | `Medium_Phone_API_37.0` — 1080×2400, x86_64, Google Play image (`emulator -list-avds` is the only reliable way to get the name; `Medium_Phone` fails) |
| Gradle | `expo prebuild` → `android/gradlew assembleDebug` / `assembleRelease` |

### Re-apply after every `expo prebuild`

`prebuild` regenerates `android/`, so these local edits are lost and must be re-written each time:

1. `android/gradle.properties:37` → `reactNativeArchitectures=x86_64` (debug link step otherwise
   builds arm64-v8a too and takes ~24 min for no benefit on an x86_64 emulator).
2. `android/gradle.properties:79` → `expo.sqlite.useSQLCipher=true` (without it expo-sqlite links
   plain SQLite and the encrypted-DB path silently degrades).
3. `android/local.properties` → `sdk.dir=C:/Users/admin/AppData/Local/Android/Sdk` (forward slashes).

### Blocker found and fixed — ninja MAX_PATH

First `assembleDebug` died at `:app:buildCMakeDebug[x86_64]` after 23 m 48 s:

```
ninja: error: Stat(...RNCSafeAreaViewShadowNode.cpp.o): Filename longer than 260 characters
```

`LongPathsEnabled=1` is already set in the registry, but ninja 1.10.2 (shipped inside
`cmake\3.22.1\bin`) has its own 260-char guard. CMake mangles the absolute source path into the
`.o` name, and the deep `node_modules` path under `Desktop\WIP\...` pushes it over.

* Attempt 1 — `subst W: <app root>` to shorten the path. **Failed differently:**
  `settings.gradle:32 expoAutolinking.useExpoModules()` →
  `Couldn't find "package.json" up from path "W:\android"` — Expo's `findPackageJsonPathAsync`
  walk-up never checks the drive root. Reverted.
* Attempt 2 (the fix) — install `cmake;3.31.6` through sdkmanager and copy its ninja 1.12.1 over
  `cmake\3.22.1\bin\ninja.exe` (original kept as `ninja.exe.1.10.2.orig`). Rebuild from the real
  path: **BUILD SUCCESSFUL in 33 s**.

A stale EAS-signed APK on the AVD also blocked install (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`);
`adb uninstall com.jiametric.invoiceerp` cleared it.

### On-device verification (debug build, schema v4, real SQLite+SQLCipher)

Driven with `adb shell input` + `uiautomator dump` on `emulator-5554`.

| Step | Result |
| --- | --- |
| Cold boot, DB open → migrate → seed | PASS — 60 seeded products render |
| Products → row → editor sheet → **Restock** +50 @ ₹250, note `Lot-A` | PASS — row becomes `L · Stock 50 · Sold 0 · ₹250.00 · Avl 50`; history row `2026-10-21 08:02:09 · Restock +50 → Stock 50 · Lot-A` |
| New invoice wizard 1/3 Party (Preethyaga / Coimbatore / 641001 / 9876543210) | PASS |
| 2/3 Products → catalog pick → qty 5 @ 250 | PASS — line amount `1,250.00` (Indian grouping) |
| 3/3 Review → Issue | PASS — native dialog `Invoice issued / PRE-001 for ₹1,250.00`; list row `PRE-001 · 21 Oct 26 · Issued` |
| Stock invariant after invoice | PASS — `Stock 50 · Sold 5 · Avl 45` |
| Invoice detail | PASS — totals, `Rupees One Thousand Two Hundred Fifty Only`, actions |
| Record payment ₹500 UPI | PASS — status `Issued` → `Partial`, `Paid 500.00` |
| Dashboard after payment | PASS — Invoices (FY) `1`, Total Sales Billed `₹ 1,250.00`, aging `PRE-001 — Preethyaga · 04 Nov 26 · 750.00` |
| Products → Excel | PASS — Android share sheet offers `products_<ts>.xlsx` |

### Bugs the device found (both fixed)

1. **Dead "Products" button on phones.** `CreateInvoiceScreen` returns early for `bp.isPhone` and
   that branch never rendered `<CatalogSheet>` — only the tablet/desktop branches did, so tapping
   Products set `catalogOpen` with nothing in the tree. Fixed by hoisting the element into a
   `catalogSheet` const rendered from both layouts
   ([src/features/invoices/CreateInvoiceScreen.tsx:413](file:///c:/Users/admin/Desktop/WIP/Barathy-Invoive-App/MOBILE-APP/src/features/invoices/CreateInvoiceScreen.tsx#L413)).
2. **`RangeError: Maximum call stack size exceeded` flood on every boot.** Root cause pinned by
   dumping the dev bundle and reading the repeating frames (`B:152604/152607/152612/152637/152638`):
   that is **core-js's Promise polyfill inlined inside `exceljs/dist/exceljs.min.js`** (metro picks
   the `browser` field), re-entering itself under Hermes whenever expo's dev-only
   `withDevTools` → `useKeepAwake` → `activateKeepAwakeAsync` chain runs. A resolver-level
   `core-js` stub cannot help — the polyfill is vendored inside the bundle. Fixed by taking
   exceljs out of the startup graph: `src/export/xlsx.ts` now type-imports it and `require`s it
   lazily in `excelJs()`. Cold boot afterwards: **0 RangeErrors**. Residual (accepted): loading a
   workbook re-installs the patched `then`, so a dev-only LogBox banner can appear after an Excel
   export — the restock performed right after an export still wrote correctly (Stock 50 → 60).
   **This "dev-only" read was wrong — see Prompt 19: the same poisoning breaks the release build,
   and exceljs has since been removed from the project entirely.**

### Emulator driving notes (Windows / Git Bash)

* `export MSYS2_ARG_CONV_EXCL="*"` before any `adb` call with a device path, otherwise
  `uiautomator dump /sdcard/ui.xml` silently writes to `C:\Program Files\Git\sdcard\ui.xml`.
* Screenshots: `adb exec-out screencap -p > "$TEMP/x.png"`; the Read tool needs the Windows form
  `C:\Users\admin\AppData\Local\Temp\x.png`.
* Gboard on the Play image throws a **"Try out your stylus"** overlay that swallows
  `adb shell input text`; dismiss it once with a tap on its *Cancel* (device coords, not
  screenshot coords — the PNG is downscaled 0.833×) and typing works normally afterwards.
* `input text` has no space support in practice here — type `Lot-A`, not `Lot A`.
* `keyevent 111` (ESC) closes a `Sheet` modal entirely, not just the keyboard.
* The phone invoice-detail overlay covers the bottom tab bar; use its `←` header button first.

## Prompt 19 — Release build, the real Excel failure, exceljs removed (2026-10-21, session 9)

### Release APK on the host toolchain

`./android/gradlew -p android assembleRelease` died after 6 m 28 s on
`:app:lintVitalAnalyzeRelease → java.lang.OutOfMemoryError: Metaspace`. Lint adds nothing to a
local test build, so the working command is:

```
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export ANDROID_HOME="/c/Users/admin/AppData/Local/Android/Sdk"
./android/gradlew -p android assembleRelease -x lintVitalAnalyzeRelease -x lintVitalRelease
```

→ BUILD SUCCESSFUL in 17 s, `app-release.apk` 33.66 MB, `assets/index.android.bundle` 2.04 MB.
Installed over the debug build with `adb install -r -g` (same debug signing config, so the
Keystore-bound SQLCipher key and the existing DB survived).

### Excel export is broken in release, not just dev

Prompt 18 blamed the core-js `Promise.prototype.then` wrapper for a *dev-only* LogBox flood and
"fixed" it by lazy-requiring exceljs plus restoring the native `then`/`finally` after the load.
On-device measurement shows both halves were wrong:

| Configuration | `wb.xlsx.writeBuffer()` outcome |
| --- | --- |
| exceljs lazy-required, native `then` restored | never resolves; PSS `280 MB → 5.17 GB` in 20 s, then `am_low_memory` + SIGKILL (`Process … has died: fg TOP`), with **zero** logcat output from the app pid |
| exceljs lazy-required, core-js `then` left patched | resolves in 270 ms and the file is written, but every promise created afterwards rejects — 30 × `RangeError: Maximum call stack size exceeded (native stack depth)` — and the share sheet never appears |

PSS samples taken 2 s apart from the tap (debug build, 60-row products table):

```
t=2s 280 MB · t=4s 292 MB · t=6s 1994 MB · t=8s 3149 MB · t=10s 3559 MB
t=14s 4164 MB · t=18s 4972 MB · t=20s 5176 MB · t=22s (process gone)
```

The `XDBG` trace localises it exactly: `start → db → exceljs loaded → rows built, writeBuffer`
and then nothing. So loading exceljs is cheap, building rows is cheap, and only its async writer
misbehaves — the browser bundle's vendored core-js and exceljs's stream pipeline cannot coexist
with Hermes' native Promise.

### Fix: no exceljs at all

`src/export/xlsxWriter.ts` (new, ~230 lines, zero dependencies) writes the OOXML parts itself and
packs them into a **stored** (uncompressed) ZIP with a hand-rolled CRC32. It is synchronous on
purpose: with no promises in the path, the whole class of polyfill poisoning cannot recur.

* Sheets, column widths, bold + frozen header row, `#,##0.00` right-aligned money style
  (`cellXfs` index 2), inline strings (no `sharedStrings` part needed), XML escaping including
  control-character stripping.
* `src/export/xlsx.ts` keeps its three public functions and now maps rows straight into
  `XlsxSheet` objects; `saveXlsx()` replaces `saveWorkbook()`.
* `metro.config.js`: the `browser`/`require` condition override and the `stream` →
  `readable-stream` aliases were exceljs-only and are gone; only the `wasm` asset ext remains.
* `exceljs` and `readable-stream` removed from `package.json`; `npm install` pruned 203 packages.
* `npm run test:xlsx` (new, `scripts/run-xlsx-tests.mjs`) compiles the writer with `tsc
  --ignoreConfig`, then asserts the ZIP layout (local/central/EOCD offsets, stored method,
  `zlib.crc32` per part), the escaping, the styles and the relationship ids.

### Second bug found by the same flow: `docsDir()` was one-shot

`Directory.create()` throws `Unable to create file or directory: it already exists` unless it is
idempotent, so **every** export, PDF and backup after the first one per install failed — the
`Exports/`, `Invoices/` and `Backups/` folders already existed by the time the second tap
happened. Fixed in the shared helper `src/export/pdf.ts:14` with
`dir.create({ intermediates: true, idempotent: true })`, plus `file.create({ overwrite: true })`
in `saveXlsx`. This predates the mobile port's export feature and applied to all three writers.

### On-device verification (release build, no Metro)

| Step | Result |
| --- | --- |
| Cold boot from `assets` bundle, existing encrypted DB | PASS — Dashboard renders, 0 RangeErrors |
| Products → Excel | PASS — share sheet `Sharing 1 file · products_<ts>.xlsx`; app alive; **PSS 83.9 MB** (was 5.17 GB); 0 RangeErrors |
| Repeat Excel taps | PASS — new file each time (proves the `docsDir` fix) |
| Invoices → Excel list with 0 invoices | PASS — empty single-sheet workbook shares cleanly |
| Settings → Backup → Export backup | PASS — `invoices_<ts>.db` share sheet, with `Backups/` already populated by the 14:13 auto-backup |
| `openpyxl` on the device-produced file | PASS — sheet `Products`, `A1:F61`, `('Acid Wash T-Shirt','L',0,0,0,0)`, `C2` format `#,##0.00`, `A1` bold, freeze `A2`, column A width 30 |
| `openpyxl` on the 2-sheet probe from `npm run test:xlsx` | PASS with warnings-as-errors — `['Products','Invoices_Register']`, escaping round-trips `Acid Wash <T>&"X"` |

Bundle content check on the release APK: `numFmtId` and `Invoices_Register` present, `ExcelJS`
absent.

Removing the exceljs-only Metro aliases was validated by `npx expo export --platform web`: the web
bundle still builds (1.3 MB, `wa-sqlite.wasm` resolved as an asset). The browser-side *download* of
a workbook from the new writer has not been re-driven in the web preview tier — the bytes it hands
`webBlobDownload` are the same ones `openpyxl` accepted above.

## Prompt 20 — Run on local emulator (2026-10-22, session 10)

No code changes. Installed APK on `Medium_Phone_API_37.0` was the release build from 2026-10-21
15:00 (`dumpsys` flags lack `DEBUGGABLE`); `find src app.config.ts package.json -newer
app-release.apk` returned nothing, so no rebuild was needed and no Metro server was started.

| Step | Result |
| --- | --- |
| `emulator -avd Medium_Phone_API_37.0 -gpu auto` | FAIL — qemu crashed into the crash-consent dialog; log shows `Failed to import external memory object with error: 1281` (NVIDIA RTX 3050, Vulkan gfxstream) and `adb protocol fault`; `adb devices` empty |
| `emulator ... -gpu swiftshader_indirect -no-snapshot-load` | PASS — `sys.boot_completed=1`, `emulator-5554 device` |
| `monkey -p com.jiametric.invoiceerp` launch | PASS — `ReactNativeJS: Running "main"`, no `AndroidRuntime` errors; Dashboard renders (FY 2026–27, 0 invoices, ₹ 0.00, bottom tabs Home/Invoices/Products/Settings) |

## Prompt 21 — Material Design 3 UI pass (2026-10-22, session 10)

No installed skill targets Android/Material UI (the available ones cover docs, slides,
artifacts and browsers), so the pass applies Material Design 3 + Android platform guidance
directly. Audit was done on-device first (before-screenshots of all tabs, Create Invoice,
product editor).

**Root-cause findings from the audit**

| Finding | Evidence | Fix |
| --- | --- | --- |
| System Back exited the app from Create Invoice / Invoice detail / Settings drill-in | Back from "New invoice" dropped to the launcher; the next scripted taps opened Google Calendar | `NavProvider` owns one `hardwareBackPress` listener + LIFO interceptor stack (`useBackIntercept`) |
| Text/fill contrast below AA | primary 3.40:1, header end 2.08:1, muted 3.62:1 (computed) | new colour roles, all ≥ 4.5:1 |
| Pale strip above every header; nav labels under gesture bar | screenshots | edge-to-edge insets in `TopAppBar` / `BottomTabs` |
| Dashboard empty state said "Tap ＋ New" with no such control on phones | screenshot | extended FAB |
| Product rows ~100dp tall, 48dp pill chips, centred modal "sheet", no ripple, no field focus state | screenshots / code | M3 list items, filter chips, bottom sheet, `android_ripple`, focused outline |
| Price fields reformatted `1` → `1.00` while typing | `value={(paise/100).toFixed(2)}` | `MoneyInput` |
| Export failures only reached `finally` (unhandled rejection, no message) | code | `.catch` → error dialog |

**Files changed (MOBILE-APP):** `src/ui/tokens.ts`, `src/ui/components.tsx`, `src/ui/Nav.tsx`,
`src/ui/Sheet.tsx`, `src/ui/Snackbar.tsx` (new), `src/shell/App.tsx`, `src/shell/navigation.tsx`,
`src/features/dashboard/DashboardScreen.tsx`, `src/features/invoices/{InvoicesScreen,InvoiceDetail,CreateInvoiceScreen}.tsx`,
`src/features/products/ProductsScreen.tsx`, `src/features/settings/SettingsScreen.tsx`. Data layer untouched.

**Verification**

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | PASS (exit 0) |
| `npm run test:money` / `test:xlsx` / `test:integration` | PASS / PASS / PASS |
| `gradlew assembleRelease -x lintVitalAnalyzeRelease -x lintVitalRelease` | BUILD SUCCESSFUL in 46s; `adb install -r` Success (DB kept) |
| Home / Invoices / Products / Settings render (light) | PASS — gradient under status bar, indicator pill, FABs, search bars, chips, Avl badges |
| Create Invoice: field focus, stepper, "Add from products" bottom sheet | PASS |
| Back: sheet closes → Items→Bill to → leave + "Saved to drafts" snackbar | PASS |
| Back: Drafts → Settings → Home → launcher (`mCurrentFocus` = NexusLauncher) | PASS |
| Drafts: delete via trash icon → dialog → "Draft deleted" snackbar (test draft removed again) | PASS |
| Snackbar vs FAB overlap | FAIL on first build → offset raised to nav bar + 72dp → PASS |
| Dark mode, cold start | PASS — all roles render; live switch while running does not re-theme (known limitation) |
| `ReactNativeJS:E` / `AndroidRuntime:E` in logcat | none |

Not exercised on device this pass: issuing a real invoice / payment sheet submit (avoided writing
business data into the user's database), tablet breakpoints (no tablet AVD running), web tier.

## Prompt 22 — MOBILE-APP as a portable standalone folder (2026-10-22, session 11)

`MOBILE-APP/` already held the complete updated app; this pass makes it safe to copy elsewhere.

**Root-cause finding:** generated native caches record the folder's absolute path:
`android/app/.cxx/**/cache-v2-*.json` and `hash_key.txt` contain `...\Barathy-Invoive-App\MOBILE-APP`,
and `node_modules/{expo-modules-core,expo-sqlite}/android/.cxx` + 7 `node_modules/*/android/build`
trees do the same. A copied folder carrying them fails CMake re-configure.

**Added to MOBILE-APP:** `README.md` (standalone setup / run / build / move guide),
`release/InvoiceERP-1.0.0-release.apk` (latest Prompt 21 build, x86_64 only),
`scripts/clean-native-caches.ps1` (removes the path-bound caches + stops the Gradle daemon;
auto-sets `JAVA_HOME` to Android Studio's `jbr`).

**Verification: copy → clean → build → run from a new location**

| Step | Result |
| --- | --- |
| `robocopy MOBILE-APP C:\Users\admin\Desktop\MOBILE-APP-movetest /E` (incl. node_modules) | 2.43 GB copied |
| `clean-native-caches.ps1` in the copy | removed 15 cache dirs. First run printed a Gradle `JAVA_HOME is not set` error from the daemon-stop step → script fixed → clean rerun silent |
| `tsc --noEmit`, `test:money`, `test:xlsx`, `test:integration` in the copy | PASS ×4 |
| `gradlew assembleRelease -x lintVitalAnalyzeRelease -x lintVitalRelease` in the copy | BUILD SUCCESSFUL in 2m 12s, 365/365 tasks executed (full native rebuild) |
| `adb install -r` that APK → launch | Success; `ReactNativeJS: Running "main"`, no `AndroidRuntime` errors; Products renders with existing 60-row DB (Keystore key + data kept) |
| Test copy deleted afterwards | removed |

Note: the emulator had exited with the previous session; restarted with `-gpu swiftshader_indirect`.
The release APK is x86_64-only (`reactNativeArchitectures=x86_64`) and will not install on arm64
phones; README documents the switch to `arm64-v8a,x86_64`.

## Prompts 23–24 — EAS cloud preview APK (2026-10-22, session 12)

**Root-cause finding before building:** since Prompt 18 a local `android/` exists and the root
`.gitignore` no longer excludes it. EAS would have uploaded it and skipped remote `expo prebuild`,
shipping the emulator tuning (`reactNativeArchitectures=x86_64` → no arm64, so it would not install on phones)
and a manifest prebuilt without `EAS_BUILD_PROFILE` (INTERNET not stripped). Fix: new
`MOBILE-APP/.easignore` excluding `/android`, `/ios`, `/release`, `/build`, `/dist`, caches.

Login: the CLI had no session (website sign-in does not log in `eas-cli`); `npx eas-cli login`
browser flow completed by the user in Terminal tab → `jiametric` (Owner of `jiametrics-team`).

| Step | Result |
| --- | --- |
| `eas build --platform android --profile preview --non-interactive` | upload 1.1 MB (android/ excluded ✔), remote keystore `XunsAMGKSH`; build `88968e4d-e1ff-406e-a496-3dc8810852b9` finished 13:04 → 13:19 (15 min) |
| Artifact | [https://expo.dev/artifacts/eas/yYuS1S1IX1SEI-XuMaahxAoX6ETL3hWKj7TFcC5EbHg.apk](https://expo.dev/artifacts/eas/yYuS1S1IX1SEI-XuMaahxAoX6ETL3hWKj7TFcC5EbHg.apk) → `MOBILE-APP/release/InvoiceERP-1.0.0-eas-preview.apk`, 98.3 MB, sha256 `39d9d85c6945835b…` |
| `aapt dump permissions` | **no `INTERNET`, no `ACCESS_NETWORK_STATE`** ✔. Present: READ/WRITE_EXTERNAL_STORAGE (maxSdk 32), USE_BIOMETRIC, USE_FINGERPRINT, VIBRATE, SYSTEM_ALERT_WINDOW (special-access, never auto-granted; contributed by a dependency manifest — candidate for a later `blockedPermissions` entry) |
| ABIs | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` ✔ |
| Bundle is today's code (commit shown by EAS is the initial `51a8ad6`; working tree was uploaded) | `index.android.bundle` contains "Saved to drafts", "Add from products", "Navigate up", "Backup & restore" ✔ |
| SQLCipher native | `libcrypto.so` for all 4 ABIs ✔ |
| Signing | EAS cert SHA-256 `cd7a17f8…` ≠ local Gradle debug cert `fac61745…` → cannot `adb install -r` over the emulator build without uninstall (data loss); **not installed on the emulator**. Upgrades in place over the 2026-10-20 EAS build (same EAS keystore). |

Build page / QR for phones: https://expo.dev/accounts/jiametrics-team/projects/invoice-erp/builds/88968e4d-e1ff-406e-a496-3dc8810852b9

## Prompt 25 — "Phone APK and emulator look different" → builds made identifiable (2026-10-22, session 12)

User report (via question): Expo APK installed on **their Android phone** shows the **old design**.

**Investigation: the two APKs are the same app**

| Check | EAS `88968e4d` APK | Local Gradle APK |
| --- | --- | --- |
| `assets/index.android.bundle` sha256 | `fc99d12c69dff21e` | `fc99d12c69dff21e` (identical) |
| Resource file list (excl. lib/, META-INF) | — | identical (`diff` empty) |
| badging: package / version / label / icon / min-target SDK | `1.0.0 (1)`, "Invoice ERP", `res/BW.xml`, 24/36 | identical |
| Manifest theme / configChanges / softInput | — | identical |
| Signing cert | `cd7a17f8…` | `fac61745…` |

Old 2026-10-20 EAS APK (`build/invoice-erp-preview-v1.0.0.apk`) is also `1.0.0 (1)` signed `cd7a17f8…`.
**Root cause:** the phone was still running the 2026-10-20 pre-redesign build. All Expo builds carried
the same `1.0.0 / versionCode 1` and nothing in-app showed the version, so a stale install (old
download reused, old build's QR, or a cancelled installer) could not be told apart from the new one.

**Fix**
- `app-version.json` (`1.0.1` / `2`) is the single version source: `app.config.ts` → `version` + `android.versionCode`; `android/app/build.gradle` set to match for local builds.
- Settings shows "Invoice ERP 1.0.1 (build 2)" (phone list footer + tablet side list).
- `release/` cleaned to two unambiguous files; 1.0.0 APKs removed.

| Verification | Result |
| --- | --- |
| `npx expo config` (and with `EAS_BUILD_PROFILE=preview`) | version `1.0.1`, versionCode `2`; blockedPermissions INTERNET + ACCESS_NETWORK_STATE |
| `tsc --noEmit`, `test:money`, `test:xlsx`, `test:integration` | PASS ×4 |
| Local `assembleRelease` | BUILD SUCCESSFUL in 1m 39s → `release/InvoiceERP-1.0.1-emulator-x86_64.apk`; `adb install -r` Success; `dumpsys` versionCode=2 versionName=1.0.1; Settings footer renders "Invoice ERP 1.0.1 (build 2)" |
| EAS `16f1ce76-a3cf-4f43-b240-67bb600276bf` | finished 15:18 (≈7 min), [https://expo.dev/artifacts/eas/cTXLvQlHA8ZnWOHhLl96m_0hpxhwqwuj1GIy5TaeFR4.apk](https://expo.dev/artifacts/eas/cTXLvQlHA8ZnWOHhLl96m_0hpxhwqwuj1GIy5TaeFR4.apk) → `release/InvoiceERP-1.0.1-phone.apk` 98.3 MB |
| Phone APK checks | badging `1.0.1 (2)`; INTERNET / NETWORK_STATE count 0; ABIs arm64-v8a, armeabi-v7a, x86, x86_64; bundle sha256 `d6e711220ca3372f` = emulator APK; cert `cd7a17f8…` (same as earlier EAS builds → in-place upgrade) |

Not verified: the install on the user's physical phone (no device access) — user to confirm Settings shows 1.0.1 (build 2).

## Prompt 26 — Phone still shows the old design after "installing 1.0.1" (2026-10-22, session 12)

User answers: Settings version line "can't find it", difference = "old design", no screenshot.
The 1.0.1 APK's bundle is verified to contain the redesign and the version footer, so the app being
opened on the phone is **not** 1.0.1 (install blocked/cancelled, an old download reused, or a second
copy / Expo Go project). `adb devices -l` listed only `emulator-5554`, so the phone could not be
inspected. Asked the user to check App info → version, look for a second icon / Expo Go, check for
"App not installed" / Play Protect, or connect the phone over USB debugging. Warned that uninstalling
deletes on-device data and the Keystore key (in-app backups then cannot be restored). **Open.**

## Prompt 27 — MOBILE-APP cleaned to the latest (blue / M3) build only (2026-10-22, session 12)

Scope: `MOBILE-APP/` only (the `digital-invoice` desktop Flask app is a separate product, untouched).

| Removed | Why |
| --- | --- |
| `build/invoice-erp-preview-v1.0.0.apk` (93 MB) | 2026-10-20 pre-redesign EAS APK, `1.0.0 (1)`, same signing key as current builds. Likely the file being installed on the phone (Prompt 26) |
| `dist/` (6.9 MB) | 2026-10-21 web export, pre-redesign |
| `.expo/` | Expo dev-server cache (regenerated) |
| `.tmp-xlsx-probe.xlsx` | test artifact; `scripts/run-xlsx-tests.mjs` now writes it to `os.tmpdir()/invoice-erp-xlsx-probe.xlsx` |
| `LICENSE` | create-expo-app template licence (© 650 Industries), not this app's |
| `Divider` in `src/ui/components.tsx` | unused export (0 references) |

Kept: `src/`, `release/` (only the two 1.0.1 APKs), `android/` (+ build caches, needed for fast local builds;
`scripts/clean-native-caches.ps1` clears them), `assets/`, `scripts/`, docs, `invoice-app-plan.md`,
`agents.md`, configs, `node_modules`. `.easignore` still lists `/build` and `/dist` so future outputs never upload.

| Verification | Result |
| --- | --- |
| `tsc --noEmit` | PASS |
| `test:money` / `test:xlsx` / `test:integration` | PASS ×3; probe written to `%TEMP%`; project root unchanged after tests |
| `npx expo export --platform android` (to %TEMP%) | Exported OK |

Root now: `.easignore .git .gitignore MOBILE_APP_CONVERSION README.md agents.md android app-version.json
app.config.ts assets eas.json index.ts invoice-app-plan.md metro.config.js node_modules package-lock.json
package.json release scripts src tsconfig.json`. The release APKs predate the `Divider` removal only
(unused code); no rebuild needed.

## Prompt 28 — "File name too long" when copying MOBILE-APP (2026-10-22, session 12)

**Measured** (`dir /s /b` over the folder, base path 57 chars): 54,958 entries; 13,217 paths > 200;
**4,480 > 240**; longest **412** —
`node_modules\expo-modules-core\android\build\.transforms\<hash>\transformed\bundleLibRuntimeToDirDebug\…\PropertySelector$ActionBuilderForRecord$$InternalSyntheticLambda$2$<64-hex>$0.globals`.
`LongPathsEnabled=1` is set, but Explorer copy ignores it (260 limit). Over-long paths are all
**Gradle outputs written into `node_modules`** by local Android builds (expo-modules-core 6,081,
@expo 1,642, expo 1,449, safe-area-context 1,391, webview 1,202, …).

**Gap found in Prompt 22's cleanup:** it only removed `node_modules/*/android/{build,.cxx}`; nested
Gradle plugin builds (`expo-modules-autolinking/android/expo-gradle-plugin/*/build`,
`expo-modules-core/expo-module-gradle-plugin/build`, `@react-native/gradle-plugin/*/build`, `.gradle`,
`.kotlin`) stayed → 239-char paths. A blanket `build` rule is unsafe: packages ship JS in `build\`
(`@expo/config/build`, `@expo/fingerprint/build`, …).

**Fix**
- `scripts/clean-native-caches.ps1` rewritten: deletes every `.cxx`/`.gradle`/`.kotlin` under
  `android\` and `node_modules\`, and `build\` only when its parent has `build.gradle(.kts)`;
  `-ListOnly` dry run; uses `cmd dir`/`rd \\?\` (first rewrite with .NET `\\?\` enumeration failed on
  Windows PowerShell 5.1: "The path is not of a legal form").
- New `scripts/copy-project.ps1 -Destination <dir> [-FreshInstall]`: robocopy with `/XD` of the exact
  cache folders (from `-ListOnly`), refuses non-empty/self/nested destinations, fails on robocopy ≥ 8 or
  `npm ci` error, reports longest destination path and warns ≥ 260.

| Verification | Result |
| --- | --- |
| First test (copy then clean at destination) | **FAIL** — cleanup threw on PS 5.1; copy script still printed "Done", longest 397 → both scripts fixed (fail-fast, exclude-during-copy) |
| `clean-native-caches.ps1 -ListOnly` on MOBILE-APP | 28 folders, all Gradle; `@expo\config\build` not listed (kept) |
| `copy-project.ps1 -Destination C:\Users\admin\Desktop\MOBILE-APP-copytest` | robocopy OK, skipped 28 cache folders, **longest path 242** (was 412) |
| In the copy: `tsc`, `test:integration` | PASS |
| In the copy: `gradlew assembleRelease …` | BUILD SUCCESSFUL in 1m 56s, 365/365 executed |
| Copy-built APK → emulator | `adb install -r` Success, `Running "main"`, versionName 1.0.1, no errors |
| Test copy removed | PowerShell 7 `Remove-Item -LiteralPath -Recurse -Force` (cmd `rd` was blocked by the tool's path guard) |

## Prompt 29 — Final audit: MOBILE-APP holds only the current (1.0.1, blue M3) version (2026-10-22, session 12)

| Check | Result |
| --- | --- |
| Top level | `.easignore .git .gitignore MOBILE_APP_CONVERSION README.md agents.md android app-version.json app.config.ts assets eas.json index.ts invoice-app-plan.md metro.config.js node_modules package-lock.json package.json release scripts src tsconfig.json` |
| APKs outside node_modules | found stale `android/app/build/outputs/apk/debug/app-debug.apk` (2026-10-21, pre-redesign debug build) → **removed**. Remaining: `release/InvoiceERP-1.0.1-phone.apk`, `release/InvoiceERP-1.0.1-emulator-x86_64.apk`, and Gradle's own output copy of the latter |
| Version strings | `package.json` / `package-lock.json` said `1.0.0` → `npm version 1.0.1 --no-git-tag-version` (both now 1.0.1; app version source remains `app-version.json`) |
| Old-design code refs (`HeaderBand`, `hairline`, `Divider`) in `src/` | none (only the `border.hairline` token) |
| Files dated before the redesign | data layer, exports, configs, tests — unchanged by the UI pass and current; no screen/UI file predates it |

`.git` still contains the original create-expo-app commit (history only, not working files).

## Prompt 30 — Everything mobile consolidated into MOBILE-APP (2026-10-22, session 12)

Inventory of `Barathy-Invoive-App/` outside `MOBILE-APP/`:

| Item | Decision |
| --- | --- |
| `digital-invoice/MOBILE_APP_CONVERSION/` (3 docs) | byte-identical to `MOBILE-APP/MOBILE_APP_CONVERSION/` (`cmp`) → original **removed**; MOBILE-APP copy is now the only, canonical one |
| `digital-invoice/invoice-app-plan.md` | identical → original **removed** |
| `Barathy-Mobile-App-Tasks.txt` (original requirements) | **moved** to `MOBILE-APP/MOBILE_APP_CONVERSION/` (`cp -p` + `cmp` before delete) |
| `Tasks.txt` | left: mostly other projects' notes (Trap Logger) and token-like strings; not this app's, secrets shouldn't travel with it |
| `MOBILE-APP.zip` (840 MB, 12:14) | left: user's own snapshot from before 1.0.1 |
| `Backup/20-10-2026-Before-GST/` | left: old full desktop-workspace snapshot (contains the pre-split `mobile/`) |
| `digital-invoice/AGENTS.md` | kept; `MOBILE-APP/agents.md` is an identical copy |

`digital-invoice/README.md`: mobile section and the three topic-doc links replaced by a short
pointer to `../MOBILE-APP/`. `MOBILE-APP` grep for paths into `digital-invoice`: none in code,
config or scripts (only history text in this walkthrough and the example paths in `agents.md`).
Tracking-doc intro rewritten to describe the folder as self-contained. From here on, docs are
updated in `MOBILE-APP/MOBILE_APP_CONVERSION/` only (no second copy to sync).

## Prompt 32 — Folder renamed MOBILE-APP → INV-MOBILE-APP (2026-10-22, session 12)

New location: `C:\Users\admin\Desktop\WIP\Barathy-Invoive-App\INV-MOBILE-APP`. **Entries above that
say `MOBILE-APP` refer to this same folder under its old name.**

| Step | Result |
| --- | --- |
| `gradlew --stop`, then `Rename-Item` | no daemon running; renamed, old path gone |
| `scripts/clean-native-caches.ps1` | 28 path-bound Gradle/CMake cache folders removed (they embedded the old path) |
| Name references updated | `README.md`, `scripts/copy-project.ps1`, `scripts/run-xlsx-tests.mjs`, tracking intro + move steps, `digital-invoice/README.md`; history rows/logs left as written. npm package name (`mobile`), Android package id and app name unchanged. |

## Prompt 33 — Run on emulator from the renamed folder (2026-10-22, session 13)

First build after the rename to `INV-MOBILE-APP` (path-bound caches had been cleared in Prompt 32).

| Step | Result |
| --- | --- |
| `emulator -avd Medium_Phone_API_37.0 -no-snapshot-load` (default GPU) | booted cleanly this time, `emulator-5554` |
| `JAVA_HOME=<AS jbr> CI=1 npx expo run:android --variant debug --device emulator-5554` | `BUILD SUCCESSFUL in 34s` (105 tasks executed, 100 from cache); APK installed |
| Metro | `Android Bundled 5737ms index.ts (910 modules)` |
| Screenshot | Dashboard renders (FY 2026–27, 1 invoice PRE-001, bottom tabs Home/Invoices/Products/Settings) |

Note: `CI=1` keeps the CLI non-interactive but disables Metro watch mode, so file edits need a re-run (or start Metro without `CI` for live reload).

## Prompt 34 — Session start: run on emulator, confirm Dashboard (2026-10-23, session 14)

Code-only start (no rebuild): the debug app `com.jiametric.invoiceerp` was already installed.

| Step | Result |
| --- | --- |
| `emulator -avd Medium_Phone_API_37.0` (default GPU) | booted without crashing (`emulator-5554`); no `-gpu swiftshader_indirect` needed |
| `npx expo start --dev-client --port 8081` + `adb reverse tcp:8081 tcp:8081` | Metro up on 8081 (watch mode on, so edits live-reload) |
| First screenshot | the emulator's quick-boot snapshot reopened the app on New invoice, step 2 (old JS). Pressing Back would autosave a draft, so the app was force-stopped instead |
| `am force-stop` → `am start -d "invoiceerp://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"` | `Android Bundled 895ms index.ts (912 modules)` |
| Screenshot | Dashboard renders: "FY 2026–27 overview" / Dashboard header, TOTAL BILLED · FY ₹0.00 with "1 invoice" badge, stock tiles Products Sold 3 · Balance Stock 12 · Actual Stock 15, "New invoice" button, floating bottom nav with Home active |

Tip: to open the dev client on Metro from the command line, use the deep link above (`scheme: 'invoiceerp'` in app.config.ts).
