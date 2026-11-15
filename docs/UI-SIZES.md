# UI sizes: contract, matrix and measured gaps

Issue #103 (follow-up to #89). Baseline `2934246`. Measurement and gating only: this
document ships with `tests/e2e/ui-sizes.e2e.ts`; it changes no layout, engine,
content, save or balance behaviour.

## Size matrix

Every case is a real production export driven at that viewport, with reduced motion
and a paused clock.

| Name | Size | Band |
|---|---|---|
| small-phone | 320x568 | narrow phone, also WCAG 1.4.10 reflow width |
| phone-360 | 360x640 | common small Android |
| phone-390 | 390x844 | baseline phone (existing E2E project) |
| phone-large | 414x896 | large phone |
| tablet-portrait | 768x1024 | width still below the column breakpoint |
| phone-landscape | 844x390 | short, height-bound |
| breakpoint-edge | 900x640 | first column layout; three columns begin here |
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
- Mode matches width: below 900px the single primary scroll plus a horizontal tab
  bar (`terminal-tabs-scroll`); at 900px and above the column layout
  (`terminal-columns`) with in-column slot tabs and no mobile tab bar.
- No console warnings or errors.
- Reads stay legible: suggested line length is 45-90 characters, so a card should
  not exceed roughly 900px at the project's monospace size.

"Visible" in this document means: the element's box lies wholly inside the
viewport (`top >= 0`, `bottom <= innerHeight`, same horizontally). It is a geometry
measure, not a claim that the player noticed it.

Asserted at the two baseline sizes today:

- 390x844: forecast above the fold; first WRITE DRIVER above the fold in the early
  state; insolvency warning and forecast above the fold while that warning is active.
- 1440x900: forecast and first WRITE DRIVER above the fold in every sampled state.

## Measured, and the gaps this contract does not yet meet

Top edge of the first WRITE DRIVER (topmost purchase control in the initially opened
destination) and whether its box is fully on screen, per sampled state. `cols` are
column widths; `card` is the widest node card rendered.

| Size | cols | card | phase-1-widgets | epistemic-ready-p2 | corporate-insolvent |
|---|---|---|---|---|---|
| 320x568 | mobile | 243-273 | 766 (no) | 850 (no) | 1037 (no) |
| 360x640 | mobile | 283-313 | 722 (no) | 762 (no) | 927 (no) |
| 390x844 | mobile | 314-343 | 685 (yes) | 687 (yes) | 860 (no) |
| 414x896 | mobile | 338-367 | 629 (yes) | 668 (yes) | 785 (yes) |
| 768x1024 | mobile | 691-721 | 563 (yes) | 580 (yes) | 678 (yes) |
| 844x390 | mobile | 767-797 | 563 (no) | 580 (no) | 656 (no) |
| 900x640 | 600 / 300 | 373-553 | 476 (yes) | 537 (yes) | 721 (no) |
| 1024x768 | 683 / 341 and 256 / 256 / 512 | 435-635 | 476 (yes) | 537 (yes) | 699 (yes) |
| 1440x900 | 960 / 480 and 360 / 360 / 720 | 643-913 | 419 (yes) | 436 (yes) | 579 (yes) |
| 1920x1080 | 1280 / 640 and 480 / 480 / 960 | 883-1233 | 397 (yes) | 436 (yes) | 500 (yes) |
| 2560x1440 | 1707 / 853 and 640 / 640 / 1280 | 1218-1659 | 397 (yes) | 436 (yes) | 500 (yes) |

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

Known gaps, recorded as budgets rather than silently accepted:

1. Narrow phones and short landscape lose the decision. The first purchase control
   is 198-469px below the viewport at 320x568, 82-287px below at 360x640, and
   173-266px below at 844x390. The layout reacts to width only, so a height-bound
   landscape phone gets the portrait stack.
2. An active red alert can be below the fold. The insolvency warning is not on
   screen at 320x568, nor at 844x390, even though the state is insolvent and the
   warning is the only place that says so at that moment.
3. Late-phase phone and short-desktop states push the decision down: the first
   purchase sits 16px below the fold at 390x844 in the insolvency state, and 81px
   below at 900x640 in the same state. In the dense mid-game state the forecast is
   below the fold at 390 and 414.
4. The 768-899 band is a dead zone: a tablet gets the mobile single column with a
   691-721px-wide card (past a readable measure), then 900px jumps to columns.
5. Narrow desktop columns: at 900-1024 the supporting column is 225-300px wide,
   roughly 200-260px of content after panel padding.
6. Widescreen is stretched, not used: nothing caps the reading measure, so the
   widest card reaches 1233px at 1920 and 1659px at 2560.

These are the inputs to the layout increment. Fixing them is expected to change
the numbers above, and the budget table is updated with the same PR that changes
layout.

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