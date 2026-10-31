# LAN_SYNC: multiple phones + Desktop admin host on the same Wi-Fi

Status: **Phase 1 in progress (2026-10-30)**. The owner accepted the recommended answer to every decision D1–D6 ("Yes, use defaults", Prompt 2): offline-first phones, a per-device invoice series, one login per person, phone users limited to invoices and payments, INTERNET permission allowed, and the current phone seeds the desktop.

---

## Rationale

### What exists today (why this is not a small change)

| Fact (checked in code) | Consequence for sync |
| --- | --- |
| Each phone has its own SQLCipher database (`src/data/db.ts`, `schema.ts` v8) | Two phones would each have their own data; nothing is shared |
| All primary keys are `INTEGER AUTOINCREMENT` (invoices, invoice_items, products, restocks, payments, drafts) | Phone A's invoice `id 12` and phone B's invoice `id 12` are different invoices. IDs collide the moment data is merged |
| Invoice number comes from `meta.next_seq` on the device (`settingsRepo.allocateInvoiceNo`) | Two phones offline would both issue `INV-0042` |
| `payments.invoice_ids` is a CSV of integer invoice ids | Breaks when ids are remapped between devices |
| Deletes are hard deletes (`deleteInvoice`, products) | Other devices can't learn that a row was deleted (no tombstone) |
| `products.stock_qty` is a stored balance; `restocks` is a ledger next to it | Two phones restocking offline would overwrite each other's balance |
| Sold / Avl are **computed** from invoice lines (Prompt 15) | Good: once invoices sync, stock "Sold" is correct on every device automatically |
| Release APK **removes INTERNET** (`android/app/src/release/AndroidManifest.xml`, LOCAL EDIT) | Android needs INTERNET for any socket, LAN included. The "fully offline" stance has to change |
| The repo layer already runs on Node's built-in SQLite (`scripts/run-integration-tests.mjs`) | The desktop host can run **the same `schema.ts` + repo code** in Node: no second copy of the business rules |
| The old desktop app (`../digital-invoice`, Flask) has a different schema: REAL money, `DD-MM-YYYY` dates, GST, clients | Not usable as the host without porting everything back. Rejected |

### Chosen approach and alternatives

| Choice | Why | Alternatives rejected |
| --- | --- | --- |
| **Hub and spoke: Desktop is the single source of truth**, phones sync only with it (never phone-to-phone) | One place to resolve conflicts, back up, and see all users' invoices. Matches "Desktop = Admin (Host)" | Peer-to-peer mesh: conflict handling on every phone, no admin. Cloud (Firebase/Supabase): needs internet and a monthly bill, data leaves the shop |
| **Offline-first phones**: each phone keeps its local DB and syncs when the host is reachable | Billing must never stop because the PC is off or Wi-Fi drops. Invoices are shared to customers immediately | Thin client (phone calls desktop API live): simplest, but no billing when the PC is off |
| **Desktop host = Electron app (Node + SQLite) reusing `src/data/*` and `money.ts`**; admin UI is the existing React Native screens built for web (`react-native-web` is already a dependency) plus new admin screens | One codebase, one set of rules, same Flat Glass design. Integration harness proves the repo code runs in Node | Python/FastAPI host: rewrites every rule. Old Flask app: schema mismatch |
| **Global ids**: every synced row gets a `uid` (UUID from `expo-crypto.randomUUID`) | Ids no longer collide; integer `id` stays as a local key so screens don't change | Server-assigned ids on push: phone can't reference its own unsynced rows |
| **Change tracking**: `updated_at`, `deleted_at` (tombstone), `dirty` flag on phones; `server_seq` stamped by the host | Push = "my dirty rows"; pull = "rows with server_seq > my last". Simple, restartable, idempotent | Full DB file copy: overwrites other users' work. CRDT library: heavy for this data |
| **Pairing by QR code** shown on the desktop (host IP, port, one-time token, key) | No typing IPs; one scan per phone; admin controls who joins | mDNS auto-discovery: needs another native module; kept as a later option |
| **Traffic encrypted at app level** (AES-GCM, key from pairing, `@noble/ciphers` pure JS) over HTTP on the LAN | Shop Wi-Fi is shared; invoice data shouldn't travel in clear. Self-signed HTTPS pinning in RN needs native work | Plain HTTP: anyone on the Wi-Fi can read it |

