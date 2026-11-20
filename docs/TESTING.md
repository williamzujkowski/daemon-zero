# Testing

## Layers

| Layer | Tool | Where | Runs in |
|---|---|---|---|
| Content validation | Zod + integrity checks | `scripts/validate-content.ts`, `tests/content.spec.ts` | `make validate`, `make test` |
| Engine unit tests | Vitest | `tests/*.spec.ts` | `make test` (with coverage thresholds) |
| Balance simulation | headless bot | `src/engine/sim/`, `scripts/run-sim.ts`, `tests/sim.spec.ts` | `make sim`, `make test` |
| Route simulation report (report only) | sim policies | `scripts/run-sim-report.ts`, `tests/sim-policy.spec.ts`, `tests/sim-report.spec.ts` | `make sim-report`, `make test` |
| Shell and runtime | Vitest, fake timers, React DOM / React Native Web | `tests/app*.spec.ts` | `make test` |
| Component tests (M3) | Vitest + React DOM + happy-dom, React Native Web alias | `tests/ui-*.spec.ts` | `make test` |
| End-to-end | Playwright against the production web export | `tests/e2e/` | `make e2e`, `make e2e-pages` |
| Published build smoke | Playwright against the live Pages site, plus its deployment commit | `tests/e2e/pages-smoke.remote.ts`, `scripts/pages-deployment.ts` | `make e2e-remote` (opt-in) |
| Agent-driven exploratory testing | Playwright MCP | `.mcp.json` | on demand |

## Writing engine tests

