# AUTH_AND_LOCK — Tracking

The app lock: S7 Sign in (`src/features/auth/AuthScreen.tsx`), `src/auth/` (LockProvider, authStore, biometrics) and S6.6 Settings → Security.

## Rationale

| Decision | Why | Alternatives considered |
| --- | --- | --- |
| A local app lock, not online accounts | The app is offline and single-device (SQLCipher database, key in the Android Keystore, INTERNET stripped from release builds). The owner chose a PIN lock. | Email + password against a server (Firebase / Supabase): needs internet, a backend and accounts; only worth it for several staff or devices. Password lock (owner picked PIN). |
| PIN 4–6 digits; unlock and confirm check as soon as the last digit is in | Owner's choice (fast at the counter). The stored length gives the dot count, so no OK key. | A fixed 4-digit PIN; a 6-digit-only PIN. |
| PIN and recovery code stored as salted SHA-256 in expo-secure-store (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), next to the database key | Uses modules already in the build; the Keystore encrypts the values; the PIN never exists in plain text. | Hashing with many iterations: each `digestStringAsync` call crosses the bridge, and with at most 10^6 PINs iterations add little; the real limits are the Keystore and the lockout. |
| The lock gates the UI; the database key is unchanged | A forgotten PIN must not lose invoices (the recovery code resets it). Wrapping the database key with the PIN would make "forgot PIN" lose everything. | Deriving the SQLCipher key from the PIN. |
| Lockout: 5 free tries, then 30 s doubling to 15 min; shared by PIN and recovery code; kept across restarts | Stops guessing without locking the owner out for long. | A fixed lockout; wiping after N tries (would lose invoices). |
| Recovery code: 12 characters from 32 (no I, O, 0, 1), `ABCD-EFGH-JKLM`, shown once; using it sets a new PIN and a new code | Owner chose "recovery code". 32 characters → `byte & 31` is uniform; ~60 bits. Case and dashes are ignored when typed. | No reset (forgetting the PIN would mean reinstalling and losing all invoices). |
| Fingerprint / face via expo-local-authentication, `disableDeviceFallback: true`, cancel = "Use PIN"; offered after setup only when enrolled; the Settings switch asks for a fingerprint first | Owner chose biometrics with PIN fallback. The module's own manifest adds `USE_BIOMETRIC` / `USE_FINGERPRINT`, so no `expo prebuild` was needed (android/ is generated and git-ignored). | The phone's screen-lock PIN as fallback (that is not the app's PIN). |
| The PIN screen covers the shell (absolute fill); the shell stays mounted and is hidden from screen readers | A half-made invoice survives a lock. | Unmounting the shell while locked. |
| Relock after 5 min in the background (`LOCK.relockAfterMs`), plus Lock now | Short trips (share sheet, file picker, fingerprint prompt) don't ask again. | Every return from the background. |
| Always the dark Sign In recipe, in light and dark mode | Owner's choice; matches `design/screens/04-sign-in`. | Following the phone theme. |
| Radii from the owner's tighter scale: card `radius.form` 18, logo `radius.bar` 16; keys round (50 %) | CLAUDE.md project exceptions (the reference has 28 / 20). | — |
| Keypad digits in Inter 300 28 | They are not amounts or quantities (the Bebas Neue exception); kit "big numbers use 300". | Bebas Neue. |
| Fingerprint glyph drawn with react-native-svg from Lucide "fingerprint" (ISC) | Feather has no fingerprint icon; Lucide is the kit's line set (stroke 1.8, round caps). | MaterialCommunityIcons `fingerprint` (not the line style). |
| The message line keeps 2 lines on the PIN steps | When an error appeared the keypad moved down under the finger. | Showing the error outside the card. |
| Web preview tier: never locked | expo-secure-store has no working web build (same as `dbKey.web.ts`). | — |

## Specs

### Storage (`src/auth/authStore.ts`, expo-secure-store)

| Key | Value |
| --- | --- |
| `auth_pin_v1` | `{ salt (16 bytes hex), hash (SHA-256 of "salt:pin"), len }` |
| `auth_recovery_v1` | `{ salt, hash }` of the normalised 12-character code |
| `auth_bio_v1` | `'1'` / `'0'` |
| `auth_fails_v1` | `{ count, until }` (ms epoch); deleted on success and when a PIN is set |

| Constant | Value |
| --- | --- |
| `PIN` | min 4, max 6 |
| `LOCKOUT` | freeTries 5, baseMs 30 000, maxMs 900 000 |
| `CODE` | alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, length 12, groups of 4 |
| `LOCK.relockAfterMs` | 300 000 |

### Flows (`LockProvider` gate → `AuthScreen` steps)

| Gate | Steps |
| --- | --- |
| `checking` | black cover while secure storage is read |
| `setup` | create → confirm → code → bio (if enrolled) |
| `unlock` | enter (auto fingerprint prompt) · recover → create → confirm → code |
| `change` | enter → create → confirm (cancellable) |
| `new-code` | enter → code (cancellable) |

### S7 layout (`S7` in AuthScreen.tsx)

| Item | Value |
| --- | --- |
| top / sides / gap | 88 (or status bar + 32) / 24 / 28 |
| logo | 64, `radius.bar` 16, `accent`, white lock 30, `shadow.secondary` |
| card | dark glass (`dark.glass`, `glassBorder`, `cardShadow` with inset), `radius.form` 18, padding 24, gap 16 |
| dots | 14, gap 16, border 1.5 `textDisabled` → filled `accent` |
| keys | 72 round (60 under 700 dp tall), gap 14 vertical / 28 horizontal, dark glass + `tileShadow`; icon keys ghost |
| column | max 400; short landscape (< 600 tall) → row, keys 60, no logo |
