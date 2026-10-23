---
name: tablet-check
description: Check every screen of the app at tablet sizes (8-inch and 10-inch, portrait and landscape) by resizing the phone emulator and screenshotting each screen, then compare with the layout reference and record findings. Use when the user asks whether the app is responsive, to check tablets, or after a change that touches a tablet branch (bp.isPhone, bp.panes, bp.atLeast).
---

# Tablet check

The layout code reads the window size in dp (`src/ui/useBreakpoint.ts`: xs < 360 · sm · md 600 · lg 768 · xl 960 · xxl 1200), so a resized phone emulator shows exactly what a tablet shows. The dedicated tablet AVDs (`Tablet_8in`, `Tablet_10in`) exist, but on this machine they only boot with software rendering, where the guest crashes and `screencap` aborts; use the phone AVD.

## 1. Start
- Emulator: `emulator -avd Medium_Phone_API_37.0` (host GPU). Debug app installed; Metro: `npx expo start --dev-client --port 8081` and `adb reverse tcp:8081 tcp:8081`.
- The tour needs these on screen: an invoice whose party is "aSAsda" (PRE-001) and the product "Acid Wash T-Shirt"; adjust the `text=` taps in the script if the data differs.

## 2. Run the four profiles
```
python -I scripts/tablet-tour.py <out_dir> tab8P  800x1280  213
python -I scripts/tablet-tour.py <out_dir> tab8L  1280x800  213
python -I scripts/tablet-tour.py <out_dir> tab10P 1200x1920 240
python -I scripts/tablet-tour.py <out_dir> tab10L 1920x1200 240
python -I scripts/tablet-tour.py <out_dir> reset
```
Each run sets `wm size` / `wm density`, relaunches the dev client (fresh bundle), and screenshots S1, S2 (+ date range), S3, S4 (+ Items, P2 when reachable), S5, P3, S6, S6 Company. Controls are found by accessibility label or text through `uiautomator`. "MISSING x" in the log means that tap had nothing to hit at that size (often expected: no stepper at md+, the editor is a pane at lg+).

## 3. Review
Open every PNG. For each, check against `SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md` (tablet wireframes, pane widths) and the Three-Slot Screen rules:
- no truncated labels or placeholders ("Iss…", "YYYY-…"), no clipped input values
- every table column visible (S5: NAME · SIZE · PRICE · STOCK · SOLD · AVL)
- pane widths as specified (S2 50 % / 42 % + 26 %; S4 25 / 38 / 37; S5 editor 38 %)
- rows of columns: cells ≥ the usable minimum (inputs 128), or stacked / wrapped
- touch targets ≥ 44; the rail at md+, the floating nav below md

## 4. Record
- Per screen: a "Tablet" section in its `SCREEN_CODE_STRUCTURE/<Screen>_<ID>_tree.md` with the four sizes and what was seen.
- Findings (what is wrong, at which breakpoint, the proposed fix) in `SCREEN_CODE_STRUCTURE/SCREEN_CODE_STRUCTURE_walkthrough.md`; decisions in `_TRACKING.md`; the prompt in `_session-prompts.md`.
- Keep the screenshots out of the repo (scratchpad); name the sizes in the log instead.

Report: which sizes were checked, which taps were missing and why, and every finding with its breakpoint.
