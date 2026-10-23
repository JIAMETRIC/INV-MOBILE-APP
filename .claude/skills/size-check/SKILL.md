---
name: size-check
description: Check every screen of the app at phone and tablet sizes (320 and 360 dp phones, the 411 dp default, phone landscape, 8-inch and 10-inch tablets in portrait and landscape) by resizing the phone emulator and screenshotting each screen, then compare with the layout reference and record findings. Use when the user asks whether the app is responsive, to check phones or tablets, or after a change that touches a breakpoint branch (bp.isPhone, bp.panes, bp.atLeast) or a Columns row.
---

# Size check

The layout code reads the window size in dp (`src/ui/useBreakpoint.ts`: xs < 360 · sm · md 600 · lg 768 · xl 960 · xxl 1200), so a resized phone emulator shows exactly what any phone or tablet shows. The dedicated tablet AVDs (`Tablet_8in`, `Tablet_10in`) exist, but on this machine they only boot with software rendering, where the guest crashes and `screencap` aborts; use the phone AVD for every profile.

## 1. Start
- Emulator: `emulator -avd Medium_Phone_API_37.0` (host GPU). Debug app installed; Metro: `npx expo start --dev-client --port 8081` and `adb reverse tcp:8081 tcp:8081`.
- The tour needs these on screen: an invoice whose party is "aSAsda" (PRE-001) and the product "Acid Wash T-Shirt"; adjust the `text=` taps in the script if the data differs. uiautomator quirks the script already handles: `&` appears as `&amp;` ("Backup &amp; restore"), a sheet has two "Close" nodes (the scrim and the button; take the last, `nth=-1`), and on one-pane sizes S3 opens as an overlay, so the script presses Back when it sees the "Invoice" title.

## 2. Profiles (dp = px ÷ (density ÷ 160))

| Tag | `wm size` | dpi | dp | Breakpoint | Stands for |
| --- | --- | --- | --- | --- | --- |
| `xs` | 640x1136 | 320 | 320 × 568 | xs | the smallest phone the app supports |
| `sm` | 720x1600 | 320 | 360 × 800 | sm | a common budget phone |
| `phone` | 1080x2400 | 420 | 411 × 914 | sm | the default emulator (the baseline) |
| `phoneL` | 2400x1080 | 420 | 914 × 411 | **lg** | a phone in landscape: it gets the tablet two-pane layout at 411 dp of height |
| `tab8P` | 800x1280 | 213 | 601 × 961 | md | 8-inch tablet, portrait (one pane + rail) |
| `tab8L` | 1280x800 | 213 | 961 × 601 | xl | 8-inch tablet, landscape |
| `tab10P` | 1200x1920 | 240 | 800 × 1280 | lg | 10-inch tablet, portrait |
| `tab10L` | 1920x1200 | 240 | 1280 × 800 | xxl | 10-inch tablet, landscape |

```
python -I scripts/size-tour.py <out_dir> <tag> <WxH> <dpi>     (one line per profile above)
python -I scripts/size-tour.py <out_dir> reset                 (restore the phone size)
```
Run the profiles one after another **from a single process** (a small Python driver, or one terminal), never as a background Bash `for` loop: killing the Python does not stop the loop, and a leftover loop resets the emulator while another tour runs. Each run sets `wm size` / `wm density`, relaunches the dev client (fresh bundle), and screenshots S1, S2 (+ date range), S3, S4 (+ Items, P2 when reachable), S5, P3, S6, S6 Company. Controls are found by accessibility label or text through `uiautomator`. "MISSING x" in the log means that tap had nothing to hit at that size (often expected: no stepper at md+, the editor is a pane at lg+). "Check the phones" = the first four rows; "check the tablets" = the last four.

## 3. Review
Open every PNG. For each, check against `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` (wireframes, pane widths) and the Three-Slot Screen rules:
- no truncated labels or placeholders ("Iss…", "YYYY-…"), no clipped input values
- every table column visible (S5: NAME · SIZE · PRICE · STOCK · SOLD · AVL)
- pane widths as specified (S2 50 % / 42 % + 26 % at xxl; S4 25 / 38 / 37; S5 editor 38 %)
- rows of columns: cells ≥ the usable minimum (inputs 128), or stacked / wrapped (`Columns`)
- touch targets ≥ 44; the rail at md+, the floating nav below md
- on short screens (xs, phone landscape): the footer, FAB and nav still clear each other; the keyboard leaves room to type

## 4. Record
- Per screen: a "Size check" section in its `SCREEN_CODE_STRUCTURE/<Screen>_<ID>_tree.md` with the sizes and what was seen.
- Findings (what is wrong, at which breakpoint, the proposed fix) in `SCREEN_CODE_STRUCTURE/SCREEN_CODE_STRUCTURE_walkthrough.md`; decisions in `_TRACKING.md`; the prompt in `_session-prompts.md`.
- Keep the screenshots out of the repo (scratchpad); name the sizes in the log instead.
- For a restructure (behaviour unchanged), also compare the phone screenshots before and after pixel by pixel (PIL `ImageChops.difference`, status bar excluded) and record the percentage; the target is 0.000 %.
- Findings so far and their fixes are listed in `SCREEN_CODE_STRUCTURE/LAYOUT_METHOD_header-main-footer_analysis.md` §7.4 (md one pane, the S5 editor pane's flex, the S4 date inputs, the S2 activity pane at xxl, the S2 list card on phone landscape).

Report: which profiles were checked, which taps were missing and why, and every finding with its breakpoint.
