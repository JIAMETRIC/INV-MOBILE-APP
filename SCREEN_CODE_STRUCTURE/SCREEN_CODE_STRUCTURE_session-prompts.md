# SCREEN_CODE_STRUCTURE — Session prompts

## Prompt 1

```
## Goal
Restructure InvoicesScreen() so a non-expert ("vibecoder") can open the file,
instantly see how the screen is built, and safely change any part of it:
containers, rows, columns, spacing, colors and text.

## First, inspect
1. Find InvoicesScreen() and every file it uses (widgets/components, models, theme).
2. Detect the framework (Flutter, Jetpack Compose, React Native, SwiftUI, etc.)
   and follow its conventions for naming and layout primitives.
3. Before editing, show me a short plan: the current structure and the
   proposed function tree. Wait for my OK.
```

## Prompt 2

```
Where is the "+ New Invoice" Button Layout?
```

## Prompt 3

```
What is Function Name of  "+ New Invoice" Button
```

## Prompt 4

```
What is inside "nav.openCreate()" Modal
```

## Prompt 5

```
Yes Correct Give me Like this in a separate file can open in Terminal: What’s inside CreateInvoiceScreen (phone layout, S4.L1)
```

## Prompt 6

```
Give me Optimized prompt to get same Like this(CreateInvoiceScreen_S4_phone_tree.md) for another Component: small sharp Propmt
```

## Prompt 7

```
so totally 6 screens?
```

## Prompt 8

```
Same tree file for S1, S2, S3, S4, S5, S6 and S0, P1, P2, P3, D1, D2, C1-C4
```

## Prompt 9

```
Yes, fix the D2.2 register bug so each invoice appears once on Invoices_Register.
```

## Prompt 10

```
How many tokens will take for Commit?
```

## Prompt 11

```
commit
```

## Prompt 12

```
OK, apply the InvoicesScreen restructure plan as proposed.
```

## Prompt 13

```
Commit the working tree changes with a sensible message.
```

## Prompt 14

```
What is this Meaning?( before vs After): InvoicesScreen.tsx is restructured as planned
```

## Prompt 15

```
Which is Best?
```

## Prompt 16

```
My Method is like a Row Columns?
```

## Prompt 17

```
Can we make Each Screen as header, main, Footer layout concept inside each row and Columns?: Suggestion
```

## Prompt 18

```
This wont Break the : The rule in React Native?
```

## Prompt 19

```
This is Correct or Not?: Where you’d break the rule, and how the scaffold avoids it:
```

## Prompt 20

```
Deep analysis and Tradeoff of My method and Above Table: in All Mobile Rules: 

┌──────────────────────────┐
│ HEADER   title · buttons │  fixed, never scrolls
├──────────────────────────┤
│ MAIN     rows            │  scrolls (or a list), takes the remaining height
│   row                    │
│   row  [ col | col ]     │
│   row                    │
├──────────────────────────┤
│ FOOTER   action bar      │  fixed, rises with the keyboard
└──────────────────────────┘
   bottom nav (global, owned by the app shell, not by the screen)
```

## Prompt 21

```
1.What Name we can Give for this New Method? 2.We can create this as a Skill or Design(which Name is Better), 3.Create as a Web page using HTML,CSS and Javascript with code snippet with copy buttons (Use UI Design(colors, Fonts, Styling match exatly as in the Mobile UI)
```

## Prompt 22

```
Create this also as webpage: The full analysis is in LAYOUT_METHOD_header-main-footer_analysis.md. Here is the substance.

Verdict
```

## Prompt 23

```
I asking to create a Webpage of the Whole Discussion
Starting line:
Verdict

Your method is sound. It's the structure that React Native's flexbox, Material Design 3, Apple's HIG and this project's own design kit all already assume, so it adds no new mechanism and breaks no rule. Its real costs are three couplings it creates, each with a known fix the scaffold can own once:


Ending Line:
Recommendation: adopt it, build src/ui/Screen.tsx, apply to S4 first and confirm each screen in the emulator before the next. The analysis and logs are written but not committed.
```

## Prompt 24

```
Shall I create the three-slot-screen skill now?: yes
```

## Prompt 25

```
All three must be updated for any Skill?: SKILL.md, CLAUDE.md and README.md: beacuse ui also having same Names: How can i have UI as Sepaarte Skill and Layout as Separet skill?: the Folder Names Makes the Diffrence?
```

## Prompt 26

```
Where is the Skill folders?
```

## Prompt 27

```
The Below three are Problems?: How can we Improve this?

Touch targets 44	⚠️ columns	3 columns on a 360 dp phone ≈ 105 dp each: fine for buttons, tight for labels. Rule: ≤ 3 columns on phones, tappable cells ≥ 44

Lists	⚠️ coupling	last row must clear footer + nav; today each screen hard-codes it, the scaffold can measure the footer with onLayout

Performance	⚠️ one habit	list rows should be React.memo (S2's InvoiceRow isn't yet; pre-existing)
```

## Prompt 28

```
Yes. Memoise the list rows in S2 and S5, and add the Columns helper in src/ui; leave footer measuring for the Screen scaffold.
```

## Prompt 29

```
This where responsive works?: if someone add 4th column it must go down right?:1. Touch targets vs columns

Is it a problem now? No. The only 3-column row is the Dashboard tiles (S1.2), and it already copes: labels get numberOfLines={2} with minHeight: 36 so the values line up, and figures shrink with adjustsFontSizeToFit. The risk is the next row someone adds with 3 or 4 columns on a 360 dp phone. and My App is Responsive for 8inch and 10 inch Tablet?(This tablet responisve which SKILL we can add?)
```

## Prompt 30

