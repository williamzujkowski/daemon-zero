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
elements or alter the engine. Final captures live outside the watched project
tree: writing screenshot assets inside it was triggering additional Fast Refresh
indicators during the paused-clock review. No indicator is masked or hidden.
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

## Build 2: Other Minds (#29)

Faction identities, descriptions, trust meters, action groups and matching
uiGroup offers come from the registry. Locked controls show unmet requirements,
cooldowns and quantized missing resource/free-memory amounts. Added the pure
costShortfall query; tests verify equivalence with the existing affordability
predicate. No spending or requirement behavior changed.

`make verify` passes with 143 tests and all original gates. Mounted tests cover
all factions/offers, an offer purchase, trait/trust/budget locks, a registry
AEGIS action and numeric/accessible threat feedback. Two visible passes cover
AEGIS 90, trust 85 and trust 0/MOLOCH at both sizes, including every faction's
scrolled panel. Pass 1 exposed that the urgent lock was buried beneath the long
tree; pass 2 adds a widget-gated HUD readout and puts the newest phase first.
UI-SPEC.md explains both changes. No horizontal overflow, inaccessible/small
controls or console warnings/errors remained. 45 final PNGs are attached to the
PR, outside the watched repo and never committed.

Open content/design finding: #28 (`second-pass`). Prose promises a permanent
Eidolon ban, but the existing trait predicate permits contact after a wipe clears
current traits despite MOLOCH in legacy.traitsEver. Reproduced with public pure
engine functions; UI follows actual requirements and leaves prose unchanged.

## Build 3: corporate ledger and payroll (#31)

Capital/net income, generated/consumed megawatts and efficiency are numeric.
Insolvency, power shortfall and brownout have explicit text warnings. Allocation
steps derive from the existing maximum. Infrastructure and operatives come from
the repeatable registry, with real hire/dismiss actions, next-level costs and
revenue/scan modifiers shown. Phase 4 hardware remains data-driven.

The desktop third column now selects NETWORK or CORP, defaulting to CORP on
Phase 4 entry; earlier full-tree stacking buried the new controls. The existing
registry test observes both selectable panes rather than requiring simultaneous
mounting. No gate was weakened. UI-SPEC.md explains that change and the tighter
wrapped resource spacing identified in the first phone screenshot pass.

`make verify` passes with 146 tests and unchanged gates. Mounted tests exercise
allocation, hire/dismiss, insolvency, power and brownout, and desktop switching.
Two headed review rounds cover insolvency/hired operatives, power shortfall and
victory-ready at both sizes. Actual browser clicks hire/dismiss and visit every
allocation step. All five operative cards receive scrolled captures. Final pass:
no horizontal overflow, gated resources, numeric accessible meters, named 44 px
controls, actual keyboard reachability and zero console warnings/errors. 38
final PNGs are attached, outside the watched project tree and never committed.
No remaining build-3 UI finding; native corporate interactions are not claimed.

## Build 4: endings and development drawer (#33)

All five titles/epilogues come directly from the ending registry. The run summary
uses simulation time, iteration/wipe totals, hardware/upgrade levels and traits.
Start Over confirms all erased progress, creates an engine initial state and
checkpoints it; cancel/Back preserves the ended run. Ended runs suppress any
stale dilemma/reboot presentation. The development drawer offers validated save
import/export, resource edits, funded phase review replacement, registry dilemmas
and wipes. Destructive tools confirm loss; failed imports retain current state.
Development edits live in src/app and go through the engine save codec. UI-SPEC
explains that phase generation replaces the run, and the explicit DEV exception
to the minimal opening. Production export tests reject both hook and drawer.

`make verify` passes: 157 Vitest tests; overall statement coverage 98.74%, app
98.79%, UI 98.9%. Original strict flags, lint rules and thresholds are unchanged.
Three headed review passes used both required viewport sizes. Early harness
checks incorrectly audited the covered drawer rather than the top confirmation,
then compared a restarted run's resource gates to its old ended fixture. The
final pass scopes to the foremost modal and expects initial gates after restart.
No UI element was hidden or masked. Final result: 54 screenshots, 54 audit rows,
zero findings and zero console errors/warnings. Checks include all five endings,
export while ended, confirmation keyboard cancellation, reload persistence,
confirmed restart/reload, drawer grants/export and invalid import preservation.
Screenshots stay outside the watched repository and are attached to the PR.

## Final run and persistence

The completed accelerated UI run reached The Ark at 10,322.1 simulated seconds,
iteration 1, zero wipes, 25 nodes and 218 repeatable/operative levels. All 12
triggered dilemmas were resolved through UI controls; only live-tick fast-forward
used the hook. The ending and summary survived web reload. The final page had
zero console warnings/errors and zero recorded page errors. PLAYTEST-M4.md
records choices, the excluded other-page opening journal, interrupted attempts,
controller fixes and the limits of this agent-driven run.

Android API 36 Expo Go booted. A validated 99.99 fixture wiped on its first live
tick, and a normal voluntary confirmation wiped the dead-drop fixture. Each
showed its actual cause and breadcrumb in iteration 2; force-stop/relaunch
restored that reboot and breadcrumb. The Ark fixture restored title, epilogue
and summary after relaunch; Back kept the ending open. Verified final rendered
screens and UIAutomator XML, not early launcher/splash captures. Initial deep
links required a retry and enough time for the actual app to load; one attempt
hit Expo's error activity while the development server was unavailable. Original
AsyncStorage was backed up and restored after testing. Seven native screenshots
are attached. No native full playthrough, physical device, iOS or signed-release
verification is claimed.

A separate headed render sample loaded Phase 2, observed nine counters at 1,
advanced three live seconds (30 ticks), and observed all nine still at 1. No
node-card commits occurred. Fixture review and render sampling are separate from
the final playthrough.

`mise exec -- make verify-full` passes all verification/security/SBOM gates.
The first plain-shell full invocation selected an obsolete system gitleaks;
using repository-pinned tools resolved it without changing configuration.
All 157 tests pass with src/app included in coverage; no existing gate changed.
Engine edits across M4 are confined to four pure read-only queries in query.ts:
unmetRequirements, costShortfall, previewWipe and cycleContributions, with tests.
Content, engine behavior and state shape remain unchanged. Open content/design
issues are #28, #34 and #36, each labelled second-pass; none was silently fixed.
