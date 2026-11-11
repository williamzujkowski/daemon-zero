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