```
Yes. Add a wrap mode to Columns (4th column goes to the next line, inputs default to a sensible minimum), then create 8-inch and 10-inch tablet AVDs and screenshot every screen on them.
```

## Prompt 31

```
Yes, fix the two tablet bugs: the Products editor ScrollView flex basis so the NAME column shows at lg/xl/xxl, and the S4 date inputs clipping at xl. Re-run /tablet-check on S4 and S5 afterwards.
```

## Prompt 32

```
Yes. Make md (600-767 dp) single-pane like the phone layout but with the rail, so the S2 list, S3 items header and S5 table are no longer cramped on an 8-inch tablet in portrait. Re-check with /tablet-check at md.
```

## Prompt 33

```
Yes: show the S2 ActivityPane only at xxl, and let the S4.L3 products panel show name and size on two lines when narrow. Re-check at xl.
```

## Prompt 34

```
these three is Fixed?: 

Touch targets 44	⚠️ columns	3 columns on a 360 dp phone ≈ 105 dp each: fine for buttons, tight for labels. Rule: ≤ 3 columns on phones, tappable cells ≥ 44

Lists	⚠️ coupling	last row must clear footer + nav; today each screen hard-codes it, the scaffold can measure the footer with onLayout

Performance	⚠️ one habit	list rows should be React.memo (S2's InvoiceRow isn't yet; pre-existing)
```

## Prompt 35

```
What we have to do now?; 2 reduced from "three copies of a magic number" to "one token", with the measuring step waiting on the Screen scaffold, which is the next piece of work on the list.
```

## Prompt 36

```
Yes. Run /three-slot-screen on S4 Create invoice, including the Screen scaffold with footer measuring: inspect and show me the proposed function tree first, then wait for my OK.
```

## Prompt 37

```
OK, build the Screen scaffold and apply the S4 plan as proposed.
```

## Prompt 38

```
i WILL SHUTDOWN NOW..
```

## Prompt 39

```
COMMIT
```

## Prompt 40

```
push everythimg
```

## Prompt 41

```
Already is there
```

## Prompt 42

```
https://github.com/JIAMETRIC/INV-MOBILE-APP
```

## Prompt 43

```
Can We have Seperate SKILL for Tablet and Mobile Responsives?
or three-slot-screen(SKILLS) we can append?
```

## Prompt 44

```
Yes. Rename tablet-check to size-check, add the phone profiles (xs 320, sm 360, 411 default, phone landscape) to the tour script and the skill, update CLAUDE.md, README and three-slot-screen step 6, and run the phone profiles once to see what they show.
```

## Prompt 45

```
Yes, fix the S2 list card collapse on short screens (phone landscape with the date range open), re-check with /size-check phoneL, and push.
```

## Prompt 46

```
All three Fixed?: 

Touch targets 44	⚠️ columns	3 columns on a 360 dp phone ≈ 105 dp each: fine for buttons, tight for labels. Rule: ≤ 3 columns on phones, tappable cells ≥ 44

Lists	⚠️ coupling	last row must clear footer + nav; today each screen hard-codes it, the scaffold can measure the footer with onLayout

Performance	⚠️ one habit	list rows should be React.memo (S2's InvoiceRow isn't yet; pre-existing)
```

## Prompt 47

```
Do this also: 

The one loose end on the third row: two screens still carry their own copy of the number, because they haven't been restructured yet:

* `DashboardScreen.tsx:42` uses `useContentInset(bp.isPhone)` (the old helper)
* `ProductsScreen.tsx:323` has `touch.button + layout.gap` inline

Both are correct values, both disappear when S1 and S5 go through `/three-slot-screen` (they'll take `<Screen fab>` and `useFabClearance()` like S2). So the risk itself is closed; the cleanup follows the two restructures that are next on the list anyway.
```

## Prompt 48

```
Yes. Run /three-slot-screen on S5 Products: inspect and show me the proposed function tree first, then wait for my OK.
```

## Prompt 49

```
OK, apply the S5 plan as proposed.
```

## Prompt 50

```
All three Fixed?: 
Touch targets 44	⚠️ columns	3 columns on a 360 dp phone ≈ 105 dp each: fine for buttons, tight for labels. Rule: ≤ 3 columns on phones, tappable cells ≥ 44

Lists	⚠️ coupling	last row must clear footer + nav; today each screen hard-codes it, the scaffold can measure the footer with onLayout

Performance	⚠️ one habit	list rows should be React.memo (S2's InvoiceRow isn't yet; pre-existing)
```

## Prompt 51

```
Yes. Run /three-slot-screen on S6 Settings: inspect and show me the proposed function tree first, then wait for my OK.
```

## Prompt 52

```
OK, apply the S6 plan as proposed.
```

## Prompt 53

```
Yes. Run /three-slot-screen on S1 Dashboard and S3 Invoice detail: inspect both and show me the proposed function trees first, then wait for my OK.
```

## Prompt 54

```
OK, apply the S1 and S3 plans as proposed.
```

## Prompt 55

```
all Fixed?;

Touch targets 44	⚠️ columns	3 columns on a 360 dp phone ≈ 105 dp each: fine for buttons, tight for labels. Rule: ≤ 3 columns on phones, tappable cells ≥ 44

Lists	⚠️ coupling	last row must clear footer + nav; today each screen hard-codes it, the scaffold can measure the footer with onLayout

Performance	⚠️ one habit	list rows should be React.memo (S2's InvoiceRow isn't yet; pre-existing)
```

## Prompt 56

```
How can i enforce all the Modifcations you did for Mobile Responisve tablet Screens to be followed in my next app: any Document or Skill?
```

## Prompt 57

```
can complete the above?
```
