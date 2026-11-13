# Replayability A — accessible decoded speech

Issue #75; implements section A of REPLAYABILITY-PLAN.md. No content, balance,
engine, saved state or Phase 1 pacing changes.

## Replayability pilot A — accessible decoded speech

Decoded Audio keeps its existing live feed and adds NEXT TRANSMISSION. With
reduced motion, the waveform is static and speech advances only on request.
In normal mode speech follows the existing eight-second cadence; NEXT holds a
line and FOLLOW LIVE resumes it. Changing to reduced motion holds the currently
eligible line; switching back does not discard that hold. Controls remain inside
Audio, appear only after decoding, and never change resources or saved history.

Focus stays on the manual control. Automatic text is not a live-region alert.
A line that loses eligibility is replaced by an eligible fallback. Restore,
Start Fresh and iteration changes reset local selection; a wipe cannot retain
hidden speech. Waveform/time subscriptions are isolated from parent widgets and
purchase cards. No new panel, narrative text, pacing or save schema is introduced.

FOLLOW LIVE returns keyboard focus to NEXT TRANSMISSION when it disappears.
The ordinary asynchronous platform preference lookup still starts normal-motion
users in live mode; a later change to reduced motion holds the visible line.

## Verification

Component tests cover every eligible line/wrap, live/hold/resume, preference
changes, zero/one-line sets, disappearing eligibility, decoder removal, restore
and iteration reset, state immutability and sibling node render counts.
Production E2E covers keyboard traversal and normal live/hold/reload behavior.

Fresh fixtures were generated from this branch. Visible Chrome checked tick 0,
parser-ready with decoder locked, and all Phase 1 widgets at 390x844 and 1440x900.
Pass 1: zero console errors/warnings, horizontal overflow or visible controls
below 44px. Keyboard activation preserved focus. The fan/parser cards each
stayed 1 -> 1 over 30 live ticks before decoding; the network-exit card stayed
1 -> 1 after decoding. Tick 0 had no node card to measure. Screenshots are
attached to the PR, not committed. The final focus refinement is covered by
component/production E2E tests; visible final-build review is recorded below.

No Android, physical-device screen reader or human pacing qualification is
claimed for this UI-only increment. Nexus CI-health check reported healthy;
expert provider quota limits from the planning review remain unresolved.

Final checks: 382 unit tests; aggregate statement coverage engine 99.08%, app
98.98%, UI 98.72%. `make verify-full` passed with unchanged pacing, coverage and
security gates; Trivy retains its existing warning about the ignored generated
Android mapping-file size. Production-root E2E: 46 passed (31.4s). The first E2E
attempt assumed a mobile Sensors tab on desktop; the harness now navigates only
when that tab exists. No application gate or assertion was weakened.

Visible pass 2 repeated all six views after the focus refinement with the same
zero-error/layout results and 1 -> 1 counts. Independent standards/spec reviews
found no blocking issue. They prompted a safe zero/one-line FOLLOW LIVE guard,
a real voluntary-wipe component test, and a Start Fresh/restore production test.
Those final edge/lifecycle changes passed the full automated suite. No open
visual finding remains from the two review passes. PR screenshots show decoded
and locked states; development-only DEV controls are expected in those captures.
