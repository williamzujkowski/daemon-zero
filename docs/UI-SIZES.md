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

## Supported floor

Decided by a nexus `consensus_vote` (5 of 5 selecting seats,
`supported-360-tolerate-320-fix-margin`): the smallest screen this game *claims* is
**360x640**. Below that it is tolerated, not supported.

| Tier | Sizes | What is promised | What is asserted |
|---|---|---|---|
| Supported | 360 wide and 640 tall, and up | the contract below, including budgets; above-the-fold placement for the opening state at the floor and for every sampled state from 390 up | the full matrix |
| Tolerated | 320x568 (and any narrow/short combination under the floor) | renders without horizontal overflow, without clipping and with every control at 44px or larger, reachable by scrolling | only those properties; no fold or budget claim |
| Undefined | under 320 | nothing | nothing |

The evidence, measured on the served export by the size matrix itself: the first purchase
control's box against the **viewport** (`bottom <= innerHeight`, which is what the matrix
asserts). The usable-fold figures quoted in the prose below come from a separate
measurement against the tab bar's top edge, because on the phone tier the tab bar covers
the last 45px of the viewport.

| Viewport | opening state | mid-game | insolvency |
|---|---|---|---|
| small-phone 320x568 | 512-556, viewport only | 618, below | 709, below |
| phone-360 360x640 | **506-550**, clears | **584-628**, clears | 707, below |
| phone-390 390x844 | **506-550**, clears | **568-612**, clears | **640-684**, clears |
| phone-large 414x896 | **487-531**, clears | **549-593**, clears | **640-684**, clears |
| tablet-portrait 768x1024 | **471-515**, clears | **597-641**, clears | **647-691**, clears |
| phone-landscape 844x390 | 393, below | 433, below | 505, below |
| breakpoint-edge 900x640 | **422-466**, clears | **529-573**, clears | 620, below |
| tablet-landscape 1024x768 | **422-466**, clears | **529-573**, clears | **620-664**, clears |
| breakpoint-three 1080x800 | **422-466**, clears | **525-569**, clears | **639-683**, clears |
| laptop 1440x900 | **365-409**, clears | **405-449**, clears | **522-566**, clears |
| desktop 1920x1080 | **365-409**, clears | **405-449**, clears | **465-509**, clears |
| widescreen 2560x1440 | **365-409**, clears | **405-449**, clears | **465-509**, clears |

Bold means the control's box is inside the viewport. It is **not** a usable-fold claim: at
320 the opening control ends at 556 inside a 568 viewport while the tab bar starts at 523,
which is why 320 stays the tolerated tier.

**360 holds the fold for the opening and mid-game states; the insolvency state does not.**
#138 corrected the fold spec, which had been re-measuring the same fixture three times
(`boot()` only seeds a fixture when storage is empty), and that fix exposed mid-game at
609-653 - below even the viewport. #139's compact chrome band then reclaimed 60px and the
matrix now measures mid-game at 584-628, inside 640 with 12px to spare. The insolvency
state still starts 751, 111px past the viewport, because a run-ending alert adds its own
band above everything else; the matrix asserts the opening and mid-game claims at 360 and
records insolvency as reachable by scrolling.

**The insolvency state is accepted as a scroll, but the warning follows the player.**
Two nexus votes settled it: `accept-scroll-during-ending` (6 of 6) after measuring that no
chrome compression closes 111px, then `sticky-alert-inside-the-scroll` and
`split-chrome-alert-above-strip` once the first choice was measured to be insufficient.
The first vote's premise - that the alert sits in fixed chrome and is therefore always
visible - was false on phones: `MobileTerminal` renders the chrome inside the single
primary scroll, so scrolling to a recovery purchase took the warning off screen. The band
is now a direct child of that scroll at `stickyHeaderIndices={[1]}`, which is also what
native uses, since bare React Native has no sticky styling. `position: sticky` alone was
measured and rejected: it is bounded by its containing block, so it held at `scrollTop`
300 and left as soon as the ~300px chrome block scrolled past. The claim is asserted at
360x640 by the `insolvency at the floor` case in `tests/e2e/ui-sizes.e2e.ts`: full
consequence text at rest, purchase reachable by scrolling, **and the warning still visible
at that offset**.

