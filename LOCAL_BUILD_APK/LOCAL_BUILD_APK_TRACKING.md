# Local APK builds — tracking

The plan itself is the portable skill **`~/.claude/skills/local-build-apk/SKILL.md`** (prompt: `/local-build-apk` or "Local-Build-apk"), with its templates in `templates/`. This file records how it is applied to Invoice ERP.

## Rationale

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| Dev builds with Gradle on this PC, production with EAS cloud (owner, 2026-10-28) | Gradle reuses its cache between builds; EAS cloud waits in a queue. Production keeps EAS's clean, all-CPU build. | Cloud for everything; `eas build --local`. |
| Not `eas build --local` | EAS local builds run on macOS / Linux only; this host is Windows without WSL. Each run also starts from a clean prebuild, so no cache. | WSL + Android SDK inside it. |
| Sign local builds with the **EAS key** (`XunsAMGKSH`), read by Gradle from `credentials.json` | The phone's app came from EAS. Android rejects an update signed with another key; the only way round is an uninstall, which erases the invoices (the SQLCipher key lives in the Android Keystore, so a DB copy can't be restored either). | Template debug key (phone needs an uninstall); a separate local key (same problem). |
| Gradle reads `credentials.json` itself | The passwords never get copied into `gradle.properties`, chat or git. Missing file → debug key, so a fresh checkout still builds for the emulator. | Passwords in `~/.gradle/gradle.properties`. |
| Debug **and** release use the EAS key | Debug (Metro) and release builds can replace each other on the emulator and a phone without uninstalls. | Release only. |
| `reactNativeArchitectures=arm64-v8a,x86_64` | One APK installs on phones (arm64) and the emulator (x86_64). Slower: the README measured ~30 s for x86_64 only vs ~24–25 min for all CPUs on a clean build. | x86_64 for daily work, arm64 only for phone builds (`-PreactNativeArchitectures=x86_64` still does that). |
| `src/release/AndroidManifest.xml` removes INTERNET + ACCESS_NETWORK_STATE | Matches `app.config.ts` `blockedPermissions` for EAS preview / production: the app stays offline. Debug keeps INTERNET for Metro. | Regenerate `android/` with `EAS_BUILD_PROFILE=preview` (would also drop it from debug). |
| A portable skill + Python verifier | The owner wants to reuse the plan in the next project by prompt; `verify_apk.py` proves the signature match before a phone install. | A README section only. |

## Specs (this project)

| Item | Value |
| --- | --- |
| Package | `com.jiametric.invoiceerp` |
| EAS key | remote keystore `XunsAMGKSH` (default), used by builds 2 and 3 |
| Key files (git- and EAS-ignored) | `credentials.json`, `credentials/android/keystore.jks` |
| Edits in `android/` (re-apply after prebuild; `grep -rn "LOCAL EDIT" android`) | `app/build.gradle` signing block · `gradle.properties` `reactNativeArchitectures=arm64-v8a,x86_64` · `app/src/release/AndroidManifest.xml` |
| Ignore lines | `.gitignore` and `.easignore`: `credentials.json`, `/credentials/` |
| Version | `app-version.json` (1.0.1 / versionCode 3) and `android/app/build.gradle` (`versionCode 3`, `versionName "1.0.1"`) |
| Build | `cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleRelease` |
| Verify | `python -I ~/.claude/skills/local-build-apk/templates/verify_apk.py android/app/build/outputs/apk/release/app-release.apk --credentials credentials.json --package com.jiametric.invoiceerp` |
| Emulator | switched to the EAS key on 2026-10-28 (one `adb uninstall`, owner's OK; test data erased). Local and EAS builds now update it in place |
