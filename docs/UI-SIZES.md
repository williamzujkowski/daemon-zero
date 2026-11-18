# UI sizes: contract, matrix and measured gaps

Issue #103 (follow-up to #89). Measurement and gating shipped in #104; the first
layout increment shipped in #106 and was corrected in #110 after measurement showed
the claimed column floor was only wired into the tablet tier. The policy itself is
`src/ui/layout.ts`, unit-tested in `tests/ui-layout.spec.ts`; the matrix only has to
confirm the geometry that policy predicts.

## Size matrix

Every case is a real production export driven at that viewport, with reduced motion
and a paused clock, and is then read a second time with the clock resumed for 1500ms
(the paused-clock section below says which figure is which).

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
| Supported | 360 wide and 640 tall, and up | the contract below, including budgets; above-the-fold placement for the opening and mid-game states at the floor and for every sampled state from 390 up **on a paused clock** (one exception, recorded as a gap rather than hidden: the insolvency purchase at 900x640, "Still open" item 3; the floor's own insolvency state was never promised and is an accepted scroll) - see the paused-clock section, where the mid-game state does not hold this at 360x640 or 900x640 once time passes | the full matrix, including the paused-clock fold verdict of every cell: each promised cell as clearing and each exception as **not** clearing (`PAUSED_FOLD`) |
| Tolerated | 320x568, and short landscape such as 844x390 (any narrow/short combination under the floor) | renders without horizontal overflow, without clipping and with every control at 44px or larger, reachable by scrolling | only those properties; no fold or budget claim. The six verdicts the table below records for 320x568 and 844x390 are pinned in `PAUSED_FOLD` as measured facts, so the table cannot go stale; a change there is a correction to make, not a broken promise |
| Undefined | under 320 | nothing | nothing |

The evidence, measured by the size matrix itself. **Basis:** app tree at `34160fc` (`main` after #169), production web export (`make build-web`), headless Chromium, reduced motion, initial scroll position, **paused
clock**; two consecutive runs agreed on every cell. Each cell is the first purchase
control's top and bottom edge, the `geometry` annotation's `firstUnlockTop` and
`firstUnlockBottom`. `usable fold` is the annotation's `usableFold`: the docked tab bar's
top edge on the single-scroll tier, where the bar covers the last 45px of the viewport, and
the viewport height where no tab bar is docked.

| Viewport | usable fold | opening state | mid-game | insolvency |
|---|---|---|---|---|
| small-phone 320x568 | 523 | **433-477**, clears | 517-561, viewport only | 630-674, below |
| phone-360 360x640 | 595 | **427-471**, clears | **505-549**, clears | 628-672, below |
| phone-390 390x844 | 799 | **427-471**, clears | **489-533**, clears | **561-605**, clears |
| phone-large 414x896 | 851 | **408-452**, clears | **470-514**, clears | **561-605**, clears |
| tablet-portrait 768x1024 | 1024 | **471-515**, clears | **597-641**, clears | **647-691**, clears |
| phone-landscape 844x390 | 345 | 336-380, viewport only | 376-420, below | 448-492, below |
| breakpoint-edge 900x640 | 640 | **422-466**, clears | **529-573**, clears | 620-664, below |
| tablet-landscape 1024x768 | 768 | **422-466**, clears | **529-573**, clears | **620-664**, clears |
| breakpoint-three 1080x800 | 800 | **422-466**, clears | **525-569**, clears | **639-683**, clears |
| laptop 1440x900 | 900 | **365-409**, clears | **405-449**, clears | **522-566**, clears |
| desktop 1920x1080 | 1080 | **365-409**, clears | **405-449**, clears | **465-509**, clears |
| widescreen 2560x1440 | 1440 | **365-409**, clears | **405-449**, clears | **465-509**, clears |

Bold means the control ends at or above the **usable fold** (`firstUnlockAboveUsableFold`),
which is the stricter of the two folds and so implies the viewport one. `viewport only`
means the box is inside the viewport (`firstUnlockVisible`) but its bottom edge is behind
the tab bar: at 320x568 the mid-game control ends at 561 inside a 568 viewport while the tab
bar starts at 523, and at 844x390 the opening control ends at 380 against a bar at 345.
`below` means it ends past the viewport. The matrix asserts this table cell by cell, on the
paused clock: `PAUSED_FOLD` in `tests/e2e/ui-sizes.e2e.ts` holds one of the three verdicts
for each of the 36 cells, read from the annotation's two fields and nothing else, and a cell
that changes in **either** direction fails the run - a promised cell that stops clearing, or
one of the two `below` cells in the supported tier (360x640 and 900x640 insolvency, the
second being the promise's one exception) that starts clearing and so makes this document
wrong the other way. "Contract" lists every gated cell. The running-clock verdicts are
recorded in `geometry-running` and not gated; only the offset is.

**360 holds the fold for the opening and mid-game states on a paused clock; the insolvency
state does not.** #138 corrected the fold spec, which had been re-measuring the same fixture
three times (`boot()` only seeds a fixture when storage is empty), and that fix exposed
mid-game at 609-653 - below even the viewport. #139's compact chrome band then reclaimed
60px and the matrix measured mid-game at 584-628: inside 640 with 12px to spare, but behind
the tab bar at 595. Dropping the kernel band from the phone tier (#143) and compacting the
forecast (#163) are what brought it above the bar: it measures 505-549 now, 46px clear of
the usable fold. That is the paused figure; with the clock running the same control is at
617-661, 66px past the bar (see the paused-clock section). The insolvency state started at
751, 111px past the viewport, when it was put to the vote below, because a run-ending alert
adds its own band above everything else; it measures 628-672 now, 32px past the viewport and
77px past the tab bar. The matrix asserts the opening and mid-game claims at 360 and records
insolvency as reachable by scrolling.

**The insolvency state is accepted as a scroll, but the warning follows the player.**
Two nexus votes settled it: `accept-scroll-during-ending` (6 of 6) after measuring that no
chrome compression closes 111px (the gap at the time of the vote; it is 32px past the
viewport and 77px past the tab bar as measured now, and still a scroll), then `sticky-alert-inside-the-scroll` and
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
78px at 320, 360 and 390, and 45px of clearance at the 360 floor. The strip still measures
78px at 320, 360, 390 and 414 in the opening and mid-game states; the clearance figure is
#139's own and is superseded by the table above.

Three-per-row packing was tried and measured twice: at 390 it gave 116px against 103 because
the base readout's 135px `minWidth` survives into the compact branch, and at 360 it wrapped
every long pair for 138px. The path is disabled rather than shipped on a measurement it
misses.

320 is the iPhone SE 1st-generation / 2016-era Android class and the WCAG 1.4.10
reflow width, which is why it stays *tolerated* rather than dropped: deleting its
special cases risks overflow at the reference width. It has already cost the below-360
header band (#133) and the phone art fold (#134) and, when this was decided, still missed
by 67px, so further increments are not spent on it by default. Measured now, the opening
state clears the tab bar at 320 by 46px, mid-game ends 38px behind it and the insolvency
state 151px past it. The tier is unchanged: nothing is promised there.

When the floor was voted, 360 cleared by 1px, which is not margin but a coin flip: the next
control added to the header would have re-broken it, and widening that margin was the
outstanding work on this tier. Measured now, the opening state clears the tab bar at 360 by
124px and mid-game by 46px on a paused clock. The margin left to watch is the running
clock, where mid-game ends 66px past the bar.

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

Above-the-fold cells the spec gates, all on the paused clock:

- **First purchase control, every size and every sampled state** (`PAUSED_FOLD`, the first
  table under "Supported floor"): clears the usable fold at 360x640 in the opening and
  mid-game states, and in all three states at 390x844, 414x896, 768x1024, 1024x768, 1080x800,
  1440x900, 1920x1080 and 2560x1440; clears in the opening and mid-game states at 900x640.
  Asserted as **not** clearing, so a fix cannot leave this list stale: insolvency at 360x640
  and at 900x640 (both end past the viewport). Pinned as facts without a promise: 320x568
  (clears / viewport only / below) and 844x390 (viewport only / below / below).
- 360x640, each sampled state again in its own case: forecast above the fold and at most
  64px tall; the opening and mid-game purchase clearing, the insolvency purchase below.
- 360x640 mid-game (`mid-game at the floor`): the purchase ends at or above the docked tab
  bar, read through the same `usableFold` the annotation carries.
- 360x640 insolvency (`insolvency at the floor`): the warning on screen at rest and still on
  screen once the purchase is scrolled into view.
- 390x844: forecast above the fold; first WRITE DRIVER above the fold in the early
  state; insolvency warning and forecast above the fold while that warning is active.
- 1440x900: forecast and first WRITE DRIVER above the fold in every sampled state.
- 320x568: the insolvency warning on screen at rest.

## Measured, and the gaps this contract does not yet meet

**Basis:** app tree at `34160fc` (`main` after #169), production web export (`make build-web`), headless Chromium, reduced motion, initial scroll position, **paused clock**; two
consecutive runs agreed on every cell.

Top edge of the first WRITE DRIVER (topmost purchase control in the initially opened
destination) and whether its box is fully on screen, per sampled state. `cols` is the
core column width early → later phases (the phase's own slot takes the larger share);
`card` is the widest node card in that state. The yes/no is the **viewport** verdict
(`firstUnlockVisible`), which is the basis the contract uses; the usable-fold verdict is in
the first table under "Supported floor". Two cells differ between the two bases: 320x568
mid-game and 844x390 opening are inside the viewport and behind the tab bar.

| Size | cols | core | sensors | side | card (early / mid / warning) | phase-1-widgets | epistemic-ready-p2 | corporate-insolvent |
|---|---|---|---|---|---|---|---|---|
| 320x568 | mobile | — | — | — | 288 / 258 / 258 | 433 (yes) | 517 (yes) | 630 (**no**) |
| 360x640 | mobile | — | — | — | 328 / 298 / 298 | 427 (yes) | 505 (yes) | 628 (**no**) |
| 390x844 | mobile | — | — | — | 358 / 328 / 328 | 427 (yes) | 489 (yes) | 561 (yes) |
| 414x896 | mobile | — | — | — | 382 / 352 / 352 | 408 (yes) | 470 (yes) | 561 (yes) |
| 768x1024 | two | 428 → 384 | — | 340 → 385 | 396 / 322 / 322 | 471 (yes) | 597 (yes) | 647 (yes) |
| 844x390 | mobile | — | — | — | 728 / 698 / 698 | 336 (yes) | 376 (**no**) | 448 (**no**) |
| 900x640 | two | 560 → 450 | — | 340 → 451 | 528 / 388 / 388 | 422 (yes) | 529 (yes) | 620 (**no**) |
| 1024x768 | two | 682 → 512 | — | 342 → 513 | 650 / 450 / 450 | 422 (yes) | 529 (yes) | 620 (yes) |
| 1080x800 | three | 720 → 340 | 360 → 340 | 0 → 400 | 688 / 337 / 337 | 422 (yes) | 525 (yes) | 639 (yes) |
| 1440x900 | three | 960 → 360 | 480 → 360 | 0 → 721 | 728 / 658 / 658 | 365 (yes) | 405 (yes) | 522 (yes) |
| 1920x1080 | three | 1280 → 480 | 640 → 480 | 0 → 961 | 728 / 698 / 698 | 365 (yes) | 405 (yes) | 465 (yes) |
| 2560x1440 | three | 1707 → 640 | 853 → 640 | 0 → 1281 | 728 / 698 / 698 | 365 (yes) | 405 (yes) | 465 (yes) |

Forecast and active-warning visibility in the same runs (same basis; `forecastVisible` and
`warningVisible`, both against the viewport):

| Size | forecast (early / mid / warning state) | insolvency warning |
|---|---|---|
| 320x568 | yes / yes / yes | yes |
| 360x640 / 390x844 / 414x896 | yes / yes / yes | yes |
| 768x1024 | yes / yes / yes | yes |
| 844x390 | yes / yes / yes | yes |
| 900x640 and above | yes / yes / yes | yes |

The two warning cells that read **no** before #128 moved the alert above the resource strip
now read yes in the matrix's `warningVisible` annotation. Its top edge (`warningTop`) is 70
at 320x568, directly under the 70px header, and 64 at every other size.

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

### The contract is measured on a paused clock

`tests/e2e/ui-sizes.e2e.ts` consumes fixtures through `boot()`, which installs a Playwright
clock and pauses it, so no time passes while geometry is read. That is what makes the matrix
reproducible, and it is the one thing the app never does: the simulation always runs. A nexus
vote (`keep-frozen-add-a-running-column`, 6 of 6 selecting) kept the frozen matrix as the
contract and added a second measurement per cell with the clock resumed for 1500ms, emitted
as a `geometry-running` annotation beside `geometry`.

Measured at 360x640, from that run. **Basis for both tables:** app tree at `34160fc` (`main` after #169), production web export (`make build-web`), headless Chromium, reduced motion, initial scroll position; the
frozen column is the **paused clock**, the running column the same page after the clock has
**run for 1500ms**. Two consecutive runs agreed on every cell. The fold column compares the
control's bottom edge with the tab bar's top edge at 595:

| State | Frozen (contract) | Running (1500ms) | Delta | Clears the 595 fold |
| --- | --- | --- | --- | --- |
| `phase-1-widgets` | 427 | 427 | 0 | yes / yes |
| `epistemic-ready-p2` | 505 | 617 | **112** | **yes / no** |
| `corporate-insolvent` | 628 | 628 | 0 | no / no |

The mid-game cell is the one that flips: it clears the fold on the paused clock and misses it
once time passes, because time-gated notices appear above the purchase. The opening and
insolvency states do not move. Measured across the whole matrix, only that one state shifts,
and by the same 112px at every size:

| Size | Mid-game frozen | Mid-game running | Delta | Inside the viewport, frozen / running |
| --- | --- | --- | --- | --- |
| 320x568 | 517 | 629 | 112 | yes / **no** |
| 360x640 | 505 | 617 | 112 | yes / **no** |
| 390x844 | 489 | 601 | 112 | yes / yes |
| 414x896 | 470 | 582 | 112 | yes / yes |
| 768x1024 | 597 | 709 | 112 | yes / yes |
| 844x390 | 376 | 488 | 112 | no / no |
| 900x640 | 529 | 641 | 112 | yes / **no** |
| 1024x768 | 529 | 641 | 112 | yes / yes |
| 1080x800 | 525 | 637 | 112 | yes / yes |
| 1440x900 | 405 | 517 | 112 | yes / yes |
| 1920x1080 | 405 | 517 | 112 | yes / yes |
| 2560x1440 | 405 | 517 | 112 | yes / yes |

Both tables carry the figures measured after #89's forecast compaction, which lowers the
frozen and the running figure by the same 22px on 360-414 (44px at 320) and so changes no
delta, and after the fix for #162 below.

The 112 is two blocks that mount once time passes, and nothing else moves: `response-notice`
at 64px, and `wild-signal-notice` at 44px plus a 4px gap. Diffing every testID'd block before
and after resuming the clock gives the same two at 360x640 and at 1440x900.

**#162: the delta read 156 and 134 on seven cells, and the cause was one wrapped label.**
Between #152 and this fix the matrix read 156 at 320, 360, 390 and 768 wide, 134 at 414, 900
and 1080, and 112 elsewhere. Bisected with the matrix, building each tree:

| Tree | 360x640 | 414x896 | 1440x900 | `wild-signal-notice` at 360 |
| --- | --- | --- | --- | --- |
| `d89b823`, before #152 | 134 | 134 | 112 | 66px, one text on two lines |
| #152, first commit (`100661f`) | 112 | 112 | 112 | 44px, one shortened line |
| #152, second commit (`92d3954`), and `afeccdb` as merged | **156** | **134** | 112 | **88px** |
| #153, #154, #155, #156, and main before this fix | 156 | 134 | 112 | 88px |
| with `[ REVIEW ]` unable to shrink | 112 | 112 | 112 | 44px |

So nothing after #152 moved it - not the memory line (#153), the seized hosts (#155) or the
`[ ▶ READ ]` control (#156). #152's review fix split `[ REVIEW ]` into its own element so the
ellipsis could not take it, and restored the full `SIGNAL PENDING //` prefix for axe. On
react-native-web every `Text` can shrink, so the name and the affordance shared the shortfall
in proportion to their widths: at 360 the 84px `[ REVIEW ]` was squeezed to 60px and broke
onto three lines (66px of text in an 88px control), and onto two at 414, 900 and 1080 where
the column is a little wider. The 112 this table recorded at the time was the figure of the
PR's first commit and does not match the tree that merged. The fix is `flexShrink: 0` on the
affordance, which is what the one-line design already said: the name alone truncates. The
matrix now asserts the offset per state at every size (`RUNNING_CLOCK_OFFSET` in
`tests/e2e/ui-sizes.e2e.ts`), so a wrapped notice or a new block above the purchase fails
the run instead of drifting into a table. The cost is in the name: at 320 the text has 168px of the
329 it wants and at 360 208px, and the prefix takes the first 152, so the signal's own name is all but ellipsed at 320 and cut to a few letters at 360,
while the full text stays in the accessible label.

On the
viewport basis this table uses, 320x568, 360x640 and 900x640 are the cells that flip; only the
last two carry a promise. On the usable-fold basis the annotation now also carries, the
running mid-game control ends at 673 against 523 at 320x568, 661 against 595 at 360x640, 532
against 345 at 844x390 and 685 against 640 at 900x640, and clears at the other eight sizes;
the cells that flip between the two clocks are the same 360x640 and 900x640, because 320x568
is already behind its tab bar when paused. Every sampled
state other than mid-game still moves by 0. So the promise row above is qualified rather
than rewritten: the contract still holds on the basis it is measured, and 900x640 joins 360x640
as a cell where a running game does not clear. Note this table reads against the **viewport**
(the annotation's own definition), not the stricter usable fold. Treat every above-the-fold number in this document as a
frozen-clock budget, and read the running column before promising a player what they will
see. The running figure is a sample at 1500ms, not a settled value: what matters is its
scale, not its last digit.

### Late-game phone play is a scroll, by decision

Measured at 360x640 with a phase-5 mid-game save in the CORP workspace, on the served build:
header 0-80; resource strip 80-234 (154px - seven meters, CYC 26, UND 26, MEM 45, CAP 45,
THM 26, SUS 26, AEGIS LOCK 57); the interrupt forecast block about 234-404; the omen
notice 404-477; the workspace nav 477-569 (two rows of 44px buttons); the wild-signal
notice 573-639; and the first purchase control against a 595 fold:

| Save loaded | First purchase | Distance past the fold |
| --- | --- | --- |
| fresh (`savedAtMs` now) | 822-866 | 227px |
| stale (`savedAtMs` 0, offline progression applied) | 838-882 | 243px |

Both are real scenarios - the second is a returning player - and they differ by 16px because
offline progression adds its own notices. Measure with a truthful `savedAtMs` when comparing
against another cell, or the offline notices will be counted as live chrome.

No single lever reaches the fold, and neither do the two biggest together: collapsing the
forecast block (about 145px) and making the workspace nav one scroll row (about 48px) lands
the control near 645, still 50px past the fold before the card's own header. Reaching it
would mean hiding the forecast, the notices or the workspace buttons that the player is
reading. A nexus vote (`accept-late-game-scroll-and-document`, 3 of 4 selecting,
`thresholdMet` true) therefore records phase-5 phone play as a scroll rather than promising
a fold it cannot keep. The strip at this state is 154px against 78px in phase 1; that
growth is the number to watch if this is revisited.

### Still open

1. **The insolvency state still needs a scroll; the other two states now clear the fold.**
   At 360x640 the opening state clears 595 and, since the kernel band was dropped from the
   phone tier (#143), mid-game does too - **on a paused clock**: the first purchase reads 505
   against 595 since the forecast compaction (#89). With the clock running the same cell
   reads 617 and does not clear, so that claim is a budget rather than a promise (see the
   paused-clock section above).
   Compacting the two time-gated notices on the phone tier returned 22px, not the 78px
   estimated when the vote was taken, because both blocks are floored by their own 44px
   controls; the wild-signal notice now fits one line and the response notice was left
   alone after measuring a 0px return. The insolvency state reads 628-672 and is accepted
   as a scroll with a pinned warning. Measured after #89: 320x568 mid-game 517-561 against a 523 fold, and
   844x390 mid-game 376-420 and insolvency 448-492 against 345. Short landscape is the
   worst case left and is tolerated by decision, not by omission: a nexus vote
   (accept-landscape-as-tolerated, 5 of 5 selecting, thresholdMet true) weighed folding the
   network tree's phase title band and moving the purchase above the card name, and chose
   to name the tier instead. That vote also corrected a number on the way in - the 48px band
   above that purchase is widget padding 12 + heading 22 + gap 14, so a compact heading
   recovers 8px, not 48; the full 48 costs the phase title outright. Neither 320x568 nor
   844x390 makes an above-the-fold promise. The header at 320 is 70px since #133; the older "102-111px"
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
2. **The active red alert is on screen at rest at every matrix size; what is left is the
   purchase under it.** This item used to say the insolvency warning sat at 580px against
   a 568px viewport at 320x568 and 375px against 390 at 844x390, and asked for the alert
   to move above the resource strip. #128 did that: its top edge is recorded in the
   "Two folds" section below at 70px at 320x568 and 64px at 360x640 and 844x390 (the annotation's `warningTop`; this item
   used to quote 111px for 320x568, which no longer measures), and the size matrix's `geometry`
   annotation reads `warningVisible: true` for `corporate-insolvent` at all twelve sizes,
   320x568 and 844x390 included (the spec asserts the 320x568 case by name). The 580px and
   375px figures predate #128 and are removed. The annotation is taken at the initial
   scroll position; staying visible while scrolled is asserted at 360x640 only, by the
   `insolvency at the floor` case.
3. **Two supported cells still put the insolvency purchase past the viewport: 360x640 and
   900x640.** The matrix annotation reads the first purchase at 628-672 at 360x640
   (as in item 1, against a 640 viewport and a 595 usable fold) and at 620-664 at
   900x640, where `firstUnlockVisible` is false against a 640 viewport. Every other
   supported size reads `firstUnlockVisible: true` in that state. The earlier figures here
   (811px at 360x640, "6px over" at 900x640) predate the chrome compaction and #143 and are
   removed. The cause is unchanged: the insolvency state's resource strip is 154px at
   360x640 against 78px in the opening state, and 114px against 57px at 900x640, by the
   same annotation.

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
| manual cycle out of the pre-card slot | -44 | **declined** (vote below) |
| forecast notice to one line | -22 | **-22 at 360/390/414 in every sampled state; -22 at 320 and -44 in its mid-game state; 0 at 768+ and at 844x390** |
| card body, 320/360 only (diminishing: -63 at 390, -44 at 414, 0 at 844+) | -85 | **declined** (vote below) |

**The last three levers were settled by one vote (#89).** A nexus `consensus_vote`, record
`vote-1794807123274-zpaqr6s`: `build-forecast-compaction-decline-other-two`, 6 of 7 seats
selecting, `thresholdMet` true. One seat (Scope Steward) selected
`decline-all-three-and-close`. Its dissent, in substance: 22px flips no matrix cell; both
clauses of the sentence carry live numbers and an instruction ("Set resources aside"), so
abbreviating risks the legibility of gameplay-critical text; and it adds a second string
variant to maintain. The measurement bears out the first point - no supported cell changes
verdict (below) - and the build answers the other two with constraints the vote set:
abbreviation only, never ellipsis or clipping; no number and no instruction dropped; the
full sentence stays the accessible name; wide tiers keep the sentence unchanged.

- **Forecast notice, built.** Below 768px wide (`isPhoneWidth`) the sentence is abbreviated
  and `accessibilityLabel` carries the full one, as the resource strip and cost captions do:

  | Full sentence (every tier's accessible name, and the visible text from 768 up) | Phone |
  |---|---|
  | `Audit trail unreadable.` | `Audit unreadable` |
  | `Suspicion stable or falling.` | `SUS not rising` |
  | `At current rate: 910s until suspicion 100.` | `SUS 100 in ~910s` |
  | `No interrupt inbound.` | `No INT inbound` |
  | `Interrupt inbound in 45s. Set resources aside.` | `INT 45s: set aside` |

  `~` carries "at current rate", and `not rising` is the one clause that is reworded rather
  than abbreviated: `SUS stable/falling // INT 45s: set aside` is 40 characters, and the
  longest wording measured to fit one line at 360 is 38. Measured on the served build, the
  block (`forecast-notice`) went from 86px to 64px at 360, 390 and 414 and from 86-108px to
  64px at 320, and the first purchase moved by the same amount on the paused and the running
  clock:

  | Size | opening | mid-game | insolvency | mid-game, running clock |
  |---|---|---|---|---|
  | 320x568 | 455 → 433 | 561 → 517 | 652 → 630 | 717 → 673 |
  | 360x640 | 449 → 427 | 527 → 505 | 650 → 628 | 683 → 661 |
  | 390x844 | 449 → 427 | 511 → 489 | 583 → 561 | 667 → 645 |
  | 414x896 | 430 → 408 | 492 → 470 | 583 → 561 | 626 → 604 |
  | 768x1024, 844x390, 900 and wider | unchanged | unchanged | unchanged | unchanged |

  The gain is the estimate, 22px, not more: it flips no supported cell. 360x640 insolvency
  still ends at 672 against a 640 viewport, and 360x640 mid-game on a running clock ended at
  705 (661 since #162, when the running column dropped to 629, 617, 601 and 582 on the four
  phone rows above). The one verdict that moves is in the tolerated tier - 320x568 mid-game now ends at 561
  inside its 568 viewport on a paused clock, still behind the tab bar at 523. With an
  interrupt inbound - a state no sampled fixture holds, measured by patching one in - the
  full sentence is three lines at 360 and the gain is 44px there (22-44px at 320, 390 and
  414). At 320 a 34-character wording fits and a 36-character one wraps to a second line; at
  360 a four-digit countdown beside an inbound interrupt is 39 characters, which was not
  measured and is expected to wrap too. It wraps; it is never clipped.
  844x390 is in the single-scroll tier but keeps the full sentence, which already measures
  one line there. Pinned by the `forecast notice` cases in `tests/e2e/ui-sizes.e2e.ts` and by
  `tests/ui-forecast-compact.spec.ts`.
- **Manual cycle out of the pre-card slot, declined.** The control is hardcoded in
  `src/ui/TerminalPane.tsx`, not a registry widget, and renders only in the CORE pane - the
  phone's active pane in phases 0-1, where 360 already clears. The gain would land only on
  320x568 and 844x390, both tolerated by recorded votes, and `docs/UI-SPEC.md` puts the
  manual control first, with the #131 vote choosing demotion only past 200 cycles/s.
- **Card body, declined.** The -85 figure has not been re-measured since #119; UI-SPEC fixes
  the card order; the landscape vote already declined moving the purchase above the card
  name; and folding the description measured 0-22px (see the phone-tier flavour section).

The strip's `-87` is an idealised target, and the measurement corrected it: one row
of five readouts needs a ~900px strip, which is where the HUD already fits on one
line. At 320px each of the two columns is 160px wide, so a label and its value sit
on one line only when both are short — which is what the compaction took. The
strip is 122px at 320 now (223 in the insolvency state, where the extra values
wrap) against 57px at 900. The remaining ~50px at 320 would cost label
abbreviation (`UNDERSTANDING` → something shorter), which trades legibility for
height and is not obviously a win.

Those were the figures when the levers were scoped. #139 later took the abbreviation
after all, with the full label kept as the accessible name, and the strip measures 78px
at 320 now (109 in the insolvency state) against the same 57px at 900.

At that point 320x568 needed **244** net to bring the control above the fold, and 844x390
needed **262**, which app chrome alone could not reach — that case needed the card and the
chrome together. 900x640 mid-game was the cheapest win in the set (57px) and it was
pane chrome, not app chrome. Measured now, on a paused clock and against the usable fold:
320x568 clears in the opening state and needs 38px in mid-game and 151px in the insolvency
state; 844x390 needs 35px, 75px and 147px; and 900x640 mid-game clears with 67px to spare,
leaving its insolvency state 24px short and its running-clock mid-game 45px short.

### Short viewports pack the HUD by content

A viewport whose *height* is what it lacks gets the packed strip: as many readouts
per row as fit, one line each, instead of the two-per-row fraction that suits a tall
phone. Two per row across an 844px landscape phone cost three rows of a 390px screen
(84px, 141px in the insolvency state) where packing fits four across; packed, the strip
measures 28px there, and 85px in the insolvency state. The condition
is `isShortViewport(height)`, the same 599px boundary the layout policy already uses
for the tier, so a landscape phone is short for both purposes rather than for one.

Packing by content means a readout's width is its text, so a value losing a digit could
repack the strip while the player watched. #293 found it: its `phase-1-widgets` fixture
opens at 9.98% suspicion, drawn `10.0%`, and within 1.5 s of running the value reads `9.9%`.
At 320x568 that readout narrowed from 68px to 59px, rose from the third row to the second,
and the strip went from 78px to 52px, moving the first purchase up 26px (the matrix's
running-clock offset). The thermal and suspicion readouts now keep the width of two digits
before the point (`00.0`), drawn in the same font as a zero-height, hidden-from-assistive-tech
twin of the value. Values of 10 and up are drawn exactly as before. Measured at 320x568 on
that fixture: 68px wide and 78px of strip both paused and running, offset 0. The amount
readouts (cycles, understanding) are not held: they mostly grow rather than hover
around a decade boundary.

### Two folds, 45px apart

The mobile tab bar (`terminal-tabs-scroll`) docks over the bottom of the primary
scroll, so the *usable* height is `innerHeight - 45`: the bar's top edge measures 523,
595, 799, 851 and 345 at 320x568, 360x640, 390x844, 414x896 and 844x390. From 768 wide up
no tab bar is docked and the two folds are the same line. The matrix records both verdicts
per cell (`firstUnlockVisible` against `innerHeight`, `firstUnlockAboveUsableFold` against
`usableFold`), and they disagree in two paused cells: at 320x568 the mid-game purchase ends
at 561, 7px inside `innerHeight` but **38px behind the tab bar**, and at 844x390 the opening
purchase ends at 380, 10px inside and 35px behind. Fold verdicts in the "Measured" table
are against `innerHeight`, which is the more generous of the two; the first table under
"Supported floor" uses the usable fold.

The insolvency warning used to sit in the `CORP` workspace only, which meant the
other workspaces showed nothing at all while a run ended. #128 moved it into the
terminal chrome above the resource strip, and it now sits in every workspace: measured
in the `corporate-insolvent` state, its top edge is 70px at 320x568, 64px at 360x640
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

The "Measured" table is read through the E2E harness with the game clock paused: the
state is frozen at hydration, so nothing that only appears in play is on screen. This
paragraph used to estimate the difference from a hand-run live comparison taken before the
wild-signal notice was cut to one line (#152); the matrix now measures it instead, in the
`geometry-running` annotation, and the estimate is retired. Measured on the same basis as
the tables above, after the clock has run for 1500ms: the opening and insolvency states do
not move at any of the twelve sizes, and the mid-game first purchase sits **112px lower at
every size**, 844x390 included. That offset is asserted per state at every size
(`RUNNING_CLOCK_OFFSET`). Treat the paused tables as a lower bound for mid-game, and read
the running column in the paused-clock section before promising a player what they will
see.

## Running it

```bash
pnpm exec playwright test --config tests/e2e/config.ts --project=sizes
```

The project sets each viewport itself, so it runs once rather than under both the
`phone` and `desktop` projects. Each test attaches a `geometry` annotation per
sampled state — including per-column widths — and a `geometry-running` one after the
clock has run, which is what the tables above are built from. Both carry the two folds:
`firstUnlockTop`/`firstUnlockBottom`, `firstUnlockVisible` (inside the viewport),
`usableFold` (the docked tab bar's top edge, or the viewport height without one) and
`firstUnlockAboveUsableFold`. Both verdicts are asserted per cell on the paused clock
(`PAUSED_FOLD`) and recorded only on the running one. To collect
them, add `--reporter=json` and read each test's `annotations`. `make e2e` includes the project.

## Limits

- Web export only. Rotation is not covered, and native font scaling was looked at once,
  on an emulator: at `font_scale` 1.0 the phone forecast is one line on a 411 dp
  display, at 1.3 and 2.0 it wraps to two, and nothing clipped (REVIEW-ANDROID-EMULATOR-2026-11-16.md).
  Other screens at large native font sizes, and iOS, stay open.
- Safe-area insets (#89) are handled in code, seen working on an Android emulator and
  **unverified on hardware**.
  `react-native-safe-area-context` 5.11.1 wraps the app (`App.tsx`), and
  `src/ui/safeArea.tsx` is the only place an inset becomes padding: the terminal root
  pads all four edges, so the header clears the notch or status bar and the bottom tab
  bar clears the home indicator, and every full-window modal overlay (dilemma, menu,
  ending, reboot, reveals, processes, kernel history, confirm, dev drawer) adds the
  inset to its ordinary gutter. The Android-only `StatusBar.currentHeight` pad is
  gone, because edge-to-edge reports the status bar as the top inset.
  - Every size in this document is unchanged: insets are 0 on the web export, and the
    matrix passes without edits. `tests/ui-safe-area.spec.ts` asserts the padding with
    mocked insets and its absence with none.
  - The web viewport meta deliberately has no `viewport-fit=cover`. The library's web
    provider already reads `env(safe-area-inset-*)`, but without `cover` a browser
    keeps the page inside the safe area itself and those values are 0. Opting in would
    draw under the notch on iOS Safari, which nothing here can measure.
  - Emulator only (API 36, release build, REVIEW-ANDROID-EMULATOR-2026-11-16.md): the header
    starts exactly at the status-bar inset, so the removed pad was neither doubled nor
    lost; the tab bar ends at the navigation inset for gesture and three-button bars and
    a simulated bottom cutout; menu and dilemma `Modal` windows stay inside both.
  - Not exercised: no iOS device or simulator exists here and no physical Android device.
    A real notch, an Android window that is not edge-to-edge, and landscape side insets
    are all unseen.
- Geometry and console assertions, not pixel comparison: rendering differs by host
  and committed PNG baselines would break the repository's no-screenshots rule.
- The three sampled states are engine-played saves, not a human playthrough, and
  "above the fold" is measured at the initial scroll position only.
- Caption compaction (`CostHint`, `ResourceStrip`, `NodeCard`, `LogDock`) reads
  `isCompactViewport(width)` from the policy module. Its boundary,
  `COMPACT_CAPTION_MAX_WIDTH` = 900, is deliberately independent of the tier
  boundary: the core column is at most two thirds of the viewport below it, and the
  captions stayed on 900 when three columns moved to 1080.