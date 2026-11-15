# UI sizes: contract, matrix and measured gaps

Issue #103 (follow-up to #89). Measurement and gating shipped in #104; this revision
adds the first layout increment, so the numbers below are re-measured rather than
inherited. The policy itself is `src/ui/layout.ts`, unit-tested in
`tests/ui-layout.spec.ts`; the matrix only has to confirm the geometry that policy
predicts.

## Size matrix

Every case is a real production export driven at that viewport, with reduced motion
and a paused clock.

| Name | Size | Band |
|---|---|---|
| small-phone | 320x568 | narrow phone, also WCAG 1.4.10 reflow width |
| phone-360 | 360x640 | common small Android |
| phone-390 | 390x844 | baseline phone (existing E2E project) |
| phone-large | 414x896 | large phone |
| tablet-portrait | 768x1024 | first column tier: two columns |
| phone-landscape | 844x390 | short, height-bound — stays single-scroll |
| breakpoint-edge | 900x640 | first three-column layout |
| tablet-landscape | 1024x768 | narrow desktop columns |
| laptop | 1440x900 | baseline desktop (existing E2E project) |
| desktop | 1920x1080 | wide |
| widescreen | 2560x1440 | very wide |

Sampled states: `phase-1-widgets` (early, forecast active), `epistemic-ready-p2`
(dense mid-game purchase pane) and `corporate-insolvent` (red alert plus a warning).

## Contract

Holds at every size, asserted by the matrix spec:

- No document-level horizontal overflow.
- Every visible button/tab is at least 44x44 CSS px (project standard; WCAG 2.5.8
  asks 24x24 and WCAG 1.4.10 asks that 320px-wide content reflows).
- At least one rendered pane, and no pane collapsed under 44px.
- Mode matches the width policy, `layoutFor(width, height)` in `src/ui/layout.ts`:
  under 768px, or any viewport under 600px tall, is the single primary scroll plus a
  horizontal tab bar (`terminal-tabs-scroll`); 768-899px is two columns; 900px and
  wider is the column layout (`terminal-columns`) with in-column slot tabs and no
  mobile tab bar.
- The supporting column keeps at least 340px by shrinking the core column.
- The widest node card is at most 760px — about 87 characters at the project's 14px
  monospace, inside the 45-90 reading measure — and is centred in its column.
- No console warnings or errors.

"Visible" in this document means: the element's box lies wholly inside the
viewport (`top >= 0`, `bottom <= innerHeight`, same horizontally). It is a geometry
measure, not a claim that the player noticed it.

Asserted at the two baseline sizes today:

- 390x844: forecast above the fold; first WRITE DRIVER above the fold in the early
  state; insolvency warning and forecast above the fold while that warning is active.
- 1440x900: forecast and first WRITE DRIVER above the fold in every sampled state.

## Measured, and the gaps this contract does not yet meet

Top edge of the first WRITE DRIVER (topmost purchase control in the initially opened
destination) and whether its box is fully on screen, per sampled state. `card` is the
widest node card rendered in that state.

| Size | cols | card (early / mid / warning) | phase-1-widgets | epistemic-ready-p2 | corporate-insolvent |
|---|---|---|---|---|---|
| 320x568 | mobile | 288 / 258 / 258 | 723 (no) | 807 (no) | 994 (no) |
| 360x640 | mobile | 328 / 298 / 298 | 723 (no) | 763 (no) | 909 (no) |
| 390x844 | mobile | 358 / 328 / 328 | 648 (yes) | 688 (yes) | 786 (yes) |
| 414x896 | mobile | 382 / 352 / 352 | 629 (yes) | 669 (yes) | 786 (yes) |
| 768x1024 | two | 396 / 322 / 322 | 607 (yes) | 733 (yes) | 809 (yes) |
| 844x390 | mobile | 728 / 698 / 698 | 563 (no) | 581 (no) | 679 (no) |
| 900x640 | three | 568 / 388 / 388 | 476 (yes) | 538 (yes) | 722 (no) |
| 1024x768 | three | 651 / 450 / 450 | 476 (yes) | 538 (yes) | 700 (yes) |
| 1440x900 | three | 728 / 658 / 658 | 419 (yes) | 437 (yes) | 580 (yes) |
| 1920x1080 | three | 728 / 698 / 698 | 419 (yes) | 437 (yes) | 523 (yes) |
| 2560x1440 | three | 728 / 698 / 698 | 419 (yes) | 437 (yes) | 523 (yes) |

Forecast and active-warning visibility in the same runs:

| Size | forecast (early / mid / warning state) | insolvency warning |
|---|---|---|
| 320x568 | yes / yes / yes | **no** |
| 360x640 | yes / yes / yes | yes |
| 390x844 | yes / **no** / yes | yes |
| 414x896 | yes / **no** / yes | yes |
| 768x1024 | yes / yes / yes | yes |
| 844x390 | yes / yes / yes | **no** |
| 900x640 and above | yes / yes / yes | yes |

### Closed by this increment

- **Tablet band (was gap 4).** A 768px tablet used to get the phone layout with a
  691-721px card and a jump straight to three columns at 900. It now gets two
  columns, and 900-1023 keeps a supporting column instead of falling into a third.
- **Narrow supporting column (was gap 5).** The supporting column had 225-300px at
  900-1024; it now keeps a 340px floor by taking width from the core column.
- **Uncapped measure (was gap 6).** The widest card reached 1233px at 1920 and
  1659px at 2560. Both now measure 698-728px, centred.

### Still open

1. **Narrow phones and short landscape lose the decision.** The first purchase
   control is 155-426px below the viewport at 320x568, 83-269px below at 360x640 and
   173-289px below at 844x390. A short viewport is deliberately held in the single
   scroll: height, not width, is what these lack, and that is the next increment.
2. **An active red alert can be below the fold.** The insolvency warning is not on
   screen at 320x568 or 844x390, even though the state is insolvent and the warning
   is the only place that says so at that moment.
3. **Late-phase and short-desktop states push the decision down.** The first purchase
   sits 82px below the fold at 900x640 in the insolvency state, and the dense
   mid-game forecast is below the fold at 390 and 414.

Gaps 1-3 are the inputs to the height increment. Fixing them is expected to change
the numbers above, and this table is updated with the same PR that changes layout.

## Running it

```bash
pnpm exec playwright test --config tests/e2e/config.ts --project=sizes
```

The project sets each viewport itself, so it runs once rather than under both the
`phone` and `desktop` projects. Each test attaches a `geometry` annotation per
sampled state, which is what the tables above are built from. `make e2e` includes
the project.

## Limits

- Web export only. Native font scaling (`adb shell settings put system font_scale`),
  rotation and safe-area insets are not covered here; the Android/iOS gaps stay
  open, including the missing safe-area handling on iOS noted in the issue.
- Geometry and console assertions, not pixel comparison: rendering differs by host
  and committed PNG baselines would break the repository's no-screenshots rule.
- The three sampled states are engine-played saves, not a human playthrough, and
  "above the fold" is measured at the initial scroll position only.
- Caption compaction (`CostHint`, `ResourceStrip`, `NodeCard`, `LogDock`) still keys
  on `width < 900`, so the 768-899 two-column tier renders compact captions even
  where the core column has room for full text. Harmless today; recorded so it is not
  mistaken for a second layout policy.