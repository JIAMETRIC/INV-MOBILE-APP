# REPO_CLEANUP: tracking

## Rationale

- **Tracked files were all kept.** Each of the 170 files in git is source, a test runner, a design
  reference, a skill or a topic folder that `AGENTS.md` requires. `invoice-app-plan.md` is the original
  plan that `MOBILE_APP_CONVERSION_TRACKING.md` links to. `src/data/db.web.ts` and `dbKey.web.ts` look
  unimported but are picked by Metro's platform resolution for web, so they stay.
- **Only untracked build output was removed**, and only after the owner picked the groups (Prompt 1).
  These files aren't in git, so the deletion can't be undone; everything removed is either rebuilt by the
  next build or still downloadable from expo.dev / rebuildable from a commit.
- **Gradle caches were removed with the project's own `scripts/clean-native-caches.ps1`** instead of an
  ad-hoc delete, so the same rules apply (never touches source, the keystore, `release/` or JavaScript
  `build/` folders in node_modules). `modules/whatsapp-share/android/build/` sits outside the script's
  scan roots (`android/`, `node_modules/`), so it was removed separately.
- **Kept:** `android/` (prebuild output with five local edits), `credentials/` and `credentials.json`
  (EAS signing key, needed for phone builds), `desktop/dist/` (128 KB, Electron's `main`), the latest
  APK and the latest desktop installer.

## What was removed (2026-10-31)

| Group | Paths | Size (approx.) | Comes back by |
| --- | --- | --- | --- |
| Gradle / CMake caches | 30 folders listed by `clean-native-caches.ps1 -ListOnly` (`android/.gradle`, `.kotlin`, `app/.cxx`, `app/build`, `build`, and `.cxx` / `.gradle` / `.kotlin` / Gradle `build/` under `node_modules`) + `.expo/` + `modules/whatsapp-share/android/build/` | ~2.5 GB | Next Gradle build (first one ~2–3 min slower) |
| Old APKs | `release/InvoiceERP-1.0.1-build4-local.apk`, `-build5-local.apk`, `-emulator-x86_64.apk`, `-phone.apk` | ~250 MB | EAS build pages (builds 2, 3) or rebuild from `020c390` (4) / `f9ddb86` (5) |
| Desktop build leftovers | `desktop/release/win-unpacked/`, `desktop/release/.icon-ico/`, `desktop/release/builder-debug.yml` | ~400 MB | `cd desktop && npm run dist` |

## What is left

- `release/InvoiceERP-1.0.1-build6-local.apk` (latest phone build, arm64-v8a + x86_64)
- `desktop/release/InvoiceERP-Desktop-Setup-1.0.2.exe` + `.blockmap`

## Docs changed

- `README.md`: the file table drops the four removed APK rows; one "Older builds" row points at the EAS
  build pages and the commits for builds 4 and 5. "Run it" now installs `build6-local.apk` on the
  emulator (it carries x86_64).
