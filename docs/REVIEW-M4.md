# M4 review evidence

## Setup: fixtures (#24)

`scripts/make-fixtures.ts` now emits 21 save codes: the five existing M3 states
plus Phase 2 unlocked, dead-drop/breadcrumb, suspicion 99, a separate one-tick
wipe, iteration 2 with inherited breadcrumb, Phase 3 AEGIS 90, Eidolon trust 85
and 0/MOLOCH, corporate insolvency with hired operatives, megawatt shortfall,
victory-ready and all five endings. The original M3 tests use the unchanged
`makePhase1Fixtures` helper to avoid generating unrelated states per suite.

Later-state fixtures are deliberately controlled save inputs, not balance runs.
They are parsed/reconciled through engine deserialize. Hardware and operative
purchases, breadcrumb writing, wipes and victory/ending selection all use the
unchanged public engine functions. The fixture builder recomputes rates with the
engine's computeRates query after validating each controlled input.
No engine behavior, schema or content is changed.

At 10 Hz, suspicion 99 is not one fixed tick from a suspicion wipe with these
rates. The separate `one-tick-wipe` input has suspicion 99.99; a test proves that
one 0.1-second engine tick wipes it and carries its breadcrumb. The requested 99
input remains available and is tested not to claim that transition prematurely.

All pacing, content or design issues filed during M4 receive `second-pass`.
Fixture generation does not establish native UI or browser behavior; each build
PR will record its own visible reviews and the final accelerated playthrough.

## Build 1: network, dead-drop and reboot (#26)

`make verify` passes with 139 Vitest tests, unchanged lint/strict flags/coverage
floors and production export. Engine edits are confined to three pure queries:
unmetRequirements, previewWipe and cycleContributions. Tests compare diagnostics
to the existing requirement predicate, retention to actual wipe results and
source sums to computeRates under finance, suspension, actuator and grid effects.
No engine behavior, schema or content changed.

Mounted tests cover grouped actions/cooldowns, unique test IDs, Unicode breadcrumb
limits, save/cancel/confirm, voluntary wipe, a forced wipe inside a 0.1s runtime
tick, reboot after remount and an actual engine echo after rediscovery. Fixed a
preexisting duplicate speech test ID shared by microphone and forecast widgets.

Three review rounds used the visible isolated Chrome session at 390×844 and
1440×900, covering Phase 2 unlocked, dead-drop, suspicion 99, one-tick wipe,
iteration 2 and Phase 3 network states. The first round's interrupted harness
misread a pending reboot and clicked an obsolete tab; the later rounds explicitly
wait for the modal and lazy hook after reload. Paused fixture clocks also trapped
Expo's transient import indicator over Core. Final capture primes identical
ownership safely, waits for imports to finish, then freezes time and loads the
exact fixture. The browser clock is resumed before each priming stage because
the override is shared by pages in the browser context. It does not hide DOM
elements or alter the engine.
The card counter now has a small synchronous storage module separate from the
lazy web hook: remounting a pane no longer repeatedly invokes Metro's import
loader/indicator just to record a commit. The production hook exclusion test is
retained. Both viewport sizes have unobstructed controls, gating, numeric meters, no horizontal
overflow, named 44 px controls and actual Tab reachability. Zero console errors
or warnings. Final screenshots are attached, never committed.

The final round exercises wipe confirmation, keyboard cancellation, voluntary
wipe and reload, and forced-tick wipe followed by reload. Each retained the
breadcrumb and rebuilt the reboot view. No remaining build-1 UI findings. Native
wipe/ending persistence is reserved for the final M4 checks.
