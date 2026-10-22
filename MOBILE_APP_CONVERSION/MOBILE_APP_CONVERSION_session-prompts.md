# MOBILE_APP_CONVERSION — Session Prompts

Topic-specific prompt log. Append-only; never overwrite prior entries.

## Prompt 1

```
With Continuous Mode Just Convert this application as a Mobile App As per "\invoice-app-plan.mdinvoice-app-plan.md"
```

## Prompt 2

```
Test with Simulators or your own method
```

## Prompt 3

```
Anything Just Light weight Emulator will run with AI LLM Tools?
```

## Prompt 4

```
Show me in this: Web preview + browser-use (zero install) — expo start --web, drive it with the browser tools I already have. Catches layout/breakpoint/nav bugs, but not the native layer (SQLCipher, expo-print, Keystore all mocked). ~free.
```

## Prompt 5

```
5 inch and 6 inch Display also it would be Responisve?
```

## Prompt 6

```
Build .apk
```

## Prompt 7

```
https://expo.dev/accounts/jiametrics-team/projects/trap-logger-app and Tokens: [redacted — account EXPO_TOKEN, see .env handling]
```

## Prompt 8

```
Completed?
```

## Prompt 9

```
Still No update check the Problem?
```

## Prompt 10

```
Note: ... The Token was created for Trap-logger-app: This may create any problem or the Delay is beacuse of that?
```

## Prompt 11

```
Because i am crossing my Sleeping time
```

## Prompt 12

```
Give me Proper UI Screen Options and High Quality icons also
```

## Prompt 13

```
U2 — JIAMETRIC Brand (recommended) and I1 — Hairline (outline, stroke 1.8) · calm & professional: Implement in my app
```

## Prompt 14

```
Task1: Remove Completely GST Related from this Mobile App
Task2: Remove Clients Related from this Mobile App
```

AskUserQuestion answers (design decisions approved mid-task):
- Clients replacement: "Free-text party on invoice (Recommended)" — invoices keep a party
  name/address/city/pincode/mobile/email snapshot typed directly; no clients table or screen.
- Migration strategy: "Clean rebuild (Recommended)" — fresh schema v2, old v1 DB wiped on
  version mismatch (only test data existed, so no migration path needed).

## Prompt 15

```
Rename items to Products and Products Table Must be with:
Name (Product Names)
Size(sizes)
Price
Stock
Sold
Avl-Stock

Name (Product Names):
Round Neck T-Shirt - IMP
Round Neck T-Shirt
Drop Shoulder T-Shirt
Acid Wash T-Shirt
Polo T-Shirt - IMP
Polo T-Shirt
Hoodie
Track Pant - IMP
Track Pant Cotton
Track Pant Sports
Full Hand T-Shirt - IMP
Full Hand T-Shirt

Size(sizes):
S
M
L
XL
XXL
```

AskUserQuestion answers (design decisions approved mid-task):
- Row granularity: "One row per Name+Size (Recommended)" — 12 names × 5 sizes seeded as 60
  product rows, UNIQUE(name, size).
- Sold semantics: "Auto from invoices (Recommended)" — Sold = Σ qty across non-void invoice
  lines referencing the product; Avl-Stock = Stock − Sold, computed live, never stored.
- Style code: "Drop it completely (Recommended)" — products table carries exactly
  Name/Size/Price/Stock/Sold/Avl-Stock; invoice lines keep product name + size in description.

## Prompt 16

```
How to Add Stocks and Add Restock Option also
```

(asked as a how-to; converted into a feature.)

AskUserQuestion answers (design decisions approved mid-task):
- Restock UX: "＋Restock per product (Recommended)" — per-product Restock action asking Qty
  (and optional new Price) that ADDS to current Stock instead of overwriting.
- Restock log: "Yes, full history (Recommended)" — new `restocks` table + history view;
  Stock stays the running balance, every receipt and editor correction is a ledger delta.

## Prompt 17

```
Give me the Mobile APP Related Files(move) in a Standalone Folder
```

AskUserQuestion answer: "Sibling folder, docs copied (Recommended)" — app moved to
`..\Barathy-Invoive-App\MOBILE-APP\` as standalone project root; doc + plan copies added,
originals kept in the workspace per AGENTS.md. Follow-up confirmation prompt (to satisfy the
safety classifier for terminating the locked dev server): "yes, kill the dev server PID 13384".

## Prompt 18

```
run the from Andrroid emulator as i installed
```

```
run app on emulator
```

AskUserQuestion answer: "Local build via emulator toolchain" — rejected a second EAS cloud
build; instead install the missing Android native toolchain on this host, `expo prebuild`,
`expo run:android --variant debug` and drive the app on the installed AVD.

No further user prompt arrived in this thread; the continuation (release APK build, the Excel
export OOM investigation, removing exceljs, the `docsDir` one-shot fix) is logged as *Prompt 19*
in `MOBILE_APP_CONVERSION_walkthrough.md` but still belongs to the "run app on emulator" request
above — hence no `## Prompt 19` heading here.

## Prompt 20

```
run the app in Local and I ahve installed Android studio Emulator
```

## Prompt 21

```
As per ui/ux for Android Mobile app Rules and Standard Practice Modify the UI: Use the best Skill
```

## Prompt 22

```
The Final Updated: Could you give this in a Separate Standalone Folder: i will copy that folder to new Location and Open here: May be in the folder "MOBILE-APP"
```

## Prompt 23

```
Give .apk Build:

https://expo.dev/accounts/jiametrics-team/projects/invoice-erp
```

## Prompt 24

```
I've logged in to Expo. Start the EAS preview APK build.
```

## Prompt 25

```
This copy (A copy is saved at MOBILE-APP/release/InvoiceERP-1.0.0-eas-preview.apk)and Emulator showing Both are Diffrent
```

## Prompt 26

```
Installed 1.0.1 on my phone but it still looks different from the emulator.
```

## Prompt 27

```
Keep Only the Files related to the Latest(Blue Screen): And Remove all unrelated Files keep the Folder Clean
```

## Prompt 28

```
How come Long file name Errors Comes When i copy the Folder to another Location?
```

## Prompt 29

```
Finally the Folder is having only the Current updated version Files?
```

## Prompt 30

```
Please move all the Related file to this folder: "MOBILE-APP": i am going copy move this folder to another Location from there i will work
```

## Prompt 31

```
Give me this Location: MOBILE-APP
```

## Prompt 32

```
Change the MOBILE-APP name to : INV-MOBILE-APP
```

## Prompt 33

```
run the app in Emulator
```
