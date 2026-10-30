# Local APK builds — walkthrough

## 2026-10-28: setup (steps 0, 2–5 of the skill)

Survey: `android/` is generated (CNG) and git-ignored; `.easignore` keeps it out of EAS uploads. It was emulator-only (`reactNativeArchitectures=x86_64`), signed with the template debug key for both build types, and kept INTERNET (prebuilt without `EAS_BUILD_PROFILE`). EAS builds 2 and 3 use remote keystore `XunsAMGKSH`.

Changes:

| File | Change |
| --- | --- |
| `.gitignore`, `.easignore` | `credentials.json`, `/credentials/` (checked with `git check-ignore -v`) |
| `android/app/build.gradle` | signing block reads `../credentials.json`; `eas` signing config for debug and release, debug key when the file is missing |
| `android/gradle.properties` | `reactNativeArchitectures=arm64-v8a,x86_64` (the first replace hit the comment line too; edited the real line only) |
| `android/app/src/release/AndroidManifest.xml` | new: removes INTERNET and ACCESS_NETWORK_STATE |

Portable skill written: `~/.claude/skills/local-build-apk/` (`SKILL.md`, `templates/signing.gradle.txt`, `templates/release-AndroidManifest.xml`, `templates/verify_apk.py`).

| Check | Result |
| --- | --- |
| `verify_apk.py` on the old local APK (x86_64, debug key) | package 1.0.1 / 3; `!! no arm64-v8a`; INTERNET requested; cert `fac61745…3b9c` (the debug key); RESULT not OK, as expected |
| First run of the verifier | cert line empty: `apksigner.bat` needs JAVA_HOME. Fixed: the script now finds Android Studio's `jbr` and sets JAVA_HOME for its child processes |

Not yet done: the owner downloads the key (`eas credentials`), the first arm64 + EAS-key build, `signature MATCH`, the emulator uninstall (needs the owner's OK), a phone install.

## 2026-10-28: first phone-ready local build

Owner ran `npx eas-cli credentials -p android` → `preview` → Download (in terminal tab "EAS key download"): `credentials.json` + `credentials/android/keystore.jks` written, both git-ignored. EAS showed keystore `XunsAMGKSH`, SHA-256 `CD:7A:17:F8 … 9B:9A:A9:69`.

| Check | Result |
| --- | --- |
| `gradlew.bat assembleRelease` (JAVA_HOME = jbr) | exit 0 in ~1 min; `app-release.apk` 61.6 MB |
| `verify_apk.py … --credentials credentials.json --package com.jiametric.invoiceerp` | 1.0.1 / versionCode 3; CPU arm64-v8a, x86_64; INTERNET and ACCESS_NETWORK_STATE not requested; APK cert `cd7a17f8…9b9aa969` = keystore cert = EAS fingerprint → MATCH; RESULT OK |
| `adb install -r` on the emulator (holds a debug-key build) | `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (signatures differ): expected; nothing changed on the emulator |
| Owner: "Yes, uninstall" → `adb uninstall com.jiametric.invoiceerp`, `adb install` | Success; app launches on the Dashboard with empty data (0 invoices; the Stock split pie shows its grey empty disc); `dumpsys`: versionCode 3, signature v2 |
| `adb install -r` of the same APK again | Success: from now on local and EAS builds update the emulator in place |

Still open: installing on the owner's phone (holds EAS build 3).

## 2026-10-29: build 4 (PIN lock, UPI / CASH pill)

Code at `020c390` (S7 app lock + `expo-local-authentication`, S2 payment pill). `versionCode` 3 → 4 in `app-version.json` and `android/app/build.gradle` (version stays 1.0.1), so Settings shows "build 4" and the phone (EAS build 3) accepts it as an update.

| Check | Result |
| --- | --- |
| `gradlew.bat assembleRelease -x lintVitalAnalyzeRelease -x lintVitalRelease` | BUILD SUCCESSFUL in 58 s |
| `verify_apk.py` | 1.0.1 / versionCode 4; arm64-v8a, x86_64; INTERNET and ACCESS_NETWORK_STATE not requested; APK cert = keystore cert `cd7a17f8…9b9aa969` → MATCH; installed versionCode 3 on the emulator; RESULT OK |
| `adb install -r` on emulator-5554 | Success; `dumpsys`: versionCode 4; relaunch shows the S7 lock with the emulator's existing PIN (data and PIN kept) |
| Copy | `release/InvoiceERP-1.0.1-build4-local.apk` (58.9 MB, git-ignored) |

Still open: install on the owner's phone (holds EAS build 3; same key, so `adb install -r` or opening the APK on the phone updates in place). Fingerprint unlock is first testable there.

## 2026-10-30: build 5 (LAN sync with the desktop)

Code at `f9ddb86` on branch `lan-sync` (schema v9, Settings → Sync with desktop, `expo-camera`, INTERNET kept). `versionCode` 4 → 5 was already set in `app-version.json` and `android/app/build.gradle` during the Phase 4 emulator test (an x86_64-only build then; this one has both CPU types).

| Check | Result |
| --- | --- |
| `gradlew.bat assembleRelease -x lintVitalAnalyzeRelease -x lintVitalRelease` | BUILD SUCCESSFUL in 7 s (native code already cached from build 4 and the x86_64 test build) |
| `verify_apk.py` | 1.0.1 / versionCode 5; arm64-v8a, x86_64; **INTERNET requested** (intended since build 5, LAN sync decision D5); ACCESS_NETWORK_STATE not requested; APK cert = keystore cert `cd7a17f8…9b9aa969` → MATCH; RESULT OK |
| APK contents | JS bundle has the 5-second sync check (`hasPending`); `expo-camera` and ML Kit barcode classes in the dex; CAMERA declared, RECORD_AUDIO absent |
| `adb install -r` on emulator-5554 | Success; relaunch shows the S7 lock (data kept) |
| Copy | `release/InvoiceERP-1.0.1-build5-local.apk` (75.0 MB, git-ignored, SHA-256 starts `9a33801494bb030f`) |

On the phone: install over EAS build 3 or local build 4 (same key, so it updates in place and keeps the data). The first start upgrades the database to schema v9, so export a backup from Settings → Backup & restore first. To sync, run Invoice ERP Desktop on a PC on the same Wi-Fi, choose Add phone, and scan the code from Settings → Sync with desktop.
