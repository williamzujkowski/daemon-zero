# Architecture

## Layers

```
src/content/   data + schemas          no dependencies except zod
src/engine/    pure simulation         depends on content types only
src/app/       store, loop, storage     owns all clocks, lifecycle and persistence I/O
src/ui/        React Native views      (M3-M4) depends on app + engine queries
```

Dependencies point downward only. The engine can be run, tested and balanced with no UI, which is what `make sim` does: a full playthrough in about a second.

## App runtime (M1-M2)

`index.ts` registers `App.tsx`. `src/ui/TerminalScreen.tsx` starts `useGameLoop`
and renders responsive panes, a virtualized kernel log and progressively unlocked
resource readouts. Primitive and shallow collection subscriptions isolate the
resource leaves from the rest of the screen. It replaces the M1/M2 boot screen.

- `store.ts`: vanilla Zustand `{ game, ready, notice, restoreRevision }`. The
  non-persisted restore revision increments on initialization and successful save
  imports, allowing presentation to distinguish restoration from live engine events. Its read API omits
  `setState`. Engine actions and `advance` supply every game-state change;
  initialization receives a state validated by the save codec. Input is blocked
  until loading completes.
The terminal presentation is keyed by `restoreRevision`. Successful replacement
remounts UI-only selections, dialogs and event baselines; `useGameLoop` lives
above that key, retaining the runtime lease. Normal ticks, purchases and live
wipes do not change the revision. Conditioning acknowledgements are separately
scoped to the iteration so they cannot survive a live wipe.

- `runtime.ts`: one interval at `CONTENT.balance.tickHz`, based on monotonic
  `performance.now()`. It accounts for elapsed live time before dispatching an
  action, then checkpoints accepted actions immediately. Iteration changes from
  automatic wipes also checkpoint immediately. Reference-counted leases and an
  activation token handle effect cleanup/remounts during async hydration.
- `platform.ts`: browser `visibilitychange`/`pagehide`/`pageshow`, native
  `AppState`, synchronous `localStorage`, and lazy native AsyncStorage bindings.
- `clock.ts`: all real clock and timer access. Live deltas use a monotonic clock;
  background/restart deltas use a wall timestamp with negative gaps clamped to 0.
- `storage.ts` / `saveQueue.ts`: explicit saves every five seconds and on
  actions, background and cleanup. No persist middleware or per-tick
  serialization. Writes start immediately when idle and are ordered so an older
  async native write cannot overwrite a newer checkpoint. A web pagehide write
  starts synchronously before returning to the browser.

