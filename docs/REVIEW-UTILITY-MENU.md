# Utility menu foundation

Issue #89; baseline `92d8795`. This is the utility-menu slice, not the later
column-priority or soundtrack implementation. No engine/content, balance,
save-schema, dependency or pacing changes are intended.

## Interaction contract

A labelled MENU replaces the header's save launcher. Saves, import/reset
confirmation and help share one utility surface. PROC remains a direct gameplay
shortcut. Development tools remain separately available only in development;
moving their own modal into the utility dialog is deferred. There are no inert
audio sliders or speculative preference controls; #88 will provide functional
audio controls through this foundation.

Utility routes replace one another instead of stacking native modals. Back and
Escape return through confirmation, save/help and menu pages; Close returns to
the game. Confirmation cancellation preserves the entered save code. Complete
reset remains distinct from an in-game wipe and retains the explicit warning.
The ending surface can show the same utilities and return to the epilogue.

Simulation continues while utilities are open. Already-disclosed critical
warnings and save failures remain perceivable. Mandatory game events preempt
utilities and cancel destructive confirmations rather than resurfacing stale
actions afterward. Successful save replacement establishes fresh presentation.

The existing mobile primary scroll, bounded kernel and game/workspace navigation
remain intact. The menu has its own bounded scroll and readable controls on
narrow/short screens. There is no new fixed toolbar squeezing purchase space.

## Planning and scope

The [issue](https://github.com/williamzujkowski/daemon-zero/issues/89) records
research, a fresh 36-view development baseline and the later layout checklist.
Nexus's planning panel approved 3–0 with no errors, record
`vote-1794617282098-73sognl`. This is planning evidence, not test results.
Independent review added explicit ending routing, warning visibility and a
restriction against inventing autosave success indicators.

The modal contract follows the
[WAI dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Labelling the launcher follows the discoverability guidance in
[NN/g's hamburger-menu review](https://www.nngroup.com/articles/hamburger-menu-icon-recognizability/).
Primary gameplay navigation stays exposed. The implementation must preserve
readability and reachability rather than promise that every card fits above
the fold at enlarged text.

## Verification

Implementation verification is pending. This section will record actual unit,
production-browser, visible-layout, render-count and Android results before PR
submission. Planning measurements do not qualify the implemented menu.
