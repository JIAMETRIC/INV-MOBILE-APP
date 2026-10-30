# Sign in (S7) — Three-Slot tree

**File:** `src/features/auth/AuthScreen.tsx` (483 lines; line numbers as of 2026-10-29) · **Shown by:** `LockProvider` (`src/auth/LockProvider.tsx`) at app start, after `LOCK.relockAfterMs` (5 min) in the background, and from S6.6 (Lock now, Change PIN, New recovery code) · **Data:** `src/auth/authStore.ts` (expo-secure-store: PIN / recovery-code hashes, lockout counter, fingerprint switch), `src/auth/biometrics.ts` (expo-local-authentication) · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S7 · **Design:** `design/screens/04-sign-in` · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

A cover over the whole app, always on the dark Sign In recipe (`theme = dark`, line 50), whatever the phone's theme. It does not use `<Screen>` (no nav, no FAB): one `ScrollView` holding a centred column (max 400), or on a short landscape phone a row [ header + card + footer | keypad ].

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | logo (64, App Blue, white lock; hidden in the landscape row) · H1 title · 15 #ebeaea line, from `TEXT[step]` / `VERIFY_TEXT` | `Header` | 257-274 |
| Main | the step card (dark glass, radius 18), then the keypad on the PIN steps | `StepCard` (→ `PinEntry` / `RecoveryEntry` / `RecoveryCode` / `BioOffer` + `Message`), `Keypad` → `KeypadKey` | 277-437 |
| Footer | links pinned to the bottom (`marginTop: 'auto'`): Forgot PIN? Use recovery code · Back to PIN · Cancel | `Footer` | 440-459 |

## 2. The file in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `AuthFlow`, `Step` | 22-23 | the four flows and six steps |
| 2 | `TEXT`, `VERIFY_TEXT` | 26-34 | every title and line under it |
| 3 | `S7` | 37-48 | every number: top 88, gap 28, logo, dots, keys, breakpoints, message lines |
| 4 | `useAuthFlow()` | 56-199 | all state and step transitions (no JSX); `AuthState` 200 |
| 5 | `AuthScreen()` | 214-254 | the column / landscape-row switch |
| 6 | `Header` | 257 | S7.0 |
| 7 | `StepCard` · `PinEntry` · `RecoveryEntry` · `RecoveryCode` · `BioOffer` · `Message` | 277-377 | S7.1 |
| 8 | `Keypad` · `KeypadKey` | 380-437 | S7.2 |
| 9 | `Footer` | 440 | S7.3 |
| 10 | `FingerprintIcon` · `formatWait` | 462-483 | the Lucide fingerprint (Feather has none) · "1:35" |

## 3. Tree

```
AuthScreen(flow, bio, setBio, onDone, onCancel)                        214
├─ StatusBar light
└─ ScrollView (flexGrow 1, top max(88, inset + 32), sides 24)
   ├─ column (max 400, gap 28)            — default
   │  ├─ Header            S7.0                                          257
   │  ├─ StepCard          S7.1  one of:                                 277
   │  │  ├─ PinEntry       enter / create / confirm: dots · Continue (create)   290
   │  │  ├─ RecoveryEntry  recover: Input · Continue                     316
   │  │  ├─ RecoveryCode   code: the code · note · I have written it down 337
   │  │  ├─ BioOffer       bio: fingerprint · Turn on · Not now          352
   │  │  └─ Message        error / countdown (2 lines kept on PIN steps) 364
   │  ├─ Keypad            S7.2  PIN steps only: 4 rows × 3 KeypadKey    380
   │  └─ Footer            S7.3                                          440
   └─ row (short landscape, PIN steps)
      ├─ [ Header compact · StepCard · Footer ]
      └─ Keypad (keys 60)
```

## 4. State (`useAuthFlow`)

| State | Meaning |
| --- | --- |
| `step` | enter · recover · create · confirm · code · bio (start: `create` on setup, else `enter`) |
| `entry` / `first` / `len` | digits typed · the PIN from `create` · the stored PIN's length (dots on `enter`) |
| `codeInput` / `code` / `recovered` | the typed recovery code · the code being shown · came through the recovery code |
| `msg`, `until`, `now` | message line · lockout end · the countdown tick |
| `busy`, `bioTried` | a check is running · the automatic fingerprint prompt already opened |

Transitions: `press` (auto-checks at `len` / `first.length`, moves on at 6 on create) · `verify` → `afterEnter` · `toConfirm` · `confirm` → `setPin` → `showCode` · `submitCode` · `codeWritten` · `turnOnBio` · `goRecover` / `backToPin` · Android Back handler.

## 5. Where to change what

| Change | Where |
| --- | --- |
| words on a step | `TEXT` / `VERIFY_TEXT` |
| sizes, spacing | `S7` |
| PIN length, lockout timings | `PIN`, `LOCKOUT` in `src/auth/authStore.ts` |
| relock delay (5 min) | `LOCK.relockAfterMs` in `src/auth/LockProvider.tsx` |
| the Settings side (S6.6) | `SecurityPane` in `src/features/settings/SettingsScreen.tsx` |

## 2026-10-30 addendum: person flow (LAN_SYNC Phase 5)

`AuthFlow` gains `person`, `Step` gains `pick`. `LockProvider` shows `person` instead of `unlock` once the phone is paired and the desktop has people (`src/auth/people.ts`).

| Region / piece | Where | Content |
| --- | --- | --- |
| `TEXT.pick`, `PERSON_TEXT(name)` | top, line 38 | "Who's using Invoice ERP?" / "Choose your name, then enter your PIN"; "Hi, <name>" / "Enter your PIN" |
| `useAuthFlow` | `people`, `who`; `pickPerson` (138), `backToPick` (139); `verify` checks `checkPersonPin` and calls `signIn` in the person flow; Back on `enter` returns to `pick` | |
| S7.1 pick | `PeoplePicker` (338) | `ListItem` per person (initials, `leadingAlt` for staff, Owner / Staff, chevron), then the forgotten-PIN line |
| S7.3 | `Footer` (480) | person flow on `enter`: "Not <name>? Choose another person" instead of the recovery link |

No new `S7` numbers; the keypad and dots are unchanged (dots = the person's `pin_len`). Checked on the emulator (1080 × 2400, 411 dp): pick with Owner and Ravi, "Hi, Ravi" with 6 dots, sign-in to the Dashboard.