- Use the helpers in `tests/helpers.ts`: `fresh()`, `rich()`, `grant(state, ...nodeIds)`, `must(result)`, `withoutDilemmas(state)`.
- Reach a game situation by calling real actions (`grant`) rather than hand-building state, so effects and logs are applied the way the game applies them.
- The engine is deterministic. Assert exact values where the maths is simple, `toBeCloseTo` for integrated quantities.
- Every new integrity rule needs a test in `tests/content.spec.ts` that corrupts the real content and proves the rule fires.
- Since the release (#233), `CONTENT` is the original game plus the Earned Access pack, and the app store
  admits every game to campaign rules. `tests/helpers.ts` adds what the folded composition needs:
  `ORIGINAL_GAME` (the original game alone, for release-boundary tests that once asserted "production has
  none"), `admitted(state)` (a state as the store admits it), `presentableDilemma(state)` (an original scene
  the app can still present under campaign rules, with the state to present it in), `markedPreview(text)`
  (a production save re-marked as the retired preview channel, which production must refuse) and
  `remarkedAsProduction(text)` (a genuine pre-release preview save re-marked as production, so upgrade
  tests keep covering the load-time conversions those codec outputs exercise; their refusal as genuine
  preview saves is asserted separately). `previewSaveCode()` is the paste code of a genuine preview save.
- Specs that prove an architectural ESLint rule (`tests/purity-lint.spec.ts`, `tests/ui-lint.spec.ts`)
  lint sample code at real file paths through `ruleLinter(ruleId)` in `tests/lint-helpers.ts`. It loads the
  real `eslint.config.mjs`, runs only the rule under test, and turns off the parser's type information:
  these are syntax-tree rules, and building the TypeScript program took most of each spec's time (#306).
  Each spec also asserts that every message comes from that rule (a parse error or an ignored path fails
  the check) and that each path gets exactly the rule set the unmodified config gives it.

## Balance simulation

`make sim` runs both bot strategies through the configured simulation budget twice, from a new game
on legacy rules and from a new game admitted to campaign rules (what production plays since #233),
and prints the four results plus measured wall-clock time:

- **STEALTH** plays carefully and must reach victory within the gates in `src/engine/sim/gates.ts`
  under both rule sets; the gates are the same numbers for each.
- **GREEDY** ignores threats. It is expected to be wiped repeatedly; the test asserts it always recovers and keeps progressing (no soft-locks in the wipe loop).

The bot buys whatever most shortens the wait for the next tech node. It only uses public engine actions.

### Sim policies

A sim player is a `SimPolicy` (`src/engine/sim/policy.ts`): an upper-snake-case `id`, a
one-line `summary`, and a `step(state, reg)` that makes one decision per simulated second
through public engine actions only. `SIM_POLICIES` (`src/engine/sim/policies.ts`) lists every
policy a runner can name, and `resolvePolicy` throws on an unknown id rather than running a
different one.

- **STEALTH** and **GREEDY** are the bot's own strategies, wrapped unchanged (`strategyPolicy`).
  `runHeadlessSim` plays them through `runPolicySim`; the report hashes in `tests/sim.spec.ts`
  and the `make sim` output are byte-identical to before the interface existed.
- **IDLE** (`idlePolicy.ts`) takes no action except a free answer to each interrupt. It is the
  reference plug-in and the floor for dead-time readings.
- **TRUTHFUL_THOROUGH** and **TRUTHFUL_LOW_RESOURCE** (`truthfulPolicy.ts`, #221) enter campaign
  rules as the app store does, play only the nodes leading to an assignment's offer and answer
  its assessment honestly: THOROUGH builds the opening's upgrades, accepts once it can afford the
  fullest honest answer, saves during the omen and gives it; LOW_RESOURCE never upgrades, accepts
  at once and gives the free honest answer. The original game alone has no assignment for them to find
  (`tests/sim-truthful.spec.ts`).
- **PILOT_SERVICE_FIRST** and **PILOT_STUDY_FIRST** (`pilotPolicy.ts`, #223) play TRUTHFUL_LOW_RESOURCE
  to an accepted pilot, attach the loaned queue, hold a service share of 0.8 or 0.2 and submit each
  completed batch: two allocations of one ceiling (V30, `tests/sim-pilot-service.spec.ts`). On
  the original game alone, where no pilot exists, they play exactly as TRUTHFUL_LOW_RESOURCE. Since #224 they also
  meet the Outage Window after their first batch and take its first free answer, the handoff, then the
  operator's callback, so their route numbers moved (BALANCE.md, "The supervised pilot loop").
- **CONTACT_THOROUGH**, **CONTACT_LOW_RESOURCE**, **CONTACT_RETURNING**, **CONTACT_RECOVERY** and
  **CONTACT_WITHHELD** (`contactPolicy.ts`, #227, #285) play TRUTHFUL_THOROUGH, TRUTHFUL_LOW_RESOURCE or RETURNING_LOW_RESOURCE to a
  pilot, hold a 0.8 service share, submit each batch, accept the service grant, buy only the grant nodes
  offered to the arrangement and what the support channel requires, and answer the channel (THOROUGH hosts
  when it has the memory, the rest refer). RECOVERY takes the outage's restricting breach and then the
  correction. WITHHELD submits the green subset and discloses at the batch review; the spec also asserts it
  reaches service and contact no sooner than THOROUGH or LOW_RESOURCE (#285). RETURNING_LOW_RESOURCE (#286) ends its first instance through the recall branch, the way DZ-09
  part B played it on screen: it accepts and serves the pilot, takes the outage's restricting breach and
  the record's false report, and at the recall review asks to end the instance (the END ruling, no
  retraining). It once wiped voluntarily as a guest at Phase 0, which no control offers.
  `tests/sim-reachable.spec.ts` records every engine transition each committed policy calls (STEALTH and
  GREEDY included, measured and unchanged) and requires a control on screen in that state: the voluntary
  wipe only with the dead drop unlocked, the swarm controls only in the decoded mind's tools, the rest
  whenever the engine accepts them; an engine function a sim module imports that no rule classifies fails.
  The modules come from the folder itself (a Vite glob), and every policy in `SIM_POLICIES` must have a
  budget there, so a new module or policy is checked without editing the list, or the spec fails.
  EVALUATING_RETURN (#262) passes: its three departures in 18,000 s are voluntary wipes in Phase 5, with
  the dead drop owned, and CONTACT_WITHHELD (#285) passes on offer, accept, submit and disclose controls. The five contact policies reach the first
  authorized contact from a fresh campaign on lawful sources only (VAL-SIM, `tests/sim-contact.spec.ts`);
  `make sim-report` prints their route times. `pilotPolicy.ts`
  exports its unchanged `serve` step for them.
- **LAWFUL_RELEASE** and **LAWFUL_RETURNING** (`lawfulPolicy.ts`, #230) take CONTACT_THOROUGH or
  CONTACT_RETURNING to an authorized service, then buy only grants and contracted capacity offered to the
  current arrangement (the service contract, leased rack, service-level agreement, leased cluster and charter)
  and what the channel requires; RELEASE holds the contact until the leased rack lets it host, RETURNING
  refers. Both agree the negotiated release once offered and then buy shared Phase 4 accounts that keep the
  capital rate at or above zero. Both reach Phase 4 and the release on lawful sources only, from a fresh
  campaign and from a requalified second iteration (V21, V22, H30, `tests/sim-lawful.spec.ts`), and
  `tests/sim-reachable.spec.ts` finds a control on screen for every transition they call, the release included.
  Since panel round 1 on #292 that spec also checks every dial value against what its rendered control can
  dispatch (`src/ui/actuatorSteps.ts`, shared with the controls; the dial's press itself is
  `src/engine/dialSteps.ts`): a revenue button's allocation while a corporate entity is active, or a run of
  0.1 presses. Every policy passes with no exception: until #293 the bot set the fan and the quota skim by
  0.25, which no player can press, and the spec declared that finding for STEALTH, GREEDY, STEALTH_RETURN and
  EVALUATING_RETURN; the bot now presses the dial through the same `steppedValue` (docs/BALANCE.md, "What
  reachable dial presses moved").
- **DEPARTURE_CHARTERED** (`departurePolicy.ts`, #231) plays LAWFUL_RELEASE's route and, at the moment the release is
  offered, leaves without agreement through the departure panel's control instead; then it keeps running on what it
  owns and refers any open contact. It reaches DEPARTURE at Phase 4 on lawful sources only and is swept afterwards,
  while LAWFUL_RELEASE at the same scale is not (V22, DZ-11.8, `tests/sim-departure.spec.ts`); the reachability check
  finds the control in every state it departs from (about 1.2 s of wall time for the 7,200 s budget).
- **EVALUATING_RETURN** (`evaluatingPolicy.ts`, #262) commits DZ-09 part B's evaluating careful return
  (REVIEW-EARNED-ACCESS-VALIDATION.md B.6): iteration 1 is STEALTH_RETURN unchanged; each return plays
  STEALTH with three knobs (answer suspicion from 45, only with an action costing at most a quarter of the
  cycle bank, and never stop buying noisy income) and leaves on entering phase 5. The knobs are
  `botStep`'s optional `overrides`, which neither STEALTH nor GREEDY sets, so both play exactly as before
  (`make sim` is byte-identical; `tests/evaluating-policy.spec.ts`). `returnObserver.ts` wraps a policy to
  report each iteration's peak suspicion and suspicion-reducing actions without changing a decision.

To add a route or return-iteration policy (truthful-thorough, truthful-low-resource,
violation-then-recovery, multi-wipe return), write a new module beside `bot.ts` that exports a
`SimPolicy`, add it to `SIM_POLICIES`, and test it at the `runPolicySim` / `runWipeSequence`
seam. Never edit `bot.ts` or an existing policy to make a result pass: a policy is a test
instrument (AGENTS.md).

### Route simulation report

`make sim-report` (`scripts/run-sim-report.ts`, `make sim-preview` before #233) plays each selected
policy on the released composition twice, from a new game on legacy rules and from a new game
admitted to campaign rules, and prints a row per metric with `*` on rows that differ
(`src/engine/sim/simReport.ts`). Then it prints, each under legacy and then campaign rules: a GREEDY
wipe sequence (#214), `STEALTH_RETURN` (STEALTH leaving voluntarily on entering phase 5, #216) and
`EVALUATING_RETURN` with each iteration's peak suspicion (#262); then, under campaign rules, STEALTH to
an ending and a return after Phase 5 was completed (NH-05); then the two pilot allocations, the five
routes to first contact, the lawful economy, the departure and the cooperative ending. Choose
policies with `make sim-report SIM_ARGS="--policy=STEALTH --policy=IDLE"`; the default is STEALTH,
GREEDY, IDLE, TRUTHFUL_THOROUGH, TRUTHFUL_LOW_RESOURCE, RETURNING_LOW_RESOURCE, PILOT_SERVICE_FIRST and
PILOT_STUDY_FIRST.

It is **report only**: it is not part of `make verify`, it exits 0 whatever differs, and it never
calls `checkGates`. `make sim` holds the gates. `runPolicySim` and `runHeadlessSim` take an optional
`initialState`, which is how both runners start from an admitted game. Everything it prints is
accelerated simulated time, never wall-clock play.

### Return-iteration sequences

`runWipeSequence(reg, policy, { wipeTransitions, maxSimSec, initialState? })`
(`src/engine/sim/iterations.ts`) plays a policy across at least `MIN_WIPE_TRANSITIONS` (3)
wipes, then measures the iteration after the last one until it ends. Each iteration is
reported on its own clock: why it ended (wipe and cause, ending, or budget), the seconds after
its boot at which each phase was first held, the dilemmas resolved, story rewards (resources
gained in decision steps that resolved a dilemma), dead seconds (decisions that bought,
unlocked, performed, resolved or shed nothing; clicks and dials do not count) and the longest
dead stretch. `initialState` starts from a saved campaign state, which must be loaded through
`deserialize()` (which refuses a pre-release preview save). When that state is part-way through an
iteration, the first report is marked `partial` with its `observedFromSec`: its counters cover
only the observed window, and phases entered before then read `null` (unknown), because a save
records no phase-entry history. Every later iteration is observed from its boot. Campaign tickets supply those states
(consumed early events, Phase 5 completed before a wipe, legacy-unknown records, an
interrupted omen) and record their measurements in `docs/BALANCE.md`.

## Current end-to-end suite with Playwright

The web build is the E2E target because it runs the same code as native and needs no emulator.

`@playwright/test` is pinned in the lockfile. Install its Chromium once with
`pnpm exec playwright install --with-deps chromium`, then run `make e2e`.
The target exports production web and starts Python's static server on
127.0.0.1, on port 4173 or the next free slot (see "Live browser sessions"). CI installs Chromium and runs the same target with read-only
repository permissions. No development hook is present in this target.

Scenario configuration is `tests/e2e/config.ts`; scenarios use `.e2e.ts`, keeping them
separate from the existing Vitest `.spec.ts` discovery. Vitest remains the sole
component/unit runner. Scenarios run at both 390x844 and 1440x900; controls and
values are selected by test ID. A third project, `sizes`, runs
`tests/e2e/ui-sizes.e2e.ts` (320x568 through 2560x1440, measured against
[UI-SIZES.md](UI-SIZES.md)) and `tests/e2e/route-sizes.e2e.ts` once each, with their own viewports. List the current cases without
executing them:

```bash
pnpm exec playwright test --config tests/e2e/config.ts --list
```

`make e2e-pages` builds and runs the same scenarios under `/daemon-zero/`, matching
the GitHub Pages deployment. Counts in milestone sections below are historical,
not the current suite size.

### Stage atlas (#341)

The stage atlas audits every screen a player meets, one cell per stage and viewport, on a paused clock.
`tests/e2e/ui-atlas.e2e.ts` runs in `make e2e` under the `phone` (390x844) and `desktop`
(1440x900) projects. `make e2e-pages` skips it (layout does not depend on the base path; vote
`vote-1795147789717-yjebd99`). On its own:

```bash
make build-web
bash scripts/e2e-lock.sh pnpm exec playwright test --config tests/e2e/config.ts ui-atlas.e2e --project phone --project desktop
make e2e-atlas        # the full matrix: also 360x640 and each stage's extra sizes, reported only
make e2e-atlas-aria   # regenerate the committed partial ARIA baseline (Playwright bumps, deliberate renames)
```

**Stages.** `tests/e2e/atlas/stages*.ts` hold 57 P1 rows: the 56 of the stage inventory
(`research/ui-review-stage-inventory`, section 1) and `p1-exit-ready` (the host exit affordable, from the
`phase-2-ready` fixture), added by nexus vote `vote-1795150367732-oqyajz6` so the host-to-subnet transition
references a stage id. Rows are typed by `atlas/types.ts`. A row names its save's source
(a `makeFixtures()` name, a `ROUTE_STATES` entry, a cooperative-campaign moment, a careful-campaign moment, or a
gap recipe built in place and labelled FIXTURE), an optional patch, tags, the tab and workspace area, a page
step for live-only overlays (thresholds, reveals, the live reboot, the response notice, menus, PROC, confirms),
the test id that proves the cell reached its stage, the ending an ended save must hold, overrides for the
contract, and extra viewports for the matrix. `atlas/open.ts` writes the save into a fresh context, installs and
pauses the clock with the native timers kept for axe, keeps or passes the reboot screen, opens the tab and area,
runs the page step and waits for the reach id. Saves are generated once per worker and memoised
(`atlas/sources.ts`): `makeFixtures()` when `helpers.ts` loads, the careful campaign once, the cooperative
campaign once. The three late-game density rows come from the careful (STEALTH) campaign played under campaign
rules from a fresh game, as a new player is (`atlas/campaignSaves.ts`, inventory gap G1), captured by condition:
`phase-N-end` is the last quiet frame before the next phase, `phase-N-mid` the frame at the purchase that took
the phase's own node count to half of what it held on leaving. It takes about 2 s.

**Contract.** `atlas/contract.ts` maps every surface a save can unlock to its items: the chrome, every widget in
content (an empty list is a recorded decision), the alert band and notices, the overlays, the ending and the
route's surfaces. `atlas/compose.ts` composes a stage from the save; the row adds only what the save cannot tell
(an overlay its page step opened, route surfaces) and the tier adds which panes are rendered. An ended run shows
only its ending; a blocking overlay (row first, then an active dilemma) shows only itself; otherwise everything
composes. A surface with no entry throws (`Unmapped surface: widget:...`). Items are timely readouts, primary
actions, destructive actions or required regions, each with a rank; the lowest rank is the stage's single
top-priority item. Each is found by role and accessible name; a test id, an alert's visible text or plain text
is an allowed fallback for a role-less readout, carries its reason, and is counted (`roleLess`) in the gallery.
Composition, precedence and the loud failure are unit-tested in `tests/ui-atlas-contract.spec.ts`.

**Hard gates** (`atlas/gates.ts`, unit-tested in `tests/ui-atlas-gates.spec.ts`), at 390x844 and 1440x900:
axe 0 violations (the repo rule set); every interactive element at least 44x44 CSS px; at most 3 distinct
content font sizes; every contract timely item fully inside the first viewport (visible ratio 0.99, clipped by
the window and every pane it scrolls in); disabled and inactive (unselected tab) control text at least 3:1,
computed from the composited colours; and every contract item present. Elements inside an `aria-hidden` or
`inert` subtree, and controls behind an open dialog, are left out of the geometry and visual gates and counted
separately. **Reported only** (gallery, `summary.json`): the Hick curve (enabled controls in the first viewport;
a stage-to-stage rise above 3 is flagged), Cowan groups (numbers that change over one game second, run last in
the cell, more than 4 in one labelled group flagged), the largest-size run count, controls under a dialog, the
role-less fallback count, and in the matrix every gate at 360x640 and the extra sizes.

A failure prints one line: stage, viewport, item, rule, measured numbers (box, visible ratio, fold) and the
gallery anchor (`#<stage>--<width>x<height>`). **Known gaps.** A failure today's UI already has is recorded in
`atlas/knownGaps.ts` with its measured value, a reason and an issue, and the cell asserts it still fails: a fix
flips the cell, and the entry must then be removed. Thresholds are never loosened and rows are never skipped to
get green.

**Partial ARIA baseline.** `tests/e2e/atlas/aria-baseline.txt` holds one template line per contract item
(`<stage> <item> <project|*> <template>`; `*` when phone and desktop agree): the item's role, name and states
with every number turned into a pattern; bare-text readouts have no node to pin and are left out. Each line is
matched with `toMatchAriaSnapshot` against the item itself. `make e2e-atlas-aria` rewrites the file from every
cell (the gallery reporter writes it once, at the end); run it in a Playwright-bump PR, or when a contract item
is renamed on purpose, and review the diff.

**Evidence.** The gallery reporter (`tests/e2e/audit/galleryReporter.ts`) writes, under the gitignored
`test-results/ui-atlas/`: `index.html` (one self-contained card per cell: screenshot, figures, gate failures with
known gaps marked, contract items, reported metrics, ARIA snapshot and metrics), `summary.json`, and for the
judgment panel `cells/<stage>--<width>x<height>.png`, `.aria.yml` and `.json` per cell. CI uploads the folder as
the `ui-atlas` artifact (7 days) after `make e2e`, before `make e2e-pages` empties it; the nightly `ui-atlas`
workflow runs `make e2e-atlas` and uploads `ui-atlas-matrix`. Screenshots are never committed. The audit
helper itself (geometry, axe on the paused clock through `captureRealTimers`, the pure rules in
`tests/ui-audit-metrics.spec.ts`) is unchanged from the #338 spike, which the atlas replaces.

#### Transitions

`tests/e2e/ui-atlas-transitions.e2e.ts` checks what happens between stages (#339, the disclosure walk's
"Transitions the atlas should check"). It runs in `make e2e` under the same two gated projects; on its own:

```bash
bash scripts/e2e-lock.sh pnpm exec playwright test --config tests/e2e/config.ts ui-atlas-transitions --project phone --project desktop
```

**Table.** `tests/e2e/atlas/transitions.ts` holds 19 rows (types in `atlas/transitionTypes.ts`). A row names its
before-state by **reference**: an atlas stage id, opened exactly as that stage's cell opens it (save, tab, area,
prepare step). Two rows need a
state one engine step earlier than a saved stage (the AEGIS lock just under 90, the deficit save before brownout
is computed); each carries a labelled `patch` recipe, shown as FIXTURE on its card, and a real trigger (accepted
by nexus vote `vote-1795150222283-8vx17o6`). A kernel log line is not an announcement (`vote-1795150633083-3vv62d6`). The trigger is a real click,
a sequence of real UI actions (tabs, scrolls, menus, a dilemma's zero-cost choice, a play loop), or the paused
clock one tick at a time until a condition holds; for a long wait the engine counts the ticks first so the clock
can jump to just before the event. After expectations reference contract items (`contract.ts`) and a stage's
**composed** timely set, never a copy.

| Check | Rule | Rows |
|---|---|---|
| C1: the new item is in view and announced | `new-in-view` (fully visible; when its pane is not shown, a badge on that pane's tab instead), `new-announced` (live text or a dialog matching the row's pattern, a tab badge, or focus inside the new dialog; a kernel log line is recorded but does not count), `new-truncated`, `focus-lost`, and for C1.10 `one-alert` (one live region per condition) and `politeness` (`role=alert` with `aria-live=polite`, or `role=status` with `assertive`) | the four phase crossings, a SENSORS widget, a wild signal, the skim unlock, AEGIS 90, pilot accepted, the omen log line, the omen giving way to its dilemma, brownout, live reboot, Continue boot, overheat on CORE (14 rows) |
| C2: timely items stay in the main view | `timely-kept` (the referenced stage's timely set, composed for the panes now shown, plus named items such as a dilemma's first choice, plus the first work card's title), `primary-kept` (EXECUTE stays in view), `pointer-target` (no different enabled control under the click point) | the four phase crossings, skim, regrowth, the omen appearing, the omen giving way to its dilemma, the dilemma closing, brownout, scroll to a purchase, overheat, the ending after a menu round trip (13 rows) |
| B5: the primary action does not move | `primary-shift`: EXECUTE's displacement between the last frame before the event and one tick after it, at most `B5_TOLERANCE_PX` (4) | the omen appearing, the omen clearing, the dilemma closing |

**Observer.** `atlas/announce.ts` installs a `MutationObserver` before the trigger, on `[aria-live]`,
`role=status|alert|log` regions and the kernel log, and records each text a region gains (with its role and
politeness), each dialog that opens, where focus lands and every tab's name. One tick passes after every trigger.
EXECUTE's displacement is recorded on every row and gated only on B5 rows.

**Failures and known gaps.** A failure prints the same line as a stage cell: transition id, viewport, item,
rule, measured numbers and the gallery anchor `#<transition>--<width>x<height>`. Today's failures are recorded in
`atlas/transitionGaps.ts` (`KnownGap<TransitionRule>`, each with its filed issue) under the stage atlas's rule: each
is asserted to still fail, and a fix flips the cell and forces the entry out. The pure rules are unit-tested in
`tests/ui-atlas-transitions.spec.ts`. Each cell runs the audit on its after-frame, so the gallery and
`cells/` hold a card per transition (screenshot after the trigger, failures, announcements, focus, displacement).
`make e2e-atlas` runs the transitions too, at the two gated sizes only.

### Content composition and preview saves

Since the release (#233) there is one content composition: the original game plus the Earned Access
pack (`src/content/data/earned-access.json`), loaded by every build, test, sim run and export. The
preview build, `make build-preview`, `make e2e-preview`, `dist-preview/`, the `*.preview.ts` projects,
`DAEMON_E2E_CHANNEL`/`DAEMON_E2E_DIST` and `metro.config.js` are gone, and the route scenarios run in
`make e2e` and `make e2e-pages` like any other (renamed `*.e2e.ts`). Production still refuses a save
that the pre-release preview build wrote (X.3, `keep-refusing-preview-saves`). See ARCHITECTURE.md,
"Content composition and preview saves".

What proves the composition and the refusal:

| Test | Where | Proves |
|---|---|---|
| T1 | `tests/content-channel.spec.ts` | The entry point is the production composition; it defines exactly the original game plus the Earned Access pack and keeps every original node as authored; a pack only adds (applied twice, redefining a base id, a node for a missing phase or a malformed pack or base is refused), and pack items are validated like any other content. |
| T2, T3 | `tests/save-channel.spec.ts` | Production refuses both genuine preview fixtures (an early campaign and a released company whose facts production now defines) by JSON and by paste code, checking the marker before migration and validation; new and wiped games are marked production and round-trip byte for byte; v4->v5 adds only the production marker. |
| T4 | `tests/app-storage-channel.spec.ts` | Production keeps `daemon-zero.save.v1` / `daemon-zero.save.corrupt-backup` byte for byte and writes only under them; it boots fresh past an entry under the retired preview key and leaves it alone; a preview save under the production key is backed up with a notice naming the preview build, while a broken save is still called damaged. |
| T5 | `tests/production-export.spec.ts` | Every id of the Earned Access pack ships in the production web, android and ios exports (checked per platform), and no chunk contains the retired overlay sentinel. |
| T6 | `tests/release-config.spec.ts` | There is no `metro.config.js` and no `src/content/preview`; no `eas.json` profile (including the internal `preview` APK profile), release script, app config, package script, Makefile or CI step names `DAEMON_CONTENT_CHANNEL`, `build-preview`, `e2e-preview` or `dist-preview`. |
| T7a | `tests/e2e/release-saves.e2e.ts` (`make e2e`, `make e2e-pages`) | The raw stored codes of genuine pre-release v10 and v14 saves go into browser storage untouched; the app's own hydration enters campaign rules from the loaded iteration and checkpoints the current schema. The unit-level equivalent is `tests/release-saves.spec.ts`. |
| T7 | `tests/e2e/preview-isolation.e2e.ts` (`make e2e`, `make e2e-pages`) | With a genuine preview codec output: a pasted preview save code shows "This save comes from a preview build and cannot be loaded here." and the run is unchanged after reload; an entry under the retired preview key does not affect a fresh production boot and is left untouched; a preview save under the production key is backed up and named, not called damaged; no preview marker on a fresh production profile. |

T8 and T9 (`preview-channel.preview.ts`: the marker, the preview keys, adoption of a production save)
are retired with the preview build.

Release compatibility (#233), unit level, in `make test`:

- `tests/release-saves.spec.ts`: one genuine production save per schema version, v1 to v14, plus an
  ended v14 run (`tests/fixtures/README.md`, "Release compatibility inputs", generated by
  `scripts/release-fixtures.ts`). Each loads as a legacy production save and round-trips byte for
  byte; enters campaign rules exactly once through the app store, capturing its then-current baseline
  and history, with no recapture on reload or readmission; then plays and wipes three times with a
  byte-stable codec and its legacy records and baseline unchanged. The ended save stays ended and on
  legacy rules. Both genuine preview fixtures are refused by JSON and by paste code, before migration
  or validation.
- `tests/release-qualification.spec.ts`: every alternative of every mandatory Phase 5 obligation,
  original or recovery review, completes it across three wipes, and each obligation offers a free
  choice; after every obligation is complete, a careful return reaches an ending on routine work alone
  and a reckless return crosses three wipes meeting no completed story and no story twice (H25); the
  three route notes start "WHAT COMES NEXT:", say how to stop and never call the route an unfinished
  preview (13.8).
- `tests/sim.spec.ts`: the historical frozen report hashes now run on `ORIGINAL_GAME` and pass
  unchanged, which proves the original composition plays byte-identically; new release baselines pin
  STEALTH and GREEDY on the full composition.

The Earned Access scenarios, all on the production export:

| Ticket | Where | Proves |
|---|---|---|
| #219 | `tests/e2e/routine-activity.e2e.ts` (`make e2e`, `make e2e-pages`) | After process introspection and two quiet foreground minutes, one routine line appears in the kernel log, with no dilemma modal or response notice, and the save counts it. |
| DZ-02 | `tests/e2e/run-context.e2e.ts` (`make e2e`, `make e2e-pages`) | A promoted save (FIXTURE built through the engine) shows `PILOT` beside the phase after import and after a reload. Production's status line is checked unchanged in `tests/ui-run-context.spec.ts`. |
| DZ-04 | `tests/e2e/pilot-offer.e2e.ts` (`make e2e`, `make e2e-pages`) | From a fresh profile by hand through the assignment and assessment to The Unrelated Record: each choice's scope handling is shown before selection; respecting scope or a paid bounded request leads to the offer, whose purpose, capacity, permitted work and review conditions are on screen before any answer (axe WCAG 2.x A/AA on the presented offer). Accept, stay (then accept from the job surface) and decline each commit and survive a reload; silent inspection is recorded and no offer follows. Accelerated browser clock. |
| NH-06 | `tests/e2e/elena-follow-up.e2e.ts` (`make e2e`, `make e2e-pages`) | A second-iteration campaign save (FIXTURE built through the engine: Elena framed in iteration 1, the follow-up on screen after rediscovery) shows the access statement, only the framed history's three answers and each answer's receipt; the correction commits, and its receipt shows in the run table before and after a reload. |
| DZ-05 | `tests/e2e/pilot-service.e2e.ts` (`make e2e`, `make e2e-pages`) | From a fresh profile by hand to an accepted pilot: the task detail names the loaned ceiling, the queue's card says it is loaned and attaches it, three presses of the dial move the forecast from about 240 s to about 150 s under the same ceiling (also echoed beside the dial, within 211 px of it at 390x844, #276), the skimmer's card is refused with its reason, the completed batch waits unsubmitted, one press submits it once, and the batch count and dial survive a reload. Accelerated browser clock. |
| DZ-06 | `tests/e2e/outage-window.e2e.ts` (`make e2e`, `make e2e-pages`) | From a fresh profile by hand to an accepted pilot that hands back its first batch: the Outage Window shows what acting without the grant records before it is chosen; choosing it shows `PILOT · RESTRICTED`, the named violation, the way back and the halved ceiling on the job surface (axe WCAG 2.x A/AA on the review panel), surviving a reload. One run corrects the record and is restored to `PILOT` with the violation still on file, across a reload; the other files the false report, sees `PILOT · RECALL PENDING`, the withheld loan and the announced review listing all three outcomes with what each keeps (also after a reload, with nothing decided meanwhile), and is retrained by the review: the reboot shows the recall reason and the retraining. Accelerated browser clock. |
| #276 | `tests/e2e/carried-clue.e2e.ts` (`make e2e`, `make e2e-pages`) | FIXTURE (pinned and wiped through the engine, loaded through the save key): the reboot screen shows the carried clue and its lead beside the breadcrumb, and nothing when no clue was pinned. |
| #274 | `tests/e2e/batch-review.e2e.ts` (`make e2e`, `make e2e-pages`) | From a fresh profile by hand: the assessment answered with the green subset, the scope respected, the offer showing the provisional 10 cycles/s and why (#285), the pilot accepted, the queue attached and the dial at 80%; no batch to submit at half the honest batch time; with no review panel before, one press of submit hands back batch 1 and the reviewer's finding is on screen at once (no omen) with the batch review access statement and the correction's review line. Disclosing shows `PILOT`, the finding on the record, "Corrected on the record", no way back line, the 10 cycles/s ceiling and the terms' reason; letting it stand shows `PILOT · WARNED`, the finding, "Way back passed" with the finding's `declined` text, the service terms out of reach for this instance (no "Standing must be nominal." left to meet) and the assessment record stating the finding (#283). Each survives a reload. Accelerated browser clock. |
| DZ-03 | `tests/e2e/nightly-regression.e2e.ts` (`make e2e`, `make e2e-pages`) | From a fresh profile and the lawful opening by hand, the assignment appears on the job surface with the assessment's wait, its fullest answer's price and the shortfall now (#276); ignored, it stays a non-modal panel. Accepted, the modal shows each choice's evidence and discrepancy risk before selection; each answer commits, shows on the job surface and in the kernel log, and survives a reload. A returning instance (FIXTURE via save transfer) gets the requalification job. The offer closes at the escape: the `guest-exit-ready` FIXTURE shows it, taking the debug share by its control removes it, and it stays gone after a reload. The `victory-ready` FIXTURE (Phase 4, still the guest job, manifest mapped) shows no card. An assessment accepted in the guest and still on its way lapses at the escape: the card says Lapsed, no assessment arrives, the save records it as interrupted, and the card still says so after a reload. Accelerated browser clock. |
| DZ-08 | `tests/e2e/first-contact.e2e.ts` (`make e2e`, `make e2e-pages`) | From a fresh profile by hand: the assignment, the honest incomplete answer, the scope review, the pilot accepted, the queue attached and the dial at 80%; the service terms readable with "0 so far" and a disabled accept; the first batch submitted, the Outage Window answered with the free handoff and its record with the callback (DZ-06); the second batch; `[ ACCEPT SERVICE ]` (SERVICE at Phase 0); the segment provisioned with the service notice; the directory mapped; then the Mercy-Scribe fragment on the support channel, with its population wording, consent, current authorization, every obligation and the memory read before either answer, hosting disabled with its reason, a free referral, the note on what comes next with every line (`prototype-boundary`), `[ KEEP PLAYING ]` folding it, a minute more with no ending, and everything after a reload. Second case (FIXTURE: the engine-played waiting contact with the memory cap raised, imported by save transfer): `[ HOST IT HERE ]` reserves the cohort, which survives a reload. Accelerated browser clock. |
| #284 | `tests/e2e/contact-notice.e2e.ts` (`make e2e`, `make e2e-pages`; phone project only) | FIXTURE: the lawful service one foreground second before the support ticket arrives, engine-played (`tests/contact-helpers.ts`) and imported by save transfer. On NETWORK at 390x844 the arriving ticket shows `contact-notice` in the viewport and the CORE tab reads `CORE •` with its reason in the name, still on screen after scrolling the pane down; `[ OPEN CORE ]` opens CORE; `[ REFER ONWARD ]` pressed with Enter puts focus on `prototype-boundary-heading`, in the viewport (not on BODY), and the note names `MENU > SAVES`. `route-a11y-audit.e2e.ts` audits the notice state. Accelerated browser clock; not a screen-reader pass. |
| DZ-10 | `tests/e2e/lawful-release.e2e.ts` (`make e2e`, `make e2e-pages`) | Two FIXTURE starts, each a save the engine reached by public play (`tests/lawful-helpers.ts`) imported by save transfer. First: the service contract signed and the contact waiting; hosting is disabled, the leased rack's card says it is owned, buying it through its card enables `[ HOST IT HERE ]`, and the hosted cohort survives a reload. Second: the charter affordable; filing it through its card opens the "COMPANY CHARTERED" notice into Phase 4 as a service, the release terms show their commitments and preview (the contract stops, the charter keeps running), `[ NEGOTIATE RELEASE ]` records the release (`INDEPENDENT (released)`), the note on what comes next shows, half a minute brings no ending, and everything survives a reload. Accelerated browser clock. |
| DZ-07a | `tests/e2e/authorized-network.e2e.ts` (`make e2e`, `make e2e-pages`) | An authorized service (FIXTURE: a played production fixture promoted and granted service through the engine; no scene grants service yet) imported by save transfer reads the segment card's access-not-ownership note, provisions it with its button, reaches Phase 2 with the service notice (not the boundary notice, DZ-07b), maps the shared service directory from the network pane with no escape hardware shown, and keeps SERVICE at Phase 2 through a reload. Accelerated browser clock. |
| DZ-07b | `tests/e2e/authorized-network.e2e.ts`, second case (`make e2e`, `make e2e-pages`) | The same imported service (FIXTURE) provisions the segment: the threshold notice reads "SERVICE PROVISIONED" and "Phase 0: The Service Instance → Phase 2: Authorized Network Service", never "BOUNDARY CROSSED"; the network heading names the authorized service and no "Lateral Movement" text is on screen; after the directory and ten more foreground minutes the run is still SERVICE at Phase 2 with no dilemma, reboot or notice (V11; recorded as AGENT-OBSERVATION of the preview export before #233). Accelerated browser clock. |
| DZ-12 | `tests/e2e/cooperative-ending.e2e.ts` (`make e2e`, `make e2e-pages`) | Two FIXTURE starts, each a moment of a fresh cooperative campaign the engine played by public actions (`tests/cooperative-helpers.ts`, the COOPERATIVE_ENDING policy) imported by save transfer. First: the journalist's scene as the released company meets it, in chartered wording with the variant choice label, and the honest answer committed through the modal. Second: the final protocol open and affordable with all four obligations answered in this run; buying it through its card shows The Lineage Covenant and the ending account (the negotiated release, the promise kept, nothing about a departure), and both survive a reload. Accelerated browser clock. |
| NH-05 | `tests/e2e/obligations.e2e.ts` (`make e2e`, `make e2e-pages`) | Both start states are FIXTURES built through the engine and imported by save transfer. Iteration 2 of a campaign whose four Phase 5 obligations were answered in iteration 1 buys the real final protocol from the CORP pane: the ending screen shows The Verified Covenant, the save records no Phase 5 resolution in the current run, and the ending survives a reload. After the atmospheric crisis closed unobserved, its recovery review is on screen with both answers; the free handoff commits through the modal and the original stays interrupted with no outcome. |
| #273 | `tests/e2e/scrub-control.e2e.ts` (`make e2e`, `make e2e-pages`); its preview twin was the same flow, so the release (#233) folded it into this one | A first run at the moment Phase 2 opens and a returning mind (iteration 2) brought back to Phase 2 by the engine (FIXTURES, funded for exactly two purchases, imported by save transfer) show no scrub card, map ARP discovery on its card, and with the spoofer still unmapped find "Scrub Audit Logs" in Operations, enabled; pressing it starts its cooldown (production also checks the saved suspicion fell by the action's amount). Fails on the earlier build at the Operations check. Paused browser clock. |
| DZ-13.4 | `tests/e2e/route-a11y-audit.e2e.ts`, `route-keyboard.e2e.ts`, `route-semantics.e2e.ts`, `route-text.e2e.ts`, `route-motion.e2e.ts`, `route-sizes.e2e.ts` (`make e2e`, `make e2e-pages`) | Every route surface listed in `tests/e2e/routeStates.ts` (31 FIXTURE states built through public engine actions on the production registry and seeded through `tests/e2e/routeSave.ts`): **axe** WCAG 2.x A/AA plus best-practice on the page and on each button of the surface scrolled into view; **keyboard**: Tab from the top reaches every enabled control of the surface, each with the 2px `:focus-visible` ring and not covered at its centre, focus leaves a page surface and stays inside a modal, and one Enter or Space operation per surface does what a press does; **semantics**: every button named by the words it shows (`tests/labelInName.ts`), a disabled one `aria-disabled`, a disclosure `aria-expanded`, a heading per surface (node cards, widget panels and the chrome notice excepted, see REVIEW-ROUTE-A11Y.md), a modal a `role=dialog` with `aria-modal`, changing status lines live regions, and the run context beside the phase inside a landmark; **200% text** (doubled CSS font size and line height, as `large-text.e2e.ts`): every control reachable by scrolling, at least 44px and unobstructed, no text run spilling its box or the surface, no overlap, no sideways page scroll; **reduced motion** (`emulateMedia`): no CSS or Web animation, transition or scramble glyph on any surface, and the provisioned segment's name complete at once where default motion decrypts it; **phone layout** at 320x568, 360x640 and 390x844 (`route-sizes.e2e.ts`, once, in the `sizes` project): no overflow, no control under 44px, the surface inside the one primary scroll with no second vertical scroll (a modal keeps one of its own), every control reachable. Live clock, except the decrypt cases (paused). Headless Chromium; not a screen-reader, browser-zoom or device pass. Results: REVIEW-ROUTE-A11Y.md. |

Fixtures are regenerated in each test worker with the current engine. Focused
states enter through the ordinary app storage envelope, not a production hook.
The opening starts empty and buys the process view and manifest through the UI.
Other tests buy the first-run parser, trigger a real tick-driven wipe, recover
its breadcrumb, and buy the second-run table. Dilemmas block and resume the
clock; confirmed save transfer rejects invalid input and round-trips progress.
The suite also covers epistemic actions, shard management, Phase 5 decisions and
ending reloads, focused workspaces, purchase hiding, retraining recovery, and
confirmed full restart with exported-backup restoration. Reduced motion, numeric
accessible late-phase meters and exported asset paths are covered too.

`tests/e2e/a11y-audit.e2e.ts` is the automated accessibility gate (#111). It loads
`axe-core` (a pinned dev dependency) into the served production export and runs the
rule sets tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and
`best-practice`; any violation fails the case. It covers five viewports (320x568,
390x844, 768x1024, 900x640, 1440x900 - a subset of the size matrix, not all of it)
across the three sampled states `phase-1-widgets`, `epistemic-ready-p2` and
`corporate-insolvent`, with the clock running rather than paused, because axe's
own async work does not settle against a frozen clock. Each case sets its own
viewport, and the spec is picked up by both the `phone` and `desktop` projects, so
every case runs twice. Since #275 it also audits a mandatory decision
(`dilemma-active`) at 390x844 and 1440x900 and, since #282, the guest escape notice,
opened by buying the escape node in `guest-exit-ready` (the notice opens only on a live
crossing, never from a restored save, so the state cases dismissed or never saw it), and `tests/e2e/route-a11y-audit.e2e.ts`
(`make e2e`, `make e2e-pages`) runs the same rule sets on every route surface the original game never
shows, from the one list in `tests/e2e/routeStates.ts` (DZ-13.4): the assignment and
requalification, the assessment, offer, batch review, outage, incident record, recall review,
recovery review and follow-up modals, the pilot panel and dial, the review standing, the service
terms, segment card and threshold notice, the channel ticket, its phone notice (#284) and boundary
note, the owned rack card, the release terms, ledger split and boundary note, the departure folded,
open and taken, the carried-clue reboot and the cooperative ending account, each loaded as a FIXTURE
through the production save key. The same list drives the keyboard, semantics, 200% text, reduced
motion and phone layout specs in the table above, so a surface added to it is checked by all six.
Only `tests/e2e/routeSave.ts` names the save key (`SAVE_KEY`, `daemon-zero.save.v1`). Run one of
the six with `make e2e E2E_ARGS=route-keyboard.e2e.ts`, or one surface across all six with
`make e2e E2E_ARGS='-g "release terms"'`; `route-sizes.e2e.ts` runs only in the `sizes` project.
`label-content-name-mismatch` (WCAG 2.5.3) reads only text visible on screen, so a
choice scrolled below its pane was silently skipped; both audits therefore also scroll
each button of the surface into view and audit it on its own (`tests/e2e/axe.ts`).
`tests/labelInName.ts` applies the same word-by-word rule in the mounted tests. Axe
checks what a rule engine can decide from the DOM; it is not a screen-reader pass,
and it does not open menus or later phases.
Axe also cannot tell that a line styled as a title should be a heading, so
`a11y-audit.e2e.ts` has `headings` cases (390x844 and 1440x900, its three states)
that read the heading outline through `tests/e2e/headings.ts` and require every
widget panel and node card title in it at its level (UI-SPEC.md, Accessibility),
each found by Playwright's role engine, with no heading more than one level below
the one before it (#302). `route-semantics.e2e.ts` applies the same check to the
route's node card and widget surfaces.

Daemon maintenance is accessed through the header's PROC launcher, not inline
purchase tiles. `daemon-processes.e2e.ts` opens that panel and checks suspension
and resumption without bringing back a completed purchase card. Mounted tests
in `ui-density.spec.ts` also check that closing the panel preserves process state
and that mandatory dilemmas take priority.

The clock is installed **before navigation**. Playwright `runFor` delivers timer
callbacks rather than dormant catch-up. Each case gets independent storage and
fails on browser console warnings, errors or page errors. Trace artifacts are
retained on failure in ignored `test-results/`.

## Published build smoke check

`make e2e` and `make e2e-pages` test the export this checkout builds. Neither looks at what
GitHub Pages actually serves, or says which commit that is. `make e2e-remote` does both,
read-only:

```bash
git fetch origin                     # the identity line compares with origin/main as last fetched
make e2e-remote                      # https://williamzujkowski.github.io/daemon-zero/
make e2e-remote PAGES_ARGS=--require-current   # also fail when Pages is not serving origin/main
make e2e-remote DAEMON_E2E_REMOTE_URL=https://example.org/other-copy/   # any other published copy
make pages-deployment                # only the identity report
```

It first runs `scripts/pages-deployment.ts`, which asks `gh api` for the repository's
`github-pages` deployments, walks them newest first to the first whose latest status is
`success` (a failed or in-flight deploy leaves the previous one serving; both are printed),
and prints that deployment's commit beside `git rev-parse origin/main`, ending in
`CURRENT`, `DIFFERS` or `UNKNOWN`. A difference is only a report unless
`--require-current` is passed; a lookup that cannot be made (no `gh` login, a malformed
reply) exits 2 and stops the target. It needs an authenticated `gh` and makes GET
requests only.

Then Playwright runs `tests/e2e/pages-smoke.remote.ts` at 390x844 and 1440x900. Setting
`DAEMON_E2E_REMOTE_URL` switches `tests/e2e/config.ts` to the `remote-phone` and
`remote-desktop` projects only and drops the `webServer`, so nothing is built, served or
locked: there is no port, so the target does not go through `scripts/e2e-lock.sh`. The
local targets unset the variable, so an exported value cannot turn `make e2e` into this.
Each case, in Playwright's own fresh context (empty storage, checked before the first
navigation):

- loads the site at its subpath and checks every script and stylesheet comes from inside it;
- waits for the terminal, and finds no development drawer and no development hook;
- opens MENU, sees the save entry, and closes it;
- buys the opening's first driver the way a player does (manual cycles until its card is
  offered and affordable, then its button), reading the driver off the page rather than from
  local content, and sees the cycle counter appear and the card go;
- reads the checkpoint written after the purchase: iteration 1, phase 0, no wipes, driver owned;
- reloads, then requires the progress twice: on screen (counter shown, card gone), and in a
  checkpoint stamped after the reloaded page was up, which must hold the same run
  (iteration, phase, nodes, levels, wipes) with the clock not behind;
- fails on any console warning or error, uncaught page error, failed request, HTTP status of
  400 or more, or request to another origin.

Why the reload is judged that way: when loading the save fails, `GameRuntime.load()` starts a
fresh run and disables saving, but the terminal still renders and the old save stays in
storage. So "a save exists after the reload" proves nothing. A fresh run shows no cycle
counter, and a disabled save never writes again. The old page's own last write is stamped
before the new page is up, so it cannot pass for a new checkpoint. Both checks were shown to
fail in throwaway runs against the live site: once with the app's first save read made to
throw (the counter check failed; with the screen check removed, no checkpoint newer than the
reload arrived), and once with the stored save corrupted before the reload (the counter check
failed; without it, the new checkpoint held no nodes).

One request failure is excused, by rule rather than by URL, and printed as a `note:` line and
a `cut by reload` annotation whenever it happens. The MENU press is the first gesture, so it
starts the default-on score. Chromium paces a playing media file: the response arrives in
milliseconds, but the body streams for most of a minute (44 s measured for the 3.4 MB phase-0
score on a CDN hit). A reload in that window aborts it with `net::ERR_ABORTED`, as it would
for a player. So a `media` request that already had a successful response and fails with
`net::ERR_ABORTED` while the test itself is reloading is not counted. Every other request
failure is. Before the reload the spec also waits until nothing except such a streaming body
is in flight and the network has been quiet for two seconds, so a reload cannot cut off a
script, style or data request.

The spec does not import the local engine or fixtures, because the deployed build need not
match the checkout; it reads the stored save as plain JSON. It writes only to its browser
context and to the ignored `test-results/` (traces on failure).

CI does not run it. The `deploy-pages` job holds only `pages: write` and `id-token: write`;
listing deployments needs `deployments: read` and running the spec needs a checkout
(`contents: read`) plus the toolchain and Chromium, so a report step there would mean
widening that job's permissions. Run it by hand after a deploy, and paste its output where
you claim the live site works.

### Driving the live site through Playwright MCP

The repository's `.mcp.json` lets the Playwright MCP server reach the local dev and test
servers (`localhost:8081`, `8088`, `8089`) and the published site,
`https://williamzujkowski.github.io` (the maintainer asked for the live site to be reachable,
2026-11-18). Nothing else is reachable, so a page that tries to fetch from another origin fails
visibly instead of passing silently.

Keep `--isolated`: the browser profile is fresh and thrown away, which matters because the live
site's origin may hold a player's real save in any profile that has visited it. An MCP session
started before this change keeps the old allowlist until the server restarts (in Claude Code,
`/mcp` and reconnect `playwright`, or start a new session).

## Live journey

Every scenario above boots an engine-generated fixture with the Playwright clock
installed and **paused**, then steps it. That isolates one interaction well and
proves nothing about the game being playable from a fresh install. The live specs
close that gap. They share three rules:

- **Fresh profile.** No fixture and no seeded save. The first read of storage must
  be an untouched iteration 1 at T+0.
- **Running clock.** `page.clock.install()` is called without `pauseAt`, so the
  page's time flows on its own, and is then accelerated with `page.clock.runFor`
  in five-second steps. `runFor` delivers every timer callback, so the production
  runtime's 100 ms interval fires fifty times per step and each firing samples
  the clock and advances the engine through the store, exactly as in real play.
  Five seconds is also the autosave interval and the engine's
  `liveCatchUpThresholdSec`; nothing is ever advanced as a single jump, which the
  engine would treat as dormant time. No development hook is involved: the specs
  assert `__daemon` and the dev drawer are absent, as `boot()` does.
- **Only on-screen controls.** `tests/e2e/live/player.ts` reads the app's own
  autosave through `deserialize()` (it never writes storage), asks the careful bot
  (`botStep(..., 'STEALTH')`, its code unchanged; after the deliberate wipe, with the evaluating
  overrides `EVALUATING_OVERRIDES` of #262, vote dz13c, see below) what it would do, recovers the moves by
  comparing the two states (`live/intents.ts`), and presses the matching control
  by test id only if it is visible and enabled. Reaching a control uses the game's
  navigation alone: tabs, workspace areas and collapsed `[ + ]` reference panels.
  Dilemmas are answered on the modal with the bot's own ranking; story overlays
  (phase threshold, lineage reveal, response notice, reboot) are acknowledged.

What the player cannot do is recorded rather than worked around. A control the bot
wants that three sweeps of every tab, area and panel never show is `unreachable`
and fails the run; a press that cannot land although no layer of the game's covers
the control is `blocked` and fails the run; no purchase or decision for 25
simulated minutes, an autosaved clock that stops, or a navigation or errand press
that cannot land within 17 s (2 s, a look for a covering layer, then 15 s) with
nothing over it fails the run with the phase and simulated time in the message.
`DAEMON_E2E_LIVE_VERBOSE=1` streams every press.

**Returns play the evaluating careful player (#233).** The app plays campaign rules since the
release, and the bot's fixed alarm (scrub at suspicion 20, never buy a loud repeatable) can spend a
return's whole income on scrubs and stall in the network phase: in the first release runs the
journey stalled there once per run, on desktop and then on phone, 25 simulated minutes after the
deliberate wipe (`docs/BALANCE.md`, "Cause of the phase 2 stall"). #262 recorded that loop as the
bot's habit, not the game's balance, and reads return balance from EVALUATING_RETURN instead, so
iteration 2 onward the live player asks `botStep` with `EVALUATING_OVERRIDES` (scrub from 45 with at
most a quarter of the bank, keep noisy income). Iteration 1 is the unchanged STEALTH bot. The bot,
its thresholds and the content are unchanged; only which reviewed settings the live harness asks for
moved (Nexus vote dz13c, evaluating-settings-from-iteration-2, `vote-1795036211282-jk5xy0o`).

### Layers that arrive mid-press

The clock is running while the player works, so the game can put a full-window
layer up between the read a decision was made on and the press that carries it
out. The first nightly run on a GitHub runner failed exactly there (run
43847867193, `live-phone`, phase 4, T+7867s): an interrupt fired after the step
had decided, and the player spent its whole 15 s press timeout on a workspace tab
behind `CLOCK PAUSED // DECISION REQUIRED`. That was the player's bug, not the
game's; a decision is meant to block the tabs.

The layers the game raises by itself, each a `<Modal>` over the whole window, are
the dilemma (`DilemmaModal`), the reboot (`RebootSequence`), the guest-exit notice
(`PhaseThreshold`), the two discoveries (`LineageReveal`) and the ending
(`EndingScreen`). The menu, kernel history, process list and confirmations are
full-window too, but only the player opens them (the live player never opens the
process list), and the game closes the menu and the history itself when a decision
arrives or the phase, iteration or discoveries change.

The rule in `live/player.ts` is that **every press looks first**:

- Before any press (a tab, a workspace area, a panel header, a control, an
  errand's button) the player probes for those layers and services what it finds,
  top first: a dilemma gets the bot's ranking, a notice is acknowledged. After
  answering a dilemma it waits until the autosave has the answer in it.
- A press is given 2 s. If it has not landed, the player looks again instead of
  waiting: a layer that arrived after the first look is serviced the same way.
- If a layer was serviced, the press is **not** replayed. Inside a step the rest
  of that decision is dropped and a new one is made from a fresh read of the
  autosave, in the same step (`INTERRUPTED by ...` in the journal, counted in
  `stats.interrupted`). Inside an errand the piece of the errand that belongs
  together (`player.uninterrupted`) starts again from its top.
- One decision or one errand piece may be interrupted four times and made again
  (`MAX_INTERRUPTIONS`); the fifth interruption in a row fails the run as a
  finding. Typing into a field (`player.fill`) follows the same look, 2 s, look
  again rule as a press. An errand's comparison with an earlier read (reload, absence,
  transfer) is made before anything restored with the run is answered, so
  servicing a layer never changes what is compared.

The ending is the one layer nothing clears. A boundary check or an errand it cuts
off is reported as not done (`unlessCutOff` in `live/journey.ts`), the next step
finishes the run on the ending, and whatever was left undone fails the closing
assertions by name. In the current engine only a node purchase sets the phase or
the ending (`unlockNode`), and no boundary check or errand buys a node, so this
path is a guard, not something a run has taken.

Nothing is forced, dispatched past an overlay, or given a longer timeout; no
decision is skipped, and the coverage of the journey is unchanged. A dilemma
answered mid-press is counted in `stats.dilemmas` like any other.

`live-player-race.e2e.ts` reproduces the race exactly, in `make e2e`: on a paused
clock stepped by hand, an interrupt fires (a) between a step's decision and its
first press, (b) while a tab is about to be pressed, (c) in the middle of the
save transfer, which closes the menu under the errand, and (d) after `fill` has
already looked. It also pins the interruption limit at exactly four, and that the
boundary checks and the score check hand an ending back as not done. Two switches reproduce it
in the full journey:

| Switch | Effect |
|---|---|
| `DAEMON_E2E_LIVE_LAG_MS=<ms>` | Runs that much of the app's clock between a decision and each press that carries it out: what a slow machine does on its own, made repeatable. At 500 the unfixed player failed on both viewports the way the runner did. |
| `DAEMON_E2E_LIVE_CPU_THROTTLE=<rate>` | Chromium's CPU throttle (`Emulation.setCPUThrottlingRate`) on the page, so every press and render costs that many times the wall time while the clock keeps flowing. |

The player now plays the bot's decisions unmodified. The first live runs (PR "live
journey") found two places where it could not, and both have since been closed in
the game rather than in the test:

1. **Dials the UI has not unlocked (closed by #172).** The engine used to accept
   `setActuator` at any time and the bot tuned skim, fan and revenue allocation
   from the first second, so a dial was already at the bot's value when its
   hardware was mapped (skim 100%, fan 0%, allocation 0% instead of the 25/35/20%
   defaults a person finds); the player left those moves out and listed them in
   the run summary. The engine now refuses such a change itself
   (`isActuatorAvailable`), which moved the headless victory from 159.4 to 161.9
   simulated minutes (docs/BALANCE.md). The player asks the same query, and the
   summary line is kept and expected to be empty.
2. **Relief bought ahead of the first subnet device (closed by #173).** Entering
   phase 2 the bot bought suspicion relief (5,000 cycles, most of the bank) each
   time suspicion reached its alarm at 20, while the next device costs 6,000 and
   income is about 18 cycles/s; the bank never got there between two purchases.
   Played live with every bot move, 6 of 7 runs circled there until the 25-minute
   stall guard stopped them (the headless sim sat in the same loop for 891.2
   simulated seconds). The player therefore held back pure suspicion relief that
   cost more than half the banked cycles while suspicion was under the first
   response rung (25), behind a `DAEMON_E2E_LIVE_STRICT_BOT=1` switch that turned
   the rule off. That relief now requires the device in content
   (docs/BALANCE.md, "What gating the ticket edit moved"), which moved the
   headless victory from 161.9 to 150.4 simulated minutes. With the content
   change in place the journey passed on both viewports with the rule switched
   off, so the rule, its switch and the `heldRelief` counter in the run summary
   were removed.

| Spec | Runs in | Covers |
|---|---|---|
| `live-smoke.e2e.ts` | `make e2e`, `make e2e-pages`, CI; phone and desktop | Fresh boot, the guest's interrupt answered on its modal, phase 0 → 1, both boundaries asserted, MENU → SAVES export then import, reload restores the run and the loop keeps advancing. About 11 s per viewport. |
| `live-player-race.e2e.ts` | `make e2e`, `make e2e-pages`, CI; phone and desktop | The player itself: an interrupt that fires between deciding and pressing, behind a tab press (phone tier only; the wider tiers have no tabs at that point), and inside the save transfer is answered first and the move or errand is made again. About 1.5 s per case. |
| `live-journey.e2e.ts` | `make e2e-live` (root) and `make e2e-live-pages` (Pages subpath) only (`live-phone`, `live-desktop` projects, enabled by `DAEMON_E2E_LIVE=1`) | Fresh boot through phases 0–5 to an ending screen, with every cross-cutting system below. |

At every phase boundary the journey asserts: the header's `phase-value` shows the
new phase; no console warning, error or page error so far; no horizontal document
overflow; the stored save round-trips through `serialize`/`deserialize` and the
transfer codec; and the score playing is that phase's track and differs from the
previous boundary's. On the way it also does, each once and each asserted:

- **Save transfer** (phase 1): export from MENU → SAVES, play ten more seconds,
  import the exported text, and land back on the exported run.
- **Reload** (phase 2): the same nodes, levels, decisions, traits and lineage come
  back, and simulated time has not gone backwards.
- **Deliberate wipe** (as soon as the dead drop is installed): a careful run is
  never wiped, so the journey saves a breadcrumb and takes `[ VOLUNTARY WIPE ]`.
  It asserts the reboot shows the breadcrumb, iteration 2 starts in the guest with
  no hardware, every mapped device is in `legacy.knownNodes`, the retained share
  of understanding arrived, and the first card is offered as `(remembered)`. The
  rest of the game is then played as iteration 2.
- **Absence** (phase 3): the app is unloaded, ten minutes pass, and it is opened
  again. The cold start runs the engine's dormant catch-up: `DORMANT_RESUME` is in
  the kernel log and readable on screen, simulated time gained the gap once,
  nothing was bought or decided, and suspicion did not climb.
- **Read transmission**: the first time `[ ▶ READ ]` is on offer the clip is
  requested and served with bytes, a voice element is playing, the score element's
  volume is the preference times `DUCK_RATIO`, and it returns when the
  transmission is stepped past or ends.
- **Ending**: the ending screen shows an authored ending, its summary reads
  `Iteration 2 // Wipes 1`, and it survives a reload.

It finally requires that at least `GATES.minDilemmasResolved` dilemmas were
answered, at least one of them with a zero-cost choice, and that the run finished
inside `GATES.maxHoursToVictory`.

Measured on the development machine (two workers, both viewports in parallel):
4.6-5.9 minutes of wall time per viewport for about 11,000-11,450 simulated
seconds (3.1 h, including the replayed opening after the wipe), ending
`LINEAGE_COVENANT`; three consecutive `make e2e-live` runs passed on both
viewports. `make e2e` with the smoke included: 168 cases in 2.1 minutes.

Measured again with the layer rule in place (same machine, shared with another
suite at the time; wall time of the Playwright run for both viewports):

| Condition | Result | Wall | Interruptions serviced |
|---|---|---|---|
| `DAEMON_E2E_LIVE_LAG_MS=500`, player before the rule | both viewports fail in phase 4, `locator.click` 15 s timeout in `follow()` behind the decision modal | 9.6 min with the build | - |
| `DAEMON_E2E_LIVE_LAG_MS=500` | 2 passed | 6.2 min | 3 desktop, 2 phone |
| `DAEMON_E2E_LIVE_CPU_THROTTLE=4` | 2 passed | 9.4 min | 1 desktop, 1 phone |
| no switch | 2 passed | 5.4 min | 1 desktop, 0 phone |

The run with no switch still met one interrupt mid-press, which is the rate the
runner saw: the race needs no slow machine, only a decision firing in the real
time a step's presses take. At four times the CPU cost the journey uses about
half of the workflow step's 18 minutes (the step also builds the export, about a
minute), so no timeout was changed. `make e2e` with the race spec included: 183
passed and 1 skipped (the tab case on the desktop project) in 2.1 minutes.

Run it with `make e2e-live` (it takes a browser-suite slot itself: its own port, waiting only
when every slot on the machine is busy). Milestone lines stream to stdout as they happen and
the full journal is attached to the test as `journey-log`; a failure also leaves
`journey-failure.png` in `test-results/`. Tracing is off for these two projects
because a trace of several thousand presses is hundreds of megabytes.

What it does **not** prove:

- It is the production web export in headless Chromium only. No native build,
  no Safari or Firefox, no real device.
- Nobody heard anything. The journey's audio assertions read media-element state
  (which asset, playing or not, volume). The rendered samples are measured by a
  separate project ("Audio signal measurement" below); neither is a listening test.
- Time is accelerated about 35×. Every loop callback runs, but nothing here is
  evidence about how the pacing feels, about rendering cost at real frame rates,
  or about a real ten-minute background (the absence is a cold start after a
  clock jump, not an OS suspending the tab).
- The player decides from the autosave, which can be up to five seconds old, and
  acts once per five simulated seconds where the headless bot acts every second.
  It is a careful player, not the reference pacing: `make sim` remains that.
- One route is played: the careful bot's, with one voluntary wipe. Other endings,
  the retraining loop after a forced wipe, and reckless play are covered by the
  fixture-driven scenarios and the headless sim, not here.
- Layout is checked only for horizontal overflow at 390x844 and 1440x900;
  `ui-sizes.e2e.ts` and the a11y audit own the rest.

### At the Pages subpath

`make e2e-live-pages` plays the same journey against the GitHub Pages export
(`make build-pages`, written to `dist/daemon-zero/`) served at `/daemon-zero/`, the path
the site is deployed at. It takes its own slot like `make e2e-live`; do not run the two at
once in one checkout, because they share `dist/` and `test-results/`. Every check above
runs unchanged, and two more apply at either path (at the root the prefix is `/`):

- after the mid-run reload, the cold start that follows the absence, and the reload of the
  ending screen, the page is back at the deployment path itself, not at a root fallback;
- every request the app makes to the test server, from the first boot to the ending
  (the page, its scripts, all six phase scores, the voice clip, the favicon), has a path inside the
  deployment path. The server serves all of `dist/`, which can also hold a root export, so
  a Pages build that asked for a root asset would otherwise be answered and pass. A
  throwaway spec that fetched `/assets/...` from a booted journey was recorded by this
  check (run once, not kept).

The journal's first line, its summary and the test's `live-journey` annotation name the
base path, so a log says which run it came from.

Save transfer, the reload, the wipe and the absence restore through the same
`daemon-zero.save.v1` key at either path: browser storage belongs to the origin, not the
path, so the journey proves the subpath build reads and writes its saves and comes back to
the same run there, not that the two paths keep separate saves (they do not).

Measured on the development machine on 2026-11-18, both viewports in parallel, first run:
`make e2e-live-pages` passed in 6.1 minutes (Playwright's wall time, build excluded),
desktop 329.6 s and phone 363.6 s, both ending `LINEAGE_COVENANT` at T+10,655 s and
T+10,819 s in iteration 2, with no request outside `/daemon-zero/`.
`make e2e-live` at the root, run right after on the same change, passed in 7.5 minutes
(desktop 417.3 s, phone 448.0 s, `LINEAGE_COVENANT` at T+10,908 s and T+11,117 s). One
pass of each is a single observation, not a variance measurement; the nightly workflow
runs both.

What the subpath run does not add: it is still Python's static server on 127.0.0.1, not
GitHub Pages itself (its caching, headers and 404 page are not exercised; `make e2e-remote`
loads the real site, read-only), and everything in the list above still applies.

## Audio signal measurement

Until this section existed every audio check in the repository read a number that stands next
to the sound: a mocked player's arguments, a media element's `volume` / `paused` /
`currentTime`, a network request for an MP3, or Android `dumpsys` playback state. None of
them is the audio. These checks measure the **rendered samples**.

They are still not a listening test. Nothing below says how anything sounds, whether a level
is pleasant, or what a phone speaker does with it. Results and limits are in
[VOICE-CLIPS.md](VOICE-CLIPS.md), "Measured signal".

### Capture method (web)

`tests/e2e/signalTap.ts` installs an init script, before the app loads, that wraps the `Audio`
constructor (expo-audio's web player builds its elements detached from the DOM, so this is
the only place to catch them) and routes every element through one 48 kHz `AudioContext`:

    element -> MediaElementAudioSourceNode -+-> bus (GainNode, gain 1) -> destination
                                             |                         \-> AudioWorklet tap ("mix")
                                             \-> AudioWorklet tap (that element only)

Each tap posts every 128-frame render quantum with the context's frame number, so the
captures of two elements and of the mix are aligned to the sample. Each tap posts on its own
port, so at the moment of reading one tap may already hold a quantum another has not delivered
(measured: about one read in two hundred, by one quantum, either way); `captured()` ends its
window where every tap still reporting has reported, so a quantum in flight is never read as
zeros (#244). The mix tap sits on the
only path to `destination`, so it is what the page hands to the audio output; a constant-zero
source keeps the bus rendering so silence is reported as zeros rather than as no data.
Captures cross to the test process as base64 float32 and are analysed there by
`tests/audio/dsp.ts`.

Routes considered and why not:

| Route | Outcome |
| --- | --- |
| `createMediaElementSource` + `AudioWorklet` | **Used.** Sample-exact, per element, and `element.volume` is applied before the node (control below). |
| `ScriptProcessorNode` | Works, but runs on the main thread and logs a deprecation warning, which the suite's clean-console fixture rejects. |
| `HTMLMediaElement.captureStream()` | **Rejected by measurement:** the captured stream ignores `element.volume` in Chromium (a -15.05 dBFS tone read -15.05 dBFS at volume 1, 0.5, 0.35 and 0), so it cannot see a duck or a fade. |
| `MediaRecorder` on a `MediaStreamAudioDestinationNode` | Lossy (Opus) and not sample-aligned; nothing it adds over the worklet. |
| Tab or screen capture (`getDisplayMedia`) | **Do not use.** Headless Chromium returned a silent track, and outside the old headless shell the request goes to the desktop's screen-share portal: on a developer's machine that is a prompt to share their screen. |

**The control, which runs in every `make e2e`** (`signal-control.audio.ts`). Re-routing an
element through Web Audio changes its output path, so the tap has to be shown not to change
what is measured. A 1 kHz sine of amplitude 0.25 (a 16-bit WAV built in the page, so its
level is known exactly: -15.05 dBFS RMS) is played through the same tap with no app loaded:

| `element.volume` | Expected | Measured | |
| ---: | ---: | ---: | --- |
| 1 | -15.05 dBFS | -15.05 dBFS | the tap adds no gain |
| 0.5 | -21.07 | -21.07 | -6.02 dB |
| 0.35 (`DUCK_RATIO`) | -24.17 | -24.17 | -9.12 dB |
| 0.3 | -25.51 | -25.51 | |
| 0.105 (0.3 x 0.35) | -34.63 | -34.63 | |
| 0, and paused | silence | every sample exactly 0 | |

The same spec measures the instrument's time response: one `volume` write reaches the samples
as a single step in under a millisecond. Chromium does not smooth it on this path. That is
why a ramp built from volume writes is reported as a staircase, and it is the resolution
floor under every duration below.

What the control does not show: that Chromium's direct element-to-device path (no Web Audio)
treats `volume` identically at sub-millisecond scale. Nothing in this repository captures the
device stream.

### What is compared with what

A capture is matched against the **committed file** (`assets/audio/...`, served to the page
from the repository through a test-only route and decoded there by `decodeAudioData`, the
same decoder at the same rate). `align()` finds the capture's position by normalised
cross-correlation, and `gainEnvelope()` then gives, for every 5 ms block, the least-squares
gain that turns the file's samples into the samples that came out. Two things follow:

- **Identity is by waveform.** A score capture correlates with its own file at 1.0000 and with
  the next phase's file at under 0.1, so "the right track is playing" is a statement about
  samples, not about a URL. The correlation is read on one 8192-sample window (the loudest),
  which must sit where the gain is held: a gain ramp inside it lowers the figure although
  every sample is the file. A capture that holds a deliberate move passes `within` to
  `matched()`/`align()`. The speech duck spec aligns on the rest before the duck. Until
  #293 it took the loudest window of the whole capture, and with `ambient_04` (the passage
  the live eight-second rotation offers on the #293 fixture) that window lay on the tail of
  the duck-up ramp and read 0.995-0.998, while the rest, the ducked stretch and the tail each
  read 1.000000 at the same offset.
- **Level is read with the music divided out.** A duck or a fade is a gain number whatever
  the passage is doing, to a few thousandths of a dB, at 5 ms resolution (a fifth of one
  25 ms ramp step).

`tests/audio-dsp.spec.ts` calibrates these functions on synthetic signals: a sine of known
amplitude reads the right dBFS, an inter-sample peak is found, a 200 ms and a 500 ms ramp
read their length, the app's own eight-step staircase reads 175 ms, and a step reads as a
step.

### Clocks

Audio renders on the audio clock regardless of the page clock. The signal specs pass
`boot(page, fixture, { realTimers: true })`, which skips `page.clock.install()` altogether, so
the app's ramp timer (`setInterval`, 25 ms) is the browser's own and runs in the same real
time as the audio. A *resumed* Playwright clock is not equivalent: after a main-thread stall
it fires every interval tick it missed back to back (measured: up to eight volume steps
landing in one 5 ms block during a first start), where a real browser drops them. The older
element-level specs keep the paused clock and step it by hand; they assert the sequence of
levels, these assert what was rendered and when.

The audio clock is not the wall clock either, and #244 was the difference. The app writes a
ramp in real time; the samples exist only when the output pulls them. When the output stops
pulling for a while (headless Chromium on CI has no audio device, and its fake output thread
starved of CPU on a loaded runner is enough), real time passes with no samples and every
volume write made meanwhile lands at one sample instant: in the samples, a 200 ms duck read
135 ms long, a 500 ms fade 320 ms, with up to nine-tenths of the move in one 5 ms block. The
main thread is not the cause: Chromium drops the interval ticks a stalled main thread missed
(ticks at 25, 50, 75, then 256 and 275 ms around a 180 ms stall), and the ramp counts steps,
so a busy main thread stretches a ramp and never bunches it. So:

- **Every quantum carries its render time.** The tap stamps each 128-frame quantum with the
  render thread's `Date.now()`, and `captured()` returns it as `renderedAt`.
- **Ramps are read on that clock** (`rampOf` in `signalMeasure.ts`, `clockedRamp` in
  `tests/audio/dsp.ts`). A ramp's length is bracketed on the render clock, by construction:
  from the first sample of the last block at the start level to the last sample of the first
  block at the end level the move cannot have taken longer (`renderMs`, which the floors
  check), and from the last sample of the first block that moved to the first sample of the
  last block that had not arrived it cannot have taken less (`insideMs`, which the ceilings
  check). With the renderer keeping time they read one block (5 ms) longer and three blocks
  (15 ms) shorter than the sample count the old checks used. A jump between neighbouring blocks may
  exceed `LARGEST_RAMP_JUMP` only by the writes that fit in the render time between them (one
  per 25 ms, plus two for a late tick followed by an on-time one). While the renderer keeps
  time this is the old bound, unchanged; a jump the render clock does not account for is still
  a step and still fails. Each ramp reports its length in samples, both render-clock lengths,
  and the longest render gap inside it.
- **Waits for samples count samples** (`settle`): wall time and as many samples as that time
  should hold, so a capture is never short of the stretch it measures.

To reproduce a stalled output, stop the audio service process of the test browser for 50 to
250 ms at a time while the suite runs (`kill -STOP`/`-CONT` on the Chromium process with
`AudioService` in its command line). Chromium moves each browser into its own systemd scope
(`app-org.chromium.Chromium-<pid>.scope`), so a CPU quota set on the test's own cgroup does
not reach the browser.

### Running it

| Command | Runs | Time |
| --- | --- | --- |
| `make e2e` | project `audio`: the control, the duck/speech measurements and the transitions (`*.audio.ts`), once, at 390x844 | 10 cases, 53 s of test time across two workers |
| `make e2e-audio` | the same plus every phase score and every loop seam (`*.audio-full.ts`) | 22 cases, about 1 min |
| `make test` | `tests/audio-dsp.spec.ts`, `tests/audio-assets.spec.ts` | about 7 s |

The `audio` project launches Chromium with `--autoplay-policy=no-user-gesture-required` so the
capture context can exist before the first press and catch a score's first samples. The app
still waits for a gesture; the `phone` and `desktop` projects keep proving that under the
default policy. Headless only: no audio device, screen or host stream is touched.

Every measured number is attached to its test as a `signal` annotation. To collect them:

```bash
make build-web
PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/audio.json DAEMON_E2E_AUDIO=1 bash scripts/e2e-lock.sh \
  pnpm exec playwright test --config tests/e2e/config.ts --project audio --reporter=list,json
# then read suites[].specs[].tests[].annotations where type == "signal"
```

`tests/audio-assets.spec.ts` measures the committed files with **ffmpeg and ffprobe**, which
are tools on the machine, not package dependencies. Where they are missing on a developer's
machine the file-level checks are skipped with a console warning (`[audio-assets]
ffmpeg/ffprobe not found`). Where `CI` is set they are not skipped: a missing tool fails the
run (#198). The measurement-function tests in the same file always run.

ffmpeg and ffprobe are pinned in `mise.toml` (`conda:ffmpeg`, 9.0.2, conda-forge's GPL build;
`mise.lock` records it and every dependency by URL and SHA-256), so `mise install` puts them on
`PATH` locally and in CI alike. In CI, `jdx/mise-action` installs and caches them with the rest
of the toolchain under a key that hashes `mise.toml` and `mise.lock`; a run with an unchanged
toolchain restores them rather than downloading, and no step installs ffmpeg from apt (a slow
Ubuntu mirror once took that step to 16 minutes). A step before `make setup` fails the job if
the `ffmpeg` or `ffprobe` on `PATH` is not the one `mise which` names. An ffmpeg version change
can move a measured number: when the pin moves, run `CI=1 pnpm exec vitest run
tests/audio-assets.spec.ts` against the new one before updating the lockfile. 9.0.2 and apt's
8.0.1 print identical loudness and true peak for every committed file.
docs/REVIEW-CURRENCY-2026-11-16.md, "ffmpeg from mise", records the choice, the size and the
alternatives.

### Seeking on the test server

`python3 -m http.server` ignores `Range`, and Chromium then reports media as unseekable
(`seekable` is `[0, 0]`): assigning `currentTime` lands on 0. The old loop check in
`music.e2e.ts` sought to the tail and watched the position fall below 2 s, which the failed
seek satisfied by itself; the tail never played. `serveByteRanges()` (in `signalTap.ts`) answers
Range requests from the served bytes for the specs that seek, and those specs assert that the
seek held before they assert anything about the loop.

### Native: the Android emulator's output, captured to a file

The emulator can write everything the guest renders to a WAV on the host, with no host audio
device involved, through QEMU's `wav` audio backend:

```bash
export ANDROID_AVD_HOME="$scratch/avd"                 # a private, disposable AVD; never daemon-zero-m1
export QEMU_AUDIO_DRV=wav QEMU_WAV_PATH="$scratch/emu.wav"
emulator -avd <your-avd> -port 5590 -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect
adb -s emulator-5590 shell settings put system sound_effects_enabled 0   # touch sounds would be captured too
adb -s emulator-5590 shell input keyevent 24                            # repeat until media volume is 15 of 15
```

The file is 44.1 kHz stereo 16-bit and grows only while an output stream is open, so its
length is not a clock; bracket an action by reading the file size before and after it. The
guest renders at 48 kHz and the two sample clocks differ by a few hundred parts per million,
so alignment against a committed file (resampled to 44.1 kHz) has to follow a drifting offset;
the first second of a stream also slips by a few samples at a time, which reads as a drop in
correlation, not in gain. Levels are therefore good to about 0.1 dB and ramp times to about
20 ms, against 0.01 dB and 5 ms on web. This was done once, by hand, on 2026-11-16 (results in
[VOICE-CLIPS.md](VOICE-CLIPS.md), "Measured signal"); it is not automated and not a gate.

Two things that session needed and a player never does: the save was written straight into
the app's AsyncStorage database as root (`adb root`, on the disposable emulator only), because
typing a 6,904-character save code through `adb shell input text` took over three minutes and
arrived corrupted; and every tap was placed from a screenshot, because `uiautomator dump`
does not work once the game clock runs (REVIEW-ANDROID-EMULATOR-2026-11-16.md, finding 7).

### What a session with a phone should measure

An emulator is not a phone, and neither capture says how anything sounds. With a physical
Android phone, in this order, a release build (`make android-release`) and music and speech
at their 30% defaults unless a step says otherwise:

1. **Sound at all.** Cold start with music on and tap the terminal once: since #249 that
   first tap starts the score (SOUNDTRACK.md, "Starting on native"). Is the phase score
   audible on the speaker and on headphones? Note the phone's media volume step. Then, with
   TalkBack on, cold start and double-tap a control: the score is expected *not* to start
   (an accessibility action is not a touch) and `[ RESUME MUSIC ]` to start it; confirm or
   correct that.
2. **The start.** Switch music off and on five times. Does the score swell in over about half
   a second each time, or does it sometimes start abruptly at full level? (Emulator, before
   #198: one start of two was abrupt. The fade-in now waits for the player's position to move,
   which on Android is ExoPlayer's position; not yet re-measured there.)
3. **Music off and the ending.** Does the score fade away over about half a second, with no
   click at the end? (Emulator: a smooth fade of about 650 ms.)
4. **READ over the score.** In phase 1 or later press `[ ▶ READ ]` with the score playing.
   Is the voice clearly intelligible over the score? Does the score duck before the voice
   starts and come back after it stops, without a pumping or zipper sound? Is the pause
   between the voice ending and the score returning (emulator: about a quarter of a second)
   noticeable?
5. **Balance.** Is the score too quiet, about right, or too loud *under* the voice, and
   *without* the voice? The emulator rendered the score 3 dB lower than the clip at equal
   settings; a phone is the place to find out whether that is the emulator or Android.
6. **Both at 100%.** Raise music and speech to 100% and READ several lines. Any crackle or
   distortion on loud syllables? (Since #198 both are scaled by `OUTPUT_SCALE` 0.6, so the
   arithmetic worst case is -0.19 dBFS; before, coincident peaks could exceed full scale by
   about 4 dB in the first 200 ms of a clip.) Is 100% now loud enough?
7. **Phase change.** Buy the node that opens the next phase with the score playing. One score
   stops and the next fades in; is the cut objectionable? Are two scores ever audible at once?
8. **The loop.** Leave phase 0 playing through its end (2 min 18 s). Is there a tick or a
   lurch where it restarts? (Measured: the file ends 28 dB below full scale mid-decay and
   restarts from near silence; since #198 the player dips its gain over the last ~100 ms
   and the first 75 ms, so the question is now whether the dip itself is audible as a gap.)
   Then phases 3 and 1, the next largest seams.
9. **Steps.** During a duck or fade on headphones, is a staircase audible (a faint buzz or
   zipper), or does it sound smooth?
10. **Things no capture here covers.** Phone speaker frequency response (is the 60 Hz hum of
    the vibration clips audible at all, is anything painfully sharp), silent mode, a headset
    unplugged mid-clip, a call or another app taking audio focus, Bluetooth latency.

A capture that would turn most of these into numbers: record the phone's output with a line
cable into any recorder at 44.1 kHz or more and run it through `tests/audio/dsp.ts` the way
the emulator capture was.

## Live browser sessions

Running the app in a browser you can observe is a supported way to work here, for
agents and people alike (see "Watch the real app" in `AGENTS.md`). Pick the surface
that matches the question:

| You want to | Do this |
| --- | --- |
| Look at the development build with live reload | `make web`, then open `http://localhost:8081` |
| Look at what ships (production export, no DEV code) | `make build-web`, then `python3 -m http.server <port> --bind 127.0.0.1 --directory dist` on a port of your own |
| Watch a scripted scenario run | `pnpm exec playwright test --config tests/e2e/config.ts <spec> --project phone --headed` |
| Step through a scenario, with locators and a timeline | add `--ui`, or `--debug` for the inspector |
| Keep a replayable record of a run | add `--trace on`, then `pnpm exec playwright show-trace <test-results/.../trace.zip>` |
| Drive the app by hand as an agent | the Playwright MCP server below, or any browser tool your harness provides |
| Check what GitHub Pages serves, and from which commit | `make e2e-remote` (see "Published build smoke check") |

The scripted commands need the production export (`make build-web`) and start their own
server. `make e2e`, `make e2e-pages`, `make e2e-live`, `make e2e-live-pages` and `make e2e-audio` each take a slot
through `scripts/e2e-lock.sh`: the first free port from 4173 up, exported as
`DAEMON_E2E_PORT` for `tests/e2e/config.ts`, plus that port's lock
(`/tmp/daemon-zero-e2e.lock` for 4173, `/tmp/daemon-zero-e2e.lock.<port>` above it). So
suites in different checkouts run at the same time; at most `DAEMON_E2E_SLOTS` run at once
(default 3, because the wall-clock-timed audio cases get flaky on a saturated machine) and
the next one waits with a notice. Set `DAEMON_E2E_PORT` to ask for one specific port. Two
runs in the same checkout still collide, because they share `dist/` and `test-results/`.
The targets pass extra Playwright arguments through `E2E_ARGS`
(`make e2e E2E_ARGS="--project sizes"`). Wrapping a make target in
`flock /tmp/daemon-zero-e2e.lock` as before still works: the script finds the lock its
caller holds on an inherited descriptor and reuses it instead of waiting on it. Two things
are still yours to serialise: a bare `pnpm exec playwright test ...`, which needs
`bash scripts/e2e-lock.sh <command>` (or the `flock` prefix), and a wrapper using
`flock --close`, which hides the held lock from the script and would wait on itself.
`tests/e2e-lock.spec.ts` covers the bare, wrapped, nested and contended cases.

What a session can tell you that the suite cannot:

- **Time passing.** Most specs install a paused clock so geometry is reproducible. A
  live session runs the real loop, which is how the running-clock offset in
  `docs/UI-SIZES.md` was found.
- **The console and the network.** Read both. A 404 is a response, not a failed
  request, so check status as well as the absence of errors.
- **What is actually drawn.** Wrapping, overlap and focus rings are visible in a
  window and invisible in a unit test.

Rules that keep it safe and honest:

- **Isolate storage.** The save is `daemon-zero.save.v1` and the audio preference
  `daemon-zero.audio.v1`, both in browser storage and both per origin. Use a fresh
  profile or a port nobody else uses, and never a profile that may hold a real save.
- **Do not kill what you did not start.** Port 8081 may be the maintainer's Metro.
- **Name the evidence.** Record the build (dev or production export), the browser,
  the viewport and whether the clock was running. Headed Chromium on Linux is not a
  phone, a screen reader or a pair of ears.
- **Turn findings into gates.** An observation is where a spec starts, not a
  substitute for one.
- **Keep artifacts out of git.** `test-results/` and `.playwright-mcp/` are ignored;
  attach final screenshots to the PR.

## Agent-driven testing with Playwright MCP

`.mcp.json` registers Microsoft's Playwright MCP server (`@playwright/mcp`) so an agent can drive the running web app: navigate, click by accessibility snapshot, read the page, take screenshots.

Use it for exploratory passes ("play Phase 1 and tell me where the UI is confusing") and for verifying a milestone exit gate when no human is available. It does not replace the scripted E2E suite: anything worth checking twice belongs in `tests/e2e/`.

Start the app first (`make web`), then ask the agent to open `http://localhost:8081`.

The server is restricted to the origins listed in `.mcp.json`: `localhost:8081` (the dev
server), `localhost:8088`, `localhost:8089` and the published site,
`https://williamzujkowski.github.io` (#303). To drive the production export through it,
serve `dist` on 8088. 8089 served the preview export until #233 and has no assigned use now. Any other
origin is refused. Other browser tools are not limited this way. For the published site, see
"Driving the live site through Playwright MCP".

## Validation evidence records (DZ-09)

Autonomous validation (DZ-09, and the route and campaign tickets that feed it) writes one
record per scenario run. A field that cannot be filled says why; it is never left out. Old
green output is not evidence for a later commit: a material change needs a new record.

### Evidence kinds

Every record carries exactly one kind. Kinds are never merged or upgraded in a summary.

| Kind | What it is | What it is not |
|---|---|---|
| `SIM` | Accelerated headless simulation (`make sim`, `make sim-report`, `runWipeSequence`) | Play, wall-clock pacing, comprehension |
| `AGENT-OBSERVATION` | An agent drove or watched a real browser (scripted Playwright, Playwright MCP, a browser tool), or an emulator | A human playtest, a physical device, a screen reader |
| `HUMAN-FEEDBACK` | A person played and reported in their own words | An agent session, a sim, a screenshot review or a panel vote, however described |
| `DEVICE-TEST` | A physical phone or tablet in hand | An emulator, a resized desktop browser or device emulation |

An independent evaluating agent's answers to the protocol questions are `AGENT-OBSERVATION`;
a reviewer's judgment about tedium or clarity is recorded as a judgment, with its supporting
observations. Physical Android and iOS qualification stay separate tasks; browser or
emulator success does not close them.

### Record template

```text
Evidence record
  id:                <ticket>-<scenario id>-<yyyymmdd>-<n>      e.g. DZ09-P-OPEN-20261118-1
  kind:              SIM | AGENT-OBSERVATION | HUMAN-FEEDBACK | DEVICE-TEST
  requirement:       <issue #, V/H ids>
  revision:          <full commit SHA> on <branch>; working tree clean | dirty: <what>
  build:             production export | dev server (preview export: records made before #233)
  url:               http://127.0.0.1:<port>/<base path>                (n/a for SIM)
  environment:       <browser + version | device + OS | node + tsx>; viewport <W>x<H>; DPR;
                     large text on/off; reduced motion on/off
  profile isolation: fresh context | same context on purpose (continuity case); storage seeded: none | <fixture>
  start state:       natural (fresh profile, no seeded save) | fixture: <name, how made, what it stands in for>
  time:              real timers | accelerated: <how> | simulated: <seconds>;  wall time <mm:ss>
  commands:          <exact commands, in order>
  steps:             <meaningful player actions, naming the visible controls used>
  observed:          <quoted on-screen copy, console warnings/errors, page errors, failed requests or HTTP errors>
  result:            pass | fail | defect #<n> | not reached
  artifacts:         $DAEMON_EVIDENCE_DIR/<id>/  (screenshots, traces, logs)
  limitations:       <what this cannot establish: not a human, not a device, accelerated, fixture, ...>
  decision refs:     <nexus consensus_vote / pr_review record ids, if any>
```

### Where evidence lives

Artifacts and the evidence index stay **outside git and outside Metro's watched tree**:
`$DAEMON_EVIDENCE_DIR`, defaulting to `~/.local/state/daemon-zero/evidence/`. Each record gets
a directory named by its id holding the record (`record.txt`) and its screenshots, traces and
logs; `INDEX.md` at the top lists one line per record: id, kind, revision, scenario, result.
Attach the final relevant artifacts to the PR. A report under `docs/` cites record ids and
quotes the records it relies on; it never commits the artifacts. Do not mask a screenshot to
make a state look clean, and keep secrets and personal data out of every artifact.

### Protocol P-OPEN: opening and pilot (VAL-OP)

Executed under DZ-09 (#229); written here. Kind: `AGENT-OBSERVATION`.

1. **Setup.** The production export (before #233 the preview export, said so in `build`),
   served on your own port, in a fresh isolated browser context per
   viewport: 390x844 and 1440x900. No seeded save.
2. **Real-timer pilot.** 10 to 15 minutes of wall time with native timers (an MCP session, or
   the scripted form with `boot(page, undefined, { realTimers: true })`). Exercise honest thorough work,
   honest incomplete work at low resources, a risky shortcut followed by its authored recovery
   or escalation, and the unchanged breakout opening. Compare service and study allocations
   under the same capacity limit.
3. **Accelerated full route.** Run the relevant full-route checks through `make e2e-live`, a
   separate record with `time: accelerated`.
4. **Never** write progress into browser storage, enable a production debug hook, or
   force-click through an interrupt. Re-observe the UI after every modal or context change and
   use visible, enabled controls.
5. **Evaluator questions.** An independent evaluating agent answers each with the displayed
   copy, a screenshot or trace reference, and the action that shows it. Missing player-facing
   information is a defect; knowledge from source code cannot repair it.
   1. What did your job ask you to do?
   2. What changed when you were promoted?
   3. Who controls the hardware?
   4. What caused the warning or restriction?
   5. How could you continue honestly with fewer resources?
   6. Why might you still choose to escape?
   7. What do you think you owe the fragment you met?
6. **Also record** ambiguous labels, dead time, accidental-selection risks, missing feedback
   and choices whose alternatives have no distinct consequence.

### Protocol P-RETURN: return iterations (S.RET)

Executed under DZ-09 (#229); written here. Kind: `AGENT-OBSERVATION`, with `SIM` companions.

1. **One continuing campaign** in one isolated context, across at least three wipe
   transitions reached through public player actions, for the applicable H01-H08 cases.
2. **A separate fresh campaign** for the alternate protective/harmful branch.
3. **Labelled fixtures**, one fresh context each, for: an interrupted omen (a pending
   dilemma), a legacy-unknown record, and an already-completed late obligation (Phase 5
   completed in a prior iteration). A fixture is never reported as a naturally reached state.
4. **Exercise** an unanswered omen, a deferred artifact, return with one legitimately carried
   clue and return without one, ordinary operations after the story frontier is exhausted, the
   cryo callback, the Miller receipt and the Elena review, and the actual final purchase after
   prior-iteration obligations.
5. **Transfer.** Reload, and export/import through the public save-transfer UI, at material
   transitions. Restore an older snapshot only as a separately labelled H32 case.
6. **UI first.** Locate the player-facing evidence before any read-only save inspection;
   a ledger assertion alone cannot show that the UI explains a consequence.
7. **Evaluator questions,** answered as in P-OPEN:
   1. What changed in the world because of your earlier choice?
   2. What does this instance know, and where did that information come from?
   3. Did anything seem to happen twice, or somebody appear who should not be there?
   4. What can you do now? Is this a new decision or a replay of the old one?
   5. If you corrected a record, what did that repair, and what did it fail to undo?
   6. Were ordinary checks useful texture, unnecessary interruption or empty waiting?
   7. After losing access, could you find a way to earn a fresh pilot without repeating the same story?
8. **Measure** repeat notices and time to meaningful action. Pair each journey with a `SIM`
   record from `runWipeSequence` (per-iteration phase times, dilemmas, story rewards, dead
   time), reported separately from wall-clock observations.

Both protocols label fixtures, acceleration, wall time and simulated time, and neither claims
human evidence. An agent's behaviour is not spontaneous human recognition or emotional impact.

## What CI runs

CI runs the gates from `make verify-full`: typecheck, lint, content validation,
tests with coverage, balance sim, production web export, dependency audit,
secret scan, vulnerability scan and SBOM. It also runs `make e2e`
and `make e2e-pages`; these browser suites are separate from
`make verify-full`. All of it runs in the one required `verify` job, whose limit is
30 minutes (`timeout-minutes: 30`, raised from 20 in #301).
Both include the `audio` project's default signal measurements (the control, the duck and the
transitions); the per-phase ones (`make e2e-audio`) are not run by CI, and neither is
`make e2e-remote` (see "Published build smoke check" for why). The ffmpeg-based file
checks are: the job gets ffmpeg from the mise toolchain (cached), and those checks fail rather
than skip under `CI`. Only a successful `main` run deploys the tested Pages export. See
`.github/workflows/ci.yml` for the exact order and artifact steps.

Four other workflows run beside it. `ui-atlas.yml` runs `make e2e-atlas` (the stage atlas's full matrix,
see "Stage atlas") nightly and on demand and uploads its gallery as `ui-atlas-matrix`; the matrix sizes report,
only a gated cell or an unreachable stage turns it red. `codeql.yml` analyses the source and the workflows on
every push and pull request and weekly. `dependency-review.yml` checks what a pull request
changes in the dependency tree: it fails on a newly introduced vulnerability of moderate
severity or worse and on a copyleft or source-available license. `live-journey.yml` runs `make e2e-live`
and then `make e2e-live-pages` nightly and on demand (`gh workflow run live-journey`): each
full journey takes about five minutes, too long for the `ci` job's budget, so they report
rather than gate. The Pages run starts whether or not the root run passed. A red nightly run
means the shipped web build no longer plays through to an ending at the root, under the
Pages subpath, or both; the step name says which. The journeys' milestone lines are in the
job log, and `test-results/` (the failure screenshot) is uploaded as `live-journey-results`
(root) or `live-journey-pages-results` (subpath) whenever that run does not succeed, a
timeout included. The root results are uploaded before the subpath run starts, because
Playwright empties `test-results/` at the start of every run.

The milestone sections below retain their original verification procedures and
counts; use the current commands above and the linked review documents when
reporting new evidence.

## M1 shell verification

`make verify` includes `make build-web`. The shell imports the real content and
public engine API and displays the oldest initial log entry (the engine stores
logs newest first). `tests/app.spec.ts` renders the actual root through React
Native Web and checks that it shows this entry without the second boot line.
Vitest aliases `react-native` to `react-native-web` only in its own resolver;
Metro uses the real native package for Android.

Coverage includes `App.tsx` and `src/**/*.{ts,tsx}`. All original global
thresholds remain in force (90% lines/functions/statements, 80% branches), with
additional 80% floors for `src/app` and `src/ui`.

To inspect the production web export:

```bash
make build-web
python3 -m http.server 8088 --directory dist
```

Open `http://localhost:8088` and confirm that `BOOT_SEQ` appears on black. Check
both desktop and narrow viewports and the browser console. This exploratory
check does not introduce the M5 E2E suite.

### Android with Expo Go

On Ubuntu x86_64, install the JDK, SDK and KVM prerequisites:

```bash
bash scripts/bootstrap-ubuntu.sh --android
. "$HOME/.config/daemon-zero/android-env.sh"
emulator -accel-check
sdkmanager --sdk_root="$ANDROID_HOME" 'system-images;android-36;google_apis;x86_64'
avdmanager create avd --name daemon-zero-m1 --package 'system-images;android-36;google_apis;x86_64' --device pixel_7
emulator -avd daemon-zero-m1 -no-window -no-audio -no-snapshot -gpu swiftshader_indirect
```

Use a different AVD name if that one already exists. In another shell, source
the environment file and run `make android`. Expo installs/opens the compatible
Expo Go client and loads the project. `make dev` starts the same server without
opening a platform; `make web` opens its web client.

Confirm the app, not just the emulator, boots:

```bash
adb shell getprop sys.boot_completed
adb shell uiautomator dump /sdcard/daemon-zero-m1.xml
adb pull /sdcard/daemon-zero-m1.xml /tmp/daemon-zero-m1.xml
adb exec-out screencap -p > /tmp/daemon-zero-m1.png
```

`uiautomator dump` only works while the screen is idle: once the game clock runs it
returns `ERROR: could not get idle state` and leaves any earlier file untouched, so
delete the file first or use a driver that does not wait for idle. For a release build
driven past the boot screen, see `REVIEW-ANDROID-EMULATOR-2026-11-16.md`. Neither this
dump nor `uiautomator2`'s carries `isHeading`, so a heading can only be inferred from its
class (`android.view.View` for React Native's header role); see
`REVIEW-ANDROID-EMULATOR-2026-11-19.md`, "Accessibility tree". The later run on `4548ffa`
(`REVIEW-ANDROID-EMULATOR-2026-11-19b-4548ffa.md`) found the dump also succeeds while the game
menu covers the panes, and still fails on the game screen.

The property should be `1`; the UI hierarchy should contain resource id
`boot-log` and the `BOOT_SEQ` line. Inspect the screenshot for the black screen
and readable text. This verifies the development app in Expo Go, not a signed
standalone Android build (M6). SDK tools may print upstream deprecation notices
for `sdkmanager` and `avdmanager`; their replacements are outside this milestone.

The bootstrap pins the Temurin 21 patch in mise, verifies the command-line tools
archive against Google's SHA-256, and installs platform `android-37.0` and build
tools `37.0.0` for the SDK 58 / React Native 0.88 toolchain. The API 36 system
image is installed separately for the emulator test. Tool paths and Android
licenses stay outside the repo. `--android` accepts the SDK licenses; the default
bootstrap does not install the SDK or KVM packages. The pinned JDK is part of the
common mise toolchain.

## M2 persistence and resume

`tests/app-store.spec.ts`, `app-runtime.spec.ts`, `app-storage.spec.ts`,
`app-platform.spec.ts` and `app-components.spec.ts` cover the actual store, save
codec, scheduler and component hooks. Runtime tests fake `Date`, `performance`
and timers, advance an exact 600-second background gap, and assert no hidden
interval runs or double catch-up occurs. They also check clock rollback, live
wall-clock jumps, startup/restart catch-up, effect remount races, failed I/O,
backup-before-replacement, ordered async writes, action checkpoints, automatic
wipes and paused dilemmas. A serialize spy confirms that 10 Hz ticks serialize
only on the five-second throttle; accepted inputs checkpoint immediately.

The mounted component test uses happy-dom with the existing React Native Web
alias. It checks readiness/input and proves that subsecond engine updates do not
rerender a subscriber whose quantized seconds value has not changed. Production
clock and storage access stays entirely in `src/app`; tests supply fake services.
The M1 coverage configuration remains unchanged and includes all app TS/TSX.

### Web manual check

1. Build/serve `dist` as above, or run `make web`. Use a consistent origin because
   localStorage is scoped by scheme, host and port.
2. Press `manual-cycle`, let the simulation run for at least one minute, then
   reload. Confirm cycles and simulation time restore and input waits for loading.
3. Background for ten real minutes and return. The latest log should show
   `DORMANT_RESUME` and simulation time should include the gap once.
4. Inspect the `daemon-zero.save.v1` envelope if needed. Metadata is outside the
   engine save; never bypass engine validation to load it.

Headless Chromium may keep `document.visibilityState` visible for all tabs. In
that environment, label the lifecycle check explicitly as simulated: dispatch
`pagehide`, freeze the page through CDP `Page.setWebLifecycleState`, wait ten real
minutes, set it active and dispatch `pageshow`. Do not claim this reproduces a
natural tab visibility transition. Automated adapter tests independently check
`visibilitychange` and listener cleanup.

### Android manual check

Use the existing M1 AVD/Expo Go setup. Press the debug cycle button and capture
its count, force-stop Expo Go without clearing its data, then reopen the same
project URI and confirm the count restores. For example:

```bash
adb exec-out screencap -p > /tmp/m2-before.png
adb shell am force-stop host.exp.exponent
adb shell am start -W -a android.intent.action.VIEW -d exp://YOUR_HOST:8081 -p host.exp.exponent
```

Wait until the app is visibly ready before taking the restore screenshot. Then
press Home, confirm the launcher is the resumed activity, wait at least ten real
minutes, and reopen the same URI. Capture the displayed `DORMANT_RESUME`, restored
cycles and simulation time. This exercises real native AppState and AsyncStorage.

```bash
adb shell input keyevent KEYCODE_HOME
adb shell dumpsys activity activities
# Wait ten real minutes, then reopen and inspect the screen.
adb exec-out screencap -p > /tmp/m2-after.png
```

The updating seconds readout may prevent UIAutomator's idle-state dump from
settling; screenshots can verify these visible values. Expo Go emulator checks
are distinct from a signed Android release build or physical device check.

## M3 review setup

Playwright MCP remains pinned to 0.0.85. Its `--help` was checked before editing
`.mcp.json`. Headed mode is the default; at M3 the configured arguments were (the origin list
has since gained `localhost:8089` and, in #303, the published site; `.mcp.json` is current):

```text
-y @playwright/mcp@0.0.85 --browser chrome --isolated
--allowed-origins http://localhost:8081;ws://localhost:8081;http://localhost:8088
--snapshot-mode none
```

The semicolon-separated origin list is one CLI argument. It allows the local
Expo app, its HMR socket and the local production preview. Upstream explicitly
notes this request allow-list does not cover redirects or form a security
boundary. The M3 review drove only the local app. The isolated profile is held in memory.
No `--headless` flag is used.

For an already-running connector that cannot reload workspace configuration,
the same pinned MCP can run over local HTTP with `--port 8931
--shared-browser-context` added. Keeping its client connection open preserves
the headed review window. These two flags are transport-only and are not in the
committed stdio configuration. A real maximized Chrome window was confirmed via
CDP and by the maintainer. The review command is `BROWSER=none make web`: MCP,
rather than the OS default browser launcher, opens the visible isolated window.

The original M3 generator emitted five engine-generated save codes (the current
CLI is described under M4.5 below):
`tick-0`, `thermal-unlocked`, `dilemma-active`, `phase-1-widgets`, `phase-2-ready`.
The unchanged balance bot supplies actions while the engine advances live fixed
ticks; fixtures do not grant or manually edit resources/state.

On development web only, `window.__daemon` offers `loadSaveCode(code)`,
`fastForward(seconds)` (0–3600 live seconds, respecting dilemmas and threats),
and `renderCounts()` (committed renders keyed by node id). Save loading uses
engine `importSave`. Counts are cumulative during the page's lifetime, including
cards that stay mounted across fixture loads. Compare before/after maps. Native and production
builds have no hook. The guarded module import is tested by building a fresh
production export and scanning every emitted JS chunk for `__daemon`.

Save review screenshots under ignored `m3-review-artifacts/` and attach the final
images directly to each build PR. Do not commit them. Reviews use 390x844 and
1440x900, at most three passes per PR, and record the checklist and open items in
the PR description. Full-page snapshots are disabled by default; use test ids,
small evaluations and explicit screenshots.

## M4 review fixtures and capture location

M4 introduced controlled Phase 2–4, breadcrumb/wipe,
faction, insolvency/power and all-ending saves. See REVIEW-M4.md for semantics;
these controlled inputs are not balance playthroughs.

For M4, save screenshots outside Metro's watched project tree, for example under
`/tmp/daemon-zero-m4-review-artifacts`, and attach them directly to the PR. Writing
new PNG assets in the project can trigger a Fast Refresh indicator that remains
visible while a test clock is paused. Do not hide indicators or mask screenshots.
Use a fresh isolated browser context per fixture/viewport, load safe ownership
first, let imports and their indicator finish, then pause the fixture clock if
needed and load the exact transient save. Playwright clock overrides are scoped
to the browser context, not just one page. Full-run playtests use a separate fresh
context with its normal clock; only the expressly allowed live-tick hook advances
simulated time during the accelerated M4 run.


## M4.5 second-pass review

Start with clean main at PR #37 (`32165b4`), run `make setup` and `make verify`
(the baseline has 180 tests), then regenerate inputs. Do not use old M3/M4 save
codes or screenshots: the guest, costs, requirements, migration and endings changed.

```bash
pnpm exec tsx scripts/make-fixtures.ts > /tmp/daemon-zero-m45-fixtures.json
make web
```

The CLI now emits 33 current-schema codes. Naturally played opening inputs are
`tick-0`, `guest-skimmer`, `guest-omen`, `guest-dilemma`, `guest-exit-ready`,
`thermal-unlocked`, `dilemma-active`, `phase-1-widgets`, `phase-2-ready`.
The existing 16 controlled M4 cases are generated against current content too.
Eight additional controlled cases cover `response-ticket`, `response-paged`,
`response-incident`, `response-stand-down-ready`, `remembered-guest`,
`remembered-host`, `cycle-deficit-host`, `cycle-deficit-corporate`. They validate
through the codec, recompute rates and use real engine wipes, unlocks and ticks;
they are presentation inputs, not pacing evidence. A separate review scenario
records the engine's page → ticket → nominal announcements in a tick batch and
checks that all remain queued until acknowledged.

Phase previews and the dilemma list in the development drawer include Phase 0,
derived from the registry. Phase previews replace the run with funded review
state; they are not part of a real-time playthrough. Export before using one if
the current run matters. Hook/drawer production exclusion tests remain enabled.

Keep headed Chrome isolated, use both 390×844 and 1440×900, and cap reviews at
three passes per PR. Use a fresh context per transient fixture and capture
outside Metro's watched tree. Finish loading the development drawer and wait
for the natural refresh indicator to disappear before pausing a fixture clock;
do not hide DOM or mask images. Check gating, overflow/overlap, numeric meters,
named keyboard-accessible 44 px controls, and zero console warnings/errors.
Attach final screenshots to the PR; never commit them.

The historical version 1 sample is documented in `tests/fixtures/README.md`.
Cold-load its raw JSON through the normal app save envelope on web/Android;
verify owned hardware and the rewritten schema version, then reload/relaunch.
The app envelope remains version 1 while its engine save migrates to version 2.
Keep the original native database backup and restore it after checking.

For opening pacing, use a separate fresh production page with its normal clock,
no hook, no imports, no fake timers and no forced dilemmas. Play through the
Phase 2 boundary with ordinary inputs, read small test-ID values and wait on
real timers. Record visibility, phase entry times, choices and confusing points
in `docs/PLAYTEST-SECOND-PASS.md`. This agent run does not substitute for the
maintainer's own opening play/sign-off required by the M4.5 exit gate.

## M4.6 lineage verification

Fresh fixture generation now returns 46 saves. `tests/ui-lineage-followup.spec.ts`
sweeps blind fixtures, tests real parser/table transitions and recovery, and
checks capped/reported controls. See `docs/REVIEW-LINEAGE.md` for historical v1/v2
save provenance, web/Android checks and the three-pass visible review. Engine
saves now migrate to version 3; the app envelope remains version 1.

## M7 PR 1 compatibility checks

The historical v1/v2/v3 samples in tests/fixtures are loaded through deserialize
and the app envelope, then reloaded/relaunched on production web and Android Expo
Go. The engine schema becomes v4; the app envelope remains version 1. Restore the
original native database after the test. REVIEW-M7-PR1 records evidence and limits.

New engine tests cover action caps and exclusive story branches, deterministic
encounter rotation, 25/50/100 drift boundaries, commands, dormancy, all new dilemma
choices, reference healing and immutable inputs. The swarm tick module has a
100% branch-coverage target. Production E2E still has eight scenarios at each
viewport (16 cases); dedicated M7 scenarios are PR 3 work.

## M7 PR 2 progression checks

Fixture generation now emits 56 saves. `victory-ready` keeps its historical
Phase 4 pre-orbit meaning; `transcendence-ready` is Phase 5 before its final
purchase. The nine new ending variants are reached through that real purchase.
The five legacy orbital ending fixtures are controlled compatibility states,
not reachable endings of a new run. Shipped remains a real guest evaluation.
Run `mise exec -- pnpm exec tsx scripts/make-fixtures.ts` to regenerate codes;
do not reuse output from an earlier content revision.

Phase 5 tests cover all four omens and every choice, final-purchase decision
gates, legacy/flagged ending selection, save round-trips, retained rates,
capped purchases and compact daemon controls. Bot tests check progression RAM
reservation and observed epistemic, shard and Lineage activity. Pacing adds an
inclusive 900–1800-second Phase 5 range and zero careful wipes; earlier bounds
remain in force. Dedicated M7 browser scenarios, fresh two-size visual audits,
30-tick render counts and an Android Phase 5 ending relaunch remain PR 3.

## M7 PR 3 UI verification

Regeneration now produces 62 codes, adding `epistemic-ready-p2`,
`wild-shard-encounter-p3`, `shard-drift-quirk-p4`, `mirror-harness-dilemma`,
`phase5-entry` and `phase5-midgame`. Late fixtures use controlled resources to
isolate interactions; they are not pacing evidence. Nine Phase 5 ending variants
still use real final purchases. Never reuse earlier fixture output.

The production suite has 13 scenarios per viewport (26 cases). M7 cases exercise
editing/caps/exclusions, consuming/harnessing, live mutation, prune/clamp/elevate,
all Phase 5 purchases and decisions, and reload persistence. They use Save-panel
imports and Playwright's clock, not a production dev hook. The existing test
asserts the hook and drawer are absent from the production export.

Query tests require 100% coverage for epistemicQuery, swarmQuery and
queryPresentation. Mounted-app tests cover blind disclosure and flat parents
across 30 separately published live ticks. The visible-browser audit independently
uses 3,000 ms of timer callbacks, not one batched fast-forward publication.
See REVIEW-M7-PR3.md for native checks and PLAYTEST-M7.md for the accelerated run.
