# REPO_CLEANUP: walkthrough

## 2026-10-31 · Prompt 1: clean unwanted and unrelated files

### Survey

- `git status --ignored`: working tree clean; ignored items were `.expo/`, `android/`, `credentials*`,
  `desktop/dist/`, `desktop/node_modules/`, `desktop/release/`, `desktop/renderer/{fonts,icon.png}`,
  `modules/whatsapp-share/android/build/`, `node_modules/`, `release/`.
- No stray `*.bak`, `*.orig`, `*.log`, `*.tmp`, `*.old`, `.DS_Store` or `Thumbs.db` outside
  `node_modules/` and `android/`.
- Import scan of `src/` and `desktop/`: only `src/data/db.web.ts` and `dbKey.web.ts` had no importer;
  both are Metro `.web` platform variants, so they are in use.
- Sizes before: `android/` 2.9 GB, `release/` 328 MB, `desktop/release/` 532 MB.

### Owner decision

Asked which groups to delete (Gradle/CMake caches, old APKs, desktop build leftovers); the owner chose
all three.

### Commands and results

| Step | Result |
| --- | --- |
| `scripts\clean-native-caches.ps1` | `Removed 31 cache folders` (30 Gradle/CMake + `.expo`); Gradle daemon stop attempted |
| `rm -rf modules/whatsapp-share/android/build desktop/release/win-unpacked desktop/release/.icon-ico` | removed |
| `rm -f desktop/release/builder-debug.yml release/…build4…, …build5…, …emulator-x86_64…, …phone.apk` | removed |
| `ls release desktop/release` | only `InvoiceERP-1.0.1-build6-local.apk` and `InvoiceERP-Desktop-Setup-1.0.2.exe` (+ `.blockmap`) left |
| `git status` | only `README.md` changed plus this topic folder; no tracked file deleted |

### Not verified

- No Gradle build was run after the cleanup; the next `assembleRelease` regenerates the caches.
