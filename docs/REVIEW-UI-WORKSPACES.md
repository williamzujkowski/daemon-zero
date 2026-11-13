# Phase density review — focused workspaces

Issue #60; baseline `aacdc83` (PR #61). This second increment changes UI hierarchy,
not engine behavior, balance, content, narrative or save schema. The maintainer
authorized continuing and merging the UI PRs.

## Changes and rationale

The first pass removed inline process controls and duplicate speech, but late
panes still stacked purchases, faction descriptions, actions, cohorts and payroll.
Work now contains purchases. Unlocked Operations, Swarm, Factions, Finance,
Payroll and Reference sections provide separate destinations above the scroll.
Pending wild signals remain discoverable from a compact notice. Corporate risk
warnings remain outside every section; the AEGIS HUD stays in the resource strip.

Mobile opens the current phase's registry slot on hydration and phase changes.
Desktop gives current work more width and omits the empty sensor column before
unlock. Earlier repeatable upgrades fold without losing purchase access or effects.
KERNEL // LIVE stays visible and expands on demand. Controls, authored content,
Lineage reveals and process maintenance remain available. These local view choices
are not saved as game state.

## Start / midpoint / end review

Fresh fixtures came from `scripts/make-ui-audit-fixtures.ts`: the unchanged careful
bot's actual campaign at all 18 checkpoints, without funding or editing states.
Visible Chrome at 390x844 and 1440x900 covered every unlocked primary tab and every
new workspace section: **356 views**. Automated geometry/console inspection found
zero horizontal overflow, zero controls below 44px, and zero console warnings or
errors. Screenshots were captured outside git; overview sheets and representative
full-size views are attached to the PR. Visual inspection included all 18 default
states at both widths and the new native sections.

One initial sweep was interrupted by an export regeneration. The completed sweep
used a stable export. A later cleanup removed an empty legacy action-group
heading; Operations was checked again at both widths. Production E2E
also exercises keyboard Enter on the pending signal and log-size controls.

Desktop current-phase Work content height, same engine state and viewport as the
PR #61 baseline, in pixels. Other sections still contain the authored content;
these reductions describe the default purchase view, not deleted content. A
height equal to the pane's viewport means no scrolling is needed.

| Phase | Start | Midpoint | End |
|---|---|---|---|
| 0 | 836 → 836 | 1,138 → 984 | 1,051 → 897 |
| 1 | 1,453 → 782 | 2,507 → 1,749 | 2,202 → 1,749 |
| 2 | 2,663 → 554 | 4,279 → 1,397 | 5,087 → 1,056 |
| 3 | 6,189 → 554 | 7,063 → 976 | 11,509 → 889 |
| 4 | 9,777 → 637 | 10,067 → 853 | 9,932 → 1,078 |
| 5 | 10,291 → 505 | 9,870 → 984 | 9,376 → 897 |

Phase 0 keeps its single-control opening and pinned quota/audit controls. Phase 1
keeps sensors alongside work on desktop. Phases 2–3 stop burying purchases under
management; Phases 4–5 stop putting finance/payroll ahead of progression. Mobile
late-game Work now opens directly instead of requiring a trip from CORE.

## Verification and limits

- `make verify-full` passes: 334 unit/component tests; all existing strict, lint, coverage and pacing gates
  remain unchanged. Tests cover mobile phase-following/manual navigation, signal
  discovery, risk warnings, folded upgrades and unchanged engine effects.
- Static node, action and cohort counters remain unchanged across 30 live ticks
  in both Phase 4 and Phase 5, tested within each workspace separately. Switching
  sections intentionally mounts a different view; this is not a tick rerender.
- Statement coverage: engine 99.08%, app 98.97%, UI 98.96%.
- Production E2E (30 cases per URL configuration) covers navigation, keyboard controls, original purchases and
  effects, dilemmas, cohort operations, saves and endings. Production still has
  no development hook or drawer.
- Actual Android Expo Go emulator: Phase 5 opens in CORP Work; Finance, Payroll,
  Swarm and log expansion were operated and screenshot-inspected. Original
  emulator save restored afterward. This pass does not requalify Android save
  migration/relaunch, physical devices, iOS or a standalone APK.
- These are reproducible layout checkpoints, not a new human full-campaign
  playthrough. Factions and cohort descriptions can still be long in their own
  sections; they no longer compete with purchases. Navigation adds a choice of
  destinations, which should be evaluated in the maintainer's next playthrough.
- Retention pacing remains separate in #59. The supplied save's 5,764 recovered
  Understanding and 500-point conditioning shed are unchanged.
