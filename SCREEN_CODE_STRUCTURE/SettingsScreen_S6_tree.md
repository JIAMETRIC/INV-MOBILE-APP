# What's inside SettingsScreen (S6, phone and tablet)

File: `src/features/settings/SettingsScreen.tsx` (327 lines). Line numbers as of 2026-10-23.
Opened by the Settings tab (bottom nav on phones, rail on tablets).
IDs (S6.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

```
SettingsScreen()                                                    line 34
│
├─ VERSION_LABEL      "Invoice ERP 1.0.1 (build n)" from app-version.json   23
├─ SECTIONS           the 4 rows: key · label · hint · Feather icon         27
│                     Company · Drafts · Backup & restore · Activity log
│
├─ "Loading settings…"  shown until getSettings() returns                   63
│
├─ PHONE: list, then drill-in                                     S6.1  283
│    ├─ TopAppBar     "Settings" + "Company, drafts, backup" (large)        287
│    │                or the open section's label + glass back button
│    ├─ ScrollView    padding 20, gap 16, bottom = navInset                 294
│    │    ├─ (nothing open) sectionList(true)                      S6.1  272
│    │    │    └─ Card list: one ListItem per SECTIONS row:                 273-280
│    │    │         icon chip · label · hint · chevron; tap = setOpenOnPhone
│    │    ├─ (nothing open) version caption, centred                        301
│    │    └─ (section open) panes[open.key]  → one of the 4 panes below     298
│    └─ Android Back  closes the open section first (useBackIntercept)      49
│
├─ S6.2 companyForm                                                       144
│    ├─ Card "Business"                                           S6.2.1  146
│    │    ├─ Business name                                                  148
│    │    ├─ Subtitle                                                       149
│    │    ├─ Address  (multiline)                                           150
│    │    ├─ row: City | Pincode  (1:1, 6 digits)                           152, 153
│    │    ├─ row: PAN | Contact  (1:1; PAN upper-case 10, Contact phone)    156, 157
│    │    └─ Email  (email keyboard)                                        160
│    ├─ Card "Bank / UPI"                                         S6.2.2  163
│    │    ├─ row: Bank | Branch  (1:1)                                      166, 167
│    │    ├─ row: A/C no | IFSC  (1:1; A/C numeric tabular, IFSC upper 11)  170, 171
│    │    └─ UPI ID                                                         174
│    ├─ Card "Invoice numbering"                                  S6.2.3  177
│    │    └─ row: Prefix | Next number  (1:1; Next number read-only,        181, 182
│    │            e.g. PRE-002, from next_seq)
│    └─ Button "Save" (blue, check icon, busy spinner)            S6.2.4  187
│
├─ S6.3 draftsPane                                                        191
│    ├─ SectionTitle "Drafts (n)"  (tablet only; phone shows it in the bar) 193
│    └─ Card list                                                           194
│         ├─ EmptyState "No drafts"                                         196
│         └─ one ListItem per draft: avatar initials · party ·              198
│              "draft_no · n lines · ₹total · date" · trash IconButton      206, 209
│              tap row = nav.openCreate({ draftId }); trash = confirm → delete
│
├─ S6.4 backupPane                                                        226
│    ├─ Card "Backup & restore"                                             228
│    │    ├─ info text (SQLCipher-encrypted, device-bound)                  230
│    │    └─ row: Button "Export" (blue, share) | "Restore" (outline)       235, 236
│    └─ (when backups exist) "Recent backups" + Card list                   239-249
│         └─ ListItem: archive icon · file name · "kind · KB · date"        244
│
├─ S6.5 activityPane                                                      254
│    ├─ SectionTitle "Recent activity"  (tablet only)                       256
│    └─ Card list                                                           257
│         ├─ EmptyState "No activity yet."                                  258
│         └─ ListItem per audit row (latest 50): clock icon ·               260
│              "action — entity_type entity_id" · created_at
│
└─ TABLET: master-detail                                                  311
     ├─ TopAppBar "Settings" (large, no back)                               313
     └─ row (gap 16)                                                        314
          ├─ left column, width 300: sectionList(false) (selected row       315
          │     tinted, no chevron) + version caption
          └─ ScrollView, maxWidth 720: panes[section]                       321
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `useBackIntercept` | 49 | phone: system Back closes the open section before leaving Settings |
| `load()` | 54 | settings, drafts, backups, last 50 audit rows; reruns on `nav.refreshKey` |
| `setField(k, v)` | 67 | edits one key of the local settings copy (not saved yet) |
| `saveCompany()` | 71 | `updateSettings(...)` (empty prefix falls back to `PRE-`) → `nav.refresh()` → snackbar |
| `doExportBackup()` | 91 | `exportDbBackup()` → share sheet → reload the backups list |
| `doImportBackup()` | 104 | pick a file → "Restore backup?" confirm → `restoreDbBackup(uri)` (a safety copy is taken first) → refresh → snackbar |
| `row(a, b)` | 135 | two inputs side by side, `flex: 1` each, gap 12 |
| `last` | 142 | style that removes the last Input's 16 bottom margin inside a card |
| `sectionList(phone)` | 272 | the 4-row list card; phone = chevron + drill-in, tablet = selected tint |

## Where to change what

| You want to change | Go to |
| --- | --- |
| a section's label, hint or icon | `SECTIONS`, lines 27-32 |
| add a section | add a row to `SECTIONS`, a key to `Section` (line 25), a pane to `panes` (line 268) |
| a field label, keyboard or max length | that `<Input … />` line in the tree above |
| which fields share a row | wrap them in `row(a, b)`, or unwrap to stack them |
| the Save button's label or icon | line 187 |
| which fields are saved | the object passed to `updateSettings` in `saveCompany()`, lines 75-82 |
| the backup info text / confirm text | lines 231-232 / 113-114 |
| the version line | `VERSION_LABEL`, line 23 (values from `app-version.json`) |
| tablet list width (300) or pane max width (720) | lines 315 / 321 |
| gap between cards / side padding | the ScrollView `contentContainerStyle`, line 295 (`layout.gap` 16, `layout.side` 20) |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |
| the look of every Card / Input / ListItem / Button | `src/ui/components.tsx` (changes all screens) |

## Tablet check (Prompt 32)

Checked on 2026-10-23 with `/tablet-check` (phone AVD resized): **md** 601×961 dp (8-inch portrait).

| Size | Seen | Verdict |
| --- | --- | --- |
| md 601 | since Prompt 32 the phone list (S6.1 with chevrons, version label) beside the rail; Company opens as a drill-in with a back bar; Back returns to the list | ok |
| lg / xl / xxl | master-detail (section list 300 + pane), seen at xl in Prompt 30 | ok |

`SettingsScreen` switches on `bp.panes === 1` (phones and md) instead of `bp.isPhone`.
