# Mobile large-text reachability

Issue #85; baseline `d566845` (compact-details PR #86). No engine/content,
clock/persistence, balance, dependency or save-schema changes.

## Failure and fix

The previous mobile layout reserved independent fixed regions for header/HUD,
notices, workspace navigation, guest controls, log and tabs. Enlarged text could
consume all available height before the purchase scroll was allocated anything.
The new production regression test fails that baseline with a measured purchase
pane height of **0px** at 390x844 with doubled text.

Mobile now has one primary scroll containing header, resources, notices,
workspace navigation, guest controls and the active pane's ordinary content.
The pane uses a non-scrolling flow container inside it, avoiding competing
vertical scrolls. Resources and warnings are neither removed nor made smaller;
they can scroll above the current purchase and remain reachable by scrolling up.
This is an intentional change from permanently fixed mobile chrome, at normal
text size as well as large text. Desktop retains its existing columns/scrolls.

The virtualized kernel log is a sibling of the main scroll, never nested inside
a same-direction plain ScrollView. Compact/expanded mobile log height is the
smaller of 120/280px and 25%/45% of window height. Pane tabs occupy one horizontal
row; the active destination scrolls into view on selection/layout. Pane changes
return the main scroll to the top. No gameplay or saved preference changes.

A review found that a doubled-text quirk title became an approximately 80px-wide
column beside Details. The title row now wraps, reserving a reasonable title
basis and moving Details below it when necessary. This preserves text size and
readability rather than clipping, ellipsizing or scaling down the title.

The design follows [React Native's bounded ScrollView requirement](https://reactnative.dev/docs/scrollview)
and the objective of preserving functionality while text is resized in
[WCAG Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html).
These checks do not amount to a full accessibility-conformance certification.

## Automated evidence

New mounted tests cover mobile flow containment, a separate virtualized log,
compact/expanded short-window bounds, guest controls and unchanged desktop
structure. The existing workspace test now supplies realistic viewport height
as well as width; its original 120/280 log assertions remain intact.

Production E2E performs a real action purchase and verifies its effects, opens
Details by keyboard, reads resources/warnings, navigates panes, accesses Save and
expands the kernel under controlled doubled CSS font sizes and line heights.
A Phase 4 check executes PRUNE; a landscape check keeps finance warnings and
controls reachable. This synthetic text test is distinct from browser zoom and
native font scaling. It first reproduced the old zero-height failure.

Final `make verify-full` passes with **440 unit tests**, plus **66 production
E2E cases (43.4s)**. Engine/app/UI statement coverage is **99.10% / 98.98% /
98.32%**; UI branch coverage is **92.45%**. Every existing strict/lint/coverage/
security/pacing gate is retained; SBOM generation passes. The careful campaign
remains 9771.3 simulated seconds with zero wipes. The existing Trivy warning
about an oversized ignored generated Android mapping file remains unchanged.

## Visible browser and real zoom

Two review passes covered guest, Phase 2 Operations, Phase 4 Swarm and Phase 5
Work. The final immutable production export passed 24 cases: each state at
390x844, 1440x900 and 844x390 with normal and doubled CSS text/line heights.
Controls were scrolled into reach and operated: manual input, purchases, PRUNE,
Details Enter/Space, Save Enter/Escape, resources, pane/workspace navigation and
available kernel expansion. Zero console warnings/errors, document horizontal
overflow or visible controls below 44px were recorded. In Phase 2 at 390x844,
the new primary scroll retains approximately 679px of viewport at both text
sizes; the old separate purchase viewport had collapsed to zero. The new
primary area includes chrome, which can now scroll away to expose purchases.

Four further cases used **actual Chrome page zoom at 200%**, set through Chrome
Settings in an isolated temporary profile. Measured CSS viewport changed from
1416x888 at DPR 1 to **708x444 at DPR 2**, with visualViewport.scale still 1.
This is browser zoom, not CDP pinch scaling. The same state/action/access checks
passed. CDP screenshot capture recorded the full physical viewport after the
ordinary Playwright capture initially cropped the zoomed image. No application
change was made for that capture problem.

The first pass found the narrow quirk-title column; the second verified the
wrapping fix. Regression E2E now requires at least 150px title reading width
in the tested large-text state. It also focuses an initially offscreen CORE tab,
verifies it scrolls into view, activates it with Enter and returns to CORP. This
is focus/activation coverage, not a claim about complete screen-reader traversal.

Separate development checks measured Phase 4 and Phase 5 node cards and a swarm
cohort at **1 -> 1 renders across 30 individually dispatched live ticks**.
Independent standards/spec reviews found no code blocker and prompted correction
of stale documentation about fixed mobile notices/workspace controls. No visual
finding remains in the tested sizes. Screenshots and their hashes are attached
to the PR rather than committed. No full campaign or human usability study was
performed for this layout change.

## Android system font scaling

Expo Go actually booted on emulator-5554 with Android system `font_scale=2.0`.
A valid Phase 2 checkpoint was seeded in the app's normal local persistence
store, then the rendered game was scrolled using native input. A real WRITE
DRIVER tap acquired `p2_arp_discovery`, confirmed in the app's persisted state.
This proves purchase reachability through the new mobile flow at enlarged native
text. It is not a native paste-import or complete-campaign test.

The first automation attempt searched for Details in the Work pane and did not
find it; that attempt is not claimed successful. A second attempt tested the
visible purchase control directly. Both attempts restored the original database
and journal byte-for-byte (SHA-256 verified), restored system font scale to 1.0,
and left Expo Go stopped. No user's campaign progress was retained from testing.

No physical Android device, iOS, native screen-reader or unusually small device
beyond the stated viewport checks has been qualified. The kernel's compact view
is still a preview; expanded log access is the relevant reading check on short
screens. Human preference for the newly scrolling mobile HUD remains unmeasured.