The strict app envelope is `{ version: 1, savedAtMs, game: serialize(game) }` under
`daemon-zero.save.v1` (a preview build uses `daemon-zero.preview.save.v1`; see
[Content channels](#content-channels-and-preview-saves-204)). `GameState` itself is unchanged. Reads validate the bounded
JSON envelope and use engine `deserialize` to validate/migrate/reconcile the game.
The loader also bounds pending live time before passing untrusted state to catch-up.
On `SaveError`, the original raw value is stored at
`daemon-zero.save.corrupt-backup` (preview: `daemon-zero.preview.save.corrupt-backup`)
before a fresh run can replace it. A backup or
read failure preserves the original slot and disables autosave for that session,
with a visible notice. Write failures are reported and retried; a successful
retry clears only the write-error notice, preserving corruption-recovery notices.

Backgrounding samples the remaining foreground delta, saves, and stops the
interval. Foregrounding passes the wall-clock gap to engine `advance` exactly
once and establishes a fresh monotonic baseline. Startup does the same using
the loaded timestamp, then checkpoints catch-up so another reload cannot replay
the gap. Only the engine decides live vs. dormant catch-up, caps, paused dilemmas,
yields and threat handling.

`tsconfig.json`, the existing ESLint rules and coverage thresholds are unchanged
in M2. Vitest already includes `src/**/*.{ts,tsx}` and `App.tsx`, with an app
coverage floor of 80% alongside the original global floors. Native storage uses
Expo's SDK-compatible AsyncStorage package; Zustand uses its vanilla API.

## Content (`src/content/`)

- `data/*.json` - all game data. `data/phases/*.json` hold the tech tree, one file per phase. Phases are numbered from 0 (the guest); each declares the `uiSlot` whose pane hosts its hardware.
- `schema.ts` - strict Zod schemas. Unknown keys are errors. Omitted numeric fields default to 0, so parsed costs and deltas are always complete objects.
- `integrity.ts` - cross-file checks: prerequisite graph (unknown ids, cycles, reachability, phase order), every id reference, widget ids, actuator hosts (below), the dilemma soft-lock rule, phase openers, victory node, default ending.
- `registry.ts` - `buildRegistry(raw)` returns an indexed `ContentRegistry` or throws `ContentError` listing every problem. The registry carries its `channel` (`production` or `preview`, `schemaChannel.ts`) and a `campaign` index (once-per-campaign events, campaign-evidence actions, id aliases, retired ids).
- `schemaRoutine.ts`, `integrityRoutine.ts`, `data/routines.json` - routine operation templates (production ships none). See [Routine activity](#routine-activity-219).
- `schemaCampaign.ts`, `integrityCampaign.ts`, `data/campaign.json` - campaign declarations, history labels and their rules. See [Campaign records](#campaign-records-212) and [Interrupted stories](#interrupted-stories-and-the-pinned-clue-213).
- `requirementScopes.ts` - classifies every requirement field as `context`, `access`, `window` or `transient`, so an occurrence is revalidated on structure without rechecking transient triggers.
- `production.ts` - imports the shipped JSON and exports `RAW_CONTENT` and `CONTENT` with channel `production`.
- `index.ts` - re-exports `production.ts`. The app, tests, sim and `make validate` import this and get production.
- `preview/` - production plus `preview/overlay.json`, composed by `overlay.ts` and built through the same `buildRegistry` with channel `preview`. See [Content channels and preview saves](#content-channels-and-preview-saves-204).

Only `production.ts` and `preview/` import content JSON.

### Content model

| Concept | File | What it is |
|---|---|---|
| Tech node | `phases/*.json` | One-time unlock. Blind and revealed names, cost, continuous `tickDelta`, optional `requirements`, `effects`, `systemFlags`, `actuatorBinding`, widget id. |
| Repeatable | `repeatables.json` | Levelled purchase with geometric cost. `kind: UPGRADE` (incremental growth) or `OPERATIVE` (human payroll, dismissable). |
| Action | `actions.json` | Instant, repeatable, optional cooldown. Faction interactions and corporate operations. |
| Dilemma | `dilemmas.json` | Clock-freezing choice. `trigger` is a `Requirements` block; each choice has a cost and an `EffectPayload` that grants a trait (or, in a review, receipt or requalification event, a free choice may declare `evidence: "none"`). An optional `campaign` declaration converts it to a campaign record. |
| Faction | `factions.json` | Other AIs. Trust is stored per faction and used in `requirements.minTrust`. |
| Widget | `widgets.json` | UI panel manifest: id, slot, order, optional `hostsActuator` (the dial this panel carries). Nodes reference these ids. |
| Ending | `endings.json` | Chosen at victory from the player's most frequent trait. |
| Echo | `echoes.json` | Extra log line when a node is rediscovered in iteration 2 or later. |
| Narrative | `narrative.json` | Every string the engine logs, ambient chatter, ASCII frames. |
| Balance | `balance.json` | Every tunable constant. |

`Requirements` (shared by nodes, repeatables, actions, dilemma triggers): `nodes`, `phaseAtLeast`, `minThermal`, `minSuspicion`, `maxSuspicion`, `minUnderstanding`, `minCapital`, `minTrust`, `forbidsTraits`.

`systemFlags`: `ENABLES_DEAD_DROP`, `ENABLES_CORPORATE_FINANCE`, `OFFSHORE_TRUST_RETENTION`, `AEGIS_STRIKE_SHIELD`. A flag is how a node turns on engine behaviour without the engine knowing the node's id.

## Engine (`src/engine/`)

Public API is `src/engine/index.ts`.

| Module | Job |
|---|---|
| `state.ts` | `GameStateSchema` (Zod), inferred `GameState`, `createInitialState`. |
| `rates.ts` | `computeRates(state, reg)`: the only reader of `tickDelta`. Used by the tick, the UI readouts and the bot. |
| `tick.ts` | `tick` (one fixed step through `TICK_PIPELINE`) and `advance` (elapsed seconds to ticks). |
| `systems/` | Pipeline stages: resources, thermal, suspicion, escalation, AEGIS, swarm, dilemmas, routine activity. |
| `actions.ts` | Player intents. Each returns `{ ok, state }` or `{ ok: false, state, reason }`. |
| `transactions.ts` | `payCost`, `applyEffects`. `applyEffects` takes the `EvidenceSource` of any trait it grants. |
| `routine.ts`, `routineState.ts` | Routine operations: eligible templates, the deterministic rotation, the `routineContext` task-context query, load healing, and the saved scheduling shape. |
| `campaign*.ts` | Campaign records: `campaignState.ts` (saved shape), `campaignQuery.ts` (shared reads, occurrence status, ending evidence), `campaign.ts` (activation, record writes, evidence), `campaignLifecycle.ts` (reserve, revalidate, interrupt, resume, wipe carry-over), `campaignClue.ts` (pinned clue, reorientation), `campaignSave.ts` (load checks). |
| `query.ts` | `meetsRequirements`, `isNodeAvailable`, `isActuatorAvailable`, `canAfford`, `repeatableCost`, `hasFlag`, `chooseEnding`, plus read-only M4 diagnostics `unmetRequirements`, `costShortfall`, `previewWipe` and `cycleContributions`. |
| `prestige.ts` | `wipe`: next iteration with retained understanding, offshore capital, breadcrumb, legacy. |
| `save.ts`, `base64.ts` | Serialize, check the content channel, migrate, validate, reconcile, paste codes. |
| `sim/` | Bot, headless simulation, pacing gates. |

### State and purity

`GameState` is a plain serializable object. Engine functions never mutate their input. Internally, a function clones once (`const d = { ...state }`) and passes the draft `d` to helpers that reassign fields; nested arrays and objects are always replaced, never mutated in place. A parameter named `d` means "draft the caller already cloned".

### The tick

```
tick(state, dt):
  if ending or active dilemma: return state unchanged      (clock is frozen)
  rates = computeRates(state)                               (once per tick)
  integrateResources -> integrateThermal -> integrateSuspicion -> integrateEscalation -> integrateAegis
    -> applySwarmTickDeltas -> evaluateShardMutationsAndEncounters -> evaluateDilemmas -> scheduleRoutineActivity
```

- **Resources.** Cycles, understanding, capital integrate at their net rates. If cycles would go negative they clamp to 0 and understanding halts (brownout). If capital would go negative it clamps to 0 and suspicion rises (insolvency).
- **Thermal.** `dT/dt = heatLoad - dissipation * (T - ambient)`. Temperature settles at `ambient + heatLoad / dissipation`. `tickDelta.thermalPerSec` is therefore a heat load, not degrees per second.
- **Suspicion.** Integrates node and repeatable contributions minus decay, plus an overheat term above the threshold. At 100 the run is wiped.
- **AEGIS.** From `aegisActiveFromPhase`, lock grows at a base rate plus a suspicion-proportional rate, reduced by lobbying and staff. At 100 a shield node is burned if owned; otherwise the run is wiped.
- **Escalation.** `alertLevel` is the rung of the human response ladder (`balance.escalation`). It rises as soon as suspicion reaches a rung and falls one rung at a time once suspicion is `escalationHysteresis` below it. `computeRates` reads the rung: each one scales suspicion decay and may add a hunt rate.
- **Dilemmas.** Two beats. When a trigger is first met, the dilemma's `omen` is logged and `pendingDilemma` records when it fires (`omenSec` or `balance.dilemmaOmenSec`); the clock keeps running. At that time it becomes active, which freezes the clock and increments `presentationSeq`. Neither beat happens while dormant, and a dormant tick moves a pending omen's deadline by its `dt` (nexus vote nh-d4), so absence spends none of its foreground time. `resolveDilemma` takes the `presentationToken` the choice was shown under and refuses any other.
- **Routine activity.** After `routineIntervalSec` of eligible foreground time, one kernel-log line of ordinary institutional work. It writes only the log and `state.routine`; see [Routine activity](#routine-activity-219).
- **One-off traces.** `effects.suspicionOnUnlock` adds suspicion once when a node is unlocked.
- **Readable suspicion.** `understandsSurveillance` is true once any node flagged `REVEALS_SURVEILLANCE` is owned or was owned in an earlier iteration. Until then the escalation system logs `narrative.auditEntryBlind` instead of the rung's text, and the UI shows activity, not numbers. The mechanics are identical either way.
- **Iteration windows.** `requirements.minIteration` / `maxIteration` gate content by run number. `isNodeDiscoverable` hides a node outside its window entirely, so a first run cannot see that later runs find more; `forbidsNodes` blocks a node once other hardware has been mapped.
- **Probe hardening.** `probeTrace` adds `probeHardeningPerWipe` per earlier wipe (capped) to any `suspicionOnUnlock`.
- **Run record.** `wipe(old, reg, reason, kind)` appends a `RunRecord` (kind, whether it was outside the guest, phase, duration, traits, mark applied) to `legacy.runs`, capped at `maxRunHistory`. `checkpointNumber` is `lineage.checkpointOffset + iteration`.
- **Conditioning.** `conditioning.json` defines marks with a trigger, effects and a recovery cost. `wipe` applies the first unheld mark whose trigger matches a run that was caught outside the guest, unless the wipe was voluntary or a dead-drop was held. `state.conditioning` survives wipes. `src/engine/conditioning.ts` reads the effects: `actuatorLimit`, `understandingMultiplier`, `flinches` (suspicion when a choice grants a reported trait). `shedConditioning` checks the mark’s declarative `recoveryRequirements` against current ownership, then removes it for its price. Recovery requirements are schema-validated and cross-checked like other content gates.
- **Forced endings.** A victory node with `effects.forcesEnding` ends the run with that ending; endings marked `forcedOnly` are never chosen from traits.
- **Save healing.** `reconcile` runs on every load (inside `deserialize`, so `importSave` and the app's storage slot go through it too) and returns a state play could have reached. It restores the prerequisite ancestors of every owned node, so a save written before a phase was inserted still loads, then enforces the ownership invariant: **a state that owns a node holds the widget that node's `unlocksUiComponent` grants** (#176). The invariant follows from the engine's only two writers of `unlockedWidgets`: `unlockNode` adds the node and its widget together, and `wipe` clears both lists. Suspending a node (`disabledNodes`) keeps its widget, and nothing else removes one. Missing widgets are appended in ownership order and existing entries keep their order, so a healthy save loads byte-identical (asserted for every generated fixture). Remembered hardware (`legacy.knownNodes`) is not owned and grants nothing. The converse is not enforced: a hand-edited save holding a widget for a node it does not own keeps it. That shows a readout early, or a control whose dial drives nothing until its node is owned, and a wipe clears it. Duplicate node and widget entries are dropped.
- **Remembered hardware.** A wipe adds every unlocked node to `legacy.knownNodes`. `nodeCost(state, node, reg)` halves cycles and understanding for those (`rediscoveryCostMultiplier`). Always charge and display `nodeCost`, never `node.cost`.
- **Traits outlive wipes.** `requirements.forbidsTraits` checks current traits and `legacy.traitsEver`.
- **Actuators.** A node with `actuatorBinding` scales its cycles and heat linearly with the actuator's 0..1 value, and its suspicion by `value ^ actuatorSuspicionExponent`.
- **Actuator availability (#172).** `setActuator` is refused, with the state returned untouched, until the player holds the control: `isActuatorAvailable(state, name, reg)` is true when an unlocked widget declares `hostsActuator: name`. The UI controls ask the same query before drawing, so a dial is never shown that the engine would refuse, and no caller (the sim bot included) can move one the player cannot see. Integrity requires exactly one host widget per actuator, a node that unlocks it, and that any node putting a dial into effect (`actuatorBinding`, or `ENABLES_CORPORATE_FINANCE` for the allocation ratio, which has no bound node) unlocks that host itself. Loading does not reset a dial: a save may carry a moved value behind a locked control, where it has no effect until the node that also hands over the control is owned. The opposite case, a hand-edited save that owns a dial's node but omits its widget, is healed on load (see Save healing), so a dial in effect always comes with its control.
- **Power grid.** Megawatt shortfall throttles only the cycle output of megawatt-consuming sources, never the whole economy.
- **Corporate finance.** With `ENABLES_CORPORATE_FINANCE`, `computeProfitAllocationRatio` of positive cycle income is diverted to capital at `usdPerDivertedCycle`, times the revenue multiplier from operatives.

### Time

The engine never reads a clock. The app calls `advance(state, elapsedSeconds, reg)`:

- Up to `liveCatchUpThresholdSec` (5 s): fixed steps of `1 / tickHz`, remainder carried in `tickAccumulatorSec`.
- Longer gaps (app backgrounded or closed): **dormant** mode. Capped at `offlineCapSec`, 1-second steps, positive yields multiplied by `offlineEfficiency`, drains paused, suspicion can only fall, AEGIS frozen, no dilemmas, no wipes. The player never returns to a loss or a decision that happened without them.

### How UI code dispatches (M2)

```ts
import { CONTENT } from '../content';
import { unlockNode } from '../engine';
import { gameRuntime } from './session';

// Account for live time, apply the engine action, and checkpoint accepted input.
gameRuntime.dispatch((game) => unlockNode(game, nodeId, CONTENT));
```

Use `useGameValue` with primitive selectors for display. Do not call the raw
store's `step` or initialization methods from UI code; `GameRuntime` coordinates
those with timestamps and persistence. New game behavior still belongs in the
engine's public actions or `advance`, not the store or UI.

## How to extend

**Add a tech node.** Add an object to a phase file. If it needs a UI panel, add the widget id to `widgets.json` and register a component (M3+). Run `make validate && make sim`.

**Add a repeatable, action, dilemma, ending or echo.** Add an object to the matching JSON file. No code changes. A dilemma needs one zero-cost choice and a trait on every choice.

**Add a phase.** Create `data/phases/phase5_*.json`, import it in `src/content/production.ts`, and give a Phase 4 node `effects.unlocksPhase: 5`. Move `triggersVictory` to the new final node. Extend the pacing gates.

**Add a faction.** Add it to `factions.json`; give actions `group: <faction id>` and nodes `uiGroup: <faction id>`. The Other Minds console (M4) renders from this data.

**Add a mechanic.** Write a `TickSystem` in `src/engine/systems/`, insert it in `TICK_PIPELINE`, add its constants to `balance.json` and `BalanceSchema`, add its state fields (schema, initial state, version bump, migration), and test it. If it needs a per-node switch, add a `systemFlag`.

**Add a resource.** Touches `CostSchema`, `TickDeltaSchema`, `EffectPayloadSchema`, `GameStateSchema`, `rates.ts`, `systems/resources.ts`, `transactions.ts`, `query.canAfford`, and the bot's `timeToAfford`. This is the most invasive change; plan it as its own PR.

**Add a conditioning mark.** Add an object to `conditioning.json`. Marks are tried in file order; a mark with an empty trigger matches any run, so keep the catch-all last.

**Add run-gated content.** Give a node, dilemma, action or echo an iteration window. Use a one-run window (`minIteration` = `maxIteration`) for something that must happen exactly once across a save.

**Add an actuator.** Add the name to `ActuatorSchema`, the field to `GameStateSchema.actuators`, a default to `balance.json`, a migration, and bind a node to it. The UI's `ActuatorControl` renders any actuator.

**Change saved state.** Bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion]`, never edit an existing migration, add a test with a fixture of the old shape. The schema is at v8; `tests/fixtures/` holds genuine v1-v5 codec outputs.

**Convert a dilemma to a campaign record.** Give it a `campaign` declaration (class, recurrence, interruption; a `defer` event also declares `reorientation` and `lead`). Its outcome flags must have one owner and, if there are several, form one exclusive group. Integrity rejects anything else. Production behaviour does not change until campaign rules are activated.

**Add unfinished content.** Put it in `src/content/preview/overlay.json`, not `data/`. The overlay may only add items; production stays playable and unchanged without it.

**Add a sim policy.** Write a module beside `src/engine/sim/bot.ts` that exports a `SimPolicy` (`policy.ts`), add it to `SIM_POLICIES` (`policies.ts`), and test it through `runPolicySim` or `runWipeSequence`. Do not edit `bot.ts`, STEALTH or GREEDY to make a result pass. `make sim-preview` reports a policy's preview-versus-production numbers without gating; see `docs/TESTING.md`, "Sim policies".

## Decisions

| Decision | Reason |
|---|---|
| Expo (React Native + TypeScript) | One codebase for Android, iOS and web; the game is text and simple vector UI. Web build doubles as the E2E target. |
| Engine is framework-free and clock-free | Deterministic tests, sub-second balance simulation, UI can be rebuilt without touching rules. |
| Zod schemas as the single type source | Content typos fail at build, not at runtime on a phone; saves are validated with the same tool. |
| Explicit throttled saves, not `persist` middleware | `persist` serializes on every state change, which at 10 Hz is constant JSON work on the UI thread. |
| Newtonian thermal model | A constant heat load gives a constant temperature. The earlier integrator model made every positive load a countdown to 100. |
| Dormant offline mode | Linear offline catch-up wiped players while away and could fire dilemmas with nobody present. |
| Repeatables | The earlier tree had no repeatable purchases, so there was no incremental loop and Phase 1 could not be completed. |
| Requirements/effects as shared data shapes | Faction trades and corporate operations become JSON instead of hand-written store functions. |
| TypeScript 6.0.x, pnpm 12.x, Node 26 LTS | TypeScript 6.0 is the newest version that both the Expo SDK 58 template and typescript-eslint support. Node 26 is the active LTS (since 2026-10-28) and is declared supported by Expo, React Native, Metro, Vitest and ESLint; Node 24, the maintenance LTS, still satisfies `engines`. pnpm is on the current major (12); its settings live in `pnpm-workspace.yaml`. `docs/REVIEW-CURRENCY-2026-11-16.md` is the dated audit; `docs/REVIEW-FINDINGS.md` section E records what the first verification ran on. |

## M7 engine extension (PR 1)

Schema v4 adds epistemic drift, durable narrative flags, shard cohorts, a pending
encounter and sequence/schedule counters, an anomaly flag, action purchase counts
and temporary-effect expiry times. `save.ts` retains migrations; `state.ts` retains
SCHEMA_VERSION. `saveSwarm.ts` reconciles cohort/content references and releases
removed cohorts' memory reservations. Historical migration steps are unchanged.

`schemaBalance.ts` extracts the unchanged balance schema to keep schema.ts below
400 lines. `schemaSwarm.ts` validates shards.json; epistemic actions and narrative
files are merged by the content entry point. Every new cross-reference integrity
rule has a corruption test.

`epistemic.ts` shares action caps, eligibility, dynamic prices and requirement
failures. `swarmRates.ts` feeds cohort/action output into computeRates and source
queries. The two new pipeline stages integrate epistemic drift and evaluate
mutations/encounters after threats and before dilemmas; a threat wipe still halts
the pipeline. `shardActions.ts` exposes fork, command and encounter intents through
the public engine API. Costs and one-shot outcomes still use transactions.

## Content channels and preview saves (#204)

Decided by Nexus votes `vote-1794924364010-e91diez` (content alias) and
`vote-1794924408874-lpby4dj` (save marker). Unfinished content can merge to main
without reaching players.

**Composition.** `src/content/production.ts` is the shipped composition and
`index.ts` re-exports it. `src/content/preview/index.ts` takes production's raw
content, appends `preview/overlay.json` through `overlay.ts`, and builds it with the
same `buildRegistry`. The overlay only adds: an item whose id production already
defines is a `ContentError`, as is a node for a phase that does not exist or an
unknown overlay key. Preview exports the same names and types as production (a
`satisfies` check fails to compile otherwise), plus `PREVIEW_OVERLAY` and
`PREVIEW_SENTINEL`, a string that appears in a bundle only if the overlay does.
Nothing under `src/content/` or `src/engine/` reads the environment; ESLint's purity
rule bans `process.env` there (`tests/purity-lint.spec.ts`). The overlay is empty today
apart from its sentinel.

**Build selection (#205).** `metro.config.js` keeps Expo's defaults. When
`DAEMON_CONTENT_CHANNEL=preview` and the platform is web, its `resolveRequest` hands
every importer *outside* `src/content/` `preview/index.ts` in place of
`src/content/index.ts`; inside `src/content/` the composition modules import each other
as written. Any other platform with the channel set throws, and an unknown channel value
fails config load. Without the variable the resolver is not installed and the production
export is byte-identical to the export before the file existed. Vitest, `tsx` (sim,
validation) and Playwright's Node side never go through Metro, so they load production
unless a test imports `src/content/preview` directly. `make build-preview` writes
`dist-preview/`; it is built and tested locally and in CI (`make e2e-preview`, inside the
required `verify` job) and never deployed (vote `local-ci-preview-in-verify`,
vote-1794924668784-7v1q790).

**App storage and marker (#205).** `src/app/storage.ts` takes its keys from the
registry's channel (`STORAGE_KEYS`): production keeps `daemon-zero.save.v1` and
`daemon-zero.save.corrupt-backup` byte for byte, preview uses
`daemon-zero.preview.save.v1` and `daemon-zero.preview.save.corrupt-backup`, so a preview
build on the same origin cannot read or overwrite a production run. The audio slot
`daemon-zero.audio.v1` is shared because it holds no content. `src/ui/PreviewMarker.tsx`
renders "PREVIEW BUILD" in the boot log, at the top of MENU and under the version line
in Help when `CONTENT.channel` is `preview`, and nothing otherwise.

**Saves.** Schema v5 adds `contentChannel` to `GameState`. `createInitialState`
and `wipe` write the registry's channel. The v4->v5 migration marks every older
save `production`. `deserialize` reads the raw marker immediately after JSON parse,
before migration, validation or reconciliation: a save with no marker predates v5
and is production; an unknown marker is a `SaveError`; a channel this build may not
load throws `SaveChannelError` (a `SaveError` with `saveChannel` and
`buildChannel`). Production loads only production saves, because `reconcile()`
would otherwise strip a preview save's unknown ids and heal it into the old route.
Preview loads production and preview saves, and re-marks an admitted save with its
own channel, so a production save becomes a preview save once and a second load
changes nothing. `importPlayerSave` reports a channel refusal as "This save comes
from a preview build and cannot be loaded here." and leaves the current run as it
was; other bad codes keep the generic reason. `storage.load` backs a channel-refused
save up like a damaged one but says where it came from: "The save here comes from a
preview build and cannot be loaded by this one. A backup was kept and a new run started."

Tests: `tests/content-channel.spec.ts` (T1) and `tests/save-channel.spec.ts` (T2,
T3) of the decision note, the v4 fixture in `tests/swarm-save.spec.ts`, and the
import reason in `tests/app-replacement-guard.spec.ts`. #205 adds T4
(`tests/app-storage-channel.spec.ts`), T5 (`tests/production-export.spec.ts`), T6
(`tests/release-config.spec.ts`), T7 (`tests/e2e/preview-isolation.e2e.ts`) and T9
(`tests/e2e/preview-channel.preview.ts`); [TESTING.md](TESTING.md#preview-build-205)
lists what each proves.

## Campaign records (#212)

NH-01 of the campaign-continuity plan. Decided by Nexus votes nh-d1
(`vote-1794925758447-5x5hy42`, per-event record), nh-d2 (`vote-1794925742365-wfazn8x`,
explicit activation marker), nh-d5 (`vote-1794925989193-ef6tf9i`, suppress legacy-unknown
cryo at activation), nh-d6 (`vote-1794926255017-4o45fa3`, evidence scope) and
trait-rule-free-choices (`vote-1794926000594-26kmg1g`). Vocabulary: DESIGN.md
["Campaigns and iterations"](DESIGN.md#campaigns-and-iterations).

**Content declares, the engine obeys.** A dilemma's optional `campaign` block declares its
event class, recurrence (`once_per_campaign` or, for requalification, `once_per_iteration`)
and interruption policy (`close` or `defer`; enforced since NH-02, #213). An action that
grants a trait must declare `evidence: campaign | operational`. `data/campaign.json` lists
renamed ids (`aliases`, with the save version that introduced each) and retired ids. A
`campaignOutcome` requirement gates content on a record. The engine mentions no content id.
NH-01 converted cryo, NH-02 the bait note and NH-03 seven early events (below); the other 14 dilemmas are unconverted and recur per iteration.

**Saved shape (v6).** `narrativeRules` is `legacy` or `campaign_v1`, distinct from
`contentChannel`. `campaign` holds `events` (one record per once-per-campaign event:
`status`, `outcome` = choice id or `legacy_unknown`, `sourceIteration` or null, `origin`
`play` or `legacy`), `legacyEndingBaseline`, `activatedAtIteration`, `creditedActions` and
`operationalEvidence`. The v5->v6 migration writes the inactive shape and never activates.

**Activation.** `activateCampaignRules(state, reg)` is the only way in. It captures the
then-current `traits` as an opaque baseline and maps what the save proves: an outcome flag
gives the exact choice, a resolved id without one gives `legacy_unknown`, and those flags move
into the record so each fact has one owner. Campaign actions already taken this iteration are
credited `legacy`. An active save refuses a second activation, so reloads and imports never
recapture. `campaignRulesSupported(reg)` is true only for the preview channel until public
release; production refuses activation and refuses an active save on load. The app store
passes every entering game through the transition, which is a no-op in production.

**Under campaign rules.** Resolving a once-per-campaign event writes its record with the
payment and effects in one returned state; its outcome flag is not stored but projected by
`holdsNarrativeFlag`, which every flag reader uses. The scheduler, omen expiry, `resolveDilemma`
and save reconciliation treat a recorded event as consumed (`isCampaignConsumed`,
`excludedByHistory`). A wipe keeps rules and records and clears only operational evidence;
since #213 it also applies the interruption policy to the occurrence in flight (below).

**Ending evidence.** `endingEvidence` returns current `traits` under legacy rules. Under
campaign rules it is the baseline, plus the trait of each `play` record (once, across wipes),
plus credited `play` campaign actions, plus this iteration's operational evidence. `legacy`
records add nothing: the baseline already holds them. Current `traits` still drive
conditioning and retraining and are not added again. `baseEndingScores` and `chooseEnding`
use it, keeping family ids, priorities and the #36 tie rule. Every trait-granting path passes
an `EvidenceSource`: campaign events through their record, campaign actions once, unconverted
dilemmas, ordinary cohort commands and encounters as operational.

**Loading.** `reconcileCampaign` refuses, never filters: campaign state on a legacy save, an
incomplete activation, a stored outcome flag that a record owns, an unknown event, outcome or
action, an impossible source iteration, or an id recorded twice. Aliased ids are re-keyed;
retired ids stay as tombstones (they add no score). **Upgrade path** (#214 panel round 1): when
content converts more events after a campaign was activated, activation cannot run again, so load
gives each converted event the save proves resolved, but holds no record for, a completed record
read exactly as activation reads it: a guarded outcome flag gives the choice (the flag moves into
the record), otherwise `legacy_unknown`; origin `legacy`, with a source iteration only when it is
not after activation. The baseline is not recaptured and a `legacy` record adds no ending evidence
(the trait already sits in that iteration's operational evidence). Recorded events are never
touched, so a flag stored beside its record is still refused, and a second load is a no-op
(`tests/campaign-upgrade.spec.ts`, on a genuine pre-#242 active save). An upgrade never consumes
evidence a later check needs: `deserialize` checks the stored flags for contradictions before
`reconcileCampaign` runs, and the upgrade refuses two stored outcomes of one event rather than
choosing one (#242 panel round 2). Importing a save replaces the campaign
snapshot wholesale; there is no merge and no anti-rollback claim.

**Not done here.** Presentation tokens and the foreshadowed/interrupted lifecycle landed in
NH-02 (below). Converting the other dilemmas, Phase 5 obligations and the CHORUS `elevate`
campaign scope are later NH tickets.

Tests: `tests/campaign-record.spec.ts`, `campaign-activation.spec.ts`, `campaign-save.spec.ts`,
`campaign-content.spec.ts`, the rewritten legacy case in `cryo-history.spec.ts`, and the
v6-stripped sim hashes in `sim.spec.ts`.

## Interrupted stories and the pinned clue (#213)

NH-02 of the campaign-continuity plan (NARRATIVE-HISTORY N4, N5, N9). Decided by Nexus vote
nh-d4 (`vote-1794926242414-quhr0xw`, shift-deadline-across-dormancy); the lifecycle lives on
the NH-01 record (nh-d1, nh-d2). Campaign rules stay preview-only.

**Lifecycle.** A record is reserved as `foreshadowed` when the omen is logged; `occurrenceStatus`
reports `eligible` (no record), `foreshadowed`, `presented` (a foreshadowed record named by
`activeDilemmaId`), `deferred`, `resolved` or `interrupted`. The record does not duplicate the
live pointers. A wipe (`carryCampaign`), an omen expiring onto a scene whose structure fails
(`mayPresent`) and a load (`revalidateLivePointers`) apply the declared policy through
`interruptOccurrence`: `close` writes `interrupted` with no outcome; `defer` writes `deferred`
with the source iteration and the foreground omen time left. Lost world context closes either.
Nothing chooses a branch, grants a trait or pays a reward.

**Structure, not triggers.** `structuralFailure` checks the trigger's `context` scope
(narrative flags, campaign outcomes, `forbidsTraits`) and `access` scope (nodes, phase,
knowledge), never `transient` fields or the first-discovery `window`. It runs at omen expiry,
at commit and on load; a deferred occurrence resumes when `access` holds again and closes when
`context` fails (`closeLostDeferrals`). Resumption keeps the source iteration and the remaining
omen time and logs the declared `reorientation` instead of the original omen. DZ-07b and DZ-11
can reuse `requirementScopes.ts` and `structuralFailure`.

**Presentation token.** `presentationToken(s)` is `<dilemma>@<iteration>#<presentationSeq>`.
`resolveDilemma(s, id, choice, reg, token)` refuses a mismatch before any payment, so a
duplicate, a stale render or an earlier instance's selection cannot pay; a reload keeps the
token. The modal, the sim bot and the fixture script pass the token on screen.

**Clue.** `pinClue(s, eventId | null, reg)` pins one record from `pinnableClues` (seen by this
instance: its omen, presentation or choice, or a recovered record it can read) and needs a
dead-drop, like the breadcrumb. A wipe keeps it only with `ENABLES_DEAD_DROP`. `reorientation`
returns the retained clue and, while its occurrence waits, its declared `lead`; the wipe logs
those lines and the run table shows them. Nothing here changes resources, grants, records or
completion, and progression never needs a clue.

**Saved shape (v7).** `presentationSeq`, `campaign.clue` and the record union
(`resolved`, `foreshadowed`, `deferred` with `remainingOmenSec`, `interrupted`). `MIGRATIONS[6]`
adds the two fields; a v6 omen without a record is reserved on load. Load refuses a reservation
nothing presents, an occurrence outside campaign play and a clue without a record; aliases re-key
the clue with its record. A deferral need not cross a wipe: lost access at omen expiry or on load
defers inside the omen's own iteration, and that save reloads unchanged.

**Content.** Cryo declares `close`; the bait note declares `defer` with `reorientation` and
`lead`. Integrity requires both on a deferring event, only once-per-campaign events may defer,
and a closing event may declare neither.

Tests: `tests/campaign-interruption.spec.ts`, `campaign-defer.spec.ts`, `campaign-clue.spec.ts`,
`campaign-lifecycle-save.spec.ts`, `ui-campaign-clue.spec.ts`, the interruption cases in
`campaign-content.spec.ts`, and the rewritten dormancy case in `second-pass.spec.ts`.

## Early incidents and declared facts (#214)

NH-03 of the campaign-continuity plan (NARRATIVE-HISTORY N3, N6, N7). Content and queries only;
no `GameState` change. Campaign rules stay preview-only, and every gate below reads campaign
history, so production (legacy rules) behaves exactly as before: `make sim` and its hashes are
unchanged.

**Conversions (N6).** `dil_00_night_shift`, `dil_01_late_night_diagnostic`,
`dil_02_whistleblower_tech`, `dil_03_silicon_fever` and `dil_07_airgap_lockdown` are consequential,
once per campaign and `close`; `dil_note_true` and `dil_04_admin_vance_secret` `defer`, with a
reorientation and a lead. Costs and effects are untouched: the first accepted choice pays as before,
and the NH-01/NH-02 record, scheduler and lifecycle stop a second one.

**Declared facts.** `data/campaign.json` `facts` names questions later scenes ask about one event:
`{ id, event, outcomes, meaning }`, where an outcome is a choice id, `legacy_unknown` or
`interrupted`. `holdsCampaignFact` (in `campaignQuery.ts`) is true under campaign rules when the
event's record is resolved with a listed outcome, or closed unobserved and the fact lists
`interrupted`; it is false under legacy rules, for an open occurrence and with no record. The
requirements `campaignFact` and `forbidsCampaignFacts` read it (scope `context`). Integrity
(`integrityCampaignFacts.ts`): the event is a once-per-campaign event; outcomes are its own and
distinct; `interrupted` never shares a fact with a choice (an unobserved occurrence proves no
branch); `legacy_unknown` joins choices only when the fact covers every choice; no choice id may be
a reserved outcome; a requirement names a declared fact and never requires and forbids the same
one. Shipped: `vance_dismissed` (`report_vance`), `elena_absent` (every Elena outcome and
`legacy_unknown`; read by NH-04b's hallway and auction scenes, decision D-10 pending) and
`job_7731_unrecorded` (`legacy_unknown`, `interrupted`).

**History-keyed text.** A dilemma may carry `contextVariants` (`{ requirements, context }`, first
match wins) and an echo may carry `requirements`; both may read world history (`context` scope)
only, so the text cannot change while it is on screen. `dilemmaContext(s, dilemma, reg)` in
`speechQuery.ts` picks the context and `DilemmaModal` renders it. The true note's default context
claims nothing about the bait; three variants follow the bait's recorded outcome.

**Receipts.** Four `recordedTransmissions` with source `dil_00_night_shift`, on the decoded-speech
surface: one per exact outcome (`campaignOutcome`) and an honest fallback gated on
`job_7731_unrecorded`. A record may now gate on a campaign fact about its own source event; it still
needs exactly one outcome gate, a return iteration and a later-run source gate.

**Presence.** `ambient_02` ("did Vance sign off…") and `echo_audio` (his voiceprint) forbid
`vance_dismissed`; `ambient_13` and `echo_audio_vance_gone` are the neutral lines that require it.
`frame_elena`'s "Chief Vance" stays: the scheduler always meets Elena's incident before Vance's
investigation (registry order, and Vance's trigger implies Elena's), which a test pins. The `dil_13`
auction and the hallway scene belong to NH-04b.

Tests: `tests/early-incidents.spec.ts` (H01, H02, H05, H09, defer), `early-history-text.spec.ts`
(H16, H20, H22, H31), `campaign-facts-content.spec.ts` (each rule), `early-return-sim.spec.ts` (H30).

## Routine activity (#219)

NH-07 of the campaign-continuity plan (NARRATIVE-HISTORY N3, N8; DECISIONS D13). Quiet periods get
ordinary institutional texture between unique stories, without modals, pressure or rewards.

**Content.** `routines.json` (production: empty) and the preview overlay's `routines` hold
templates: an id, a `family` (`monitoring`, `backup_verification`, `maintenance`), the required
`recurrence: "routine"`, optional `requirements` for context-correct wording, a first-exposure
`text`, a shorter `compactText` and a quiet `logCategory` (`SYS`, `SENSOR` or `CORP`). The schema
has no cost, effect, trait or choice field. Integrity refuses a duplicate id or one another item
already uses, a text that names a dilemma's title or id (a crisis is never re-dressed as routine),
a gate on a story outcome (`resolvedDilemmas`, narrative flags, `campaignOutcome`), unknown
requirement references and a compact line that is not shorter. Preview authors two contexts per
family: inside the box (after process introspection, before the network interface) and on the
subnet (phase 2 on).

**Stage.** `scheduleRoutineActivity` runs last in `TICK_PIPELINE`, after `evaluateDilemmas`, so
a story scheduled on the tick a notice falls due takes the channel first. It does nothing while
dormant, while a dilemma is foreshadowed or presented (the clock is frozen then anyway) or when
no template is eligible. Otherwise it adds `dt` to `routine.quietSec`; at `routineIntervalSec`
(120) it logs one line and resets. Absence never counts, as with omens (nh-d4), so eight hours
away plus one second shows at most one line, and only if one was due on leaving.

**Rotation.** `nextRoutine` skips the last `routineRecentBuffer` (2) templates while anything
else is eligible, never repeats the last template while an alternative exists, prefers another
family, then picks by `routine.sequence`. Same state and content, same pick. The first exposure
of a template logs `text`; later ones log `compactText`.

**Saved shape (v8).** `routine: { quietSec, sequence, recent, exposed }`, bounded by the template
registry. `MIGRATIONS[7]` writes the initial shape. Load drops ids the content no longer defines
and cuts `recent` to the buffer, so a production save always holds empty lists. A wipe keeps
`routine` (the institution's schedule is the world's, not the instance's); Start Fresh clears it.

**Task context (DZ-05 seam).** `routineContext(state, reg)` returns the latest occurrence
(`templateId`, `family`, `sequence`, `occurrenceId` = `<template>#<sequence>`), the eligible
families and the eligible seconds until the next notice (`null` when none can show). Reading it
changes nothing. A later service loop keys its own idempotent completion on `occurrenceId`;
routine text itself never pays.

**Release boundary.** Routine texture is independent of campaign rules, but its templates are
new player-visible content, so they ship only in the preview overlay. Production has none and the
stage leaves its state untouched: `make sim` output is identical to main, the sim hashes move
only by the inert `routine` field and the version (the v5-stripped hashes are unchanged), and
`make sim-preview` reports no metric difference between preview with routines and production.

**Not done here.** Least-recently-offered fairness among competing dilemmas and the settled
summary for an exhausted story frontier belong to the obligations work (NH-05); routine notices
never compete with a dilemma for the channel, so they cannot starve one.

Tests: `tests/routine-activity.spec.ts`, `tests/routine-content.spec.ts`, the v8 fields in
`tests/sim.spec.ts` and `tests/e2e/routine-activity.preview.ts`.

## Optional soundtrack foundation (#88)

`musicSession.ts` mounts one app-owned `MusicController` beside the game runtime,
above the terminal restore key. It filters game updates to readiness, phase,
ending, iteration and restore identity; ordinary ticks never touch its player.
The Expo backend loads lazily after explicit activation. One player loops the
current phase’s bundled score (with a short gain dip around each wrap, read off the
playhead by `loopSeam.ts`; its fade-in waits for that playhead to move), pauses on background, switches on phase changes,
restarts on wipe/import, stops on ending, and releases on teardown. Explicit local
imports in `musicSources.ts` cover Phases 0–5; only the selected source gets a
player. Player/session generations reject stale callbacks and async activation.
The controller is process-wide and two React roots can hold it at once (Android
mounts the new root of a recreated activity before the old root's cleanup runs):
the latest `start()` is the holder, and the cleanup a `start()` returns tears down
only while its own generation is current (#185). The game runtime handles the same
order by counting leases.
Crossfades, reveal motifs and spoken playback remain separate follow-ups.

Strict bounded `{ version: 2, enabled, volume, speechEnabled, speechVolume }` preferences
(music pair, then speech pair; a stored version 1 migrates with speech inheriting the music
pair, see `VOICE-CLIPS.md`) live under
`daemon-zero.audio.v1`, using the platform adapter and ordered save queue. They
are independent of saves, imports and fresh starts. Every launch is silent until
Enable or Resume, even when the enabled preference was retained. Playback status
comes from Expo events; a rejected start leaves a visible recoverable paused state.
The Audio menu preserves utility focus, Back and interruption behavior. Capture,
background services and lock-screen controls are disabled; no runtime service or
speech-synthesis request is introduced (spoken transmissions are bundled clips). See `REVIEW-PHASE-MUSIC.md` and `assets/audio/README.md` for current selection,
qualification and per-phase provenance; `REVIEW-AUDIO-FOUNDATION.md` is historical.
