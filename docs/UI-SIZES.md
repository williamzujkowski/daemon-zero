# UI sizes: contract, matrix and measured gaps

Issue #103 (follow-up to #89). Measurement and gating shipped in #104; the first
layout increment shipped in #106 and was corrected in #110 after measurement showed
the claimed column floor was only wired into the tablet tier. The policy itself is
`src/ui/layout.ts`, unit-tested in `tests/ui-layout.spec.ts`; the matrix only has to
confirm the geometry that policy predicts.

## Size matrix

Every case is a real production export driven at that viewport, with reduced motion
and a paused clock.

| Name | Size | Band |
|---|---|---|
| small-phone | 320x568 | narrow phone, also WCAG 1.4.10 reflow width |
| phone-360 | 360x640 | common small Android |
| phone-390 | 390x844 | baseline phone (existing E2E project) |
| phone-large | 414x896 | large phone |
| tablet-portrait | 768x1024 | two columns: CORE + one tabbed supporting column |
| phone-landscape | 844x390 | short, height-bound — stays single-scroll |
| breakpoint-edge | 900x640 | two columns at the old column boundary |
| tablet-landscape | 1024x768 | two columns, wide |
| breakpoint-three | 1080x800 | first three-column layout |
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
  horizontal tab bar (`terminal-tabs-scroll`); 768-1079px is two columns — CORE plus
  one tabbed supporting column carrying every unlocked non-CORE slot; 1080px and
  wider is three columns with in-column slot tabs and no mobile tab bar.
