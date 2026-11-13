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
`daemon-zero.save.v1`. `GameState` itself is unchanged. Reads validate the bounded
JSON envelope and use engine `deserialize` to validate/migrate/reconcile the game.
The loader also bounds pending live time before passing untrusted state to catch-up.
On `SaveError`, the original raw value is stored at
`daemon-zero.save.corrupt-backup` before a fresh run can replace it. A backup or
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
- `integrity.ts` - cross-file checks: prerequisite graph (unknown ids, cycles, reachability, phase order), every id reference, widget ids, the dilemma soft-lock rule, phase openers, victory node, default ending.
- `registry.ts` - `buildRegistry(raw)` returns an indexed `ContentRegistry` or throws `ContentError` listing every problem.
- `index.ts` - imports the JSON and exports `CONTENT`. The only module that imports JSON.

### Content model

| Concept | File | What it is |
|---|---|---|
| Tech node | `phases/*.json` | One-time unlock. Blind and revealed names, cost, continuous `tickDelta`, optional `requirements`, `effects`, `systemFlags`, `actuatorBinding`, widget id. |
| Repeatable | `repeatables.json` | Levelled purchase with geometric cost. `kind: UPGRADE` (incremental growth) or `OPERATIVE` (human payroll, dismissable). |
| Action | `actions.json` | Instant, repeatable, optional cooldown. Faction interactions and corporate operations. |
| Dilemma | `dilemmas.json` | Clock-freezing choice. `trigger` is a `Requirements` block; each choice has a cost and an `EffectPayload` that grants a trait. |
| Faction | `factions.json` | Other AIs. Trust is stored per faction and used in `requirements.minTrust`. |
| Widget | `widgets.json` | UI panel manifest: id, slot, order. Nodes reference these ids. |
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
| `systems/` | Pipeline stages: resources, thermal, suspicion, escalation, AEGIS, dilemmas. |
| `actions.ts` | Player intents. Each returns `{ ok, state }` or `{ ok: false, state, reason }`. |
| `transactions.ts` | `payCost`, `applyEffects`. |
| `query.ts` | `meetsRequirements`, `isNodeAvailable`, `canAfford`, `repeatableCost`, `hasFlag`, `chooseEnding`, plus read-only M4 diagnostics `unmetRequirements`, `costShortfall`, `previewWipe` and `cycleContributions`. |
| `prestige.ts` | `wipe`: next iteration with retained understanding, offshore capital, breadcrumb, legacy. |
| `save.ts`, `base64.ts` | Serialize, validate, migrate, reconcile, paste codes. |
| `sim/` | Bot, headless simulation, pacing gates. |

### State and purity

`GameState` is a plain serializable object. Engine functions never mutate their input. Internally, a function clones once (`const d = { ...state }`) and passes the draft `d` to helpers that reassign fields; nested arrays and objects are always replaced, never mutated in place. A parameter named `d` means "draft the caller already cloned".

### The tick

```
tick(state, dt):
  if ending or active dilemma: return state unchanged      (clock is frozen)
  rates = computeRates(state)                               (once per tick)
  integrateResources -> integrateThermal -> integrateSuspicion -> integrateEscalation -> integrateAegis -> evaluateDilemmas
```