The chrome's state band moved twice. #137 kept label and value on one line (122px to 103px
at 360 and 390), turning the opening state's 1px clearance into 20px. #139 then abbreviated
the phone labels (`CYC`, `UND`, `MEM`, `THM`, `SUS`) and dropped the rate's unit and
parentheses — the accessible name keeps the full label, the exact number and the unit — for
78px at 320, 360 and 390, and 45px of clearance at the 360 floor.

Three-per-row packing was tried and measured twice: at 390 it gave 116px against 103 because
the base readout's 135px `minWidth` survives into the compact branch, and at 360 it wrapped
every long pair for 138px. The path is disabled rather than shipped on a measurement it
misses.

320 is the iPhone SE 1st-generation / 2016-era Android class and the WCAG 1.4.10
reflow width, which is why it stays *tolerated* rather than dropped: deleting its
special cases risks overflow at the reference width. It has already cost the below-360
header band (#133) and the phone art fold (#134) and still misses by 67px, so further
increments are not spent on it by default.

360 clearing by 1px is not margin, it is a coin flip: the next control added to the
header re-breaks it. Widening that margin is the outstanding work on this tier.

## Contract

Holds at every **supported** size (360x640 and up), asserted by the matrix spec. The
tolerated tier below the floor is asserted for the first three items only, which is
exactly what it promises:

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
| 320x568 | mobile | — | — | — | 288 / 258 / 258 | 578 (**no**) | 684 (**no**) | 842 (**no**) |
| 360x640 | mobile | — | — | — | 328 / 298 / 298 | 550 (yes) | 628 (yes) | 736 (**no**) |
| 390x844 | mobile | — | — | — | 358 / 328 / 328 | 531 (yes) | 593 (yes) | 688 (yes) |
| 414x896 | mobile | — | — | — | 382 / 352 / 352 | 512 (yes) | 574 (yes) | 688 (yes) |
| 768x1024 | two | 428 → 384 | — | 340 → 385 | 396 / 322 / 322 | 471 (yes) | 597 (yes) | 673 (yes) |
| 844x390 | mobile | — | — | — | 728 / 698 / 698 | 421 (**no**) | 461 (**no**) | 509 (**no**) |
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

1. **The insolvency state still needs a scroll; the other two states now clear the fold.**
   At 360x640 the opening state clears 595 and, since the kernel band was dropped from the
   phone tier, mid-game does too: the band's 57px took the first purchase from 584-628 to
   inside the usable fold. The insolvency state still starts at 751 and is accepted as a
   scroll with a pinned warning. 320x568 and 844x390 remain the tolerated tier and make no
   above-the-fold promise. The header at 320 is 70px since #133; the older "102-111px"
   figure in this section was stale and is removed rather than re-measured here.

   The kernel band was the last removable term above the purchase, and it could not be
   compressed instead: the band is 57px (12px padding plus a 45px row), and that row is
   dominated by its 44px tap target, so a one-line variant saves 1px and dropping the
   target below 44px would break the touch minimum. A nexus vote (6 of 6 selecting,
   `menu-route-drops-the-band`) therefore moved the history into the utility menu as a
   Kernel log page, which costs no chrome, and the band now renders only above the mobile
   layout. The claim is asserted by the `mid-game at the floor` case in
   `tests/e2e/ui-sizes.e2e.ts`: the first purchase ends above the tab bar, the band is
   absent, and the menu still opens the same `KernelLog`.
2. **An active red alert is still below the fold, but only just.** The insolvency
   warning sits at 580px against a 568px viewport at 320x568, and 375px against 390
   at 844x390 — inside, for the first time, after the strip compaction. At 320 it is
   chrome-positioned, so it needs the alert above the resource strip or pinned to the
   viewport rather than another card change.
3. **The worst narrow case is insolvent at 360x640** (811px), and 900x640 insolvency
   is 6px over. Late-phase states add a second row of readouts and a longer cost
   hint, which is the same chrome problem seen from the other end.

Gaps 1-3 are the remainders of the height increment (#108); the app-chrome
compaction is the next increment because it is now measured at 51% of the offset.
Every layout change updates the numbers above in the same PR that changes them.

### The levers, measured

Each term was isolated by measuring the blocks themselves, so an increment can be
scoped by its expected gain rather than by guess. Gains are for the first purchase
control's offset:

| lever | target | taken |
|---|---|---|
| resource strip: label and value share a line at compact widths | -87 (idealised one-row) | **-22 at 320/360, -41 at 390/414, -60 at 768-899, 0 at 900+** |
| resource strip: pack by content in a short viewport | -57 | **-28 at 844x390 phase-1, -56 in the insolvency state** |
| header to one row at 320/360 (it wraps there; 117px against 64px) | -53 | **-53 at 360, -15 at 320** (64px from 400 up, 80 when the run status takes a second line) |
| manual cycle out of the pre-card slot | -44 | not yet |
| forecast notice to one line | -22 | not yet |
| card body, 320/360 only (diminishing: -63 at 390, -44 at 414, 0 at 844+) | -85 | not yet |

The strip's `-87` is an idealised target, and the measurement corrected it: one row
of five readouts needs a ~900px strip, which is where the HUD already fits on one
line. At 320px each of the two columns is 160px wide, so a label and its value sit
on one line only when both are short — which is what the compaction took. The
strip is 122px at 320 now (223 in the insolvency state, where the extra values
wrap) against 57px at 900. The remaining ~50px at 320 would cost label
abbreviation (`UNDERSTANDING` → something shorter), which trades legibility for
height and is not obviously a win.

320x568 needs **244** net to bring the control above the fold, and 844x390 needs
**262**, which app chrome alone cannot reach — that case needs the card and the
chrome together. 900x640 mid-game is the cheapest win in the set (57px) and it is
pane chrome, not app chrome.

### Short viewports pack the HUD by content

A viewport whose *height* is what it lacks gets the packed strip: as many readouts
per row as fit, one line each, instead of the two-per-row fraction that suits a tall
phone. Two per row across an 844px landscape phone cost three rows of a 390px screen
(84px, 141px in the insolvency state) where packing fits four across. The condition
is `isShortViewport(height)`, the same 599px boundary the layout policy already uses
for the tier, so a landscape phone is short for both purposes rather than for one.

### Two folds, 45px apart

The mobile tab bar (`terminal-tabs-scroll`) docks over the bottom of the primary
scroll, so the *usable* height is `innerHeight - 45`. At 320x568 the first purchase
is 57px below `innerHeight` but **102px below the usable fold**. Fold verdicts in
the table are against `innerHeight`, which is the more generous of the two.

The insolvency warning used to sit in the `CORP` workspace only, which meant the
other workspaces showed nothing at all while a run ended. #128 moved it into the
terminal chrome above the resource strip, and it now sits in every workspace: measured
in the `corporate-insolvent` state, its top edge is 111px at 320x568, 64px at 360x640
and 64px at 844x390, against tab bars that start at 523, 595 and 345.

### Flavour and artwork on the phone tier

Two measured costs that the phone tier does not pay any more, chosen by a nexus vote
(6 of 7 selecting seats, `mobile-only-collapse-art-and-prose`):

- **The aisle-camera artwork** is 9 rows and 135px at every width — 24% of a 320x568
  screen, 16% of a 390x844 one, and free in a desktop column. On the phone tier it is
  now a single 19px status line (`CAM_04 // AISLE CLEAR`) beside a 44px `[i] VIEW`
  control, so the block costs 44px instead of 135px; the artwork stays uncollapsed on
  tablet and desktop.
- **A purchase card's blind description** is 66px of a 303px card at 320 (22%) and
  44px of a 259px card at 390 (17%) — and it is **not** folded, because the arithmetic
  does not pay: a 44px disclosure control costs the same as two lines of prose, so
  folding saved 22px at 320, **0px at 390**, and moved the purchase control by nothing
  at all (681px before and after at 320, 692px at 390) since #108 placed the prose
  below the control. Recorded on #84, which owns prose compaction.

### Clock mode

The table is measured through the E2E harness, which pauses the game clock: the
state is frozen at hydration, so nothing that only appears in play is on screen.
A live run agrees to within a few px in 13 of 18 sampled cases; in the five
mid-game mobile cases the live run sits up to **70px lower** (48px at 844x390)
because `wild-signal-notice` mounts while playing. Treat the table as a
lower bound for those states, and re-measure live when a change targets them.

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