# Settings (S6) — Three-Slot tree

**File:** `src/features/settings/SettingsScreen.tsx` (469 lines; line numbers as of 2026-10-23) · **Reached by:** the Settings tab (S0.4.1 `settings`): the floating bottom nav on phones (S0.4.2), the rail on tablets (S0.4.3) · **Data:** `getSettings()` `src/data/settingsRepo.ts:5`, `updateSettings()` `src/data/settingsRepo.ts:18`, `listDrafts()` `src/data/draftsRepo.ts:9`, `deleteDraft()` `src/data/draftsRepo.ts:55`, `exportDbBackup()` `src/data/backupRepo.ts:32`, `restoreDbBackup()` `src/data/backupRepo.ts:45`, `listBackups()` `src/data/backupRepo.ts:61`, `recentAudit()` `src/data/auditRepo.ts:25`, `shareFile()` `src/export/pdf.ts:49`, `DocumentPicker.getDocumentAsync` (expo-document-picker) · **Reference:** `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` § S6 · **Method:** `.claude/skills/three-slot-screen/SKILL.md`

The company details, drafts, backup and the activity log, in four sections. One pane (`bp.panes === 1` = xs/sm/md): the section list, or one section under the header with a back button (`openOnPhone`); system Back closes the section first. lg+ (`bp.panes` 2 or 3): a master-detail row, the 300-dp list beside the selected section (`section`). `bp.isPhone` (xs/sm) only changes the bottom inset, through `useNavInset()`.

## 1. The three slots

| Slot | What is there | Function | Lines |
| --- | --- | --- | --- |
| Header | `TopAppBar large`: "Settings" over the caption "Company, drafts, backup"; on one pane with a section open, that section's label (not large) with a back button that clears `openOnPhone` | `Header` | 222-232 |
| Main | one `ScrollView` (`SectionScroll`): on one pane, the section list or the open section, padded on both sides; on lg+, a `View` row [ `SectionListPane` 300 \| `SectionScroll` capped at 720 ]; bottom = `useNavInset()` (no `fab` slot and no `overlay`, so the same value `useMainInset()` would give) | `SectionScroll`, `SectionListPane`, `SectionBody` | 240-291 |
| Footer | none: the only screen-level action, Save, sits at the end of `CompanyForm` (S6.2.4) and scrolls with it; Export and Restore belong to the backup card | — | — |
| FAB | none | — | — |
| Nav / rail | owned by the shell (S0) | — | — |

Before any slot renders, `SettingsScreen()` shows the text "Loading settings…" until `settings` is loaded (lines 190-192); below that line every region takes `Loaded` (`SettingsState & { settings: Settings }`, line 179), so no region handles `null`.

## 2. The file in reading order

| # | Block | Lines | What you edit there |
| --- | --- | --- | --- |
| 1 | `SECTIONS` | 35-40 | the four sections: key · label · hint · Feather icon (S6.1) |
| 2 | `VERSION_LABEL` | 42 | "Invoice ERP <version> (build <versionCode>)" from `app-version.json` |
| 3 | `S6` | 46-55 | every number specific to this screen |
| 4 | `Backup`, `AuditRow` types | 57-58 | row types derived from the repo return types |
| 5 | `useSettings()` | 64-176 | all state, data and actions (no JSX); `SettingsState` 177, `Loaded` 179 |
| 6 | `SettingsScreen()` | 185-218 | the loading line, then the one-pane / master-detail switch on `<Screen header>` |
| 7 | `Header` | 222-232 | the header |
| 8 | `SectionScroll` · `SectionList` · `SectionListPane` · `SectionBody` · `FieldRow` | 240-296 | the scroller, the list, the lg+ list column, the section switch, the two-column input row |
| 9 | `CompanyForm` · `BusinessCard` · `BankCard` · `NumberingCard` | 299-370 | S6.2 |
| 10 | `DraftsPane` · `DraftRow` (memo) | 374-408 | S6.3 |
| 11 | `BackupPane` · `ExportRestoreRow` · `RecentBackups` | 411-451 | S6.4 |
| 12 | `ActivityPane` | 454-469 | S6.5 |

## 3. Tree