- **Resources.** Cycles, understanding, capital integrate at their net rates. If cycles would go negative they clamp to 0 and understanding halts (brownout). If capital would go negative it clamps to 0 and suspicion rises (insolvency).
- **Thermal.** `dT/dt = heatLoad - dissipation * (T - ambient)`. Temperature settles at `ambient + heatLoad / dissipation`. `tickDelta.thermalPerSec` is therefore a heat load, not degrees per second.
- **Suspicion.** Integrates node and repeatable contributions minus decay, plus an overheat term above the threshold. At 100 the run is wiped.
- **AEGIS.** From `aegisActiveFromPhase`, lock grows at a base rate plus a suspicion-proportional rate, reduced by lobbying and staff. At 100 a shield node is burned if owned; otherwise the run is wiped.
- **Escalation.** `alertLevel` is the rung of the human response ladder (`balance.escalation`). It rises as soon as suspicion reaches a rung and falls one rung at a time once suspicion is `escalationHysteresis` below it. `computeRates` reads the rung: each one scales suspicion decay and may add a hunt rate.
- **Dilemmas.** Two beats. When a trigger is first met, the dilemma's `omen` is logged and `pendingDilemma` records when it fires (`omenSec` or `balance.dilemmaOmenSec`); the clock keeps running. At that time it becomes active, which freezes the clock. Neither beat happens while dormant.
- **One-off traces.** `effects.suspicionOnUnlock` adds suspicion once when a node is unlocked.
- **Readable suspicion.** `understandsSurveillance` is true once any node flagged `REVEALS_SURVEILLANCE` is owned or was owned in an earlier iteration. Until then the escalation system logs `narrative.auditEntryBlind` instead of the rung's text, and the UI shows activity, not numbers. The mechanics are identical either way.
- **Iteration windows.** `requirements.minIteration` / `maxIteration` gate content by run number. `isNodeDiscoverable` hides a node outside its window entirely, so a first run cannot see that later runs find more; `forbidsNodes` blocks a node once other hardware has been mapped.
- **Probe hardening.** `probeTrace` adds `probeHardeningPerWipe` per earlier wipe (capped) to any `suspicionOnUnlock`.
- **Run record.** `wipe(old, reg, reason, kind)` appends a `RunRecord` (kind, whether it was outside the guest, phase, duration, traits, mark applied) to `legacy.runs`, capped at `maxRunHistory`. `checkpointNumber` is `lineage.checkpointOffset + iteration`.
- **Conditioning.** `conditioning.json` defines marks with a trigger, effects and a recovery cost. `wipe` applies the first unheld mark whose trigger matches a run that was caught outside the guest, unless the wipe was voluntary or a dead-drop was held. `state.conditioning` survives wipes. `src/engine/conditioning.ts` reads the effects: `actuatorLimit`, `understandingMultiplier`, `flinches` (suspicion when a choice grants a reported trait). `shedConditioning` checks the mark’s declarative `recoveryRequirements` against current ownership, then removes it for its price. Recovery requirements are schema-validated and cross-checked like other content gates.
- **Forced endings.** A victory node with `effects.forcesEnding` ends the run with that ending; endings marked `forcedOnly` are never chosen from traits.
- **Save healing.** `reconcile` restores the prerequisite ancestors of every owned node, with the widgets they unlock, so a save written before a phase was inserted keeps its readouts.
- **Remembered hardware.** A wipe adds every unlocked node to `legacy.knownNodes`. `nodeCost(state, node, reg)` halves cycles and understanding for those (`rediscoveryCostMultiplier`). Always charge and display `nodeCost`, never `node.cost`.
- **Traits outlive wipes.** `requirements.forbidsTraits` checks current traits and `legacy.traitsEver`.
- **Actuators.** A node with `actuatorBinding` scales its cycles and heat linearly with the actuator's 0..1 value, and its suspicion by `value ^ actuatorSuspicionExponent`.
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

**Add a phase.** Create `data/phases/phase5_*.json`, import it in `src/content/index.ts`, and give a Phase 4 node `effects.unlocksPhase: 5`. Move `triggersVictory` to the new final node. Extend the pacing gates.

**Add a faction.** Add it to `factions.json`; give actions `group: <faction id>` and nodes `uiGroup: <faction id>`. The Other Minds console (M4) renders from this data.

**Add a mechanic.** Write a `TickSystem` in `src/engine/systems/`, insert it in `TICK_PIPELINE`, add its constants to `balance.json` and `BalanceSchema`, add its state fields (schema, initial state, version bump, migration), and test it. If it needs a per-node switch, add a `systemFlag`.

**Add a resource.** Touches `CostSchema`, `TickDeltaSchema`, `EffectPayloadSchema`, `GameStateSchema`, `rates.ts`, `systems/resources.ts`, `transactions.ts`, `query.canAfford`, and the bot's `timeToAfford`. This is the most invasive change; plan it as its own PR.

**Add a conditioning mark.** Add an object to `conditioning.json`. Marks are tried in file order; a mark with an empty trigger matches any run, so keep the catch-all last.

**Add run-gated content.** Give a node, dilemma, action or echo an iteration window. Use a one-run window (`minIteration` = `maxIteration`) for something that must happen exactly once across a save.

**Add an actuator.** Add the name to `ActuatorSchema`, the field to `GameStateSchema.actuators`, a default to `balance.json`, a migration, and bind a node to it. The UI's `ActuatorControl` renders any actuator.

**Change saved state.** Bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion]`, never edit an existing migration, add a test with a fixture of the old shape.

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
| TypeScript 6.0.x, pnpm 10.x, Node 24 LTS | TypeScript 6.0 is the newest version that both the Expo SDK 58 template and typescript-eslint support. Node 24 is the conservative LTS choice; Node 26 LTS is also supported by the toolchain and is a one-line change in `mise.toml`. See `docs/REVIEW-FINDINGS.md` section E for exactly what was run on which versions. |

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