### Conflict rules (per table)

| Data | Who may change it | Rule when two devices change it |
| --- | --- | --- |
| Company details, bank, UPI, prefix (`meta`) | **Admin (desktop) only** | Host wins; phones receive read-only |
| Products: name, price | Admin (D4: optionally phones) | Last write wins by `updated_at`, host keeps the history in `audit_logs` |
| Stock | Anyone who may restock | `stock_qty` becomes **Σ restocks.delta** (ledger only, append-only). Two offline restocks simply add up, nothing is lost |
| Invoices + lines | The user who created it; admin can edit/void any | Owner device's latest version wins; a void from admin always wins |
| Payments | Anyone | Append-only rows; invoice status (paid/partial) is recomputed on the host after merge |
| Drafts | Stay **local** to each phone | Not synced |
| Oversold (Avl < 0) after merge | — | Allowed and shown red, as today (Prompt 15: overselling must stay visible). Admin sees a list |

---

## Decisions needed from the owner

| # | Question | Recommendation |
| --- | --- | --- |
| **D1** | Must phones bill when the desktop is off / out of Wi-Fi? | **Yes (offline-first)**. If "no", the plan shrinks a lot (thin client) |
| **D2** | Invoice numbers across devices | **Per-device series**: desktop `INV-0001`, phone 1 `INV-A0001`, phone 2 `INV-B0001`. Always unique offline, no gaps. Alternative: one series with **number blocks** leased from the host (phone holds e.g. 20 numbers): one series, but numbers go out of date order and a lost phone leaves gaps |
| **D3** | Users: one login per **person** or per **device**? | Per person (name + PIN), created by admin on the desktop; every invoice stores `created_by` |
| **D4** | What may a phone user do? | Create invoices + payments, view stock. Prices, products, restock, settings, void/delete: **admin only** (switchable per user) |
| **D5** | Is adding the INTERNET permission OK? | Needed for any Wi-Fi sync. App still talks only to the paired desktop's LAN address |
| **D6** | Existing data on the current phone | First pairing **uploads that phone's data into the desktop** (one-time "seed"); every later phone starts empty and downloads |

---

## Architecture

```
            Shop Wi-Fi (same LAN, e.g. 192.168.1.x)
 ┌────────────────────────────┐
 │ DESKTOP (Admin / Host)     │  Electron app, Windows
 │  • Node HTTP server :7420  │◄──── POST /sync/push  (dirty rows, encrypted)
 │  • SQLite (SQLCipher)      │────► GET  /sync/pull?since=<server_seq>
 │    = master database       │◄──── POST /pair  (one-time token from QR)
 │  • same schema.ts + repos  │      GET  /health
 │  • Admin UI: all screens + │
 │    Users, Devices, Sync log│
 │  • daily backups           │
 └────────────▲───────────────┘
              │ sync on: app open, after each save, every 60 s, "Sync now"
   ┌──────────┴─────────┐   ┌────────────────────┐
   │ Phone A (user Ravi)│   │ Phone B (user Anu) │   … more phones
   │ local SQLCipher DB │   │ local SQLCipher DB │
   │ works offline      │   │ works offline      │
   └────────────────────┘   └────────────────────┘
```

### Schema v9 (phones and host share it)

- Every synced table (`products`, `restocks`, `invoices`, `invoice_items`, `payments`, `meta`): add `uid TEXT UNIQUE`, `updated_at`, `deleted_at`, `origin_device`, `server_seq INTEGER`, and on phones `dirty INTEGER`.
- `invoice_items.invoice_uid`, `invoice_items.product_uid`, `restocks.product_uid`: links by uid (integer FKs kept for local joins).
- `payments.invoice_ids` CSV → new `payment_invoices(payment_uid, invoice_uid)` table.
- `invoices.created_by` (user uid), `invoices.series` (device letter, D2).
- New host-only tables: `users`, `devices` (token hash, key, last_seen, revoked), `sync_log`.
- Phone-only: `sync_state` (host address, device id, last pulled server_seq, last sync time).
- Migration fills uids for all existing rows, so the current phone's data can seed the host (D6).

### Schema v9: as built (Phase 1, 2026-10-30)

Code: `src/data/schema.ts` (`SCHEMA_SQL`, `SYNC_SQL`, `SYNC_TABLES`), migration `addSyncColumns` in `src/data/dbCore.ts`, reader `src/data/syncRepo.ts`.

