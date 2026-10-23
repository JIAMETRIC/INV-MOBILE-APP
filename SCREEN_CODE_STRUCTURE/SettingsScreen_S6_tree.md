# What's inside SettingsScreen (S6, phone and tablet)

File: `src/features/settings/SettingsScreen.tsx` (469 lines). Line numbers as of 2026-10-23, after the Three-Slot restructure (Prompt 52).
Opened by the Settings tab (bottom nav on phones, rail on tablets).
IDs (S6.x) are from `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md`.

The file reads top to bottom: the labels and numbers you edit most (`SECTIONS`, `VERSION_LABEL`, `S6`),
all the state in one hook (`useSettings`), the screen switch on `<Screen>`, then one function per
region in on-screen order: the header, the scroller, the section list, and each section's content.
Function names are stable; line numbers drift.

```
SECTIONS              S6.1  Company · Drafts · Backup & restore · Activity log (key · label · hint · icon)   35
VERSION_LABEL         "Invoice ERP 1.0.1 (build n)" from app-version.json                            42
S6                    every number specific to this screen:                                          46
                        listWidth 300 · paneMaxWidth 720 · auditRows 50 · inputPull −16 ·
                        pincodeLength 6 · panLength 10 · ifscLength 11 · numberPad 3

useSettings()         state + data, no JSX: section (lg+) · openOnPhone (one pane) · settings ·    64
                      drafts · backups · audit · busy · load · setField · saveCompany ·
                      exportBackup · importBackup · removeDraft · openDraft · Android Back

SettingsScreen()      the switch, on <Screen header>                                                185
├─ loading   → "Loading settings…" (before <Screen>, so every region sees loaded settings)
├─ one pane  → SectionScroll[ SectionList + version ]  or  SectionScroll[ SectionBody ]  (phones, md)
└─ lg+       → row[ SectionListPane 300 | SectionScroll (max 720)[ SectionBody ] ]

Header                S6.0  "Settings" + "Company, drafts, backup" (large); one pane with a         222
                      section open: its label + glass back button

Main
├─ SectionScroll      the one scroller: side padding (one pane) or end padding + max width (lg+)   240
├─ SectionList        S6.1  the four rows (chevrons on one pane, tint on lg+) + the version line   256
├─ SectionListPane    lg+: the fixed 300-dp left column holding SectionList                         275
├─ SectionBody        picks CompanyForm · DraftsPane · BackupPane · ActivityPane                    284
├─ FieldRow           one row, two equal input columns (<Columns kind="input">)                    294
├─ CompanyForm        S6.2  BusinessCard · BankCard · NumberingCard · Save (S6.2.4)                 299
│    ├─ BusinessCard  S6.2.1  name · subtitle · address · City | Pincode · PAN | Contact · email     311
│    ├─ BankCard      S6.2.2  Bank | Branch · A/C no | IFSC · UPI ID                                 335
│    └─ NumberingCard S6.2.3  Prefix | Next number (read-only, "PRE-002")                            356
├─ DraftsPane         S6.3  "Drafts (n)" title (lg+) · list card of DraftRows or "No drafts"        374
│    └─ DraftRow      (React.memo) avatar · party · "no · lines · ₹ · date" · trash (confirm)       392
├─ BackupPane         S6.4  info card + ExportRestoreRow · RecentBackups                            411
│    ├─ ExportRestoreRow  Export (blue) | Restore (glass)                                           428
│    └─ RecentBackups     "Recent backups": archive · file name · "kind · KB · date"                438
└─ ActivityPane       S6.5  "Recent activity" title (lg+) · list card of audit rows                  454

Footer: none (Save sits at the end of the company form)
```

## What each function does

| Function | Line | Does |
| --- | --- | --- |
| `useSettings()` | 64 | `load()` (settings, drafts, backups, the last `S6.auditRows` audit rows; reruns on `refreshKey`), `setField`, `saveCompany` (prefix defaults to `PRE-`, then refresh + snackbar), `exportBackup` (`exportDbBackup` → share), `importBackup` (pick a file → confirm → `restoreDbBackup`), `removeDraft` (confirm → `deleteDraft`), `openDraft` (S4 with the draft); Back closes the open section first on one pane |
| `SettingsScreen()` | 185 | the loading line, then the one-pane or the master-detail `<Screen>` |
| `Header` … `ActivityPane` | 222–454 | the regions above |

## Where to change what

| You want to change | Go to |
| --- | --- |
| a section's label, hint or icon; add a section | `SECTIONS` (35); add the matching case in `SectionBody` |
| the list width or the pane's reading width on tablets | `S6.listWidth`, `S6.paneMaxWidth` |
| how many audit rows show | `S6.auditRows` |
| a field's label, keyboard or length limit | its `<Input>` in `BusinessCard`, `BankCard` or `NumberingCard`; limits in `S6` |
| which fields share a row | the `<FieldRow>` around them |
| the order of the company cards | the four lines in `CompanyForm` (302–305) |
| what a draft row shows | `DraftRow` (392) |
| the backup text or buttons | `BackupPane` (411), `ExportRestoreRow` (428) |
| what an activity row shows | `ActivityPane` (454) |
| the version line | `VERSION_LABEL` (42) |
| what Save / Export / Restore do | `saveCompany`, `exportBackup`, `importBackup` inside `useSettings` |
| card / input / list looks (all screens) | `src/ui/components.tsx` |
| colours, radii, fonts | `src/ui/tokens.ts` |

## Size check (Prompt 52, after the restructure)

Phone (411 dp): list, Company, Drafts, Backup & restore, Activity log, Back: **0.000 % differing pixels** before vs after (the backup view was checked by eye; the before run missed its tap). md and lg: see the walkthrough, Prompt 52.

Earlier size notes (Prompts 30, 32) are superseded by this section.
