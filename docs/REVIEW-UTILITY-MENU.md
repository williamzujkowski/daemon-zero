# Utility menu foundation

Issue #89; baseline `92d8795`. This is the utility-menu slice, not the later
column-priority or soundtrack implementation. No engine/content, balance,
save-schema, dependency or pacing changes were made.

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
The ending surface shows the same utilities and returns to its epilogue.

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

Independent standards review found no actionable issue. Spec review found two
edge cases, both fixed and re-reviewed: destructive replacement now checks the
confirmation scope inside the app runtime action, after overdue live ticks have
been sampled; and a small focus request survives terminal remounts after a
successful import/reset. Tests cover a delayed dilemma and wipe occurring on the
confirmation click, stale restored-save tokens, normal resource ticks, safe focus
restoration and priority for imported mandatory overlays. No engine behavior changed.

The unit suite passes **464 tests in 71 files**. Statement coverage is engine
**99.10%**, app **98.99%**, UI **98.18%**; all existing branch/function/line floors,
lint rules, strict flags and pacing gates remain intact. The careful campaign
remains 9771.3 simulated seconds with zero wipes. Production E2E passes **74 cases
(51.4s)**, including keyboard focus containment, Back/Escape, safe import/reset,
ending saves, an arriving dilemma cancelling reset and narrow enlarged labels.
`make verify-full` passes, including security scanning and SBOM generation.

Two visible review passes covered guest, corporate insolvency and Shipped ending
menus, saves, confirmations and help at 390x844, 1440x900, 320x640 and 844x390.
The 320px cases used doubled CSS text and line height. The first pass found a
clipped verbose Back caption; the second uses a short BACK label with its full
accessible name. All **48 final cases** passed console, document overflow,
control-width containment and >=44px-target checks. Screenshots were inspected;
final artifacts remain outside git. The production export has no development
hook or drawer. No column-priority or card-density improvement is claimed here.

Three further cases used **actual Chrome 200% page zoom**, with a measured
708x444 CSS viewport and DPR 2, and operated export, reset cancellation and
closing on the guest, insolvency and ending states. No console warnings/errors
or horizontal document overflow occurred. This is separate from CSS text scaling.

Development counters for visible node/action/cohort cards in Phase 4 and Phase 5
Work, Operations and Swarm remained **1 -> 1 across 30 individually dispatched
live ticks**, with the utility menu open. Closing or opening a local utility
route does not replace the gameplay panes. A full campaign was not replayed for
this utility-only change.

Android Expo Go actually booted at system font scales **1.0 and 2.0**. Real taps
opened MENU -> SAVES and exported a valid v4 code. Android Back cancelled reset
confirmation, preserving the exact exported code; subsequent Back presses
returned to the root and then gameplay. Ownership and iteration stayed intact.
The original SQLite database and journal were restored byte-for-byte with SHA-256
checks, font scale restored to 1.0, and Expo Go stopped. Native ending utilities,
successful import, completed reset, screen readers, physical Android and iOS
were not verified in this pass. Initial native harness assertions/scroll targets
were corrected; no application defect was established by those failed attempts.

A full-security attempt overlapped E2E cleanup and Trivy encountered a disappearing
`test-results/.last-run.json`. Verification was rerun serially, without altering
scanner configuration. The pre-existing oversized ignored Android mapping-file
warning remains a tooling limitation, not a relaxed gate.