| Where | Added | Purpose |
| --- | --- | --- |
| `products`, `restocks`, `invoices`, `payments`, `audit_logs` (`SYNC_TABLES`) | `uid TEXT` (unique index), `dirty INTEGER DEFAULT 1`, `rev INTEGER DEFAULT 0`, `server_seq INTEGER`, `origin_device TEXT`, `created_by TEXT` | Global id; "waiting for push"; edit counter, so a push acknowledged late can't clear a newer edit (engine clears `dirty` only `WHERE rev = <pushed rev>`); host's change number; which device made the row; which user made it (Prompt 5) |
| `meta` | `dirty DEFAULT 0`, `rev`, `server_seq` | Company details sync from the host |
| new `payment_invoices(payment_id, invoice_id)` | PK on both, cascades | Replaces matching the `invoice_ids` CSV with `LIKE` (CSV still written for display and old backups) |
| new `sync_tombstones(tbl, uid, dirty, server_seq, deleted_at)` | unique `(tbl, uid)` | A deleted synced row, so the host learns about the delete |
| new `sync_state` (singleton) | `device_id` (random 32-hex), `applying`, `host_url`, `last_pull_seq`, `last_sync_at`, `user_uid` | This device's sync identity and progress; `user_uid` = the signed-in user (set by Phase 5 sign-in, empty until then) |

**Triggers** (one set per synced table, created by `SYNC_SQL`):

| Trigger | Fires | Does |
| --- | --- | --- |
| `trg_<t>_ins` | after insert, when `uid` is NULL or `origin_device` is empty | sets a random uid, `origin_device = sync_state.device_id` and (when empty) `created_by = sync_state.user_uid`. Host rows arrive with uid and origin set, so it skips them and they keep their own user |
| `trg_<t>_upd` | after update, when the update didn't change `dirty` and `sync_state.applying = 0` | `dirty = 1, rev = rev + 1` |
| `trg_<t>_del` | after delete, when `applying = 0` | writes a tombstone |
| `trg_meta_upd` | after update **of the company columns only** | marks `meta` dirty. `invoice_prefix` and `next_seq` are per device (D2), so issuing an invoice never marks it |

`sync_state.applying = 1` is set by the sync engine while it writes rows pulled from the host, so they aren't pushed straight back.

**Upgrade v8 → v9** (`addSyncColumns`, one transaction): add the columns, create the new tables, add one correcting `edit` restock row for any product whose `stock_qty` differs from Σ ledger, split each payment's CSV into `payment_invoices` (unknown invoice ids dropped), give every existing row a uid and this device as origin (all stay `dirty = 1`: the first sync uploads them, D6), then create the triggers. The test checks the upgraded database has the same tables, columns, indexes and triggers as a fresh v9 one.

**Built differently from the plan list above:**
- Deletes stay hard deletes plus a tombstone row, instead of a `deleted_at` column on every table. Every existing query keeps working unchanged.
- No `invoices.series` column: the series is the device's own `invoice_prefix` (e.g. `INV-A`), set when the phone pairs (Phase 4).
- **`invoice_items` has no sync columns**: lines travel inside their invoice. Editing an invoice already deletes and re-inserts all its lines, and any change to lines also updates the invoice row, which marks it dirty, so the host replaces that invoice's lines as a whole. Product links are sent as product uids. To be revisited if lines must sync on their own.
- `users`, `devices` and `sync_log` are host-only, so they're created in Phase 2, not on phones.

### Sync cycle (phone)

1. **Push:** send all `dirty = 1` rows (in dependency order: products → restocks → invoices → lines → payments). Host validates, applies conflict rules, stamps `server_seq`, replies with accepted uids. Phone clears `dirty`.
2. **Pull:** ask for rows with `server_seq > last_pulled`; upsert by `uid`; apply tombstones; save new `last_pulled`.
3. Repeated pushes are safe (upsert by uid): a dropped Wi-Fi mid-sync never duplicates an invoice.

---

## Plan (phases)