```
SettingsScreen()                                                        line 185
│   "Loading settings…" until getSettings() resolves; then every region sees Loaded   190
│
├─ Header               S6.0  TopAppBar large: "Settings" / "Company, drafts, backup"   222
│                             one pane, section open: its label + back button → setOpenOnPhone(null)
│
├─ SectionScroll (side)       ScrollView: sides 20, top 4, gap 16; bottom = useNavInset()   240
│    │
│    ├─ no section open
│    │    └─ SectionList  S6.1  Card list: ListItem × 4, icon chip · label · hint, chevron   256
│    │         ├─ "Company"           briefcase      → setOpenOnPhone('company')         36
│    │         ├─ "Drafts"            file           → setOpenOnPhone('drafts')          37
│    │         ├─ "Backup & restore"  upload-cloud   → setOpenOnPhone('backup')          38
│    │         ├─ "Activity log"      clock          → setOpenOnPhone('activity')        39
│    │         └─ VERSION_LABEL  caption, centred, under the card                       267
│    │
│    └─ section open      SectionBody: switch (section)                                   284
│         ├─ CompanyForm      S6.2    column, gap 16                                      299
│         │    ├─ BusinessCard  S6.2.1  Card: SectionTitle "Business"                    311
│         │    │    ├─ Business name · Subtitle · Address (multiline)                    316
│         │    │    ├─ FieldRow  [ City | Pincode ]       Columns kind="input"          319
│         │    │    ├─ FieldRow  [ PAN | Contact ]        Columns kind="input"          323
│         │    │    └─ Email   (wrapped, marginBottom S6.inputPull)                      327
│         │    ├─ BankCard      S6.2.2  Card: SectionTitle "Bank / UPI"                  335
│         │    │    ├─ FieldRow  [ Bank | Branch ]        Columns kind="input"          340
│         │    │    ├─ FieldRow  [ A/C no | IFSC ]        Columns kind="input"          344
│         │    │    └─ UPI ID  (wrapped, marginBottom S6.inputPull)                      348
│         │    ├─ NumberingCard S6.2.3  Card: SectionTitle "Invoice numbering"           356
│         │    │    └─ FieldRow  [ Prefix | Next number (read-only, tabular) ]           362
│         │    │                 wrapped, marginBottom S6.inputPull
│         │    └─ Button "Save" S6.2.4  icon check, busy → saveCompany()                 305
│         │
│         ├─ DraftsPane       S6.3    SectionTitle "Drafts (n)" on lg+ only; Card list   374
│         │    └─ DraftRow × n (React.memo), or EmptyState "No drafts"                   392
│         │         avatar initials · party · "draft_no · n lines · ₹total · date" · trash
│         │
│         ├─ BackupPane       S6.4    column, gap 16                                      411
│         │    ├─ Card (gap 16): SectionTitle "Backup & restore" · info text             414
│         │    │    └─ ExportRestoreRow  [ Export (blue) | Restore (outline) ]           428
│         │    └─ RecentBackups  (only when backups.length > 0)                          438
│         │         SectionTitle "Recent backups" · Card list: archive · file name · "kind · KB · date"
│         │
│         └─ ActivityPane     S6.5    SectionTitle "Recent activity" on lg+ only; Card list   454
│              └─ ListItem × n: clock · "action — entity_type entity_id" · created_at     461
│                 EmptyState "No activity yet." when audit is empty                       460
│
├─ Footer                     none (Save is the last row of CompanyForm)
└─ fab slot                   none

lg+ (panes):  Header (large, no back) · View row, gap 16                                 208
              [ SectionListPane 300 | SectionScroll max 720 [ SectionBody(section) ] ]
   SectionListPane   width S6.listWidth, paddingStart 20, gap 16:                        275
                     SectionList phone={false}: no chevrons, the selected row tinted,
                     tap → setSection(key); VERSION_LABEL left-aligned under it
   SectionScroll     paddingEnd 20, bottom = useNavInset(), maxWidth S6.paneMaxWidth,    240
                     flexGrow 1
```

## 4. The `S6` numbers

| Key | Value | ID | Means |
| --- | --- | --- | --- |
| `listWidth` | 300 | S6.1 (lg+) | the width of the section list column |
| `paneMaxWidth` | 720 | Main (lg+) | the selected section's reading width |
| `auditRows` | 50 | S6.5 | how many audit rows `recentAudit` loads |
| `inputPull` | `-space[4]` (−16) | S6.2.1 · S6.2.2 · S6.2.3 | the last `Input` in a card drops its 16 bottom margin, so the card's padding stays even |
| `pincodeLength` | 6 | S6.2.1 | `maxLength` of Pincode |
| `panLength` | 10 | S6.2.1 | `maxLength` of PAN |
| `ifscLength` | 11 | S6.2.2 | `maxLength` of IFSC |
| `numberPad` | 3 | S6.2.3 | the next sequence is zero-padded to 3 digits ("PRE-002") |

