# AUTH_AND_LOCK — Walkthrough

## 2026-10-29: S7 app lock (PIN, fingerprint, recovery code) and S6.6 Security

### Changes

| File | Change |
| --- | --- |
| `package.json` | `expo-local-authentication ~58.0.2` (`npx expo install`) |
| `app.config.ts` | plugin `expo-local-authentication` (iOS Face ID text; Android permissions come from the module manifest) |
| `src/auth/authStore.ts` (new) | PIN / recovery-code hashes, lockout counter, fingerprint switch |
| `src/auth/biometrics.ts` (new) | `bioAvailable()`, `bioUnlock()` |
| `src/auth/LockProvider.tsx` (new) | gate state, AppState relock, `useLock()`, the cover |
| `src/features/auth/AuthScreen.tsx` (new) | S7, Three-Slot layout |
| `src/shell/App.tsx` | `LockProvider` around `NavProvider` |
| `src/features/settings/SettingsScreen.tsx` | `security` section, `SecurityPane` (S6.6), `toggleBio` |
| Docs | `SCREEN_LAYOUT_REFERENCE.md` (map, S0.1.3, S6.6, S7), `scripts/screen-map.py` (+ `screen-map.html`, 8 screens), `SCREEN_CODE_STRUCTURE/AuthScreen_S7_tree.md` (new), `SettingsScreen_S6_tree.md` addendum, README |

### Findings during the test

- A first scripted run reported "The PINs did not match" although the code was right: the error line pushed the keypad down, and the next taps landed on other keys. The same would happen under a real finger, so the message line now keeps its two lines on the PIN steps (`S7.messageLines`). The keypad still moves between steps (create has a Continue button and a two-line subtitle), which is expected.

### Checks (emulator-5554, Medium Phone API 37, 411 dp; release APK from local Gradle, `adb install -r`, data kept)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | no errors |
| `assembleRelease` | BUILD SUCCESSFUL; `aapt2 dump permissions`: `USE_BIOMETRIC`, `USE_FINGERPRINT` present, no `INTERNET` |
| First open after the update | "Create a PIN": logo, H1, dark card with 6 dots and a disabled Continue, round glass keypad; matches 04-sign-in |
| Mismatched confirm | red "The PINs did not match. Choose your PIN again." and back to create |
| Create + confirm a 4-digit PIN | recovery code shown (`XXXX-XXXX-XXXX`) → "I have written it down" → Dashboard (2 invoices · ₹350.00, data kept); no fingerprint step because none is enrolled |
| Restart (force-stop + launch) | "Welcome back", 4 dots, "Forgot PIN? Use recovery code" |
| Wrong PIN | "Wrong PIN." |
| 5 wrong in a row | keypad dimmed, "Too many wrong tries. Try again in 0:29." counting down |
| Recovery code during the lockout | "Try again in 0:08." (same counter), Continue disabled |
| Recovery code typed in lower case with dashes, after the wait | accepted → "Choose a new PIN" → 6-digit PIN (moves on at 6) → confirm → a new recovery code → app |
| Settings | four sections; Security: App lock card, fingerprint switch greyed ("Add a fingerprint in Android Settings…"), Change PIN, New recovery code, Lock now |
| Lock now → unlock | back on Settings → Security (the shell stayed mounted) |
| Change PIN → Android Back | "Enter your PIN" with Cancel; Back returns to Security |
| Fingerprint unlock | **not tested**: the emulator has no screen lock or fingerprint enrolled (enrolling changes the emulator's security settings) |
| 5-minute relock, tablets, landscape, dark mode | **not tested** |

The emulator's test PIN is the 6-digit one set through the recovery path; its recovery code was shown on screen once (emulator test data only).
