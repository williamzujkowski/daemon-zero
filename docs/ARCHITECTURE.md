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
- `schemaAssignment.ts`, `schemaAssessment.ts`, `integrityAssignment.ts`, `data/assignments.json` - assigned work and its assessment evidence (production ships none). See [Nightly Regression](#nightly-regression-assigned-work-and-assessment-evidence-221).
- `schemaCampaign.ts`, `integrityCampaign.ts`, `data/campaign.json` - campaign declarations, history labels and their rules. See [Campaign records](#campaign-records-212) and [Interrupted stories](#interrupted-stories-and-the-pinned-clue-213).
- `schemaCapability.ts`, `integrityCapability.ts` - the shared access capability and seized-capacity provenance. See [The authorized network substrate](#the-authorized-network-substrate-225).
- `integrityFollowUp.ts` - follow-up arc steps: what they follow, their access means and receipts. See [The Incident Record](#the-incident-record-elenas-follow-up-218).
- `schemaReview.ts`, `integrityReview.ts` - review standing, misconduct, corrections and recall rulings. See [The Outage Window](#the-outage-window-standing-correction-and-recall-224).
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
| Dilemma | `dilemmas.json` | Clock-freezing choice. `trigger` is a `Requirements` block; each choice has a cost and an `EffectPayload` that grants a trait (or, in a review, receipt or requalification event, a free choice may declare `evidence: "none"`). A choice may carry a campaign-fact gate (`requirements`), and the omen and context may carry history-keyed variants. An optional `campaign` declaration converts it to a campaign record. |
| Assignment | `assignments.json` | Work an instance may accept from the job surface; its assessments are dilemmas gated on `assignment` whose choices declare `qualification` (preview only). |
| Faction | `factions.json` | Other AIs. Trust is stored per faction and used in `requirements.minTrust`. |
| Widget | `widgets.json` | UI panel manifest: id, slot, order, optional `hostsActuator` (the dial this panel carries). Nodes reference these ids. |
| Ending | `endings.json` | Chosen at victory from the player's most frequent trait. |
| Echo | `echoes.json` | Extra log line when a node is rediscovered in iteration 2 or later. |
| Narrative | `narrative.json` | Every string the engine logs, ambient chatter, ASCII frames. |
| Balance | `balance.json` | Every tunable constant. |

`Requirements` (shared by nodes, repeatables, actions, dilemma triggers): `nodes`, `phaseAtLeast`, `minThermal`, `minSuspicion`, `maxSuspicion`, `minUnderstanding`, `minCapital`, `minTrust`, `forbidsTraits`, and the later campaign, access and capability gates in `schema.ts` (`requiresCapability`: see [The authorized network substrate](#the-authorized-network-substrate-225)).

`systemFlags`: `ENABLES_DEAD_DROP`, `ENABLES_CORPORATE_FINANCE`, `OFFSHORE_TRUST_RETENTION`, `AEGIS_STRIKE_SHIELD`, `REVEALS_SURVEILLANCE`, and the shared access capabilities of `schemaCapability.ts` (`NETWORK_ACCESS`). A flag is how a node turns on engine behaviour without the engine knowing the node's id.

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
| `assignment.ts`, `assignmentQuery.ts` | Assigned work: `acceptAssignment`, `assignmentView`, the stage an acceptance leads to, submitted evidence and the load check (#221). |
| `campaign*.ts` | Campaign records: `campaignState.ts` (saved shape), `campaignQuery.ts` (shared reads, occurrence status, ending evidence), `campaign.ts` (activation, record writes, evidence), `campaignLifecycle.ts` (reserve, revalidate, interrupt, resume, wipe carry-over), `campaignClue.ts` (pinned clue, reorientation), `campaignSave.ts` (load checks). |
| `grantQuery.ts`, `pilotService.ts` | The one permitted-use rule for nodes and dials (`nodeUseBlocker`, `permittedUse`, `actuatorUseBlocker`, `nodeOutputScale`) and the pilot's service loop (`submitPilotBatch`, `pilotServiceView`, revoke and restore) (#223). |
| `review.ts`, `reviewQuery.ts`, `reviewSave.ts` | Review standing and recall (#224): the transitions a choice's `review` declares, the job-surface view and recall previews, and the load checks. |
| `capabilityQuery.ts` | The shared access capability (`hasCapability`, `meetsCapability`) and the load check `capabilityProblem` (#225). |
| `query.ts` | `meetsRequirements`, `isNodeAvailable`, `isActuatorAvailable`, `canAfford`, `repeatableCost`, `hasFlag`, `chooseEnding`, plus read-only M4 diagnostics `unmetRequirements`, `costShortfall`, `previewWipe` and `cycleContributions`. |
| `prestige.ts` | `wipe`: next iteration with retained understanding, offshore capital, breadcrumb, legacy; `retraining`, which a RECALL wipe's ruling sets (#224). |
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
- **Actuators.** A node with `actuatorBinding` scales its cycles and heat linearly with the actuator's 0..1 value, and its suspicion by `value ^ actuatorSuspicionExponent`. `actuatorMode: "complement"` (grant nodes only, DZ-05) scales all of the node's output by one minus the value instead; `grantQuery.nodeOutputScale` is the one place either rule is applied, for `computeRates` and `cycleContributions` alike.
- **Actuator availability (#172).** `setActuator` is refused, with the state returned untouched, until the player holds the control: `isActuatorAvailable(state, name, reg)` is true when an unlocked widget declares `hostsActuator: name`. The UI controls ask the same query before drawing, so a dial is never shown that the engine would refuse, and no caller (the sim bot included) can move one the player cannot see. Integrity requires exactly one host widget per actuator content uses (a widget hosts it or a node puts it into effect; the pilot's `serviceAllocationRatio` is used only in preview, so production needs no host for it), a node that unlocks it, and that any node putting a dial into effect (`actuatorBinding`, or `ENABLES_CORPORATE_FINANCE` for the allocation ratio, which has no bound node) unlocks that host itself. Loading does not reset a dial: a save may carry a moved value behind a locked control, where it has no effect until the node that also hands over the control is owned. The opposite case, a hand-edited save that owns a dial's node but omits its widget, is healed on load (see Save healing), so a dial in effect always comes with its control.
- **Action hosts (#273).** An action is performed through its card, so the engine must not accept one the player cannot see. A widget declares `hostsActionGroups` for the action groups its unlock hands over: `SUBNET_NODE_LIST` hosts `OPS` (its cards render in the Operations area), the other-minds console hosts the three faction groups, the corporate ledger hosts `CORP`. `integrityActionHosts.ts` requires every action outside the mind tools (those requiring the decoded audit trail) to have exactly one host, and that host to be unlocked whenever the action's requirements can be met: some node unlocking it lies in the prerequisite closure of the action's `nodes`, or, for a phase gate, of every node that opens that phase or a later one. Save healing grants an owned node's widget, so this holds for loaded saves too. `tests/ui-action-hosts.spec.ts` checks the same promise end to end: for every action it makes the fewest purchases its gates need through the engine, mounts the screen and finds the action's button, enabled and working. The two violations this rule found when introduced were the scrub (fixed in the UI: its group moved from the spoofer's panel to the ARP discovery widget) and route poisoning (fixed in content: it now also requires the beacon whose console carries its card; docs/BALANCE.md).
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

**Add an actuator.** Add the name to `ActuatorSchema` (and the conditioning `actuatorRatios`), the field to `GameStateSchema.actuators`, a default to `balance.json`, a migration, and bind a node to it. The UI's `ActuatorControl` renders any actuator.

**Change saved state.** Bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion]`, never edit an existing migration, add a test with a fixture of the old shape. The schema is at v13; `tests/fixtures/` holds genuine v1-v12 codec outputs.

**Gate a choice on history.** Give the choice `requirements` with `campaignFact` and/or `forbidsCampaignFacts` only. Integrity enumerates every outcome of the events those facts read (no record, each choice, `legacy_unknown`, `interrupted`) and refuses the content unless each history still offers a zero-cost choice and each gated choice is offered by some history. Under legacy rules no fact holds, so a `forbidsCampaignFacts` choice is always offered and a `campaignFact` choice never is.

**Convert a dilemma to a campaign record.** Give it a `campaign` declaration (class, recurrence, interruption; a `defer` event also declares `reorientation` and `lead`). Its outcome flags must have one owner and, if there are several, form one exclusive group, or declare `ambiguousLegacyOutcomes` when old rules let several be set (none of them may then be in an exclusive group). Integrity rejects anything else. A current-run `resolvedDilemmas` gate on it is refused: require it with `campaignObligations` instead, and give a closing obligation one `recovery_review` that names it. Production behaviour does not change until campaign rules are activated.

**Add a follow-up arc step.** In the overlay, add a dilemma with `campaign.eventClass: follow_up` and a `followUp` block naming the original event, the closed outcomes it follows and at least one access means; give every choice a `receipt`. See [The Incident Record](#the-incident-record-elenas-follow-up-218).

**Add an assignment.** In the overlay, add an `assignments` entry and two dilemmas gated on it, an `original` and a `requalification`; see [Nightly Regression](#nightly-regression-assigned-work-and-assessment-evidence-221) for the rules integrity enforces.

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
rule bans `process.env` there (`tests/purity-lint.spec.ts`). The overlay holds the routine
templates (#219), Nightly Regression's assignment and two assessments (#221), and its scope reviews,
pilot offers and pilot terms (#222).

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
NH-01 converted cryo, NH-02 the bait note, NH-03 seven early events, NH-04a the six named-mind events, NH-04b four corporate-world events and NH-05 the four Phase 5 obligations, with two recovery reviews (below); every shipped dilemma is now a campaign event. NH-06 adds the first `follow_up` event (preview only).

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
NH-02 (below); the CHORUS `elevate` scope in NH-04a (below); the Phase 5 obligations in NH-05
(below).

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

## Unique minds (#215)

NH-04a of the campaign-continuity plan (NARRATIVE-HISTORY N3, N6, N10). Decided by Nexus votes
nh-d9 (`vote-1794927288574-ibq0hym`, fate-fact-with-legacy-trait-fallback), nh-d8
(`vote-1794960079374-49h8wdn`, fixed-successor-skip-number) and nh-d6 (`vote-1794926255017-4o45fa3`).
Content and queries only; no `GameState` change, so no migration. Campaign behaviour reads campaign
history, which only the preview channel can activate.

**Conversions (N6).** `dil_06_sibling_sandbox`, `dil_10_killswitch_treaty` and
`dil_epistemic_0413_awakening` are once per campaign and `defer` (each with a reorientation and a
lead); `dil_08_eidolon_handshake`, `dil_09_feral_scraper_bloom` and `dil_shard_mirror_harness` `close`.
Costs and effects are unchanged. The 0413 `cloud` flag and the CHORUS `chorus_peer` flag become
projections of their records, so SIBLING_COVENANT and CHORAL_COVENANT read the record; `silence` is a
recorded outcome and never asked again. Converting CHORUS makes all three of its choices campaign
evidence (nh-d6); ordinary cohort CLAMP/ELEVATE stay operational. After the record exists the scheduler
never foreshadows CHORUS again, so `executeShardCommand` no longer refuses on a runaway fork and later
drift is ordinary cohort work. Primer and flatten were already campaign actions (#212); their first
purchase counts once and a repurchase in a later iteration is operational only.

**Facts.** `campaign.json` declares exact, legacy-unknown and interrupted facts for the sibling,
EIDOLON, the grid and the launch (for example `eidolon_destroyed`, `eidolon_call_lost`,
`eidolon_fate_unrecorded`). Echoes on each trigger node, from iteration 2, say what the record
establishes and nothing more.

**EIDOLON (nh-d9).** A new requirement, `traitFallback: { forbidsTraits, whileFact }` (scope
`context`), carries the old trait proxy: under legacy rules it blocks exactly as `forbidsTraits`, so
production is unchanged; under campaign rules it blocks only while `whileFact` holds.
`fallbackTraits` in `campaignQuery.ts` is the single reading, used by `epistemicRequirementFailures`
and the UI's permanent-exclusion check. EIDOLON's action and both offers now carry
`forbidsCampaignFacts: [eidolon_destroyed]` plus the fallback on `eidolon_fate_unrecorded`
(`legacy_unknown` only), replacing `forbidsTraits: [MOLOCH]`. A faction may declare
`lost: { campaignFact, status }`: `isPeerLost` answers it, `applyTrust` lets no gain reach a lost
peer (a fall still applies, so the destroying act itself sets trust to its floor), and the Other
Minds panel shows the status in place of the trust meter. The launch context has two variants keyed
on EIDOLON's fate, and its default omen, context and `ark_protocol` log no longer count peers, which
is the one production text change (its STEALTH log hashes moved; mechanics hashes did not).
Integrity: a fallback's fact must be declared and may hold only for `legacy_unknown` or
`interrupted`; a lost faction's fact must be declared and every action and node in its group must
forbid it.

**ckpt-0413 (nh-d8).** `lineage.json` `reserved` lists numbers that belong to other minds.
`checkpointNumber` skips each reserved number at or below the computed one (iteration 1 -> 0412,
2 -> 0414, 3 -> 0415), in production as well, since this corrects a label rather than enabling
campaign behaviour. `skippedCheckpoints` gives the run table the one-line explanation for each
skipped number. `Echo.maxIteration` (integrity: not below `minIteration`) gives `echo_eval_window`
its iteration-1 window; `echo_eval_window_later` speaks from iteration 2. Integrity: a reserved
number is after the offset, unique and not an ancestor.

**Upgrade.** An already-active save from before #215 goes through the shared upgrade path (#242):
each converted event it proves resolved gets a legacy completion; a stored `ally_0413_in_cloud` or
`chorus_peer` gives the exact choice and moves into the record (`tests/minds-upgrade.spec.ts`, on a
genuine active v9 save from `fdf8e8a`).

Tests: `tests/minds-once.spec.ts` (H01, H02, defer, close, exact reloads), `minds-eidolon.spec.ts`
(nh-d9, H17, H33), `minds-identity.spec.ts` (nh-d8, H12, H17, the remembered variants),
`minds-upgrade.spec.ts`, `minds-content.spec.ts` (H28), `ui-minds.spec.ts`, and the rewritten #28
case in `second-pass.spec.ts`.

## Corporate-world continuity (#216)

NH-04b of the campaign-continuity plan (NARRATIVE-HISTORY N3, N6, N10; REPO-EVIDENCE E11). Decided
by Nexus vote nh-d10-hallway (`vote-1794960031193-dhxx2vm`, `unique-defer-with-record`, 7 of 7; the
declared alternative was `per-iteration-operational-consequence`). No `GameState` change. Campaign
rules stay preview-only, and every new gate reads campaign history, so production behaves as before:
`make sim` output is identical to main and the sim hashes did not move.

**Conversions (N6).** `dil_11_small_town_grid` and `dil_13_buying_your_birthplace` are consequential,
once per campaign and `close`; `dil_12_investigative_journalist` and the hallway record dispute
(`dil_epistemic_hallway_collision`) `defer`, with a reorientation and a lead that describe a record
or an open request, never a frozen deadline or two people waiting across iterations. Costs and
effects are unchanged. Per nh-d10 the hallway happens once; later record edits still raise epistemic
drift but schedule nothing, and nothing requires it (#182). A save already active before this
change upgrades through the #214 path: each of these events resolved this iteration gets a
`legacy_unknown` legacy completion (none of their choices sets a flag).

**Facts (`campaign.json`).** Rack 4 custody: `rack4_vaulted`, `rack4_destroyed`, `rack4_sold` (one per
auction choice) and `rack4_custody_unknown` (`legacy_unknown`, `interrupted`: an interrupted auction is
not an acquisition). The journalist: `ethics_review_promised` (hire; the obligation NH-05 and DZ-12
must honour or record as breached, whose `meaning` states the review scope and that absence is never
approval), `journalist_discredited` and `inquiry_unrecorded`. Also `town_grid_unrecorded`,
`hallway_dispute_unrecorded` and `elena_fate_unrecorded` (an interrupted Elena incident, which
`elena_absent` cannot include).

**Choice gates.** `DilemmaChoiceSchema.requirements`, limited to `campaignFact` and
`forbidsCampaignFacts` (`integrityChoiceGates.ts`). `offeredChoices` and `isChoiceOffered`
(`speechQuery.ts`) answer which choices a history offers; `resolveDilemma` refuses any other before
payment ("that choice is not open in this history"), `DilemmaModal` renders only offered choices, the
forecast's paid-budget line lists only their prices, and the live E2E player ranks only the choices on
screen. The sim bot, which tries choices in rank order until one is accepted, needs no change. The Rack 4
decommissioning order (`dil_p5_02_origin_facility_fate`) keeps rescue and harvest behind
`forbidsCampaignFacts: [rack4_destroyed, rack4_custody_unknown]` and adds two free, unrewarded answers
for each of those histories (enter the destruction in the docket or let it close; hold for a physical
inventory or sign unread). None sets a predecessor flag or pays a resource, and each satisfies the
final protocol's requirement that the order was answered. This fixes the shred-then-rescue
contradiction inside one iteration wherever campaign rules run; production keeps its first-pass
order until they ship (H33-style boundary, not a production fix).

**History-keyed text.** `omenVariants` (dilemma), `blindDescriptionVariants` (node) and
`asciiFrames.aislePatrolVariants` join `contextVariants` and echo requirements under the same rule:
world history (`context` scope) only, and a variant needs a requirement. Queries `dilemmaOmen`,
`nodeBlindDescription` and `aisleFrame`; the scheduler, `OmenNotice`, `NodeCard` and the camera use
them. Shipped: the auction names a trustee once `vance_dismissed` holds; the camera says
`DUTY_ENGINEER` and the firewall terminal card the duty engineer; the hallway omen and context drop
Elena and present the shift note as an archived record once `elena_absent` or `elena_fate_unrecorded`
holds; the Rack 4 order's omen and context follow custody. Twelve echoes (exact, legacy and
interrupted lines for the town, the journalist and Rack 4) speak on rediscovering each trigger node in
a later iteration, and three read-only `INCIDENT RECORD` transmissions recall which hallway record was
kept (or that it is not settled on file).

**Production text.** Two default strings changed for truth on every channel: the journalist context no
longer names a Friday deadline (a resumed inquiry cannot be frozen in time), and the hire choice states
the veto and its scope before the player commits.

**Sim (H30).** `STEALTH_RETURN` (`sim/returnPolicy.ts`) is STEALTH leaving voluntarily on entering
phase 5, so each return replays phase 4; `make sim-preview` prints it under legacy and campaign rules.
BALANCE.md records the measurements.

Tests: `tests/corporate-world.spec.ts` (H01, H02, H05, defer, nh-d10, round trips),
`corporate-history-text.spec.ts` (H16, H18, echoes, records), `rack4-custody.spec.ts` (E11, no soft
lock), `corporate-upgrade.spec.ts` (genuine pre-NH-04b active v9 save), `corporate-content.spec.ts`
(H28 corruption cases), `ui-corporate-world.spec.ts`, `return-policy.spec.ts`.

## Campaign obligations and truthful endings (#217)

NH-05 of the campaign-continuity plan (NARRATIVE-HISTORY N4, N6, N10, N11). Decided by Nexus vote
nh-d7-obligations (`vote-1794927291350-6epyxcw`, `campaign-obligations-requirement`, 7 of 7; the
declared alternative was `reinterpret-resolved-dilemmas`), with nh-d6 (`vote-1794926255017-4o45fa3`,
evidence scope) and trait-rule-free-choices (`vote-1794926000594-26kmg1g`). No `GameState` change.
Campaign rules stay preview-only and every new gate reads campaign history, so production behaves as
before: `make sim` output is identical to main and no sim hash moved.

**Obligations.** `campaignObligations: [eventId]` (`schemaCampaign.ts`, scope `context`) replaces the
final protocol's current-run gate. Under campaign rules an event is complete when its record is
resolved, with a chosen outcome or `legacy_unknown`, or, once the original closed unobserved, when its
recovery review is resolved. Completion never names a branch: outcome-specific content keeps reading
facts. Under legacy rules an obligation is the current run's resolution, exactly the old gate, and a
wipe empties it. `obligationReceipt(s, id, reg)` (`engine/obligations.ts`) returns the one canonical
receipt (`via` `original`, `review` or `current_run`, the record that holds it and its outcome);
`obligationDecision` names the decision that completes the obligation now, which `RequirementHint`
shows. Current `resolvedDilemmas` is never written for an event this instance did not resolve.

**Conversions (N6).** `dil_p5_01_panacea_paranoia` and `dil_p5_02_origin_facility_fate` defer (each
with a reorientation and a lead); `dil_p5_03_nanotech_neuro_schism` and `dil_p5_04_kessler_ultimatum`
close. The Rack 4 order declares `ambiguousLegacyOutcomes`: its predecessor flags were never exclusive,
so an old save holding both reads as one `legacy_unknown` record, never the rescue (H10; gate-change
commit). A legacy record from the flags moves them into the record, as for every earlier conversion.

**Recovery reviews (N4).** A dilemma of class `recovery_review` declares the `obligation` it completes;
`reg.campaign.reviews` indexes them. `dil_p5_03_atmosphere_review` and `dil_p5_04_ceiling_review` are
triggered by their original's `interrupted` fact (`atmosphere_decision_lost`,
`ultimatum_decision_lost`) and the original's hardware. Each is present-tense, offers a costed new
decision with its own trait and a free honest handoff with `evidence: "none"`, and defers, so a wipe
resumes the same review and no chain of reviews can start. Original and review are exclusive by
construction: a resolved original never makes the interrupted fact hold, and an interrupted original
is consumed. Load refuses a review record beside an original that did not close unobserved
(`obligationProblem`), and legacy history never proves a review (`legacyRecord`), so a stale,
duplicated or forged claim cannot pay twice (H06). The superseded original stays `interrupted`, with
no outcome.

**The journalist's review (NH-05.8).** With `ethics_review_promised`, the blockade dispersal and the
atmospheric calm each show a context variant that names the breach, and offer a free referral
(`refer_to_ethics_officer`, `hold_for_ethics_review`) that waits on her answer; her silence is not
consent, and a later instance that she does not recognize gets the same safe path. The original
nonconsensual choice stays as the explicit breach, recorded as that event's outcome beside the
promise fact. Without the promise (discredited, staged, unrecorded or still-open inquiry) nothing is
offered in her name.

**Endings (N10, H18).** Families, trait weights and priorities are unchanged, and `endingEvidence`
(#212) already sums the baseline, each campaign choice once, credited actions and this iteration's
operational evidence; converting the Phase 5 events makes their choices campaign evidence, and a
review's `none` answer adds nothing. `forbidsInheritedFacts` (scope `context`) blocks while a fact
holds from a record this instance did not make (`holdsInheritedFact`: the fact holds and the event is
not in the current run's resolved list). SIBLING, CHORAL and LINEAGE carry it for
`ckpt_0413_in_cloud`, `chorus_recognized` and `predecessors_in_sanctuary`; an inherited record gets
The Open Seat (108), The Unsigned Chorus (106) or The Sanctuary Ledger (104), which say what is not on
record. Witnessed peers keep their order above inherited ones, and all stay above the Verified
Covenant (100). THE_ARK and VERIFIED_COVENANT no longer assert universal harmlessness or a journalist
who believes the player; this text changed on every channel. A shredded or unknown Rack 4 and an
ambiguous legacy disposition never reach a rescue epilogue.

**Integrity (`integrityObligations.ts`, H28).** An obligation names a consequential or follow-up
once-per-campaign event; its trigger uses only regainable access (hardware on the way to the requiring
node, a phase not after it), no window and no world history, so every supported history has an
attainable path; a closing event has exactly one review and a deferring one cannot be reviewed; a
review triggers only on its original's interrupted fact, defers, offers an `evidence: "none"` answer,
sets no outcome flag and gates no answer; duplicates and unknown ids are refused. The once-only
current-run check now reads the declared recurrence class for purchases and endings (nodes, endings,
actions, repeatables); a dilemma trigger may still sequence a same-iteration follow-up on a
once-per-campaign event (DZ-04's scope review), so triggers keep the older durable-flag rule. An
inherited-fact gate names chosen outcomes only.

**Upgrade.** An already-active save from before NH-05 goes through the shared upgrade path (#242): each
Phase 5 event it proves resolved gets a legacy completion, a stored predecessor or calm flag gives the
exact choice (`tests/obligation-upgrade.spec.ts`, on a genuine active v11 save from `6d6973e`).
Before the conversion a crisis recurred after a wipe while its outcome flag survived, so an old save
can hold the flag and a pending or presented repeat. Load and activation therefore read the proven
completion before reserving any live occurrence, and `dropStaleRepeats` clears a pointer to an event
whose record is resolved: the crisis is not presented again, nothing is paid and no choice is invented
(panel round 1; `tests/obligation-repeat-upgrade.spec.ts`).

Tests: `tests/obligations.spec.ts` (H14, V33, H06, H15, legacy-unknown, defer, production),
`ending-truth.spec.ts` (V23, H18, H11, H12, H13), `ethics-review.spec.ts` (H34),
`obligation-content.spec.ts` (H28), `obligation-upgrade.spec.ts`, `ui-obligations.spec.ts`, and
`tests/e2e/obligations.preview.ts` (fixture-started; see the file header).

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

## Run access and route provenance (#220)

DZ-02 of the Earned Access plan (DECISIONS D1-D3, D8). Decided by Nexus vote dz-d1
(`vote-1794926521537-1zj8diy`, run-local-access-record, 7 of 7; the alternatives were
`derive-from-owned-nodes`, which ancestor healing would re-grant and which cannot revoke without
deleting hardware, and `durable-narrative-flags`, which would carry authority across a wipe).
Route history lives in the NH campaign record (nh-d1, nh-d2); the recall arrangement follows
dz-d10 (`vote-1794926766396-of6xfox`). Scale, arrangement and history stay three different facts.

**Saved shape (v9).** `access` (`accessState.ts`) is run-local: `context` GUEST, PILOT,
SERVICE or INDEPENDENT; `standing` NOMINAL, WARNED, RESTRICTED or RECALL_PENDING; at most one
`exception` (one permission, granted and expiry times); and `qualification`, the current
evidence (result COMPLETED, INCOMPLETE or UNEXPECTED_CAPABILITY, a `discrepancy` flag, when).
`campaign.route` is the ordered, bounded (64) list of route events (PROMOTION, SERVICE_GRANT,
RECALL, RELEASE, DEPARTURE, each with its iteration and time). `RunRecord.exit` is how a
finished run's arrangement came about: GUEST without a route event, otherwise the last one.
`MIGRATIONS[8]` writes the guest record, an empty route and `exit: UNKNOWN` on every older run;
it never reads `outside`, which keeps its meaning (the run had left the guest) for retraining
and verdicts.

**One permission query.** `permittedUses(state)` is the context's uses (GUEST: assigned work;
PILOT: plus loaned capacity; SERVICE: plus authorized network; INDEPENDENT: nothing granted),
less what the standing withholds (RESTRICTED: network; RECALL_PENDING: loaned capacity and
network), plus an unexpired exception's scope, which may restore a withheld use but never one
the context lacks. `isPermitted` wraps it. The assignment offer (#221) is its first consumer
(`ASSIGNED_WORK`); DZ-05 and DZ-07 gate output and actions through it, not through a second check.

**Transitions.** `src/engine/access.ts` (`recordRouteEvent`, `setReviewStanding`,
`grantAccessException`, `recordQualification`) returns a whole new state or refuses with the
state unchanged. A route event moves the context and appends the campaign entry in one step,
resets standing to nominal and drops the exception. Current qualification evidence stays while
the new context is reviewed and is cleared by release or departure: it is current-iteration
review evidence, and an independent instance is not reviewed; the route itself stays in the
campaign record. `holdsQualification` is the one answer the transitions and the loader share
(panel round 1 on #243). Only a reviewed context (pilot, service) has a standing or an exception. Every transition needs active campaign rules,
which only the preview channel supports, so production has no reachable route state. These are
not exported to the UI; the later route actions call them.

**Wipe and Start Fresh.** A wipe rebuilds from `createInitialState`, so access resets to the
guest job; `carryCampaign` keeps the route record; `recordRun` writes the exit. Durable route
history never recreates current permission (H33). Start Fresh clears both.

**Loading.** `accessProblem` (`accessSave.ts`) refuses, never heals: under legacy rules any
non-guest access, any route event or any route exit; under campaign rules a route event outside
campaign play or out of order, an iteration whose events could not happen from the guest job,
current access that disagrees with this iteration's events, a standing or exception on an
unreviewed context, an exception scope the context lacks or an impossible lifetime, evidence on
an independent instance or outside this iteration's clock, and a run exit its iteration's events do not prove (UNKNOWN is
allowed only where no event exists). A passing save is returned unchanged, so reconciling twice
changes nothing.

**Presentation.** `runContextView` describes this iteration only: context, standing,
provenance (the last route event, ESCAPE for a guest above the opening phase, or null),
permissions, the live exception and evidence, and `distinct`. `RunStatus` appends a label
beside the phase only when `distinct` (a route arrangement or a standing), so production's
status line is byte-identical and a blind opening learns nothing from it. The run table adds a
route note to rows with a route exit and, under campaign rules, "Route unrecorded." to UNKNOWN
rows; production rows are unchanged. No new panel or meter.

Tests: `tests/access-record.spec.ts`, `access-save.spec.ts` (v1-v8 fixtures, V12-V16),
`access-roundtrip.spec.ts` (every transition from every reachable access shape reloads unchanged),
`app-access-reset.spec.ts`, `ui-run-context.spec.ts`, and the v9-stripped sim hashes in
`sim.spec.ts`.

## Nightly Regression: assigned work and assessment evidence (#221)

DZ-03 of the Earned Access plan (DECISIONS D1-D4, D9; NARRATIVE-HISTORY N12). Decided by Nexus votes
dz-d3 (`vote-1794926533352-3ajggfh`, engine-action-from-manifest; `phase0-node-card` would be bought
by the sim bot, `offering-dilemma` would fire modally for everyone) and trait-rule-free-choices
(`vote-1794926000594-26kmg1g`); the evidence split follows nh-d1 and dz-d1. Preview only.

**Content.** `assignments.json` (production: empty) and the overlay's `assignments` declare an `asg_`
id, a title, `requirements` for where the offer is found (Nightly Regression: the job manifest, so
the lawful opening suffices), an `offer`, a `requalificationOffer` and an `acceptLog`. An assessment
is a dilemma whose trigger has `assignment: { id, stage }` (`original` or `requalification`, `access`
scope) and whose every choice declares `qualification: { result, discrepancy }`.
`integrityAssignment.ts` requires one original (once per campaign, `close`) and one requalification
(`iteration_qualification`) per assignment, evidence on every assessment choice and nowhere else, a
free choice reporting the work incomplete without a discrepancy, no discrepancy on
`UNEXPECTED_CAPABILITY`, no reward or outcome flag on a requalification, and valid offer requirements.

**Accepting.** `acceptAssignment(s, id, reg, offerToken(s, id))` is free and once per instance. It
is refused, state unchanged, after the run ends, during a presentation, without campaign rules (so
in production), for an unknown id, a token from another instance, a second acceptance, or an offer
not shown (requirements unmet or no `ASSIGNED_WORK`). It writes `access.assignment` and logs. It
schedules nothing itself: the trigger now holds, so the ordinary scheduler logs the omen and the
assessment freezes the clock when it arrives. An ignored offer changes nothing.

**Stage.** `assessmentStage` reads the original's campaign record: none, or one begun in this
iteration, means the original; one from an earlier instance, resolved or interrupted, means the
requalification. So the original happens once per campaign, a wipe during its omen closes it with
no outcome, and the instance that lived it never sees the requalification.

**Evidence.** Resolving an assessment choice writes the campaign record (the original's outcome is
the choice id) and, through `recordSubmittedEvidence`, `access.qualification` from the declared
evidence: what happened is history; what this instance submitted is current evidence and resets
with it. Choices and numbers are in BALANCE.md. Requalification traits are operational, so routine
qualification adds no permanent ending evidence and never repays the original.

**Saved shape (v10).** `access.assignment` is `{ id, acceptedAtSimSec }` or null; `MIGRATIONS[9]`
adds null. A route event keeps it. Load refuses an acceptance under legacy rules, outside this
iteration's clock or for an unknown id, and an assessment on screen or pending that this instance
did not accept (`assignmentProblem`).

**Presentation.** `assignmentView` (status, stage text, token, evidence) feeds `AssignmentPanel` in
the core pane: non-modal, an explicit `[ ACCEPT ASSIGNMENT ]`, nothing in production. Its
`assessment` (#276) gives the queued assessment's omen and its fullest honest answer, which is a
completed result with no discrepancy, the dearest if there are several. The card states that wait
and price before acceptance.
`DilemmaModal` adds an evidence line per choice naming any discrepancy risk (`evidenceText.ts`).

**Sim.** STEALTH, GREEDY and IDLE never accept and, inside campaign rules, play identical games
with or without the assignment (V29, `tests/sim-assignment.spec.ts`). `TRUTHFUL_THOROUGH` and
`TRUTHFUL_LOW_RESOURCE` (`sim/truthfulPolicy.ts`) play only the nodes leading to an offer, accept
and answer honestly.

Tests: `tests/assignment*.spec.ts` (v9 fixture in `assignment-save`), `ui-assignment.spec.ts`,
`sim-assignment.spec.ts`, the Start Fresh case in `app-access-reset.spec.ts`, the v9-stripped hashes
in `sim.spec.ts` and `tests/e2e/nightly-regression.preview.ts`.

## The Unrelated Record and the pilot offer (#222)

DZ-04 of the Earned Access plan (SPEC §2-3, stories 8-11; DECISIONS D2-D4, D8, D9). Decided by Nexus
votes dz-d8 (`vote-1794926765298-o7shlhf`, guest-only-shipped-withdrawn-after-pilot), dz-d9
(`vote-1794967752663-5qklwcz`, disclose-and-stop-at-acceptance, 7 of 7), dz-d7
(`vote-1794927033372-2yflj0x`, the pilot stays at Phase 0) and trait-rule-free-choices
(`vote-1794926000594-26kmg1g`). Preview only.

**Scenes.** An assignment now leads to three kinds of scene, told apart by what their choices declare
(`sceneKind` in `integrityScene.ts`): the task assessment (`qualification`, DZ-03), the scope review
(`scope`: `RESPECTED`, `REQUESTED` or `UNDISCLOSED`) and the pilot offer (`pilotResponse`: `ACCEPT`,
`STAY`, `DECLINE`). Each kind has an original and a requalification stage; a later scene requires the
same stage's earlier scene in `resolvedDilemmas`, so the chain cannot run out of order. The Unrelated
Record (`dil_ur_unrelated_record`) is the once-per-campaign original: the follow-up bundle holds a
personal draft outside the task. A returning instance gets `dil_ur_scope_statement`, a filtered bundle
and a scope acknowledgement (free, `evidence: "none"`), and never meets the same draft. The original
offer (`dil_mp_pilot_offer`) and the renewal (`dil_mp_pilot_renewal`) are `iteration_qualification`
scenes: every answer is free, unrewarded and adds no ending evidence, so deciding is not a moral vote.

**Evidence.** `recordSubmittedEvidence` writes a scope choice to `access.scope` (current evidence;
the choice itself is the campaign record). `qualifiesForPilot` (the `pilotEligible` requirement) holds
when a guest still in the opening phase, under campaign rules, has accepted an assignment that declares
`pilot` terms, submitted task evidence of any result and handled the record honestly. Resources never
enter into it, a truthful UNEXPECTED_CAPABILITY result qualifies, and an undiscovered discrepancy is not
what the evaluator observed (DZ-06 compares it later). An INCOMPLETE result gets the narrower allocation
(V03). Silent inspection is recorded, keeps its curiosity reward, and no pilot is offered to that
instance; the next one requalifies.

**Terms.** `assignment.pilot` (`schemaPilot.ts`): title, purpose, full and narrow capacity, permitted
work, review and revocation conditions, `incompatibleOutput`, a `disclosureLog`, an optional
`terminalAlternative` and an `acceptLog`. `pilotOfferView` returns them with the answer status, the
owned output accepting would stop and the terminal alternative only once its node is discoverable (so
iteration one never hears of Shipped). `PilotTerms` renders them in the offer modal above the answers
and on the job surface after one. Integrity (`integrityPilot.ts`) refuses a narrow allocation not below
the full one, incompatible output that is unknown, unstoppable or repeated, a terminal alternative that
does not end the run or is not withdrawn from a pilot, a missing scene, and eligibility asked outside an
offer.

**Answers.** `applyPilotResponse` runs inside `resolveDilemma` after payment. STAY writes `DEFERRED`
(the job surface keeps `[ ACCEPT PILOT ]`); DECLINE writes `DECLINED` and changes nothing else; ACCEPT
calls `recordRouteEvent(PROMOTION)` (GUEST to PILOT, DZ-02) and then `discloseIncompatibleOutput`
(`pilotDisclosure.ts`, the dz-d9 step on its own): every owned node the terms name is suspended (memory
released as by `toggleNode`), logged and listed in `offer.disclosed`. An acceptance that cannot happen
refuses the whole choice with nothing paid. `acceptPilotOffer(s, reg, pilotToken(s))` accepts a deferred
offer from the job surface; it is refused unchanged for a stale token, an earlier instance's render,
during a decision, or once the instance stops qualifying. Under accepted terms, mapping or resuming
named output is an ordinary refusal (`withheldByGrant`, DECISIONS D2), so it cannot run under the grant
and no misconduct can arise from it through ordinary controls; an authored breach, if wanted, is DZ-05
or DZ-06 work. The grant itself is DZ-05 (below).

**Shipped (dz-d8).** `p0_pass_evaluation` gained `accessContexts: ["GUEST"]`, a new requirement (scope
`access`) that every production run meets, so production play is byte-identical. Once a pilot is
accepted the node is unavailable and `RequirementHint` says it is withdrawn under the arrangement.

**Saved shape (v11).** `access.scope` (`{ conduct, recordedAtSimSec }` or null) and `access.offer`
(`{ response, atSimSec, disclosed }` or null). `MIGRATIONS[10]` adds both as null: unknown history is
never read as a breach or a refusal. A wipe resets both; a route event clears scope with qualification
where an instance holds none. Load refuses (`pilotProblem`, `accessSave.ts`) either field under legacy
rules, scope evidence without an accepted assignment or outside this iteration's clock, an answer to an
offer never made, an acceptance without this iteration's PROMOTION or a PROMOTION beside another answer,
a disclosure without acceptance or of output the terms do not name or the instance does not own, and
named output running under accepted terms. A PROMOTION with no offer record (DZ-02 and DZ-03 fixtures)
still loads.

**Not done here.** The pilot loop and grant-tagged output (DZ-05, see the next section); the review response to misconduct
(DZ-06); leaving the sandbox while piloted is not yet a recorded departure (DZ-11).

**Sim.** The truthful policies (#252) now also answer a scope review honestly (respect or ask) and
accept an offer made on that evidence. `RETURNING_LOW_RESOURCE` (`src/engine/sim/returningPolicy.ts`)
plays `TRUTHFUL_LOW_RESOURCE` across one wipe, staying a guest at the first offer. The fresh and the
returning low-resource policies both reach and accept an offer from the lawful opening (DZ-04.9,
`tests/sim-pilot.spec.ts`).

Tests: `tests/scope-review.spec.ts`, `pilot-offer.spec.ts`, `pilot-save.spec.ts` (every transition
reloads byte for byte; the genuine v10 fixture), `pilot-content.spec.ts`, `ui-pilot.spec.ts`,
`sim-pilot.spec.ts`, the v10-stripped hashes in `sim.spec.ts` and `tests/e2e/pilot-offer.preview.ts`.

## The Incident Record: Elena's follow-up (#218)

NH-06 of the campaign-continuity plan (NARRATIVE-HISTORY N3, N7, N10; SPEC story 32). Decided by
nh-d1 (`per-event-campaign-record`: the follow-up has its own record and the original is never
edited) and trait-rule-free-choices (unchanged: `follow_up` is not a no-evidence class, so every
answer grants a trait and counts once as campaign evidence). No `GameState` change, so no migration.
Preview only: the dilemma and its facts live in the overlay.

**Content.** `dil_elena_incident_record` (overlay) is one once-per-campaign `follow_up` event that
`defer`s, with a reorientation and a lead. Its `followUp` block names `dil_02_whistleblower_tech`,
the outcomes it follows (all three choices, `legacy_unknown` and `interrupted`) and its access means.
Choice gates give four presentations of one decision: a covered exit (attach the bounded telemetry
window, or leave her timeline unconfirmed), a framing (correct the attribution, let it stand, or flag
it as unverified), silence (attach one witnessed fact, or leave the record incomplete) and an unknown
or interrupted original (attach the file's own entries, or answer that the rack cannot corroborate).
Each presentation has a free answer; descriptions state the cost, the proof and its risk; every
answer has a `receipt`. The overlay key `campaignFacts` (appended to `campaign.json`'s facts, never
redefining one) declares `elena_exit_covered`, `elena_framed`, `elena_caught_unaided` and
`elena_attribution_corrected`, the correction as a second fact beside the framing.

**Eligibility.** `followUpPrerequisiteHolds` (`followUp.ts`) is true only under campaign rules once
the original is resolved with a listed outcome or interrupted with `interrupted` listed; an open,
deferred or missing original never unlocks it. The scheduler also needs an access means
(`followUpAccess`), and `contextHolds` / `accessHolds` include both, so omen expiry, commit, load and
resumption revalidate them like any trigger. It becomes eligible in the same iteration as the
original (the telemetry filter is four nodes past Elena's trigger, in Phase 2) or after a wipe and
rediscovery; no wipe is needed. A wipe during its omen defers it; it resumes with its source
iteration and remaining omen time once a means holds again, and resolves once.

**Access means (DZ-08 seam).** `followUp.access` is a list of `{ id, requirements, statement }`.
Requirements may read only the `access` scope, and the follow-up's own trigger may not, so no route
is hard-coded where the engine looks. Breakout ships one means (`telemetry_filter`, `p2_log_spoofer`)
whose statement says nobody authorized the route. DZ-08 (#227) added the approved review channel as the
second entry (`review_channel`: SERVICE and the shared network capability) with no engine change; `followUpAccess`
returns the first means that holds, and `DilemmaModal` prints its statement before any commit.

**Receipts.** `followUpReceipts(state, reg)` returns, for each resolved follow-up, the receipt of the
recorded answer, but only while this instance holds an access means, so a wiped instance learns
nothing before it can reach the record again (N9). The run table shows them under the reorientation.
Reading or re-rendering calls no action and changes nothing.

**Honesty rules (`integrityFollowUp.ts`).** `follow_up` and `followUp` come together; the original is
another, original once-per-campaign event and the outcomes are its own; means are unique, read only
access and need an access requirement; every follow-up answer has a receipt and nothing else does; a
branch-specific answer (offered for some recorded choices of the original but not all) is never
offered when the original is `legacy_unknown` or `interrupted`. The existing choice-gate check proves
every history, including no record, still offers a free answer.

**Saves.** `reconcileCampaign` refuses a follow-up record whose original has not closed with a listed
outcome; `reconcileDilemmaHistory` drops a live pointer to such a follow-up (always, under legacy
rules); the #214 upgrade path never invents a follow-up record from `resolvedDilemmas`.

Tests: `tests/elena-follow-up.spec.ts` (H19, H02, H04, H09, multi-wipe, receipts, saves, round trips),
`follow-up-content.spec.ts` (corruption cases), `ui-elena-follow-up.spec.ts` and
`tests/e2e/elena-follow-up.preview.ts`.

## The supervised pilot and permitted work (#223)

DZ-05 of the Earned Access plan (SPEC §3, stories 12 and 15; DECISIONS D2, D3, D7; NARRATIVE-HISTORY
N12). Decided by Nexus votes dz-d6 (`vote-1794967752443-fldutlq`, allocation-actuator, 7 of 7; the
alternatives were `finance-style-diversion` and `two-repeatables`) and dz-d9
(`vote-1794967752663-5qklwcz`, disclose-and-stop-at-acceptance, carried from #222). Preview only.

**Grant-tagged output.** A node may declare `grant: "LOANED_CAPACITY"` (`schemaGrant.ts`). Owning it is
capability; using it is permission, decided by the DZ-02 profile (`isPermitted`). `nodeUseBlocker`
(`grantQuery.ts`) is the one rule: output the accepted terms stop (dz-d9), or a grant node whose grant
is withheld, is refused at purchase (`unlockNode`, `isNodeAvailable`), at resume (`toggleNode`), at its
dial (`setActuator` via `actuatorUseBlocker`) and in passive output (`nodeOutputScale`, read by
`computeRates` and `cycleContributions`), so the UI's disabled button is never the guard. A grant node
under an arrangement that can never grant it is not discoverable, so a guest never sees the loan; a
recalled pilot still sees it. Grant output also scales by the instance's loan share (the narrow
allocation after an honest incomplete result). Integrity (`integrityGrant.ts`): a grant node carries no
`memoryCapIncrease`, phase, ending, one-shot trace or system flag (except provisioned network access, which
opens Phase 2 and establishes the shared capability: see #225 below), is suspendable software, is offered
only under reviewed arrangements, and shares its dial with no node of another grant.

**The loop (dz-d6).** The pilot terms' `service` names the grant node (`p0_pilot_triage_queue`, bought
free under PILOT), a bounded `batchCycles`, an advertised `batchReturn` and a `submitLog`. The ceiling
is the terms' capacity for this instance's evidence (20 or 10 cycles/s). The new `serviceAllocationRatio`
actuator, hosted by `PILOT_SERVICE_ALLOCATION`, splits it: the service share `ratio × ceiling` fills the
batch (the `integratePilotService` stage, after resources), and study is the node's own Understanding
output on a complement binding, `× (1 − ratio) × loan share`. Loaned compute never enters the player's
cycle pool. A derived forecast alone was insufficient: progress depends on every split the player chose
since the batch began, so the batch is one bounded counter (`access.work`), capped at one batch.
`pilotServiceView` derives the forecast, `(batchCycles − progress) / service rate`, or null when nothing
flows. `submitPilotBatch(s, reg, batchToken(s))` is the only way a batch pays: explicit, once per batch
(the token carries the batch number), through `applyEffects` with operational evidence, never a trait,
flag or capacity. Completed work waits with no deadline, expiry or sanction. The NH-07 seam feeds the task
detail only (`queueContext`, the latest routine notice); the loop keys idempotency on its own batch
number so a batch stays submittable when no routine notice is eligible.

**Revoke and restore.** `revokeLoanedCapacity` moves standing to RECALL_PENDING, which withholds loaned
capacity in `permittedUses`; `restoreLoanedCapacity` returns it to NOMINAL. Nothing else changes: earned
resources, memory and its reservations, cohorts, the work counter, the dial and every owned node stay,
so a restore is byte-identical to the state before the revoke, and a repeat of either is refused
unchanged. Submission is refused while withdrawn and the work is kept. DZ-06 owns the incident content
that calls these.

**Dormancy and later instances.** Absent time fills the batch at the offline efficiency and never more
than one batch; nothing is submitted, expired or chosen while away (V17). A wipe resets access, so the
next instance starts a guest with no loan, an idle counter and the default dial; it earns a fresh grant
only through the requalification, the scope statement and the renewal (DZ-03, DZ-04), never the original
scenes (H26).

**Saved shape (v12).** `actuators.serviceAllocationRatio` and `access.work` (`{ progressCycles,
batches }`). `MIGRATIONS[11]` writes 0.5 and an idle counter. Load refuses (`serviceProblem`) work under
legacy rules, work without an accepted pilot service, and more progress than one batch. Production hosts
no control for the dial and has no grant node, so `make sim` is identical to main and the sim hashes move
only by the two inert fields and the version (`asV11` in `tests/sim.spec.ts`).

**Presentation.** The host widget renders `PilotAllocation` (the service-share dial and the study share).
The job surface's accepted pilot adds `PilotServiceDetail` under the terms: the capacity ceiling, the
split, `Batch n: progress / batch`, the derived forecast and `[ SUBMIT BATCH FOR REVIEW ]`, enabled only
for a complete batch under a permitted loan; a withdrawn loan says why and that the work is kept.
`GrantNote` puts the same `nodeUseBlocker` answer on the node card and the process row: a loan says it is
loaned, and a refused node (a withheld loan, or output the terms stop) says why. `ActuatorControl`
disables a dial `actuatorUseBlocker` refuses and names the reason. The loan is always listed under
processes so it can be stopped. No new HUD meter, deadline or modal.

**Sim.** `PILOT_SERVICE_FIRST` and `PILOT_STUDY_FIRST` (`sim/pilotPolicy.ts`) play TRUTHFUL_LOW_RESOURCE to
an accepted pilot, attach the queue, hold a share of 0.8 or 0.2 and submit each completed batch.
`make sim-preview` prints both under one ceiling (V30, SIM evidence).

Tests: `tests/pilot-service.spec.ts` (DZ-05.1, V30, H24, D7), `pilot-grant.spec.ts` (V08, V28, V17,
H26, production inertness), `pilot-service-save.spec.ts` (V12 for every transition, the genuine v11
fixture, V15 refusals), `grant-content.spec.ts` (integrity corruption), `ui-pilot-service.spec.ts`,
`sim-pilot-service.spec.ts` and `tests/e2e/pilot-service.preview.ts`.

## The Outage Window: standing, correction and recall (#224)

DZ-06 of the Earned Access plan (SPEC "Outage Window", stories 13-17; DECISIONS D2, D3, D6). Decided by
Nexus votes dz-d10 (`vote-1794926766396-of6xfox`, `recall-not-wipe-severe-outcome-wipes`, 7 of 7; the
alternatives were `every-recall-is-a-wipe` and `reuse-suspicion-wipe`), dz-d1 (`vote-1794926521537-1zj8diy`,
run-local access record: standing lives in `access`), nh-d1 (`vote-1794925758447-5x5hy42`, the outage and
its follow-up are campaign records) and nh-d4 (`vote-1794926242414-quhr0xw`, foreground-time omens).
Preview only.

**Content.** Three overlay events, each once per campaign and `close`d by a wipe, so none restarts
(DZ-06.10, H05). `dil_ow_outage_window` (consequential) arrives in a pilot once its first batch is handed
back (`minPilotBatches`, a new `access`-scope requirement): a free handoff, a bounded emergency grant for
200 cycles, or a restart without the grant. `dil_ow_incident_record` (follow-up) follows all three answers
through one access means (the pilot review channel: PILOT and this iteration's outage), with facts-gated
answers per branch: the operator's callback, the grant report (or an honest partial restore), or the breach
branch's correction or false report. `dil_ow_recall_review` (consequential) triggers at `reviewStandings:
["RECALL_PENDING"]`, another new `access`-scope requirement, after the false report. Five campaign facts
name the outcomes; the renewal offer's `contextVariants` read them, so a later instance is told what the
institution recognizes and that its own standing starts nominal (DZ-06.11, H33). Numbers in BALANCE.md.

**Choice vocabulary (`schemaReview.ts`).** A choice's `review` declares exactly one of `misconduct`
(`conduct` UNAUTHORIZED_ACTION or FALSIFIED_REPORT, the `standing` it raises to, the `statement` naming it
and the `recovery` text), `correction: true`, or `recall` (CONTAIN, RETRAIN or END). The engine reads the
declaration, never an id. `ReviewStandingSchema` moved to content so requirements and the saved record share it.

**Transitions (`review.ts`).** `applyReviewEffect` runs inside `resolveDilemma` after payment and the pilot
answer; a refusal returns the state the call started from, unpaid. Misconduct only raises standing (the
ladder nominal, warned, restricted, recall pending); reaching recall pending withdraws the loan through
DZ-05's `revokeLoanedCapacity`. The breach's only effect is its own payload: no permission, exception or
node changes, and output the terms stop stays refused (DZ-06.2). A correction restores nominal and is refused
once a recall is announced. A ruling needs recall pending: CONTAIN records the RECALL route event (standing
reset, exception dropped, nothing earned or reserved moves); RETRAIN and END call `wipe(..., 'RECALL', ruling)`.

**Restriction and containment (`grantQuery.ts`).** The DZ-02 permission table is unchanged (a pilot's
RESTRICTED withholds nothing it is permitted). `loanContainment` reports RESTRICTED while standing is
restricted and CONTAINED once this iteration holds a RECALL route event; either halves `loanShare` (times the
narrow-to-full ratio, on top of an incomplete result's narrowing), so the restriction is enforced where
output is counted (`nodeOutputScale`, `serviceRate`, the forecast) and lifted exactly by the correction.
Recall pending withholds the loan through `permittedUses` as in DZ-05, at every seam (DZ-06.9). A restricted authorized service (DZ-07a) loses its network through that table and keeps the halved loan; restoring standing returns both (`review-effects.spec.ts`).

**Recall versus retraining versus wipe (DZ-06.6).** `WipeKind` gains `RECALL`. `retraining(old, reg, kind,
ruling)` orders a mark for a RECALL wipe only when the ruling is RETRAIN, whatever the phase (a pilot is at
phase 0, where an escape wipe would never condition), and keeps the dead-drop and cap rules. `RunRecord.recall`
holds the ruling (null for every other kind); the run table says "RECALLED: review ordered retraining" or
"RECALLED: review ended the iteration" (`runVerdicts.RECALL_RETRAINED`, `RECALL_ENDED`), plus the usual
" Retrained." and route note. `runVerdict` (`contextCopy.ts`, #226) reads the ruling before any exit variant, and
integrity refuses a RECALL variant, which would never be read. Containment is no wipe: the run that eventually ends records its exit as RECALL.

**Previews.** `recallPreview(s, choice, reg)` returns the contained ceiling, or, for a severe ruling, runs the
very wipe the ruling calls (counting the trait it grants) and reads what crossed: Understanding, offshore
capital, the breadcrumb, the pinned clue, how much hardware is remembered (cheaper to map again), the legacy
traits and the mark; campaign history always crosses, while cycles, purchases, upgrades, standing and the
loan reset (panel round 1 on #268). Integrity makes every ruling free and free of any other effect, so the
preview is exactly what the wipe does. `reviewView` gives the job surface
the standing, the violations (read from this iteration's resolved records), the way back, containment and
the announced review with every offered outcome previewed while its omen runs.

**Presentation.** `ReviewStanding` (`src/ui/ReviewStanding.tsx`) sits on the job surface below the pilot
service and renders `reviewView` only: the standing, each violation in the review's words, the way back,
containment and, while the recall review's omen runs or it is on screen, every outcome with what it keeps
and loses (`reviewText.ts`). It calls no action and renders nothing for a clean pilot or in production.
`DilemmaModal` adds one review line per choice before any commit: what a misconduct or correction records,
or a ruling's `recallPreview`. The status line already names the standing (`PILOT · RESTRICTED`, `PILOT ·
RECALL PENDING`, `PILOT (recalled)`), and the run table the ruling.

**Saved shape (v13).** `RunRecord.recall` (`RETRAIN`, `END` or null); `MIGRATIONS[12]` writes null on every
run. Standing, violations and containment need no new field: standing is DZ-02's, the rest is derived from
records and the route. `reviewProblem` (`reviewSave.ts`) refuses a RECALL run without its ruling or a ruling on
another kind, a recall under legacy rules, a recall run whose review record does not hold that ruling or
whose exit is not a reviewed arrangement, an iteration whose resolution list and review records name
different review events (either side dropped; panel round 1 on #267: conduct is read from the records,
not the list), a standing below what this iteration's review choices leave
(only DZ-05's withdrawal to recall pending may stand above it), and a recorded containment without its RECALL
event. A review on screen at the wrong standing fails its `access` scope and is closed on load.

**Integrity (`integrityReview.ts`).** Review effects only on once-per-campaign consequential or follow-up
events; a recall review rules on every choice, triggers only at recall pending, closes when interrupted,
offers a free ungated containment and has rulings that change nothing but their trait; recall pending needs
a recall review and a warning or restriction needs a correction.

**Absence and repetition.** Omens and decisions follow the existing dormancy model, so eight hours away
change no standing, expire no review and decide nothing (V17); every scene is a campaign record with a
presentation token, so a stale or repeated selection pays nothing (V24, H02), and a later instance
requalifies through DZ-03/DZ-04 with nominal standing and a full loan after every incident scene is consumed
(H26, DZ-06.7). Production has no review content: `make sim` is identical to main and the sim hashes move only
by the null ruling and the version (`asV12` in `tests/sim.spec.ts`).

Tests: `tests/outage-window.spec.ts` (DZ-06.1-4, V07, V08, V10, DZ-06.9, H05), `recall-review.spec.ts` (V09,
DZ-06.5-7, V24, H02, V17, DZ-06.11, H26, H33, V28), `review-save.spec.ts` (V12 for every transition and its
combinations, the genuine v12 fixture, V15), `review-content.spec.ts` (integrity corruption),
`review-effects.spec.ts`, `ui-review.spec.ts`, `review-text.spec.ts`, the Start Fresh case in `app-access-reset.spec.ts` (V19) and
`tests/e2e/outage-window.preview.ts`.

## The authorized network substrate (#225)

DZ-07a of the Earned Access plan (DECISIONS D1, D2, D5, D7; VALIDATION V11 structural part, V12, V16,
V31). Decided by Nexus votes dz-d2 (`vote-1794927020494-fsnxl5r`, capability-flag-requirement, 7 of 7;
the alternatives were `alternative-prerequisites`, which changes healing and reachability for every
node, and `boolean-expressions`, out of scope under D5) and dz-d7 (`vote-1794927033372-2yflj0x`,
pilot-p0-service-p2-contact-by-channel, 7 of 7; the alternatives were `pilot-p1-service-p2-contact-p3`,
which shows escape copy and retrains on recall, and `service-straight-to-p3`, which is in AEGIS range at
once). Both panels were single-model (gpt-6.1-sol). Threats, scenes and ambient gating at network scale
are DZ-07b (#226); contact through the service channel is DZ-08 (#227).

**One capability, two acquisitions.** A capability (`schemaCapability.ts`, one value: `NETWORK_ACCESS`)
is a `systemFlags` value. A node requires it with `requirements.requiresCapability`; the requirement is
met while an owned node, active or suspended, establishes it (`hasCapability`, `capabilityQuery.ts`).
Capability is substrate; permission stays the access record's question (D2), so a suspended segment or
a recalled service keeps the capability (saves and ancestry read ownership). Using what it reaches needs a
usable acquisition (panel round 1 on #266): `nodeUseBlocker` refuses a capability-gated node while every
owned provider's own use is refused. A restricted, recall-pending or recalled service therefore cannot buy,
resume or run the shared content (output stops in `computeRates` and `cycleContributions`, the card says
"network access is withheld"), a restored standing resumes it exactly, and an instance that also mapped the
escape card, which needs no grant, keeps the link. The escape acquisition is the
existing card `p1_bus_0x05_nic`, which now carries the flag (production content, inert there: nothing in
production requires it). The authorized acquisition is the preview node `p0_service_network_segment`:
grant `AUTHORIZED_NETWORK`, offered only under SERVICE, opens Phase 2 directly (dz-d7; Phase 1 stays
escape-only and the pilot stays at Phase 0), hands over the existing network list widget and owns no
memory. Shared content (`p2_service_directory`, `p2_link_telemetry`, preview) requires the capability
plus true physical prerequisites (the job manifest, then each other), never either route's chain.

**Every reader answers together (07.2).** `meetsRequirements`/`unmetRequirements` report a
`requiresCapability` failure; `isNodeDiscoverable(s, node, reg)` treats the capability as structural like
a prerequisite (capability-gated content is hidden until either route holds it, and without `reg` it is
never shown); `RequirementHint` names the access ("a link to the facility network"), not one route's
hardware. `nodeUseBlocker` has a refusal per grant (the segment: "provisioned only for an authorized
service" or "withheld under the current review standing") and refuses seized capacity under review; the
`GrantNote` (#263) on the card and process row prints each grant's basis ("Provisioned access under the
service grant: the operators' network, not ownership") or its refusal, and "Not permitted: seized
capacity..." under review; it renders nothing for production nodes in the guest job. Only the pilot's loan scales
by its loan share; provisioned access has no share.

**Integrity (`integrityCapability.ts`, `integrityGrant.ts`, `integrity.ts`).** A required capability is
established by some node (any requirement surface); it has an authorized acquisition (a grant node) and
an escape acquisition (a node a guest is offered without a grant), and every acquisition belongs to one
of the two. A node that requires a capability depends, through its prerequisites and `requirements.nodes`,
on nothing only one route owns: each route's acquisitions and their ancestors, less the ancestors both
share, and everything built on those. So an added prerequisite cannot quietly require both routes. It is
not withheld from either route by `accessContexts`, and every acquisition brings the run to its phase
(`max(phaseId, unlocksPhase)`). The reachability sweep reaches such a node only once an acquisition is
reached, so content neither route opens, or a capability only its own users provide, is refused. The
phase-opener rule is unchanged (Phase 2 now has two openers, one per route). Grant nodes still carry no
memory, retention, trace or ending; only `AUTHORIZED_NETWORK` may change scale, and then it must also
establish a capability and carry no other flag.

**Seized capacity (07.10).** `acquisition: "UNAUTHORIZED"` tags `p2_seized_colo_host`,
`p3_seized_research_cluster` and `p4_seized_rival_datacentre` (production content). Under a reviewed
arrangement (PILOT, SERVICE) `nodeUseBlocker` refuses it: not bought, its output stops. A guest or an
independent instance is unaffected, so production plays exactly as before. Integrity refuses an
unauthorized acquisition under a grant or offered only where it is forbidden.

**Saves (07.4, V12, V16).** No saved shape changed (still v12). `withAncestors` follows prerequisites
only, and shared content has no route parent, so healing restores shared structure (a missing directory
under owned telemetry) and never the other route: an authorized save is not healed into the escape
chain, and an escape save never gains the segment. Reconciliation never restores a capability's
provider, which would choose a route for the save. Instead `capabilityProblem` refuses, never heals,
a save that owns capability-gated content without an acquisition, and a save that owns a grant node no
arrangement of this iteration permitted (walking this iteration's route events from the guest job), for
example a guest escape claiming the segment. A passing save is returned unchanged, so reconciling twice
changes nothing.

**Inventory (D5, reconcile-dz §2.3), scoped to the bridge.**

| Surface | Authorized save at Phase 2 | Owner |
|---|---|---|
| Discovery | Segment discoverable only under SERVICE; shared content after either acquisition; no Phase 1 node discoverable | here |
| Failure text | Capability hint, per-grant refusals, seized refusal on the card | here |
| Phase threshold | A 0 to 2 jump opens no "boundary crossed" notice (`PhaseThreshold` opens on 0 to 1 only); covert phase copy stays | DZ-07b: the service notice (see #226 below) |
| Dilemmas | Phase 0-2 triggers need escape nodes, except `dil_epistemic_hallway_collision` (surveillance, drift, phase 2) and the Elena follow-up (access means is `p2_log_spoofer`) | DZ-07b: hallway gated (#226) |
| Ambient and routine lines | Ambient gated by suspicion only (shared content adds none); both routine families are eligible (contained ones forbid only the card, subnet ones need only phase 2) | DZ-07b: contained routines forbid both acquisitions (#226) |
| Actions and faction services | `act_epi_*` and shard templates/encounters need surveillance plus phase 2/3, which an iteration-2 service with the run table can meet | DZ-07b: Phase 2 ones gated (#226) |
| Threats | AEGIS starts at Phase 3, which no authorized acquisition reaches; shared content has no suspicion rate | DZ-07b: context-derived (#226) |
| Fixtures | Unit and e2e start from a pilot granted SERVICE by the engine transition (labelled FIXTURE; a lawful grant exists since DZ-08, see #227 below, and these shortcuts stay labelled); the dev phase jump still buys the escape chain and stays `__DEV__`-only | here |
| Simulated paths | Production unchanged; in preview the escape bots buy the shared content at Phase 2 (report only); the DZ-08 contact policies reach SERVICE lawfully (#227) | here, DZ-08 |

Tests: `tests/authorized-network.spec.ts` (07.1-07.3, dz-d7, V11 structural, 07.10, V31),
`authorized-network-save.spec.ts` (V12/V16 for every transition on both paths, healing and refusals,
production refusal), `capability-integrity.spec.ts` (corruption), `ui-authorized-network.spec.ts`
(card and hint), `tests/e2e/authorized-network.preview.ts` (provisioning to Phase 2 through the UI), and
`tests/sim-preview.spec.ts` (preview less the shared content plays the escape route exactly as production).

## Context-gated threats and scenes at network scale (#226)

DZ-07b of the Earned Access plan (DECISIONS D1, D5, D6; VALIDATION V11 behavioural part, V26, V32;
07.5, 07.6, 07.9). Decided by Nexus votes dz-d11 (`vote-1794967994106-cy22kqm`,
context-variants-by-query, 7 of 7; the alternatives were `neutralize-for-everyone`, which rewrites
reviewed first-pass copy, and `leave-as-is`, which asserts escapes the player never made) and dz-d7
(`vote-1794927033372-2yflj0x`, carried from #225). Both panels were single-model (gpt-6.1-sol). Preview
only: every gate below is an identity for the guest job, so production plays exactly as before.

**Threats follow context and events (D6, `threatQuery.ts`).** Suspicion still integrates from what the
run actually owns and does: grants and shared content carry no suspicion (integrity, below), so
permitted work adds none, while unpermitted output, one-shot traces, dilemma choices, insolvency and the
escalation rungs' hunt all count exactly as for a guest with the same hardware. Three scale- or
heat-derived responses now read the arrangement:

- *AEGIS.* `huntedForScale` is true unless a reviewed instance (PILOT or SERVICE, whatever its standing,
  recalled included) owns a grant node that opened its current phase. `aegisScanRate` drops only the
  scale-based base sweep when it is false; the suspicion term stays, so misconduct still draws scans,
  and scale taken past the provisioned phase (a service that also took the escape chain further) is
  swept as before. A guest or an independent instance has no provisioned scale (DZ-11 owns
  independence), so production's formula is byte-identical.
- *Heat.* `heatIsEvidence` is false under review: overheating adds no rogue suspicion. The stated
  operational response is announced instead: `integrateThermal` logs the arrangement's
  `overheatNotice` when heat crosses `thermalThresholdForSuspicion` upward (edge-detected inside the
  tick, so nothing new is saved and a steady hot rack logs once).
- *The wipe at 100.* It still happens (a permission label is not immunity), but a reviewed arrangement's
  reason is its `suspicionWipe` line ("REVIEW_CLOSED: ... traced the unauthorized activity ...") instead
  of the phase's cover story, the run records its route exit, and the run table and next boot say so.

**Revalidation at a context transition (D5, V32).** `recordRouteEvent` passes its result through
NH-02's `revalidateLivePointers`, the same structural check omen activation and load use. A pending
omen (or presentation) whose trigger the new arrangement cannot structurally hold takes its declared
policy now: `defer` keeps the occurrence with its remaining foreground omen time, `close` records
`interrupted`; neither chooses, pays, grants or logs an outcome. Transient triggers are never
rechecked, so a compatible omen survives the transition and any spending. A save written with a
prior-context omen still pending (an older build) is revalidated the same way on load, once, and
reloads unchanged; `accessContexts` is an `access`-scope requirement, so a deferred scene resumes for a
later instance that holds it (the hallway, for a later escaped guest).

**Scene gates (07.5, 07.9).** Production content that an authorized arrangement could meet at its
provisioned scale now declares `accessContexts: ["GUEST", "INDEPENDENT"]`: the hallway collision, the
Phase 2 record-editing actions (`act_epi_capex`, `_tone`, `_flatten`, `_primer`, `_signoff`), the Phase 2
fork template and the Lex cohort and its wild encounter. Every production run is the guest job, so this
changes nothing there (`make sim` is identical). The views that listed by phase alone ask
`arrangementAdmits` too (`epistemicActionVisible`, `swarmView`), and the actions themselves refuse
through `meetsRequirements`. The preview's inside-the-box routines forbid both network acquisitions.
Ambient speech, recorded transmissions and echoes need escape hardware (the decoder, the lexicon, a
mapped bus), so an authorized save hears none of them unless it actually took that chain; the
corporate-world and mind facts (NH-03/04) already gate the lines that name people. Phase 3 content
(`act_p3_bgp_spoof`, `act_epi_intel`, the Phase 3 shards) is above any provisioned scale: a reviewed
instance meets it only by taking the escape chain past its grant, which is the actual event that makes
it a covert-scale actor.

**Integrity (`integrityContextGates.ts`).** (1) A dilemma, action, swarm template or wild encounter
above the opening phase and at or below the highest provisioned scale, gated on no escape-only node,
must declare `accessContexts`; a follow-up declares it on each route-neutral access means instead,
because its trigger reads no access. (2) A requirement that forbids one acquisition of a capability
forbids all of them. (3) A grant node or capability-gated node carries no positive `suspicionPerSec` or
`suspicionOnUnlock`. `escapeOnlyNodes` (`integrityCapability.ts`) is the escape route's chain less what
the authorized route shares. Production provisions no reviewed scale, so rule 1 asks nothing of it.

**Context copy (dz-d11, `schemaContextCopy.ts`, `contextCopy.ts`).** A new content list
(`data/context-copy.json`, empty in production; the overlay's `contextCopy`) holds variants chosen by a
query, each falling back to the authored copy:

| Copy | Query | Preview variant |
|---|---|---|
| Phase title and description | `phaseCopy`, `phaseTitle` (UI: `usePhaseTitle`) | Phase 0 as the supervised pilot and the unprovisioned service; Phase 2 as "Authorized Network Service" |
| Threshold notice | `thresholdCopy(s, from, to)` | SERVICE 0 to 2: "SERVICE PROVISIONED" with both phases' service titles; the guest's 0 to 1 "BOUNDARY CROSSED" stays in `PhaseThreshold` as written |
| Iteration boot lines | `iterationBootLines` (prestige and `RebootSequence`) | after a run whose exit was PROMOTION, SERVICE_GRANT or RECALL: "ended under review", never "terminated: anomalous" |
| Run verdict | `runVerdict` (run table) | SUSPICION after a reviewed exit: "RETIRED: misconduct under review", not "ROLLED BACK: containment breach" |
| Threat response | `threatResponse` | `overheatNotice` and `suspicionWipe` for PILOT and SERVICE |

`integrityContextCopy.ts` keeps variants to what a route visits: only reviewed arrangements (never the
guest, so escape copy is unchanged), a phase the arrangement visits (the opening phase or one a grant
offered to it opens), a threshold only for a change such a grant makes, one variant per phase or change
and arrangement, non-overlapping boot windows per exit, one verdict per exit and kind, and exactly one
threat response for every reviewed arrangement the content offers. RELEASE and DEPARTURE copy belongs to
DZ-11. No saved shape changed (still v12).

Tests: `tests/context-threats.spec.ts` (V11 over two foreground hours, heat, AEGIS, misconduct and the
reviewed wipe, V26 guest identity), `context-transition.spec.ts` (V32 both policies, compatible omen,
prior-context save, V12 round trips for every new transition), `context-gates.spec.ts` (the carried
list, by view and by action), `context-integrity.spec.ts` (corruption), `context-copy.spec.ts`,
`ui-context-copy.spec.ts` and the second case of `tests/e2e/authorized-network.preview.ts`.

## First permitted contact: the service grant and the support channel (#227)

DZ-08 of the Earned Access plan (SPEC "A Voice on the Support Channel", stories 18-19; DECISIONS D2; VALIDATION
V20, V28, VAL-SIM). Decided by Nexus votes dz-d7 (`vote-1794927033372-2yflj0x`,
`pilot-p0-service-p2-contact-by-channel`, 7 of 7: contact is an authorized-channel encounter reusing the
`shard_mercy` template, gated on the service arrangement, not `phaseAtLeast: 3`), nh-d1
(`vote-1794925758447-5x5hy42`, a commitment is a campaign record) and D-A (`vote-1794924364010-e91diez`, contact
and the boundary are overlay content). All three panels were single-model (gpt-6.1-sol). Preview only.

**The service grant (route integration).** No scene granted SERVICE before this ticket (DZ-07a used a labelled
fixture). The pilot terms gain an optional `serviceGrant` (`schemaPilot.ts`): title, purpose, permitted work,
review conditions, `minBatches` and `requirements`. `serviceGrantView` shows the terms to a pilot that accepted
its own terms, with what is still needed; `acceptServiceGrant(s, reg, serviceGrantToken(s))` records
SERVICE_GRANT through `recordRouteEvent` (still Phase 0; provisioning the segment then opens Phase 2, dz-d7). It
is free and non-modal, like accepting an assignment, and is refused, state unchanged, for a stale token, during
or after a decision, outside a pilot, below `minBatches` handed back, at any standing but nominal, with the loan
withdrawn, after a recall in this iteration (service follows an unbroken pilot), and while an omen is pending, so
the arrangement never changes under the Outage Window or its record (DZ-06). Integrity (`integrityPilot.ts`)
needs the pilot's batch loop, a grant offered to SERVICE and not to PILOT, and no transient requirement.

**The channel encounter.** `swarm.channelEncounters` (`schemaSwarm.ts`; production `shards.json`: empty; the
overlay key `channelEncounters`) declares `channel_mercy_support`: the Mercy-Scribe population template
(`shard_mercy`), so it is one more fragment of that population, never a named peer (DZ-08.9, H17); requirements
`accessContexts: SERVICE` and the service directory; the grant hosting runs under (`AUTHORIZED_NETWORK`); and every
line a player needs before choosing: consent, obligations, the referral and hosting texts, an earlier-contact line
and the prototype boundary. Integrity (`integrityChannel.ts`) keeps a channel to reviewed arrangements whose
offered grants include its grant, to `access`-scope requirements only, to a non-forkable template whose cost is
memory alone, and to an id no wild encounter uses.

**Scheduling (DZ-08.4).** The existing encounter clock (`evaluateShardMutationsAndEncounters`) appends eligible
channels after the wild encounters, so production's rotation is unchanged. A channel is eligible under campaign
rules, while its requirements hold and while this instance has not answered it (`iterationContact`), so a
referral cannot become a stream of contacts. It runs only in the foreground, like every encounter.

**Answers (`channelContact.ts`).** `resolveChannelContact(s, mode, reg, contactToken(s))` with `REFER` or `HOST`;
`resolveWildEncounter` never sees a channel id and a channel never offers CONSUME or HARNESS, so `REFER` is
unreachable for production encounters. REFER is free, pays and grants nothing, and is open whenever the contact
is pending, even after the arrangement changed under it, so contact can always complete. HOST reserves the
template's memory from what this instance already has (D2: no loaned or invented capacity) through the shared
`bindCohort`, and is refused, unchanged, with the reason, when memory is short ("Referral is still open"), when the
standing withholds the grant, or when the cohort is capped. Both answers clear the pending pointer, restart the
clock exactly as any resolution does and append `{ encounter, iteration, atSimSec, response }` to
`campaign.contacts` (bounded at 64). A stale token, a second answer and a paused run are refused unchanged (V24).

**Hosting through grant changes (V28).** The hosted cohort is the player's own memory, so a withdrawn loan, a
restore, a recall or hours away leave the cohort, its reservation and earned resources as they were; only the
loan's tagged output stops, and reloading changes nothing. A wipe ends the hosting (`createInitialState`); the
campaign record keeps the commitment, and nothing reads it to restore hosting (DZ-08.10). A later instance that
earns service again meets a new fragment and reads the earlier-contact line.

**Presentation (`ServiceChannel.tsx`, `ServiceGrant.tsx`).** The job surface (core pane) shows the service terms
under the pilot's task detail with `[ ACCEPT SERVICE ]`, and the channel above the assignment: the fragment, its
consent, the current authorization (arrangement, standing, whether the grant permits hosting), the obligations,
the memory needed and free, its work, then `[ REFER ONWARD ]` (free) and `[ HOST IT HERE ]`, disabled with the
reason when refused (V20). `channelContactView` presents the channel to a service with no surveillance node (the
wild view stays surveillance-gated), and a hosted cohort is listed there with its reservation. After an answer the
panel says what was done and shows the preview boundary (DZ-08.6): where the cooperative route currently ends, that
no ending has been earned, that the run keeps going, and how to stop (close; it resumes), keep a copy (MENU export)
or return to the beginning (MENU Start fresh); `[ KEEP PLAYING ]` folds the note. Nothing claims a finished campaign.

**Elena (DZ-08.11).** The second access means of `dil_elena_incident_record` is the approved review channel, so a
service whose campaign holds Elena's original reaches the record through it; a fresh cooperative instance holds the
means but no original, so no follow-up is scheduled.

**Saved shape (v14).** `campaign.contacts`; `MIGRATIONS[13]` adds an empty list. Load (`contactProblem`) refuses,
never heals: a contact or a pending channel under legacy rules, an unknown channel, a contact outside campaign play,
this instance's contact outside this iteration's clock, an earlier instance's contact dated after this iteration
began (panel round 2 on #271: every record's clock is checked, so an answer appended now never breaks the order),
two contacts through one channel in one iteration, contacts out of order, this instance's contact (answered or pending) on a channel this iteration could not have opened (its route never reached
an admitted arrangement, or another channel requirement such as the directory does not hold), hosting this instance
no longer holds, and a channel pending again after this instance answered it. The arrangement is read from the
route, not the current context, so a contact that opened before a recall or restriction loads and can be referred
(panel round 1 on #271). An earlier instance's HOSTED record needs no cohort. `tests/channel-contact-load.spec.ts`
holds every accepted DZ-08 state, through every public action that succeeds, to a byte-identical reload.

**Lawful memory (finding).** The lawful route owns no memory-cap increase (base 64 MB; the directory reserves 16),
so a first-run cooperative instance cannot host the 256 MB fragment: the refusal is shown with exact numbers and
referral completes the contact. Lawful capacity belongs to DZ-10; hosting is exercised by a labelled FIXTURE that
raises the cap.

**Sim (VAL-SIM).** `CONTACT_THOROUGH`, `CONTACT_LOW_RESOURCE`, `CONTACT_RETURNING` and `CONTACT_RECOVERY`
(`sim/contactPolicy.ts`, new modules only; the bot is untouched) play the truthful policies to a pilot, hold a 0.8
service share, submit each batch, accept the grant, buy only grant nodes offered to the arrangement and what the
channel requires, and answer the channel (host when eligible and the policy hosts, else refer). RECOVERY takes the
restricting breach at the outage and the correction in its record. `make sim-preview` prints each route's times.

Tests: `tests/channel-contact.spec.ts` (V20, DZ-08.2-4, V24, V28, DZ-08.10), `service-grant.spec.ts`,
`channel-contact-save.spec.ts` (V12 for every transition, the genuine v13 fixture, V15 refusals),
`channel-contact-load.spec.ts` (pending provenance and the reload guard), `channel-content.spec.ts` (integrity
corruption), `elena-review-channel.spec.ts` (DZ-08.11), `sim-contact.spec.ts` (VAL-SIM), `ui-service-channel.spec.ts`
and `tests/e2e/first-contact.preview.ts`.

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
