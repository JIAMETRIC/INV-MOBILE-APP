<!-- Copy of ~/.claude/skills/local-build-apk/SKILL.md (2026-10-28). The skill is the source: edit it there, then re-copy. Templates: ~/.claude/skills/local-build-apk/templates/. Prompt: /local-build-apk or "Local-Build-apk". -->

# Local-Build-apk

Implementation plan, first proven on the Invoice ERP app (2026-10). Goal: **development builds come from Gradle on this PC, production releases from EAS cloud, and both are interchangeable on a phone.** That only works when every APK carries the same signing key: Android refuses an update signed with a different key, and the only way round it is an uninstall, which erases the app's data.

Templates sit next to this file in `templates/`: `signing.gradle.txt`, `release-AndroidManifest.xml`, `verify_apk.py`.

## Rules (never break)

- **Never print, paste or commit the keystore passwords.** Gradle and `verify_apk.py` read them from `credentials.json`; you never open that file's values in chat.
- **The user downloads or creates the key themself** (`eas credentials` or `keytool`). It is their secret; ask them to run it and to back up `credentials.json` + the `.jks` outside the project.
- **Never install a debug-key APK over a phone app that holds real data.** Run `verify_apk.py` first; install only on `signature MATCH`.
- **Ask before any `adb uninstall`**: it erases that device's app data (an encrypted DB can't be restored without its Keystore key).
- `eas build --local` is not this plan: it is macOS/Linux only (on Windows it needs WSL) and rebuilds from scratch every time.

## 0. Survey the project (read only)

Find and write down, before changing anything:

| What | Where |
| --- | --- |
| package name, version source | `app.json` / `app.config.*` (`android.package`, `versionCode`), a version file if any |
| EAS project, profiles | `eas.json`, `owner` / `extra.eas.projectId` in the config |
| has the app ever been built on EAS? | `npx eas-cli build:list --platform android --limit 3 --json --non-interactive` |
| permissions the release profiles block | `blockedPermissions` in the config |
| is `android/` generated and git-ignored (CNG)? | `.gitignore`, `.easignore` |
| current CPU types | `android/gradle.properties` → `reactNativeArchitectures` |
| current signing | `android/app/build.gradle` → `signingConfigs` / `buildTypes` |
| Java and SDK | Android Studio's `jbr`; `%LOCALAPPDATA%\Android\Sdk` (Windows) |

No `android/` yet: run `npx expo prebuild --platform android` first.

## 1. The signing key (user step)

- **App already built on EAS** (phones have it): the user runs, in the project root,
  `npx eas-cli credentials -p android` → profile `preview` (or the one used for phones) → `credentials.json: Upload/Download …` → `Download credentials from EAS to credentials.json`.
  Result: `credentials.json` + `credentials/android/keystore.jks`.
- **Brand-new app, never on EAS**: the user creates a key (`keytool -genkeypair -v -storetype JKS -keystore credentials/android/keystore.jks -alias <app> -keyalg RSA -keysize 2048 -validity 10000`), writes `credentials.json` in the EAS format below, then uploads it once with `eas credentials` (`Upload credentials from credentials.json to EAS`) so later cloud builds use the same key.

```json
{ "android": { "keystore": { "keystorePath": "credentials/android/keystore.jks",
  "keystorePassword": "…", "keyAlias": "…", "keyPassword": "…" } } }
```

Then: back up both files outside the project. Losing them means phones can never be updated again.

## 2. Keep the key out of git and out of EAS uploads

Add to **both** `.gitignore` and `.easignore` (create `.easignore` by copying `.gitignore` if missing):

```
credentials.json
/credentials/
```

Check: `git check-ignore -v credentials.json credentials/android/keystore.jks` names both.

## 3. Gradle signs with that key (`android/app/build.gradle`)

Replace the template's `signingConfigs { … }` and the `signingConfig` lines of `buildTypes` with `templates/signing.gradle.txt` (keep the template's other `release` lines). It reads `../credentials.json` at build time; without the file it falls back to the debug key, so emulator builds keep working on a fresh checkout. Debug **and** release get the EAS key, so the two can replace each other on any device.

## 4. One APK for phones and the emulator (`android/gradle.properties`)

`reactNativeArchitectures=arm64-v8a,x86_64` (phones are arm64; the emulator is x86_64). Edit the real line, not the comment above it that mentions `x86_64`. Emulator-only quick build: add `-PreactNativeArchitectures=x86_64` on the command line.

## 5. Offline release builds (only if the EAS release profiles block permissions)

Copy `templates/release-AndroidManifest.xml` to `android/app/src/release/AndroidManifest.xml`, one `tools:node="remove"` line per blocked permission. Skip the step if the app needs the network.

## 6. Version

A phone accepts an APK only if its `versionCode` is **equal to or higher than** the installed one. Bump the version source before every build you hand out; for Gradle builds the number lives in `android/app/build.gradle` (`versionCode` / `versionName`), which prebuild regenerates from the config, so edit both or re-run prebuild.

## 7. Build

```
cd android
JAVA_HOME = <Android Studio>/jbr        (Windows Git Bash: export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr")
./gradlew assembleRelease               (Windows cmd/PowerShell: gradlew.bat assembleRelease)
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. The first build with arm64 compiles every native library for two CPU types (expect 20–30 min); later builds reuse Gradle's cache. If lint runs out of memory, add `-x lintVitalAnalyzeRelease -x lintVitalRelease`. Android Studio alternative: *Build → Generate Signed App Bundle / APK* with the same keystore.

## 8. Verify before it touches a phone

```
python -I ~/.claude/skills/local-build-apk/templates/verify_apk.py android/app/build/outputs/apk/release/app-release.apk --credentials credentials.json --package <package>
```

Needs `RESULT OK`: arm64-v8a present, `signature MATCH` (APK cert = keystore cert), INTERNET as intended, versionCode not below the installed one (when a device is on adb).

## 9. Install

- Emulator / USB phone: `adb install -r android/app/build/outputs/apk/release/app-release.apk` (`-r` keeps data).
- Phone without USB: copy the APK to the phone and open it (allow "install unknown apps" for the file manager).
- **First switch on a device that has a debug-key build** (typically the emulator): the install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Ask the user, then `adb uninstall <package>` once; that device's data is lost.

## 10. Make it stick (docs)

- `android/` is regenerated by `expo prebuild`: list the edits of steps 3–5 in the README's "re-apply after prebuild" table (the template comments start with `LOCAL EDIT` so `grep -rn "LOCAL EDIT" android` finds them).
- README: the local build command, the backup rule for the key, and that production stays on EAS.
- The project's own docs rules (topic folder, prompt log) if it has them.

Status (2026-10-28, Invoice ERP · Expo SDK 58 · React Native 0.88 · Windows 11 + Git Bash · Android Studio jbr): steps 0–8 pass. Key downloaded with `eas credentials`; `assembleRelease` built arm64-v8a + x86_64 in ~1 min (native code already cached; a clean first build is far longer); `verify_apk.py`: INTERNET not requested, APK cert = keystore cert = the SHA-256 that `eas credentials` shows → MATCH, RESULT OK. Step 9: the emulator holding a debug-key build refused it with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, as predicted; after the owner's OK, one `adb uninstall`, then install and `install -r` over it both succeed. **Not yet run:** install on a phone that has the EAS build.