Shared spacing comes from `src/ui/tokens.ts`: `layout.side` 20, `layout.gap` 16, `layout.grid` 12.

## 5. Rows and columns

| Row | Function | Cells | Rule |
| --- | --- | --- | --- |
| S6.2.1 City \| Pincode | `FieldRow` in `BusinessCard`, line 319 | 2: City · Pincode (numeric, 6) | `Columns kind="input"`: stacks under 128 dp per cell |
| S6.2.1 PAN \| Contact | `FieldRow` in `BusinessCard`, line 323 | 2: PAN (characters, 10) · Contact (phone pad) | `Columns kind="input"`: stacks under 128 dp per cell |
| S6.2.2 Bank \| Branch | `FieldRow` in `BankCard`, line 340 | 2: Bank · Branch | `Columns kind="input"`: stacks under 128 dp per cell |
| S6.2.2 A/C no \| IFSC | `FieldRow` in `BankCard`, line 344 | 2: A/C no (numeric, tabular) · IFSC (characters, 11) | `Columns kind="input"`: stacks under 128 dp per cell |
| S6.2.3 Prefix \| Next number | `FieldRow` in `NumberingCard`, line 362 | 2: Prefix · Next number (`editable={false}`, tabular) | `Columns kind="input"`: stacks under 128 dp per cell |
| S6.4 Export \| Restore | `ExportRestoreRow`, line 428 | 2 `Button`s, `flex: 1` each, gap `layout.grid` 12 | a plain `View` row, not `Columns`: never stacks. Its comment states the layout, not a reason |
| lg+ panes | `SettingsScreen`, line 210 | 2: `SectionListPane` (fixed 300) · `SectionScroll` (`flexGrow: 1`, max 720) | a `View` row with gap 16; the list never shrinks, the scroller takes the rest |

`FieldRow` (line 294) is the one wrapper: `<Columns kind="input">{children}</Columns>`. `Columns` decides from its own measured width, so the rule holds inside the lg+ pane as well as at full width. The S6.1 list and the S6.3 / S6.4 / S6.5 lists are `ListItem` rows, not column rows.

## 6. State and actions (`useSettings()`)

| Name | Does |
| --- | --- |
| `section` / `setSection` | the selected section on lg+ (`'company'` at start) |
| `openOnPhone` / `setOpenOnPhone` | the drilled-in section on one pane (`null` = the list) |
| `settings` | the editable copy of `Settings`; `null` until `load()` returns, which is the loading line in `SettingsScreen()` |
| `drafts`, `backups`, `audit` | the three lists (`Draft[]`, `Backup[]`, `AuditRow[]`) |
| `busy` | true while Save, Export or Restore runs; the three buttons show it |
| `useBackIntercept` (lines 77-80) | on one pane with a section open, system Back sets `openOnPhone` to `null` and claims the event; otherwise it lets Back leave Settings |
| `load()` (internal, lines 82-87) | `getSettings`, `listDrafts`, `listBackups`, `recentAudit(S6.auditRows)`, in that order; reruns whenever `nav.refreshKey` changes (line 89). Not returned from the hook |
| `setField(k, v)` | edits one key of the local `settings` copy |
| `saveCompany()` | `updateSettings` with the thirteen company and bank fields plus `invoice_prefix` (defaults to `'PRE-'` when empty); keeps the saved row, `nav.refresh()`, snackbar "Company settings saved" |
| `exportBackup()` | `exportDbBackup()` then `shareFile(uri)`, then `load()`; failure shows the "Backup failed" alert |
| `importBackup()` | `DocumentPicker.getDocumentAsync` (sqlite3 / octet-stream) → the "Restore backup?" confirm (Cancel / Restore, destructive) → `restoreDbBackup(uri)`, `nav.refresh()`, `load()`, snackbar "Database restored from backup"; failure shows "Restore failed" |
| `removeDraft(d)` | `useCallback`: the "Delete draft?" confirm (title is `d.draft_no`) → `deleteDraft(d.id)` → `load()` + snackbar "Draft deleted" |
| `openDraft(d)` | `useCallback`: `nav.openCreate({ draftId: d.id })` (S4 with the draft) |