- No column is narrower than 340px: the core column and each supporting column hold
  that floor, and the tier boundary sits where three floors plus a readable core
  actually fit. This is asserted per column, not derived from the mode.
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
destination) and whether its box is fully on screen, per sampled state. `cols` is the
core column width early → later phases (the phase's own slot takes the larger share);
`card` is the widest node card in that state.

| Size | cols | core | sensors | side | card (early / mid / warning) | phase-1-widgets | epistemic-ready-p2 | corporate-insolvent |
|---|---|---|---|---|---|---|---|---|
| 320x568 | mobile | — | — | — | 288 / 258 / 258 | 625 (**no**) | 731 (**no**) | 896 (**no**) |
| 360x640 | mobile | — | — | — | 328 / 298 / 298 | 625 (yes) | 687 (**no**) | 833 (**no**) |
| 390x844 | mobile | — | — | — | 358 / 328 / 328 | 572 (yes) | 634 (yes) | 710 (yes) |
| 414x896 | mobile | — | — | — | 382 / 352 / 352 | 553 (yes) | 615 (yes) | 710 (yes) |
| 768x1024 | two | 428 → 384 | — | 340 → 385 | 396 / 322 / 322 | 531 (yes) | 657 (yes) | 733 (yes) |
| 844x390 | mobile | — | — | — | 728 / 698 / 698 | 509 (**no**) | 549 (**no**) | 625 (**no**) |
| 900x640 | two | 560 → 450 | — | 340 → 451 | 528 / 388 / 388 | 422 (yes) | 529 (yes) | 646 (**no**) |
| 1024x768 | two | 682 → 512 | — | 342 → 513 | 650 / 450 / 450 | 422 (yes) | 529 (yes) | 646 (yes) |
| 1080x800 | three | 720 → 340 | 360 → 340 | 0 → 400 | 688 / 337 / 337 | 422 (yes) | 525 (yes) | 665 (yes) |
| 1440x900 | three | 960 → 360 | 480 → 360 | 0 → 721 | 728 / 658 / 658 | 365 (yes) | 405 (yes) | 526 (yes) |
| 1920x1080 | three | 1280 → 480 | 640 → 480 | 0 → 961 | 728 / 698 / 698 | 419 (yes) | 437 (yes) | 523 (yes) |
| 2560x1440 | three | 1707 → 640 | 853 → 640 | 0 → 1281 | 728 / 698 / 698 | 419 (yes) | 437 (yes) | 523 (yes) |

Forecast and active-warning visibility in the same runs:

| Size | forecast (early / mid / warning state) | insolvency warning |
|---|---|---|
| 320x568 | yes / yes / yes | **no** |
| 360x640 / 390x844 / 414x896 | yes / yes / yes | yes |
| 768x1024 | yes / yes / yes | yes |
| 844x390 | yes / yes / yes | **no** |
| 900x640 and above | yes / yes / yes | yes |

### Closed

- **Tablet band (was gap 4).** A 768px tablet used to get the phone layout with a
  691-721px card. It now gets two columns.
- **Narrow columns (was gap 5).** The supporting column had 225-300px at 900-1024 and
  the core column could collapse to 225px there. Both now hold a 340px floor: at 900
  the panel is two columns (450/451), and three columns only start at 1080, where
  340+340+400 actually fits. The floor is asserted per column at every size.
- **Uncapped measure (was gap 6).** The widest card reached 1233px at 1920 and
  1659px at 2560; both now measure 698-728px, centred.

### Where the vertical space goes

Before changing anything (#108) every block above the first purchase control was
measured at 320x568, 360x640, 390x844, 414x896, 844x390, 900x640 across the three
sampled states. Averaged over the cases (the button sat at 723px in a 568px fold),
four terms account for it:

| term | px at 320x568 | share of the offset |
|---|---|---|
| app chrome: header + resource strip + kernel dock + forecast | 405-506 | 51% |
| card body above the button: title, description, cost, hints | 197-244 | 27% |
| pane chrome: workspace row + pane heading | 0-77 | 8% |
| other: notices, previews, the gap to the button | 0-220 | 14% |

Two app-chrome numbers set the ceiling: the header is 117px at 320 wide and 64px
from 390 up because its controls wrap, and the resource strip is 144px at 320
(five readouts across 3-5 rows) against 57px when one row fits.

### What the card reorder recovered

The purchase control now precedes the description (#108). Measured against the
previous table, the button moved up 54-76px on most sizes and 141-163px at
900-1024 wide, which brought 360x640 and 900x640 back to the fold and 1024x768
back entirely for the insolvency state.

### Still open

1. **Narrow phones and short landscape still lose the decision**, but by much less.
   At 320x568 the button is 57px past the fold (102px past the 523px the mobile tab
   bar leaves) and at 844x390 it is 119px past. The remaining cost is app chrome,
   not the card: the header and the wrapped resource strip together are 261px of the
   405 at 320.
2. **An active red alert can still be below the fold.** The insolvency warning sits
   at 602px at 320x568 and 435px at 844x390. It is chrome-positioned, so the card
   reorder cannot move it; it needs the alert rendered above the resource strip or
   pinned to the viewport.
3. **The worst narrow case is insolvent at 360x640** (833px), and 900x640 insolvency
   is 6px over. Late-phase states add a second row of readouts and a longer cost
   hint, which is the same chrome problem seen from the other end.

Gaps 1-3 are the remainders of the height increment (#108); the app-chrome
compaction is the next increment because it is now measured at 51% of the offset.
Every layout change updates the numbers above in the same PR that changes them.

## Running it

```bash
pnpm exec playwright test --config tests/e2e/config.ts --project=sizes
```

The project sets each viewport itself, so it runs once rather than under both the
`phone` and `desktop` projects. Each test attaches a `geometry` annotation per
sampled state — including per-column widths — which is what the tables above are
built from. `make e2e` includes the project.

## Limits

- Web export only. Native font scaling (`adb shell settings put system font_scale`),
  rotation and safe-area insets are not covered here; the Android/iOS gaps stay
  open, including the missing safe-area handling on iOS noted in the issue.
- Geometry and console assertions, not pixel comparison: rendering differs by host
  and committed PNG baselines would break the repository's no-screenshots rule.
- The three sampled states are engine-played saves, not a human playthrough, and
  "above the fold" is measured at the initial scroll position only.
- Caption compaction (`CostHint`, `ResourceStrip`, `NodeCard`, `LogDock`) reads
  `isCompactViewport(width)` from the policy module. Its boundary,
  `COMPACT_CAPTION_MAX_WIDTH` = 900, is deliberately independent of the tier
  boundary: the core column is at most two thirds of the viewport below it, and the
  captions stayed on 900 when three columns moved to 1080.