| Phase | Work | Size | Done when |
| --- | --- | --- | --- |
| **0. Decide** ✅ | Owner answers D1–D6 | — | Defaults accepted (Prompt 2) |
| **1. Sync-ready data** ✅ 2026-10-30 | Schema v9 + migration (uids, timestamps, tombstones, ledger-based stock, `payment_invoices`); repos write uid/dirty/soft-delete; integration tests extended | M | `npm run test:integration` passes on v9, existing phone DB migrates without loss |
| **2. Desktop host** ✅ 2026-10-30 (core + Electron app + installer) | New `desktop/` folder: Electron + Node server + SQLite (SQLCipher) reusing `src/data`; endpoints `/health`, `/pair`, `/sync/push`, `/sync/pull`; Windows firewall rule; auto-backup | L | Two simulated phones (Node test) push/pull and converge |
| **3. Desktop admin UI** | Web build of existing screens (S1 Dashboard, S2 Invoices, S3, S5 Products, S6 Settings) + new: **Users**, **Devices & pairing QR**, **Sync log**, filter "by user" | L | Admin sees every phone's invoices and stock in one place |
| **4. Phone sync client** ✅ 2026-10-30 (header sync dot not done) | Settings → **Sync** section (pair by QR via `expo-camera`, status, Sync now, unpair); sync engine; header sync dot (synced / pending / offline); INTERNET permission + cleartext LAN config; encryption | M | Phone pairs, bills offline, catches up when back on Wi-Fi |
| **5. Users & roles** ✅ 2026-10-30 | Per-user PIN sign-in (extends the S7 lock), `created_by` on invoices, permission checks on phone and enforced on the host | M | Phone user can't change prices; host rejects a forged push |
| **6. Test & roll out** | Multi-device test: emulator + phone + desktop on Wi-Fi; Wi-Fi drop mid-sync; same product restocked on two phones; admin voids while phone edits; `/size-check` on new screens; seed host from current phone; build 5 | M | Checklist in `LAN_SYNC_walkthrough.md` all green |

Order: 1 → 2 → 4 can be tested end to end before the full admin UI (3) and roles (5).

### How the desktop app runs (Phase 2–3 design, Prompt 3)

Windows installer (`InvoiceERP-Desktop-Setup.exe`, electron-builder NSIS) built from a new `desktop/` folder in this repo. One Electron app, three parts:

| Part | Runs in | What it is |
| --- | --- | --- |
| **Screens** | Electron window (Chromium) | The same React Native screens compiled for web (`react-native-web`, already a dependency; `npm run web` already works as the preview tier). A desktop window is wide, so the existing tablet layouts apply (side rail + 2–3 panes). New admin screens: Users, Devices (pairing QR), Sync log |
| **Database + rules** | Electron main process (Node) | Master SQLite file, encrypted (SQLCipher via `better-sqlite3-multiple-ciphers`), in `%APPDATA%\InvoiceERP\`. Runs the same `src/data/*` repos through an adapter like the integration harness's. The window calls them over IPC (`window.api.invoices.save(...)`), via a `.desktop` variant of the data entry point |
| **Sync server** | Same main process | HTTP on port 7420, private networks only (installer adds the firewall rule). Keeps running from the tray icon when the window is closed; optional "start with Windows" |

Phone-only pieces and their desktop replacements (only two files use phone-only modules):

| Phone | Desktop |
| --- | --- |
| `expo-print` PDF + share sheet (`src/export/pdf.ts`) | Electron `printToPDF` on the same HTML template → Save as / Print / open folder |
| WhatsApp direct share (`modules/whatsapp-share`) | Save the PDF/image, then "Open folder" (WhatsApp Desktop accepts drag and drop) |
| Fingerprint (`src/auth/biometrics.ts`) | PIN only (Windows Hello is a later option) |
| Key in Android Keystore | Key protected with Windows DPAPI (Electron `safeStorage`) |

Needs: a Windows 10/11 PC on the same router as the phones (Wi-Fi or cable), switched on while phones should sync. Phones keep billing when it's off and catch up later (D1). Daily automatic backups to `Documents\InvoiceERP\Backups`.

### Admin pages (desktop only, Phase 3; Prompt 4)

The shared screens show the combined data of all users. These pages exist only on the desktop, behind the admin PIN:

| ID | Page | Shows |
| --- | --- | --- |
| **A1** | **Overview** | Period picker (Today / Week / Month / FY). Overall KPIs: sales, invoice count, collected Cash vs UPI, outstanding, stock available, oversold products. A **per-user table** (invoices, sales, collected, voids, last active), sales by user (bar) and by day (line). Device strip: online / last sync / changes waiting |
| **A2** | **Users** | List of users with their period KPIs; add / disable a user, reset PIN, set permissions (D4). Tapping a user opens **A2.1 User detail**: their invoices and payments, sales chart, activity timeline, devices used |
| **A3** | **Activity log** | Every action from every device, newest first: "Ravi · Phone A · issued INV-A0042 · ₹4,500 · 10:42". Filters by user, device, action, date. **Watch list** highlighted: deletes, voids, price changes, stock corrections, backup restore, failed PIN attempts |
| **A4** | **Devices** | Each phone: user, series letter, online / offline, last sync, changes waiting, app build; "Add phone" (pairing QR), block a phone |
| **A5** | **Sync log** | Each push / pull per device: time, rows in / out, rejects with reason (e.g. a phone user tried to change a price) |

Data each page needs, and what's missing today:

| Need | Status (Prompt 5, 2026-10-30) |
| --- | --- |
| Who made an invoice / payment / restock / product / log entry | ✅ `created_by` on every synced table, filled by the insert trigger from `sync_state.user_uid` (empty until Phase 5 sign-in sets it) |
| Activity timeline on the desktop | ✅ `audit_logs` is a synced table (uid, device, user, dirty); `recentAudit()` returns `created_by` and `origin_device` |
| Voids in the log | ✅ `invoicesRepo.setStatus(…, 'void')` logs `invoice.void` (no screen voids yet; the admin void comes in Phase 3) |
| Settings changes in the log | ✅ `settingsRepo.updateSettings` logs `settings.update` with the changed field names |
| Sign-in activity | ✅ `auth.signin` (LockProvider, unlock finished: PIN or fingerprint), `auth.failed` / `auth.locked` (wrong PIN or recovery code, with count and wait), `auth.recovered` (authStore) |
| Trustworthy times | Phase 2: host stores `received_at` per synced row |

Logging sits in the data / auth layer, not in the screen files, so the line numbers cited in `SCREEN_CODE_STRUCTURE/*_tree.md` stay valid.

Alternatives considered: Tauri (smaller installer, but the Node data layer would need a sidecar process); a background Node service plus a browser tab at `localhost` (simplest, but no tray icon or installer, and easy to close by accident).

### Phase 2 as built: host core (2026-10-30, Prompt 6)

Runs on plain Node today (`npm run host:start`); the Electron window and installer wrap `startHost()` next.

| File | Role |
| --- | --- |
| `src/sync/protocol.ts` | Shared types and constants: `PROTOCOL` 1, port 7420, `PULL_WINDOW` 2000, push / pull / pairing messages, `Envelope`, `SyncDb` (the subset of expo-sqlite both sides use) |
| `src/sync/wire.ts` | Local row ⇄ wire row: `WIRE_COLS` per table, ids replaced by uids (restock → `product_uid`, invoice → `lines[]` with `product_uid`, payment → `invoice_uids[]`), `readWire` / `writeWire` / `deleteWire`, company details (`META_COLS`) |
| `src/sync/client.ts` | Phone engine: `collectPush` (dirty = 1 rows, `base_seq` = last host version), `applyPushResult` (clear dirty only where `rev` still matches; `host_wins` → take `current`; other refusals → dirty = 2), `applyPull` (skip rows with a local edit waiting; `giveWay` on unique clashes), `syncOnce(tx, transport)`, `applyPairing` (series prefix) |
| `desktop/host/app.ts` | `startHost()`: opens the master DB through the app's own `src/data/db` (Expo modules shimmed by `expoShim.ts` + `nodeSqlite.ts`), host tables, one-at-a-time `exclusive()` transactions, server, backups |
| `desktop/host/hostSync.ts` | `handlePush` (conflict rules below), `handlePull`, `stampChanges` (numbers every dirty row on the host, incl. the admin's own edits) |
| `desktop/host/server.ts` | `GET /health`, `POST /pair`, `/sync/push`, `/sync/pull`; 20 MB body limit; errors `unknown_device` 401, `revoked` 403, `bad_seal` 401, `pairing_expired` 401, `protocol` 409 |
| `desktop/host/pairing.ts` | One-time QR (`invoiceerp://pair?h=<LAN IPs>&p=7420&i=<pid>&s=<secret>`, 10 min), series letters A, B … Z, AA …; re-pairing keeps the letter |
| `desktop/host/seal.ts` | AES-256-GCM, 12-byte IV, tag appended, request path as additional data |
| `desktop/host/hostSchema.ts` | `host_state` (seq, host_id, name, series count), `devices`, `pairings`, `sync_log` |
| `desktop/host/backup.ts` | `VACUUM INTO <dataDir>/backups/host-YYYY-MM-DD.db` at start and every 6 h (once a day), last 30 kept |
| `desktop/host/main.ts` | Terminal entry: `--data`, `--port`, `--pair` |

**Conflict rules as built** (`hostSync.handlePush`):

| Data | Rule |
| --- | --- |
| Products | Phone wins if its edit started from the host's current version (`base_seq`) or its `updated_at` is ≥ the host's; else `host_wins`. Same name under another uid → `name_taken`. Stock is rebuilt from the ledger after every push |
| Restocks, payments, log entries | Append-only; a repeat is acknowledged again. Restock with an unknown product → `missing_product` |
| Invoices | Same rule as products; a desktop **void always stands**; number used by another invoice → `number_taken`. Paid / partial recomputed from payments after every push (without touching `updated_at`) |
| Company details | Desktop only; the first phone may fill an empty desktop (D6) |
| Deletes | Applied, and the host's own tombstone carries them to the other phones |
| Repeated push | Rows identical to the host's are acknowledged without a new change number |

**On the phone, when a pulled row clashes** (`client.giveWay`): a local product with the same name takes the host's uid (its restocks and invoices are sent again); a local invoice with the same number moves to this device's series (`INV-C001`) and an `invoice.renumber` log entry records the old number.

**Changed from Phase 1:** product uids are name-based **only for the 12 seeded catalog names** (`productSeedSql`, and the v8 → v9 upgrade for those names), so every device seeds the same catalog under the same uids. Products made later get random uids. A first version derived every product's uid from its name; the sync test showed that a renamed product and a new product with its old name then share a uid, so a restock could land on the wrong product.

### Phase 2 as built: Electron app and installer (2026-10-30, Prompt 8)

Own npm package in `desktop/` (its `node_modules` stay out of the phone app and EAS builds). Pinned: `electron` 44.9.3 (44.7.2 had advisory GHSA-jr5w-w6x2-84p9, fixed after 44.9.0), `electron-builder` 26.17.0, `better-sqlite3-multiple-ciphers` 13.0.3, `qrcode` 1.5.4. `npm audit`: 0.

| File | Role |
| --- | --- |
| `desktop/electron/main.ts` | Single instance; `startHost()` with the encrypted engine; window (1100×780, min 380×560, sandboxed, no navigation); closing the window hides it, the tray keeps the host running (tray: Open, Quit); `--hidden` when started with Windows; `--smoke` build check; IPC for the page |
| `desktop/electron/preload.ts` | `window.host`: `status`, `pair`, `setBlocked`, `setStartWithWindows`, `openDataFolder` |
| `desktop/electron/cipherDb.ts` | `openCipherEngine` (SQLite3 Multiple Ciphers, `cipher = sqlcipher`, `legacy = 4`: the phone's SQLCipher 4 format); `loadDbKey` (32 random bytes, kept in `host.key` sealed by Windows DPAPI, current user); `isEncryptedFile` |
| `desktop/renderer/` | Status page: host name and company, LAN address, KPI tiles (phones, invoices, products), Phones list (series letter, last sync, IP, app version, Online / Offline / Blocked, Block / Unblock), Add phone dialog (QR, one-time, 10-min countdown, link), Sync log (refusals in red), Start with Windows, data folder |
| `desktop/installer/firewall.nsh` | Inbound TCP 7420, private profile, this exe only; removed on uninstall. Data folder never touched |
| `desktop/scripts/copy-assets.mjs` | Copies Inter 300–600, Bebas Neue and `assets/icon.png` from the app into `renderer/` |

Host changes for it: `NodeSqliteDb` takes any engine with the node:sqlite / better-sqlite3 shape (`SqlEngine`) and loads `node:sqlite` only when none is given; `expoShim` gains `useEngine` and `setSecureItem` (the app's `dbKey.ts` reads `db_key_v1`, `dbCore` sends `PRAGMA key`); `startHost({ engine, dbKeyHex })`. The terminal host now defaults to `%APPDATA%\InvoiceERP-terminal` so its unencrypted file never meets the Electron app's encrypted one in `%APPDATA%\InvoiceERP`.

**Why DPAPI through PowerShell, not Electron `safeStorage`:** the first build used `safeStorage`. Its key lives in Chromium's `Local State` file, written only on a clean shutdown; the smoke run quits with `app.exit` and the second start failed with "Error while decrypting the ciphertext". On a real PC, a crash or power cut on the first day would have left the database unreadable. DPAPI keeps no state of its own; the key is checked by decrypting it again before first use and passed to PowerShell in an environment variable, never on a command line.

**Why `npmRebuild: false`:** electron-builder tried to compile the database module with Visual Studio (not installed). The module is N-API with prebuilt binaries, which work in any Node or Electron; the packaged-app smoke run proves it.

**Page design** (CLAUDE.md): Dashboard reference layout (top 56, sides 20/32, gap 16), glass cards 16, controls 12, chips 10, dialog 18, pills 999; Inter 300–600, Bebas Neue for counts; dark follows Windows with the Sign In dark-glass recipe; red only for Blocked and refusals; Feather icons stroke 1.8. Backdrop blur is used here (the no-blur exception is Android only). Differences from the reference: no bottom nav (one page), KPI value in Bebas Neue 34 instead of Inter 26/500 (project exception for numbers), and phone rows wrap their status and button under the name below 520 px.

**Still open after Phase 2:**
- **Phones can't pair yet:** scanning the QR is Phase 4 (phone app Settings → Sync).
- **Installer not code-signed:** Windows SmartScreen shows "unknown publisher" once.
- **Installer not run on this PC:** it installs for all users and adds the firewall rule, so the owner runs it.
- **If Windows' user profile is lost, so is the DPAPI key:** `host.db` and its backups can't be opened. The phones still hold the data and can re-seed a new desktop. A "save recovery key" button is a Phase 3 candidate.
- **Host reset detection:** if the host database is replaced, phones must notice the new `host_id` and pull from 0 (Phase 4).
- **Users table:** Phase 5.

### Phase 4 as built: phone sync (2026-10-30, Prompt 10)

| File | Role |
| --- | --- |
| `src/sync/seal.ts` | AES-256-GCM in pure JS (`@noble/ciphers` 2.4.0), byte-for-byte the desktop's format (tested both ways) |
| `src/sync/service.ts` | `parsePairingCode`, `pair(code, deviceName, appVersion)` (probes the QR's addresses in parallel, 3 s each; device key → `expo-secure-store` `sync_device_key_v1`), `syncNow()` (health check first: offline / other desktop; then `syncOnce`, 60 s per call), `syncStatus()`, `unpair()`; `SyncError` codes with the words to show |
| `src/sync/SyncProvider.tsx` | Background sync once paired: on open, on coming back, every 60 s while open, within 5 s of a save on any screen (cheap local check for waiting changes, skipped while the last round failed); `nav.refresh()` when a pull brought changes; `useSync()` for Settings. Device name from `Platform.constants` Brand + Model |
| `src/sync/client.ts` | `applyPairing` stores `host_id` / `host_name`; pairing with a **different desktop** marks every row for sending again and pulls from 0 |
| `src/features/settings/SettingsScreen.tsx` | S6.7 **Sync with desktop**: not paired = Scan pairing code / paste link → Pair; paired = Desktop · Invoice series · Last sync (+ waiting, + refused-changes row), Sync now \| Unpair; last error in red |
| `src/features/settings/PairScanner.tsx` | S6.7.4 full-screen QR scanner (`expo-camera` ~58.0.14, QR only, no microphone) |
| `src/data/schema.ts` | `sync_state.host_id`, `host_name` (v9, still unreleased) |
| `app.config.ts`, `android/` | INTERNET kept in release builds (D5); `usesCleartextTraffic` (plugin `withCleartextLan` + LOCAL EDIT); `expo-camera` plugin with `recordAudioAndroid: false` |
| `app-version.json`, `android/app/build.gradle` | versionCode 5 |

**Error words** (`service.ts` `MESSAGES`): not paired · desktop not reachable (Wi-Fi / desktop running) · a different desktop answers · blocked on the desktop · desktop no longer knows this phone (pair again) · pairing code used or expired · not a pairing code · different sync versions · desktop problem.

**Not done in Phase 4:** the header sync dot on every screen (status is in Settings → Sync only); opening an `invoiceerp://pair` link from another app (the scheme is registered, but nothing handles it yet); background sync while the app is closed (Android background jobs are out of scope: phones sync when opened).

### Phase 5 as built: people and limits (2026-10-30, Prompt 17)

**Model.** People are made on the desktop (page card **People**: name, Owner or Staff, four switches, PIN 4–6 digits, "can sign in" on / off; never deleted, so their invoices stay theirs). Owner (`role = admin`) may do everything. Staff may make invoices and take payments, plus the switches (`USER_PERMS`):

| Switch | Allows | Checked on the phone | Checked on the desktop |
| --- | --- | --- | --- |
| `products` | add / rename / delete products, prices (incl. a new price when restocking) | S5 FAB, New product, name / price fields, Delete, New price | product rows: `updated_by`; product tombstones |
| `stock` | restock, correct stock | S5 Restock, stock field | restock rows: `created_by`; restock tombstones |
| `delete` | delete or void invoices (and payments) | S3 Delete | invoice going to void: `updated_by`; invoice / payment tombstones |
| `settings` | company details, restore a backup, unpair | S6.2 Save, S6.4 Restore, S6.7 Unpair | company details: `updated_by` (the first phone may still fill an empty desktop) |

`''` (nobody signed in: a phone without people, or rows made before) counts as the phone's owner, as before Phase 5, except that company details from a paired phone with nobody signed in are still the desktop's (`host_wins`). An unknown or switched-off person may do none of the switch actions; their invoices and payments are still taken.

**Schema v10** (`dbCore.addPeople`; v8 phones pass v9 then v10 in one open, columns added only where missing):
- `users` (uid, name unique, role, perms, pin_salt / pin_hash / pin_len, active, updated_at, dirty, server_seq): made on the desktop, pulled by phones.
- `updated_by` on every synced table and on `meta`.
- `sync_tombstones.user_uid`.
- The triggers set `updated_by` (insert: `created_by`, else the signed-in person; update: the signed-in person) and the deleting person on a tombstone.

**Protocol 2.** Push rows carry `updated_by`, and deletes carry `user_uid`. Pulls carry `users`. `PushResult.undeleted` lists deletes the person may not make. `not_allowed` refusals come with the desktop's `current` row, which the phone takes back; a row the desktop never had is dropped (a dropped restock takes its stock with it). A phone and desktop on different protocol numbers refuse to sync (409, "Update the older one"), so a build 5 phone can't half-sync with this desktop. A pushed row with a missing column keeps its default instead of failing.

**On the phone.**
- `src/auth/people.ts`: list, people mode, PIN check through `authStore.checkHashed` (shared lockout), sign in, current person, `may`.
- `LockProvider`: `person` flow, `person`, `can(perm)`, `refreshPeople`.
- S7 person flow: pick, then enter.
- Limits on S5, S3 and S6, as in the table.
- `SyncProvider` calls `refreshPeople` when a pull brought people.

**On the desktop.** `desktop/host/users.ts`:
- `hashPin`, `listUsers`, `saveUser`, with these rules: names unique, PIN 4–6 digits, a new person needs a PIN, at least one active owner.
- `hostSync.allowed()`: product edits whose only change is stock pass as a stock change (`unchanged(…, loose)`).

**Found on the emulator and fixed:** the first sync after the update runs under the lock. The people it brought did not change the device-PIN screen already showing, so the device PIN opened the app. Now a sync that brings people switches that screen to "Who's using", and a right device PIN leads on to it while people exist.

**Not done in Phase 5:**
- A person changing their own PIN on the phone (the owner does it on the desktop).
- Per-person activity pages on the desktop (Phase 3).
- A login on the desktop itself: the PC's Windows account is the owner's.
- A tampered app could send `''` as the person: limits guard honest phones (stale permissions, old builds), not a modified app.

### Risks

- **PC IP changes** (router DHCP): set a DHCP reservation for the PC on the router; phone shows "Host not found — re-scan QR". mDNS discovery is a later option.
- **Windows firewall** blocks the port: installer adds an inbound rule for private networks only.
- **Clock skew** between phones affects last-write-wins: host stamps its own time on receipt and uses `server_seq` order, not phone clocks, for ties.
- **Lost phone**: admin revokes the device on the desktop; its token stops working. Local data stays SQLCipher-encrypted behind the PIN.