`DraftRow` is `React.memo` and takes `d`, `alt`, `last`, `onOpen`, `onDelete`, `theme` as explicit props; `onOpen` and `onDelete` are the two `useCallback` handlers above, so a re-render of the pane does not re-render untouched rows.

## 7. Where to change what

| You want to change | Go to |
| --- | --- |
| a section's label, hint or icon; the section order | `SECTIONS`, lines 35-40 |
| add a section | `Section` type (32), a `SECTIONS` entry, a `case` in `SectionBody` (284-291) and its pane function |
| the header title or caption | `Header`, lines 225-226 |
| the version line | `VERSION_LABEL`, line 42 (values in `app-version.json`); its placement in `SectionList`, line 267 |
| the list width or the pane's reading width on lg+ | `S6.listWidth`, `S6.paneMaxWidth` |
| the scroller's padding or the bottom inset | `SectionScroll`, lines 244-246 (`layout.side`, `useNavInset()`) |
| a field's label, keyboard, capitalisation or length limit | its `<Input>` in `BusinessCard` (316-328), `BankCard` (341-349) or `NumberingCard` (363-365); limits in `S6` |
| which two fields share a row | move the `<Input>`s inside or outside a `<FieldRow>` |
| when a two-column row stacks | `FieldRow`, line 295 (`kind`, `minCell`, `stackAt` on `Columns`) |
| the order of the company cards, or the Save button | `CompanyForm`, lines 302-305 |
| the last input's pull inside a card | `S6.inputPull` and the three wrapping `View`s (327, 348, 361) |
| the next-number padding | `S6.numberPad` |
| how many audit rows show | `S6.auditRows` |
| what a draft row shows | `DraftRow`, lines 396-406 |
| the drafts or activity empty text | `EmptyState` in `DraftsPane` (381) and `ActivityPane` (460) |
| the backup info text | `BackupPane`, lines 416-419 |
| the Export / Restore buttons | `ExportRestoreRow`, lines 431-432 |
| what a recent-backup row shows | `RecentBackups`, lines 444-446 |
| what an activity row shows | `ActivityPane`, lines 462-464 |
| what Save / Export / Restore / delete do | `saveCompany`, `exportBackup`, `importBackup`, `removeDraft` in `useSettings` |
| the confirm dialog texts | `importBackup` (136-143), `removeDraft` (160-166) |
| what Back does on one pane | `useBackIntercept`, lines 77-80 |
| card, input, list row, app bar looks (all screens) | `src/ui/components.tsx` |
| colours, radii, fonts | `src/ui/tokens.ts` (never hex values in this file) |

## 8. Sizes

| Size | Layout | Last checked |
| --- | --- | --- |
| phone5 360 × 640 (5-inch) | The four-row section list and the version line with room to spare; Company: Business name, Subtitle, Address, City | Pincode above the nav, the rest by scrolling. | Prompt 65 |
| xs 320 · sm 360 · phone 411 | one pane: header, the list card with chevrons and the version line, or a section under its label with a back button; bottom nav floating, no FAB | Prompt 44 (xs: the list and the drill-in fine; sm: complete, nothing truncated), Prompt 52 (411: list, Company, Drafts, Activity log and the list after Back pixel-identical before / after, 0.000 % differing; Backup & restore checked by eye: info card, Export \| Restore, four recent backups). xs and sm were run before the company rows became `Columns` (Prompt 52 re-ran 411, md and lg only) |
| phone landscape (lg) | master-detail beside the rail: the 300-dp list and the section pane; fits in 411 dp of height and scrolls | Prompt 44 |
| md 601 (8-inch portrait) | one pane + rail: the list with chevrons and the version line, then Company as a drill-in under its back bar; Back returns to the list | Prompt 32 (md became one pane), Prompt 52 |
| lg 800 · xl 961 · xxl 1280 | master-detail: the 300-dp list with the tinted selected row and the version line, the section in the pane capped at 720 with its two-column rows side by side | Prompt 52 (lg), Prompt 30 (lg, xl, xxl: as designed) |

Open findings (not applied): none.
