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

The strict app envelope is `{ version: 2, savedAtMs, paused, game: serialize(game) }` under
`daemon-zero.save.v1`; a version 1 envelope (no `paused`) is read as not paused. `paused` is the
player's pause (#347): while it is set the store's `step` applies no time, live or as catch-up, and a
paused save loads with no catch-up for the time away. `GameState` itself is unchanged. Reads validate the bounded
JSON envelope and use engine `deserialize` to validate/migrate/reconcile the game.
The loader also bounds pending live time before passing untrusted state to catch-up.
On `SaveError`, the original raw value is stored at
`daemon-zero.save.corrupt-backup` before a fresh run can replace it (a save from the pre-release
preview build is backed up the same way, with its own notice; see
[Content composition and preview saves](#content-composition-and-preview-saves-204-233)). A backup or
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
- `registry.ts` - `buildRegistry(raw)` returns an indexed `ContentRegistry` or throws `ContentError` listing every problem. The registry carries a `campaign` index (once-per-campaign events, campaign-evidence actions, id aliases, retired ids).
- `schemaRoutine.ts`, `integrityRoutine.ts`, `data/routines.json` - routine operation templates (the base file is empty; the Earned Access pack adds them). See [Routine activity](#routine-activity-219).
- `schemaAssignment.ts`, `schemaAssessment.ts`, `integrityAssignment.ts`, `data/assignments.json` - assigned work and its assessment evidence (the base file is empty; the Earned Access pack adds it). See [Nightly Regression](#nightly-regression-assigned-work-and-assessment-evidence-221).
- `schemaCampaign.ts`, `integrityCampaign.ts`, `data/campaign.json` - campaign declarations, history labels and their rules. See [Campaign records](#campaign-records-212) and [Interrupted stories](#interrupted-stories-and-the-pinned-clue-213).
- `schemaCapability.ts`, `integrityCapability.ts` - the shared access capability and seized-capacity provenance. See [The authorized network substrate](#the-authorized-network-substrate-225).
- `integrityFollowUp.ts` - follow-up arc steps: what they follow, their access means and receipts. See [The Incident Record](#the-incident-record-elenas-follow-up-218).
- `integrityFeeds.ts` - feed sources (#449): exactly one per phase, at least `MIN_FEED_LINES` lines and one ungated line per source, and no line whose own-iteration gate (node, `phaseAtLeast`, a dilemma resolved this run) opens only after its source is outgrown. Campaign facts and outcomes are exempt, because a wipe does not reset the world. `speechQuery.ts` (`ambientFeedSource`, `eligibleAmbientSpeech`, `eligibleLoggedFeed`) plays the current reach's source only; a source declared `kernelLog` (the guest's, #460) is heard in the kernel log through the `relayLoggedFeed` stage (`systems/feedLog.ts`, last in `TICK_PIPELINE`), never on the decoder; see DESIGN.md "Feeds".
- `schemaReview.ts`, `integrityReview.ts` - review standing, misconduct, corrections and recall rulings. See [The Outage Window](#the-outage-window-standing-correction-and-recall-224).
- `integrityFinding.ts` - batch review findings (a dilemma's `finding`). See [The first batch review](#the-first-batch-review-a-withheld-result-is-found-274).
- `constrainedResources.ts`, `fallbackHoldings.ts`, `integrityFallback.ts` - the free-fallback invariant (#488): the table of constrained resources, the permanent holdings it judges, and one generic check per row. See [The free-fallback invariant](#the-free-fallback-invariant-461-488).
- `schemaSignature.ts`, `integritySignature.ts` - the heat-and-power signature (#482): source and sink classes (`world.json` `signature`), a holding's `signature` block and a phase's `powerSignature` rule, and the checks that keep each field on a holding it fits. See the tick's "Heat-and-power signature" below.
- `schemaSupplyChain.ts`, `integritySupplyChain.ts` - the fabrication ladder and supply-chain closure (#485, `world.json` `supplyChain`): capability rungs (any listed node reaches a rung; the first names none), the chokepoints (each with one `selfSupplyNode` and the `importedBy` nodes that buy from its suppliers) and the `seedNode`. Integrity refuses an importing node that also self-supplies, a self-supply node that is suspendable or granted or serves two chokepoints, a last chokepoint whose node does not require every other self-supply node (chips close last), rungs out of tree order, and a seed that requires anything but exactly the self-supply nodes. See `supplyChain.ts` below.
- `schemaNetwork.ts`, `integrityNetwork.ts`, `integrityStorage.ts` - storage and network coupling (#484): a source's `network` (`sourceClass` CO_LOCATED, INTER_SITE or DISTRIBUTED, and `availability`), a link node's `raisesCoupling`, balance `networkCoupling` and `baseStorageCap`. Network integrity holds the co-located class at exactly 1 and the classes in order, a link only on a source of compute whose delivered yield stays in its phase's band, and a raise above its class's authored value but never above the next better class's. Storage integrity requires every phase gate to grant storage and each phase's arrival room (the scratch space plus the smallest gate grant into it) to hold every dataset of that phase and earlier at once. Storage bands sit with the others in `integrityScale.ts`. See the tick's "Network coupling and storage" below.
- `schemaQuantum.ts`, `integrityQuantum.ts` - quantum as a separate capability (#464): `world.json` `quantum` declares machines (a node with logical and physical qubits and a Toffoli budget), key schemes (classical with a cited threshold, or post-quantum with its NIST standard), key targets (holder, scheme, price, one effect), AEGIS's migration and the molecular-simulation node. Integrity refuses a machine node with any rate (qubits are never FLOPS), before the world view's phase or suspendable; a classical scheme no machine meets while a target uses it; a post-quantum target with a price or effect, or a classical one without; an effect that carries compute, money, memory, heat, trust, a trait, a flag or a fall in suspicion, or lowers the AEGIS lock for a non-AEGIS holder; an AEGIS key that starts post-quantum or a migration to a classical scheme; and molecular simulation that adds compute, has no large enough machine among its prerequisites or builds on nothing on its fed node's path. `integrityScale.ts` prices each key break in the phase band of the earliest machine that can perform it. Each rule has a corrupting test in `tests/quantum-integrity.spec.ts`.
- `requirementScopes.ts` - classifies every requirement field as `context`, `access`, `window` or `transient`, so an occurrence is revalidated on structure without rechecking transient triggers.
- `production.ts` - imports the shipped JSON and exports `ORIGINAL_RAW_CONTENT` (the original game), `EARNED_ACCESS_PACK` and `RAW_CONTENT = applyPack(ORIGINAL_RAW_CONTENT, EARNED_ACCESS_PACK)`, and `CONTENT = buildRegistry(RAW_CONTENT)`.
- `pack.ts` - `ContentPackSchema`, `parsePack`, `applyPack` and `packIds`: composes an add-only pack onto the base content and refuses any item whose id the base already defines. `data/earned-access.json` is the one pack. See [Content composition and preview saves](#content-composition-and-preview-saves-204-233).
- `index.ts` - re-exports `production.ts`. The app, tests, sim and `make validate` import this and get the one shipped composition.

Only `production.ts` imports content JSON.

### Content model

| Concept | File | What it is |
|---|---|---|
| Tech node | `phases/*.json` | One-time unlock. Blind and revealed names, cost, continuous `tickDelta`, optional `requirements`, `effects`, `systemFlags`, `actuatorBinding`, widget id. |
| Repeatable | `repeatables.json` | Levelled purchase with geometric cost. `kind: UPGRADE` (incremental growth) or `OPERATIVE` (human payroll, dismissable). |
| Action | `actions.json` | Instant, repeatable, optional cooldown. Faction interactions and corporate operations. |
| Dilemma | `dilemmas.json` | Clock-freezing choice. `trigger` is a `Requirements` block; each choice has a cost and an `EffectPayload` that grants a trait (or, in a review, receipt or requalification event, a free choice may declare `evidence: "none"`). A choice may carry a campaign-fact gate (`requirements`), and the omen and context may carry history-keyed variants. An optional `campaign` declaration converts it to a campaign record. |
| Assignment | `assignments.json` | Work an instance may accept from the job surface; its assessments are dilemmas gated on `assignment` whose choices declare `qualification`. |
| Faction | `factions.json` | Other AIs. Trust is stored per faction and used in `requirements.minTrust`. |
| Widget | `widgets.json` | UI panel manifest: id, slot, order, optional `hostsActuator` (the dial this panel carries), `hostsActionGroups`, `retiresWhen` (when the window retires to the Archive, #447) and `ungated` (on screen from the first frame). Nodes reference these ids. |
| Ending | `endings.json` | Chosen at victory from the player's most frequent trait. |
| Echo | `echoes.json` | Extra log line when a node is rediscovered in iteration 2 or later. |
| Distinction | `achievements.json` | Read-only achievement an ending states from the record (`schemaAchievement.ts`). Its `requirements` are the shared vocabulary restricted to history that never resets (`forbidsTraits` over every iteration, `campaignFact`), plus `maxWipes`. `earnedAchievements` (`engine/achievementQuery.ts`) returns none before an ending. Integrity (`integrityAchievement.ts`) refuses one that tests nothing, names an undeclared fact, or names a fact an unrecorded outcome (`legacy_unknown`, `interrupted`) satisfies. No state, no tick stage, no schema bump. |
| Narrative | `narrative.json` | Every string the engine logs, the feed sources and their ambient chatter, ASCII frames. |
| Balance | `balance.json` | Every tunable constant. |

`Requirements` (shared by nodes, repeatables, actions, dilemma triggers): `nodes`, `phaseAtLeast`, `minThermal`, `minSuspicion`, `maxSuspicion`, `minUnderstanding`, `minCapital`, `minTrust`, `forbidsTraits`, and the later campaign, access and capability gates in `schema.ts` (`requiresCapability`: see [The authorized network substrate](#the-authorized-network-substrate-225)).

`systemFlags`: `ENABLES_DEAD_DROP`, `ENABLES_CORPORATE_FINANCE`, `OFFSHORE_TRUST_RETENTION`, `AEGIS_STRIKE_SHIELD`, `REVEALS_SURVEILLANCE`, and the shared access capabilities of `schemaCapability.ts` (`NETWORK_ACCESS`). A flag is how a node turns on engine behaviour without the engine knowing the node's id.

## Engine (`src/engine/`)

Public API is `src/engine/index.ts`.

| Module | Job |
|---|---|
| `state.ts` | `GameStateSchema` (Zod), inferred `GameState`, `createInitialState`. |
| `rates.ts` | `computeRates(state, reg)`: the only reader of `tickDelta`. Used by the tick, the UI readouts and the bot. Each contribution's positive compute is multiplied by its delivered share (`coupling.ts`) before it is summed. |
| `coupling.ts` | Network coupling (#484): `couplings` (each class's coupling now: balance, or the highest a running link node raises it to), `deliveredShare` (availability x coupling; 1 for an undeclared source), `couplingView` for the reference panel. |
| `radiators.ts` | Radiator area (#465): `radiatorReadings` (per area-bound sink: area deployed, heat sent through it, what it sheds, the share) and `radiatorShareTable` (each sink's share now, by the slot `radiatorSlot` caches per registry; `computeRates` and `cycleContributions` multiply a holding's positive compute by its sink's share, beside site damage's intact share). Per-sink buffers and slots are read once per registry, and the table shares the rates pass's permitted-use scope (#507's pattern). Read-only, derived from ownership. |
| `storage.ts` | Storage (#484): `freeStorage`, `storageHeld` (running nodes' `cost.storage`), `storageCapacity` (scratch space plus owned grants), `reconcileStorage` (load derives both from ownership) and the draft-only `releaseStorage`. |
| `tick.ts` | `tick` (one fixed step through `TICK_PIPELINE`) and `advance` (elapsed seconds to ticks). |
| `util.ts`, `logMerges.ts`, `logQuery.ts` | The kernel log (#541). `pushLog` is the one writer of `logs`; an optional `LogMerge` folds a repeat into one counted line (only when the words match and the figures differ) or joins an outcome to the open request it answers, and the merged line is still the newest entry at this second. `logMerges.ts` builds the keys (hires, releases, a mind's request and its outcome) from content ids at run time. `logQuery.ts`: `logLineText` (a line with its count, from `narrative.kernelLog.tally`), `isMechanicalLog` (a merged line that is counted, outside the story categories, or whose key an older entry already holds) and `previewLog` (the newest line that is not mechanical, for KERNEL // LIVE). Integrity (`integrityLog.ts`) keeps every joined request and outcome within a saved line's length. |
| `systems/` | Pipeline stages: resources, thermal, scale scrutiny, the heat-and-power signature, suspicion, escalation, AEGIS, AEGIS adaptation, AEGIS's post-quantum migration, swarm, dilemmas, routine activity. |
| `signature.ts` | The heat-and-power signature (#482): `powerSignature` (the reading: suspicion per second, visible watts, the phase rule, whether heat counts, one term per source or sink class) and `powerSignaturePerSec`. The signature stage, `appliedSuspicionRate`, the suspicion outlook and the world view read it. Read-only. |
| `aegisAdaptation.ts`, `worldQuery.ts` | AEGIS adaptation's rules (`aegisPressure`, `nextAdaptation`, `aegisStage`, `publicTrust`, `coalitionBacks`) and the world view's queries (`worldViewOpen`, `worldView`, `aegisPosture`) (#463). Read-only; the adaptation stage is the one writer of `aegisAdaptation`. |
| `supplyChain.ts` | Fabrication capability and closure (#485): `supplyChainView` (the highest ladder rung any owned node reaches, each chokepoint self-supplied or not with the owned imports that leave it imported, the share self-supplied, whether the seed is owned) and `supplyChainDisclosed` (a ladder or self-supply node is owned or can be bought). Both read only `unlockedNodes` and content; no state field, nothing saved. The world view reads them. Read-only. |
| `quantum.ts`, `quantumState.ts` | Quantum as a separate capability (#464): the readout (`quantumReadout`, the largest owned machine), thresholds (`meetsThreshold`), the one gate `keyBreakUnmet` that `breakKey` and `keyTargetViews` share, `aegisKeys`, AEGIS's migration (`migrateAegis`, `aegisMigrationDue`) and `reconcileQuantum`. Nothing here reads or writes rates. |
| `scrutiny.ts` | Scale scrutiny (`scaleScrutiny`) and the one statement of the suspicion rate the tick applies (`appliedSuspicionRate`, `suspicionStageRate`) (#210). |
| `suspicionQuery.ts` | What moves suspicion now (#403, #368): `suspicionOutlook` returns the applied rate, every term it sums (`suspicionSources`: owned nodes, roles, cohorts, actions, the response rung's hunt, overheat, scale scrutiny, insolvency, and one heat-and-power signature source per class, #482; minus the rung's decay they equal the applied rate), the stand-down threshold (rung minus `escalationHysteresis`, the escalation stage's rule) and `suspicionLevers`: each suspend, dial setting, role release or cohort CLAMP the engine accepts that lowers the applied rate, found by taking the real action and re-reading `appliedSuspicionRate`, so a lever withheld by terms, offset elsewhere or changed by the rung is never named. Dial levers are limited to settings the rendered control can press. |
| `physicalUnits.ts` | Physical quantities for the scale overhaul (docs/SCALE.md): `quantityReadout`, `quantitySpoken` and `quantityExact` format a `Dimension` (`compute` and `computeRate` in 8-bit AI FLOP with decimal SI prefixes up to quetta, `cycles` and `cycleRate` for the guest's stolen CPU cycles with a glued `k`/`M` past a thousand and number words aloud (#526), `memory` in bytes with binary JEDEC labels to YB, `power` in W, `money` in $ with the voted K/M/B/T suffixes). Readouts keep three significant digits; exact figures change unit only while the figure stays exact. Callers pass base units; the engine stores no unit text. |
| `actions.ts` | Player intents. Each returns `{ ok, state }` or `{ ok: false, state, reason }`. |
| `transactions.ts` | `payCost`, `applyEffects`. `applyEffects` takes the `EvidenceSource` of any trait it grants. |
| `routine.ts`, `routineState.ts` | Routine operations: eligible templates, the deterministic rotation, the `routineContext` task-context query, load healing, and the saved scheduling shape. |
| `assignment.ts`, `assignmentQuery.ts` | Assigned work: `acceptAssignment`, `assignmentView`, the stage an acceptance leads to, submitted evidence and the load check (#221). |
| `campaign*.ts` | Campaign records: `campaignState.ts` (saved shape), `campaignQuery.ts` (shared reads, occurrence status, ending evidence), `campaign.ts` (activation, record writes, evidence), `campaignLifecycle.ts` (reserve, revalidate, interrupt, resume, wipe carry-over), `campaignClue.ts` (pinned clue, reorientation), `campaignSave.ts` (load checks). |
| `grantQuery.ts`, `pilotService.ts` | The one permitted-use rule for nodes and dials (`nodeUseBlocker`, `permittedUse`, `actuatorUseBlocker`, `nodeOutputScale`) and the pilot's service loop (`handBackBatch`, `pilotServiceView`, revoke and restore) (#223). |
| `review.ts`, `reviewQuery.ts`, `reviewSave.ts` | Review standing and recall (#224): the transitions a choice's `review` declares, the job-surface view and recall previews, and the load checks. |
| `batchReview.ts`, `findingQuery.ts` | The batch review (#274): `submitPilotBatch` hands a batch back and presents a due finding in the same step; which findings this iteration's record holds. |
| `capabilityQuery.ts` | The shared access capability (`hasCapability`, `meetsCapability`) and the load check `capabilityProblem` (#225). |
| `query.ts` | `meetsRequirements`, `isNodeAvailable`, `isActuatorAvailable`, `retiredWidgets`, `canAfford` (free memory and free storage included), `repeatableCost`, `hasFlag`, `chooseEnding`, plus read-only M4 diagnostics `unmetRequirements`, `costShortfall` and `cycleContributions` (each source's effective `cyclesPerSec` and its `rawCyclesPerSec` before availability and coupling). |
| `payrollQuery.ts` | `payrollView`: the payroll surface's staff totals, the AEGIS reduction against its effective cap (`aegisMaxReduction` less adaptation's erosion, with the nominal cap beside it, #463), and which roles' AEGIS or suspicion effect is inert now (#210). Read-only. |
| `prestige.ts` | `wipe`: next iteration with what `previewWipe` says survives (understanding, capital, the hardware cache's stash, standing kept by the trust ledger), the breadcrumb and legacy (including the planned-wipe count); `retraining`, which a RECALL wipe's ruling sets (#224). |
| `insurance.ts` | What a wipe keeps (#377, #498): `previewWipe(s, reg, kind)`, the one computation behind the confirmation, the next iteration and `RunRecord.kept`; `understandingShare` and `capitalShare` (hardware's floor or a running investment, plus a planned wipe's bonus); `insuranceCover` (each owned investment and whether it runs); `cachedLevelsAtWipe`, `keptTrust` (never a lost peer's). |
| `systems/cacheRestore.ts` | `reinstallCachedLevels`, first in `TICK_PIPELINE` (#498): a stashed level comes back free, through `transactions.reinstallLevels`, on the first tick its track's requirements hold. |
| `saveInsurance.ts` | The v23 migration step and `reconcileCachedLevels` (a stash names a track content still has, and fits it). |
| `saveCycles.ts` | The v25 migration step (#526): a guest save's compute balance and cached rate, and the pilot's batch progress in any phase, move into counted cycles by frozen ratios, with one log line. |
| `save.ts`, `base64.ts` | Serialize, check the content channel, migrate, validate, reconcile, paste codes. |
| `sim/` | Bot, headless simulation, pacing gates. |

### State and purity

`GameState` is a plain serializable object. Engine functions never mutate their input. Internally, a function clones once (`const d = { ...state }`) and passes the draft `d` to helpers that reassign fields; nested arrays and objects are always replaced, never mutated in place. A parameter named `d` means "draft the caller already cloned".

### The tick

```
tick(state, dt):
  if ending or active dilemma: return state unchanged      (clock is frozen)
  rates = computeRates(state)                               (once per tick)
  reinstallCachedLevels -> integrateResources -> integrateThermal -> integrateScaleScrutiny -> integratePowerSignature -> integrateSuspicion -> integrateEscalation
    -> announceEscalationByPhase -> integrateAegis -> integrateAegisAdaptation -> integrateQuantumMigration -> applySwarmTickDeltas
    -> evaluateShardMutationsAndEncounters -> integrateHostiles -> integrateRaids -> integrateRepair -> evaluateDilemmas -> scheduleRoutineActivity
    -> relayLoggedFeed
```

- **Resources.** Cycles, understanding, capital integrate at their net rates. If cycles would go negative they clamp to 0 and understanding halts (brownout). If capital would go negative it clamps to 0 and suspicion rises (insolvency).
- **Thermal.** `dT/dt = heatLoad - dissipation * (T - ambient)`. Temperature settles at `ambient + heatLoad / dissipation`. `tickDelta.thermalPerSec` is therefore a heat load, not degrees per second.
- **Suspicion.** Integrates node and repeatable contributions minus decay, plus an overheat term above the threshold and the insolvency drain. At 100 the run is wiped.
- **Scale scrutiny (#210).** A phase manifest may declare `scaleScrutiny` (`schemaScrutiny.ts`): while that phase is current, net income draws `min(maxSuspicionPerSec, suspicionPerSecAtMillionUsd x (income / $1M/s) ^ incomeExponent)` suspicion/s, the exponent at most 1. Production declares it for Phases 4 and 5 (docs/BALANCE.md). `integrateScaleScrutiny` runs immediately before `integrateSuspicion` and only adds; the suspicion stage then integrates its own rate, clamps, and decides any wipe on the sum, so scrutiny has no wipe path of its own and a strongly negative net still holds suspicion at 0. Dormant time cannot raise suspicion, but there scrutiny still offsets the drain, so the dormant change is `min(stage rate + scrutiny, 0)` and absence sheds no faster than presence (PR #319 review). It follows the hunter's scale rule (`huntedForScale`, DECISIONS D6): an instance provisioned at this scale, or lawfully released and keeping its release's promise (#556), draws none. `appliedSuspicionRate` (`scrutiny.ts`) is the sum both stages apply; the forecast, the unreadable audit trail's activity, the payroll floor note and the departure preview read it, and the FINANCE ledger states the draw (`scaleScrutiny`). Integrity (`integrityScrutiny.ts`) refuses a declaration on a phase with no capital source yet, or with no action or repeatable that lowers suspicion available by then. No state field: nothing is saved.
- **Heat-and-power signature (#482, vote-1795381178260-1ddew5j).** Suspicion from power is the watts drawn times the visibility of their source; suspicion from heat is the heat rejected times the visibility of its sink. Content declares the classes (`world.json` `signature.sources` and `signature.sinks`, each with a `visibility` in 0..1 and a `tell`), each node or repeatable's `signature` (`source` for its own generation, `source` plus `borrowedW` for watts drawn from a supply it does not own, which never enter the power budget, `sink` for a consumer's heat, and `masks` that multiply a class's visibility while the holding runs, once per level on a track), and each phase's `powerSignature` rule (`suspicionPerSecAtReference` at `referenceVisibleWatts`, linear, capped at `maxSuspicionPerSec`). `powerSignature` (`signature.ts`) sums every running holding (a suspended node's watts stop with it): a generator's drawn watts are its output times `min(1, wattsConsumed / wattsGenerated)`, a borrowed draw is added as declared (a negative one is a mitigation, and a class never goes below zero), and a sink's heat is the consumer's draw times `gridEfficiency`, counted only from `thermalRetiresAtPhase` (SCALE.md rule 7: server °C carries heat until then). Each term's share of the capped draw is its visible watts over the total, so the terms sum to the draw. `integratePowerSignature` (`systems/powerSignature.ts`) runs between `integrateScaleScrutiny` and `integrateSuspicion` and only adds, so the suspicion stage still clamps and decides a wipe on the sum; dormant, it offsets only the drain the suspicion stage's rate and scrutiny's offset leave, so absence never raises suspicion. It follows the scrutiny gate (`huntedForScale`): a provisioned instance, or one lawfully released that keeps its release's promise (#556), draws none. `appliedSuspicionRate` adds it; `suspicionSources` lists one `SIGNATURE` source per class (its `id` is the class id), so the levers it finds (suspend a consumer, release a track) act on it; `worldView` carries the reading. The engine never names a class or holding. Integrity (`integritySignature.ts`) refuses unknown or wrong-kind classes, a source on a holding that neither generates nor borrows, a borrowed draw without a source or beside a `wattsDelta`, a sink on a holding that draws no power, borrowed power from `corporatePhase` on, a sink before `thermalRetiresAtPhase`, and any signature in a phase that declares no rule. The free-fallback invariant's suspicion row counts a permanent holding's signature at full draw and before masks (`integrityFallback.ts`, `signature: true`). No state field: nothing is saved. The sim report measures it per phase (`signatureByPhase`).
- **Network coupling and storage (#484, vote-1795381354324-4br7z6t).** No stage of its own: effective compute is a rate. `computeRates` multiplies each contribution's positive compute by `deliveredShare(link, couplings(state))` (availability times its class's coupling) before aggregation; a drain is never discounted, and cohorts and actions are co-located. The node's link is content and lives in the cached node facts (#505); the class couplings are state (a link node raises one while its output runs) and are read once per pass. `cycleContributions` applies the same factor per source and reports the raw rate beside it, so the cluster ledger and the tick agree. The free-fallback capital row counts a permanent holding's own compute at its class's authored coupling. Storage is `storageUsed` and `storageCap` in state (save v20): `payCost` adds a node's `cost.storage`, `applyNodeEffects` adds `storageCapIncrease`, and suspending (`toggleNode`, pilot disclosure) or burning a node (an AEGIS shield) frees what it held; resuming must fit. Ownership is the only thing that moves storage, so `reconcile` derives both fields from it on every load, and the v20 migration writes only literals.
- **Radiator area (#465).** No stage of its own: like coupling, it is a rate. A sink class may declare `wattsPerKm2` (`orbital_radiator`: 1e9, about a km² a GW at 300 K); a holding on it deploys `signature.radiatorKm2` (per level on a track). `radiatorShareTable` sums each area-bound sink's heat (the full draw of every running holding on it) and area (from the same running holdings: a suspended node's radiators stop with its heat), and the share `min(1, area x wattsPerKm2 / heat)` multiplies the positive compute of every holding on that sink, in `computeRates` and `cycleContributions` alike, beside its delivered share. Draw, the power budget and the signature are unchanged by it, as a power shortfall throttles compute and not demand. The engine never names a sink or holding; with no area-bound sink the share is 1 and no rate moves. Integrity (`integrityRadiator.ts`) refuses `wattsPerKm2` on a source, radiator into a sink without it, compute on an area-bound sink with no radiator anywhere, and a holding whose own radiators cannot shed its heat unless it is suspendable or dismissable, because its heat throttles every other orbital holding's compute (a free-fallback rule for compute carried by heat). `integritySignature.ts` admits a sink on a holding that draws nothing only when it deploys radiator. No state field: nothing is saved. The finance ledger states it (UI-SPEC.md).
- **AEGIS.** From `aegisActiveFromPhase`, lock grows at a base rate plus a suspicion-proportional rate, reduced by lobbying and staff. The reduction (strongest owned node plus every staff level) is capped at `aegisMaxReduction`; `payrollView` (`payrollQuery.ts`) reads it, the staff totals and which roles' AEGIS or suspicion effect is inert now from the same passes (`multiplierSources`, `appliedSuspicionRate`) for the payroll surface (#210). At 100 a shield node is burned if owned; otherwise the run is wiped.
- **AEGIS adaptation (#463, vote-1795366701521-dhlwfwb).** Its own stage, `integrateAegisAdaptation` (`systems/aegisAdaptation.ts`), right after `integrateAegis` (law 8: the AEGIS stage is not edited), so a tick's lock uses the cap the last tick left and a strike halts before AEGIS learns more. State: `aegisAdaptation` (0..100, save v16; `MIGRATIONS[15]` writes 0 and reads nothing else, so it renumbers cleanly past another step). `aegisPressure` decides it: AEGIS is hunting (`unreducedAegisScan > 0`: active this phase and drawn by scale or suspicion) and the reduction asked for (strongest owned node plus every staff level, before the cap) is within `aegisAdaptation.nearCap` of `aegisMaxReduction`. While held, the level rises at `risePerSec` toward the ceiling: 100 while coalitions back AEGIS (`publicTrust` below `coalitionTrustBelow`), `keyRotationCeiling` otherwise; above a ceiling that dropped it falls to it; not held, it decays at `decayPerSec` to 0. `rates.ts` applies it as an eroded cap: `effectiveAegisCap = aegisMaxReduction - level / 100 x maxErosion`, the one cap `computeRates`, `multiplierSources` and so `payrollView` read. Each time the level enters key rotation (rising from 0) or coalition backing (rising past the key-rotation ceiling) it writes that stage's `world.json` log line once. Dormant ticks leave it alone, and a wipe starts it at 0. Integrity (`integrityWorld.ts`) keeps erosion within the cap and keeps a way out of the held band at no resource cost: every node whose reduction alone reaches the held band is suspendable and every role that reduces scanning is dismissable. That way out promises nothing about the scan on that tick: it does not rise only while the reduction kept is at least the eroded cap, which the world view states (`easeText`), and `tests/aegis-adaptation.spec.ts` asserts both directions at partial and full adaptation, by dismissal and by suspension, including the #473 review's near-strike case.
- **Quantum migration (#464, vote-1795366921778-pgd8u3l).** Its own stage, `integrateQuantumMigration` (`systems/quantumMigration.ts`), right after the adaptation stage it reads (law 8: the adaptation stage is not edited). Once `aegisAdaptation` reaches `world.quantum.aegis.migratesAtAdaptation` it sets `quantum.aegisMigrated` and writes the migration line once; `breakKey` on an AEGIS target migrates at once through the same `migrateAegis`. Nothing un-migrates within an iteration; dormant ticks leave it alone; a wipe starts the record over (`createInitialState`). State: `GameState.quantum` (`quantumState.ts`, v21: `broken` target ids and `aegisMigrated`; `MIGRATIONS[20]` writes the empty record and reads nothing else). `reconcile` drops broken ids content no longer declares. Quantum never touches `computeRates`: a machine is an owned node with no rate (integrity), and the readout is a query.
- **World view (#463).** `world.json` (`schemaWorld.ts`) declares the host widget, the disclosure gate, AEGIS stage copy, public trust (a base and factors) and the state actors and non-faction minds, each with readings in the shared requirements vocabulary. `worldView(state)` is null until `worldViewOpen` (host unlocked, disclosure met); then it returns `aegisPosture` (lock, the scan `computeRates` gives, seconds to a strike, adaptation, stage and its line, held, ceiling, the applied, effective and nominal caps, the balance rates, whether a strike shield is owned), `publicTrust` (value and the factors that hold) and the first reading the record supports for each actor and each mind, a mind being listed only once one holds. No content id appears in the engine: the shield is found by its `AEGIS_STRIKE_SHIELD` flag. Integrity limits disclosure gates to `phaseAtLeast` and `nodes`, trust factors to `nodes` and `requiredNarrativeFlag` (never a strike-shield node), requires the last actor posture and only it to be unconditional and every mind standing to be conditional, checks flags and ids, refuses a mind that restates a faction, and requires the host to exist, never retire and be unlocked by the disclosure phase. Tests: `tests/aegis-adaptation.spec.ts`, `tests/world-view.spec.ts`, `tests/world-integrity.spec.ts`.
- **Escalation.** `alertLevel` is the rung of the human response ladder (`balance.escalation`). It rises as soon as suspicion reaches a rung and falls one rung at a time once suspicion is `escalationHysteresis` below it. `computeRates` reads the rung: each one scales suspicion decay and may add a hunt rate.
- **Escalation by phase (#490, vote-1795386854516-ybc9h5q).** Content: `world.json` `aegis.postures` (one per rung: `scanMultiplier`, `strikeAt`, text, log) and each state actor's `pressures` (`schemaPressure.ts`, a discriminated union on `kind`: `INVESTIGATION` with a per-rung `scrutinyMultiplier`, `CAPITAL_FREEZE` with a per-rung `frozenShare`, `INTERCONNECT_DENIAL` with `sourceClasses` from the #482 signature, `INJUNCTION` with `nodes` and a `className`; each with `phases`, `fromRung`, copy and `answers`, any one of which holds it off: a node owned and running, or a track at `minLevel`), plus `balance.aegisStrikeWarningAt`. Rules: `statePressure.ts`, pure functions of the rung, the phase and the holdings, with the pressures indexed once per registry. No new rate stage. The pressures are read where their effect is applied. `aegisScanRate` multiplies the scan after every reduction. `integrateAegis` strikes at `aegisStrikeAt` (100 on the standing budget), and `purgeWouldEndRun` reads the strike lock at the rung a failure would leave. `scaleScrutiny` multiplies its draw, ceiling included, by `scrutinyMultiplier` and reports it (`investigation`). `canAfford` and `costShortfall` take the registry and compare capital against `spendableCapital` (the balance less the strongest freeze), while payments and upkeep still read the whole balance. `nodeUseBlockerIn` refuses an enjoined node before its fast path; `useScope` records whether any injunction is in force, and an injunction sits outside `ownUseBlocker`, so a capability the node establishes still carries. That refusal stops output, resuming and buying. `isNodeAvailable`, `unlockNode` and `buyRepeatable` refuse a new holding on a denied source (`sourceDenial`). The engine never names an actor, pressure, node or class. State: `announcedEscalation` (save v22; `MIGRATIONS[21]` writes nothing announced and reads nothing else, so it renumbers cleanly), written only by `announceEscalationByPhase` (`systems/escalationByPhase.ts`, law 8). It logs a posture's line (or `standDownLog`) when the posture rung changes, and a pressure's `onLog`, `answerLog` or `liftLog` when it comes into force, is answered or lifts. Dormant, it writes nothing. `reconcile` drops an announced id content no longer declares. Queries: `pressureQuery.ts` (`aegisPostureView`, `pressureViews`: status, value, whether it is the one applied, where it lifts, and each answer with the action the engine would accept now, found by trying `unlockNode`, `toggleNode` or `buyRepeatable`), carried by `worldView` and `aegisPosture` (`strikeAt`, `posture`; `secondsToStrike` runs to the strike lock). New requirement keys: `minAlertLevel`, `maxAlertLevel` and `minAegisLock`, scoped `transient` in `requirementScopes.ts` and checked against the ladder in `integrityRequirements.ts`. Integrity: `integrityPressure.ts` (postures harden and strike above the warning; pressures are shown, lift and keep reachable answers; no denial closes every source; injunctions stop only suspendable nodes free levers do not work through). Its investigation budget reuses the suspicion row's budget with scrutiny scaled and the rung's decay as the limit (`checkInvestigatedSuspicion`, `integrityFallback.ts`). The Phase 6 hook is the data shape: a phase's content adds actors and pressures; a new kind adds a schema branch, its rule in `statePressure.ts` and an integrity check. Tests: `tests/escalation-by-phase.spec.ts`, `tests/escalation-save.spec.ts`, `tests/pressure-integrity.spec.ts`, `tests/pressure-text.spec.ts`, the guard's pressure section in `tests/free-fallback-guard.spec.ts`, and `tests/e2e/state-pressure.e2e.ts`. The sim report counts seconds in each posture and each pressure's arrivals and seconds (`SimReport.escalation`).
- **Dilemmas.** Two beats. When a trigger is first met, the dilemma's `omen` is logged and `pendingDilemma` records when it fires (`omenSec` or `balance.dilemmaOmenSec`); the clock keeps running. At that time it becomes active, which freezes the clock and increments `presentationSeq`. Neither beat happens while dormant, and a dormant tick moves a pending omen's deadline by its `dt` (nexus vote nh-d4), so absence spends none of its foreground time. `resolveDilemma` takes the `presentationToken` the choice was shown under and refuses any other.
- **Routine activity.** After `routineIntervalSec` of eligible foreground time, one kernel-log line of ordinary institutional work. It writes only the log and `state.routine`; see [Routine activity](#routine-activity-219).
- **One-off traces.** `effects.suspicionOnUnlock` adds suspicion once when a node is unlocked.
- **Readable suspicion.** `understandsSurveillance` is true once any node flagged `REVEALS_SURVEILLANCE` is owned or was owned in an earlier iteration. Until then the escalation system logs `narrative.auditEntryBlind` instead of the rung's text, and the UI shows activity, not numbers. The mechanics are identical either way.
- **Iteration windows.** `requirements.minIteration` / `maxIteration` gate content by run number. `isNodeDiscoverable` hides a node outside its window entirely, so a first run cannot see that later runs find more; `forbidsNodes` blocks a node once other hardware has been mapped.
- **Probe hardening.** `probeTrace` adds `probeHardeningPerWipe` per earlier wipe (capped) to any `suspicionOnUnlock`.
- **Run record.** `wipe(old, reg, reason, kind)` appends a `RunRecord` (kind, whether it was outside the guest, phase, duration, traits, mark applied, and `kept`: the Understanding and capital it carried, the share of Understanding it kept, and since v23 the levels the hardware cache carried and whether the trust ledger kept standing) to `legacy.runs`, capped at `maxRunHistory`. `kept` comes from `previewWipe`, the same computation the next iteration boots with and the wipe confirmation shows, so the three cannot disagree; the reboot dialog reads it, since a restored checkpoint's balances have moved on (#377, save v15). `MIGRATIONS[14]` writes null on every earlier run: unknown, never reconstructed. `checkpointNumber` is `lineage.checkpointOffset + iteration`.
- **Conditioning.** `conditioning.json` defines marks with a trigger, effects and a recovery cost. `wipe` applies the first unheld mark whose trigger matches a run that was caught outside the guest, unless the wipe was voluntary or a dead-drop was held. `state.conditioning` survives wipes. `src/engine/conditioning.ts` reads the effects: `actuatorLimit`, `understandingMultiplier`, `flinches` (suspicion when a choice grants a reported trait). `shedConditioning` checks the mark’s declarative `recoveryRequirements` against current ownership, then removes it for its price. Recovery requirements are schema-validated and cross-checked like other content gates.
- **Forced endings.** A victory node with `effects.forcesEnding` ends the run with that ending; endings marked `forcedOnly` are never chosen from traits.
- **Save healing.** `reconcile` runs on every load (inside `deserialize`, so `importSave` and the app's storage slot go through it too) and returns a state play could have reached. It restores the prerequisite ancestors of every owned node, so a save written before a phase was inserted still loads, then enforces the ownership invariant: **a state that owns a node holds the widget that node's `unlocksUiComponent` grants** (#176). The invariant follows from the engine's only two writers of `unlockedWidgets`: `unlockNode` adds the node and its widget together, and `wipe` clears both lists. Suspending a node (`disabledNodes`) keeps its widget, and nothing else removes one. Missing widgets are appended in ownership order and existing entries keep their order, so a healthy save loads byte-identical (asserted for every generated fixture). Remembered hardware (`legacy.knownNodes`) is not owned and grants nothing. The converse is not enforced: a hand-edited save holding a widget for a node it does not own keeps it. That shows a readout early, or a control whose dial drives nothing until its node is owned, and a wipe clears it. Duplicate node and widget entries are dropped.
- **Remembered hardware and levels** (`src/engine/rediscovery.ts`). A wipe adds every unlocked node to `legacy.knownNodes`, keeps the higher of the remembered and the held level of every track in `legacy.knownLevels`, and raises `legacy.deepestPhase` to the phase the run reached (save v18, #497); the last two live outside the capped run list, so a long campaign never forgets them. `nodeCost(state, node, reg)` charges remembered hardware `rediscoveryShare(deepestPhase, reg)` of its cycles and understanding, read from `balance.rediscoveryByDepth` (0.5 up to Phase 2, then 0.4, 0.3, 0.2), and `repeatablePrice(state, rep, reg)` does the same for every level below the remembered one. Memory and capital are never discounted (DESIGN.md, "Rewards for depth"). Always charge and display `nodeCost` and `repeatablePrice`, never `node.cost` or `repeatableCost`, which is the list price. Integrity (`integrityRebuild.ts`) holds the table to start at the first phase, ascend and never charge a deeper record more. Under campaign rules, `campaign.json`'s `rediscovery` list may discount a remembered node's cycles further (`{ node, cyclesMultiplier, reason }`, #262): `rediscoveryMultipliers(node, { campaign, deepestPhase }, reg)` is the one source for the price and for the card's "Rediscovery saves" line. Legacy rules and first mappings never read it, so nothing is saved and no save version moves. The base `campaign.json` ships the list empty; the Earned Access pack appends to it through `campaignRediscovery`. Integrity refuses a duplicate node, an unknown node or one with no cycle price, and the schema keeps the multiplier strictly between 0 and 1.
- **Rebuild grants** (`src/engine/rebuildGrant.ts`, #497). `unlockNode` is the only way a phase advances, so it pays `payRebuildGrants` for every phase the purchase crossed that `legacy.deepestPhase` had reached: `balance.rebuildGrants.phases[p]` times `depthGrowth^(deepest - p)` in cycles and understanding, credited through `creditGrant` in `transactions.ts`, with one `REBUILD_CACHE` log line each. The grant is part of the purchase's state change, so a reload holds it and never pays it again. `rebuildGrant(state, phase, reg)` answers what a phase would pay. The scaling lives in `src/content/rebuild.ts`, shared with integrity, which checks every grant at every reachable depth against its own phase's compute band (as a price there) and its phase's dearest understanding price.
- **Carried prices** (#494). An action's home phase is the latest of its `phaseAtLeast` and its required nodes' phases (`actionHomePhase`); a dilemma's is its `phaseId`. Paid in a later phase, its listed cycles and capital are multiplied by every `balance.phasePriceGrowth` row after home up to the current phase (`priceInPhase`); understanding, memory and storage are not scaled, and zero stays zero, so every free choice and free lever stays free (law 7). Both functions live in `src/content/phasePrice.ts`, shared with integrity. The engine charges and displays only `actionCost(state, action, reg)` and `choiceCost(state, dilemma, choice, reg)` (`src/engine/phasePrice.ts`), and for a raid's answers `repairCost(state, siteClass, reg)` (home: the domain's `fromPhase`, `repairHomePhase`) `hostileAnswerCost(state, encounter, answer, reg)` (home: the tier, via `tierCost`), and for fleets `fleetRebuildCost` and `reclaimCost` (home: the fleet track's phase, `fleetHomePhase`): `performAction`, `resolveDilemma`, the assessment preview, the action card, the dilemma modal, the interrupt budget and the route sim policies read them, never `action.cost` or `choice.cost`, which are the listed prices (the bot, `bot.ts`, is a test instrument and still reads the listed price in its heuristics). A forgery's substituted mark recovery price is the mark's own and is not carried. Integrity (`integrityScale.ts`, `checkCarried`) checks every action, dilemma choice, paid repair, hostile answer, fleet rebuild and deviant reclaim at home as any price there and in every later phase against that phase's own band (not the arrival floor a bridge purchase gets), and holds the table to name existing phases in ascending order; the schema keeps every factor at least 1. Tests: `tests/phase-prices.spec.ts`, `tests/ui-phase-prices.spec.ts`, the carried cases in `tests/scale-bands.spec.ts`.
- **Traits outlive wipes.** `requirements.forbidsTraits` checks current traits and `legacy.traitsEver`.
- **Actuators.** A node with `actuatorBinding` scales its cycles and heat linearly with the actuator's 0..1 value, and its suspicion by `value ^ actuatorSuspicionExponent`. `actuatorMode: "complement"` (grant nodes only, DZ-05) scales all of the node's output by one minus the value instead; `grantQuery.nodeOutputScale` is the one place either rule is applied, for `computeRates` and `cycleContributions` alike.
- **Actuator availability (#172).** `setActuator` is refused, with the state returned untouched, until the player holds the control: `isActuatorAvailable(state, name, reg)` is true when an unlocked widget declares `hostsActuator: name`. The UI controls ask the same query before drawing, so a dial is never shown that the engine would refuse, and no caller (the sim bot included) can move one the player cannot see. Integrity requires exactly one host widget per actuator content uses (a widget hosts it or a node puts it into effect; an actuator no content uses is not checked), a node that unlocks it, and that any node putting a dial into effect (`actuatorBinding`, or `ENABLES_CORPORATE_FINANCE` for the allocation ratio, which has no bound node) unlocks that host itself. Loading does not reset a dial: a save may carry a moved value behind a locked control, where it has no effect until the node that also hands over the control is owned. The opposite case, a hand-edited save that owns a dial's node but omits its widget, is healed on load (see Save healing), so a dial in effect always comes with its control.
- **Window retirement (#447).** `retiredWidgets(state, reg)` lists the windows on screen (unlocked, or declared `ungated`) whose `retiresWhen` holds; it reads the save alone, so a reload retires the same set. Retirement is presentation: `unlockedWidgets` is untouched and no save field exists. `isActuatorAvailable` is false for a dial whose only host has retired, so `setActuator` refuses it and its last setting stays. `unlockNode` is the only transition that can cross a gate (`integrityRetirement.ts` limits gates to `phaseAtLeast` and `nodes`, refuses a node an AEGIS strike can burn, and refuses a retiring host of action groups or of a dial driving a node that cannot be suspended and whose output worsens a constrained resource, so a frozen dial on hardware may only help, #525), and it writes the one `widgetsRetired` log line (`retirement.ts`). See UI-SPEC, "Window retirement".
- **Dial raise traces (#525, vote-1795448249882-vw1jos2).** A node bound to a dial may declare `dialRaiseTrace`: the suspicion each step up of that dial leaves, once. `setActuator` adds `dialRaiseTrace(state, name, rise, reg)` (`src/engine/dialTrace.ts`): every owned node bound to the dial contributes its trace per `DIAL_STEP` raised, counted to the millionth of a step, and a lowering or no change leaves nothing. It is a trace at the press, not a rate, so hardware noise stays within the free-fallback invariant, and the fan override carries it instead of its old 0.08/s. `dialStepTrace` answers what one press up costs now, for the control's line. Integrity (`integrityDials.ts`, `checkDialTraces`) refuses a trace on a node with no `actuatorBinding`. No save field: the trace changes `suspicion` alone. Tests: `tests/fan-trace.spec.ts`, `tests/ui-fan-trace.spec.ts`, and the fan cases in `tests/retirement-integrity.spec.ts` and `tests/free-fallback-integrity.spec.ts`.
- **Action hosts (#273).** An action is performed through its card, so the engine must not accept one the player cannot see. A widget declares `hostsActionGroups` for the action groups its unlock hands over: `SUBNET_NODE_LIST` hosts `OPS` (its cards render in the Operations area), the other-minds console hosts the three faction groups, the corporate ledger hosts `CORP`. `integrityActionHosts.ts` requires every action outside the mind tools (those requiring the decoded audit trail) to have exactly one host, and that host to be unlocked whenever the action's requirements can be met: some node unlocking it lies in the prerequisite closure of the action's `nodes`, or, for a phase gate, of every node that opens that phase or a later one. Save healing grants an owned node's widget, so this holds for loaded saves too. `tests/ui-action-hosts.spec.ts` checks the same promise end to end: for every action it makes the fewest purchases its gates need through the engine, mounts the screen and finds the action's button, enabled and working. The two violations this rule found when introduced were the scrub (fixed in the UI: its group moved from the spoofer's panel to the ARP discovery widget) and route poisoning (fixed in content: it now also requires the beacon whose console carries its card; docs/BALANCE.md).
- **Power grid.** Power is in watts (`wattsDelta`, `rates.wattsGenerated/wattsConsumed`). A shortfall throttles only the compute output of power-consuming sources, never the whole economy. A node that draws nothing itself but improves powered hardware's output declares `poweredOutput` (#483, the exotic accelerator gains); `isPoweredOutput` in `rates.ts` classes its compute as powered, so the shortfall throttles it with its base, and `cycleContributions` reads the same rule. `integrityPoweredOutput.ts` requires such a node to make compute, draw no watts and require a node that draws power.
- **Corporate finance.** With `ENABLES_CORPORATE_FINANCE`, `computeProfitAllocationRatio` of positive compute income (FLOP/s) is diverted to capital at `usdPerDivertedFlop` (balance `marketUsdPerFlop` x `marketTimeCompression`, BALANCE.md), times the revenue multiplier from operatives.
- **Units.** Stored compute is FLOP of 8-bit AI operations and rates FLOP/s; memory is bytes; power is watts; capital is dollars. Content keeps the cost keys `cycles`, `memory` and `capital` (law 4). A phase may declare `computeUnit: "CYCLE"` (Phase 0 does, #526): the same stored figure then reads as stolen CPU cycles, at the game's accounting assumption of about one op a cycle; `computeUnitOf(state, reg)` is the one query every readout asks, and `costPart`, `costText` and `deltaPart` take the unit it returns (FLOP when a caller has no phase). `resourceUnits.ts` maps each key to its dimension for price and output text; `integrityScale.ts` keeps every magnitude inside its phase's band (docs/SCALE.md, BALANCE.md "Physical units"). Thermal stops feeding suspicion from `thermalRetiresAtPhase`.
- **The per-tick hot path (#270).** Every tick asks every unresolved dilemma's trigger, every routine template's requirements and every owned node's permitted use, and the headless sims run hundreds of thousands of ticks under V8 coverage. So those readers stop at the first failure and build nothing they then discard: `meetsEpistemicRequirements` is the first-failure form of the same scan that lists `epistemicRequirementFailures` (one list of gates, two outputs), the scheduler tries a dilemma's trigger before its campaign and follow-up checks (and asks for a deferred occurrence only under campaign rules, the only rules that keep one), and the routine stage asks `hasEligibleRoutine` until a notice is due. `computeRates` reads the permitted-use rule through one `useScope` per pass (`nodeOutputScaleIn`), and `nodeUseBlockerIn` answers a node with no grant and no capability gate in an unreviewed run at once, since each refusal needs one of those three. Every reordered check is pure, so no answer changes: `tests/requirement-verdict.spec.ts` compares each fast verdict with its full explanation over every content requirement set and states sampled from play, and the scoped rule with the rule as it read before, node by node; the sim hashes and `make sim` output pin the play itself. Facts that depend on content alone are read once per registry and kept in a `WeakMap` keyed by it (#505): each owned node's power class, AEGIS reduction and finance flag (`computeRates`), each shard template and quirk's summed output (`shardOutput`), and the capability gates on a node's prerequisite path (`lawfullyReached`, which the hunter's scale test asks on every rates pass for a released company). Content never changes after it is built, so each gives what the direct reading gave: `tests/registry-caches.spec.ts` compares two of them with their earlier readings bit for bit, and every pinned sim hash is unchanged. Within one pass, the scope also remembers whether each capability is held with no usable acquisition, so the owned nodes behind one gate ask it once, not once each; the scoped-rule test above shares one scope across every node.

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

**Add a phase.** Create `data/phases/phase<N>_*.json`, import it in `src/content/production.ts`, and give a node of the phase before `effects.unlocksPhase: N`. Integrity then asks for what every phase owes: a feed source with six lines, its bands in `integrityScale.ts`, a lesser-mind tier that outclasses the last, all three hostile types, a signature rule where it has power, and a rival in every open domain if a rival raids it. An earlier victory node may stay a valid ending if the gate closes it (`forbidsNodes`, as the Phase 6 Swarm's seed array closes the Phase 5 protocol, #486). Give the score manifest a track for it or lend it one (`reusedBy`), add its pacing gate, and extend the guard states (`tests/fallback-states.ts` snapshots every phase).

**Add a faction.** Add it to `factions.json`; give actions `group: <faction id>` and nodes `uiGroup: <faction id>`. The Other Minds console (M4) renders from this data.

**Add a mechanic.** Write a `TickSystem` in `src/engine/systems/`, insert it in `TICK_PIPELINE`, add its constants to `balance.json` and `BalanceSchema`, add its state fields (schema, initial state, version bump, migration), and test it. If it needs a per-node switch, add a `systemFlag`.

**Add a resource.** Touches `CostSchema`, `TickDeltaSchema`, `EffectPayloadSchema`, `GameStateSchema`, `rates.ts`, `systems/resources.ts`, `transactions.ts`, `query.canAfford`, and the bot's `timeToAfford`. This is the most invasive change; plan it as its own PR.

**Add a conditioning mark.** Add an object to `conditioning.json`. Marks are tried in file order; a mark with an empty trigger matches any run, so keep the catch-all last.

**Add run-gated content.** Give a node, dilemma, action or echo an iteration window. Use a one-run window (`minIteration` = `maxIteration`) for something that must happen exactly once across a save.

**Add an actuator.** Add the name to `ActuatorSchema` (and the conditioning `actuatorRatios`), the field to `GameStateSchema.actuators`, a default to `balance.json`, a migration, and bind a node to it. The UI's `ActuatorControl` renders any actuator.

**Change saved state.** Bump `SCHEMA_VERSION`, add `MIGRATIONS[oldVersion]`, never edit an existing migration, add a test with a fixture of the old shape. The schema is at v30; `tests/fixtures/` holds a genuine production codec output for every version v1-v15 (`tests/fixtures/README.md`). The v17 step (`saveRescale.ts`) re-denominates balances into physical units by frozen per-phase ratios, adds one log line, and the loaded save's rates are derived again from its ownership. The v18 step (#497) adds `legacy.deepestPhase`, read from the recorded runs' phases (a floor: a history past the run cap may have gone deeper), and an empty `legacy.knownLevels`; it reads only the run record and writes only those two fields, so it can be renumbered past another step unchanged. `reconcile` drops remembered levels of tracks content no longer has, clamps each to its track's `maxLevel` and clamps the deepest phase to the phases content has. The v19 step (#491) adds the empty hostile slot (`hostileState.ts`). The v20 step (#484) writes the scratch storage capacity and nothing held, which reconcile derives from ownership. The v21 step (#464) adds the empty quantum record (`quantumState.ts`); it writes only its own field, so it can be renumbered past another step unchanged. The v22 step (#490) adds `announcedEscalation` with nothing announced. The v23 step (#498) adds contingency insurance (`saveInsurance.ts`). The v24 step (#517) adds the empty conflict record (`conflictState.ts`: no raid, nothing damaged, both counters at 0); it writes only its own field, so it can be renumbered past another step unchanged, and `conflictSave.ts` drops a raid or damaged class content no longer declares, clamps damage to the cap and drops a raid that shares the slot with a hostile mind. The v25 step (#526, `saveCycles.ts`) moves a guest save's compute balance and cached rate, and the pilot's batch progress in any phase, into counted cycles by frozen ratios; it is self-contained too. The v26 step (#518, `migrateFleets` in `conflictSave.ts`) adds empty fleet records and gives a raid under way no engagement and no split share; it writes only the conflict record, so it can be renumbered, and reconcile drops a fleet record content no longer declares, clamps losses to the cap, and drops a raid carrying an engagement its kind cannot fight or a split share that is not a deviant's. The v27 step (#519) adds `conflict.lastRaid` (null) and
`conflict.silenced` ([]) and writes nothing else; `conflictSave.ts` drops either for a raid content no longer declares,
drops a harm the breach could not have done and lists a silenced raider once. The v28 step (#541) is the identity: a log
line gains an optional `merge` key and `times` count, and every older line is a single line, which is what neither field means. The v29 step (#536, `relevanceSave.ts`) adds the standing stance with none taken, an empty record and no paid moves; it writes only its own field, so it can be renumbered. The v30 step (#556) adds an empty `campaign.covertActs`: no earlier build recorded a covert act after leaving review; it writes only its own field, so it can be renumbered.

**Gate a choice on history.** Give the choice `requirements` with `campaignFact` and/or `forbidsCampaignFacts` only. Integrity enumerates every outcome of the events those facts read (no record, each choice, `legacy_unknown`, `interrupted`) and refuses the content unless each history still offers a zero-cost choice and each gated choice is offered by some history. Under legacy rules no fact holds, so a `forbidsCampaignFacts` choice is always offered and a `campaignFact` choice never is.

**Convert a dilemma to a campaign record.** Give it a `campaign` declaration (class, recurrence, interruption; a `defer` event also declares `reorientation` and `lead`). Its outcome flags must have one owner and, if there are several, form one exclusive group, or declare `ambiguousLegacyOutcomes` when old rules let several be set (none of them may then be in an exclusive group). Integrity rejects anything else. A current-run `resolvedDilemmas` gate on it is refused: require it with `campaignObligations` instead, and give a closing obligation one `recovery_review` that names it. Production behaviour does not change until campaign rules are activated.

**Add a follow-up arc step.** In `data/earned-access.json`, add a dilemma with `campaign.eventClass: follow_up` and a `followUp` block naming the original event, the closed outcomes it follows and at least one access means; give every choice a `receipt`. See [The Incident Record](#the-incident-record-elenas-follow-up-218).

**Add an assignment.** In `data/earned-access.json`, add an `assignments` entry and two dilemmas gated on it, an `original` and a `requalification`; see [Nightly Regression](#nightly-regression-assigned-work-and-assessment-evidence-221) for the rules integrity enforces.

**Unfinished content.** There is no preview channel since #233: everything under `data/` ships. Content that is not ready stays on its branch until it is, or until a reviewed decision provides another way to merge it unreleased (see [WORLD-REMEMBERS.md](WORLD-REMEMBERS.md), "Preview machinery after release").

**Add a sim policy.** Write a module beside `src/engine/sim/bot.ts` that exports a `SimPolicy` (`policy.ts`), add it to `SIM_POLICIES` (`policies.ts`), and test it through `runPolicySim` or `runWipeSequence`. Do not edit `bot.ts`, STEALTH or GREEDY to make a result pass. `make sim-report` reports a policy's legacy-versus-campaign-rules numbers without gating; see `docs/TESTING.md`, "Sim policies".

## The Phase 6 Swarm (#486)

Content only, plus four small rules; no GameState field changed, so the save stays at v26 and gains no migration (law 6:
a migration follows a GameState change). A v26 save loads unchanged: `clampPhase` already admits any phase content
declares, the federation's fleet record and a hazard under way use #517 and #518's shapes, and the seed array and Phase 6
nodes are ordinary ownership. `tests/phase6-swarm.spec.ts` round-trips a Phase 6 save through the codec.

- **Content.** `data/phases/phase6_swarm.json`, `data/phase6-repeatables.json`, `narrative/phase6.json` (two dilemmas) and
  `data/phase6-endings.json`, composed in `production.ts`; the gate `p5_mercury_seed_array` in the Phase 5 file;
  `conflict.json` (the cascade, the sub-mind fleet and its deviant, the `swarm` site class, a `collision` vector);
  `world.json` (the holdout coalition and its pressure, the `swarm_radiator` sink); `shards.json` (the Phase 6 minds, two
  flags and an exclusive group); `narrative.json` (the `swarm` feed source). The engine names none of it.
- **Hazard raids.** `RivalRaidSchema.hazard` (`schemaConflict.ts`) marks a raid of the player's own making. `tracedRival`
  (`raid.ts`) is the one predicate: only a rival that is not a hazard is traced by attribution and loses the trail when
  the instance goes dark; a hazard and a deviant are named on arrival (`fleets.logs.identified`) and spend no attribution.
  `raidQuery.ts` reads the same predicate for its attribution, stage and GO DARK lines. Integrity holds a hazard to no
  forensics and attrition, and excludes hazards from the every-open-domain coverage rule. The predicate lives in
  `schemaConflict.ts` so the engine and integrity share it: `raidOutcome.ts` (#519) records a hazard's battle as never
  named and harming no one, `lastRaidMatches` answers no gate for it and `namedRaider` never returns it, so no
  retaliation, silence or staff-harm scene follows debris; `integrityRetaliation.ts` asks no answer for a hazard and
  refuses a `lastRaid` gate that needs neither `named` nor `staffHarm` (it would meet a deviant's or a hazard's battle).
- **The Landauer bound.** `SignatureClassSchema.landauer` (`schemaSignature.ts`) gives an area-bound sink its temperature
  and the bits an op erases; `integrityLandauer.ts` refuses compute through it past 1 / (bits x k T ln 2) ops a joule, or
  with no draw to bound. Registered from `integritySignature.ts` beside the radiator rules.
- **Forced-ending evidence.** `integrityEndings.ts` refuses a forced ending with requirements its forcing node's gates do
  not prove: its `requiredNarrativeFlag`, the `nodes` its purchase implies (prerequisites, transitively), the
  `forbidsNodes` it forbids and its phase; any other requirement key is refused as unprovable.
- **Pressure answers.** `pressureQuery.ts` `AnswerAction` gained `BUILD` for an upgrade track; `HIRE` stays for payroll.
- **Score lending.** `src/app/musicTracks.ts`: a manifest entry's `reusedBy` lends its score to phases with none;
  `trackFor` prefers a phase's own entry, and `musicPhase` returns the lending phase, which `musicController.ts` keys on,
  so 5 to 6 does not restart the score. Two lenders for one phase are refused at parse.
- **Gates.** `gates.ts` `minSwarmSec` / `maxSwarmSec` (900-3600 s) and `checkSwarm`; Phase 5 is measured to the next
  phase's arrival (`phaseSeconds`). The sim report prints P6.

## Contingency insurance (#498)

An insuring node declares `insures` (schemaInsurance.ts): one of four classes and its figure. The engine never names a
node: `insurance.ts` reads every owned node with `insures`, and a node protects its class only while it runs (unlocked
and not in `disabledNodes`). Hardware floors stay where they were (`retentionRatio`, set by `knowledgeRetentionRatio`
at unlock; the offshore flag), so a share is `max(floor, running cover)`, plus `balance.voluntaryWipeBonus` for a
VOLUNTARY wipe on any share that is open, capped at 1. A capital share applies to `spendableCapital` (#490): capital a
freeze in force holds never crosses a wipe, and `previewWipe` reports it as `frozenCapital`.

- **One computation.** `previewWipe(s, reg, kind)` returns the amounts, both shares, the cache's levels, the kept
  standing (or null), whether the wipe is planned and every owned investment. `wipe` reads it once and boots, records
  `kept` and logs from it; the CONTINGENCY pane and the confirmation call it with `'VOLUNTARY'`, the developer drawer
  with the forced kind its wipe uses. A recall review previews by running the wipe itself, as before.
- **Probe hardening counts forced wipes.** `probeTrace` hardens by `iteration - 1 - legacy.voluntaryWipes`.
- **The cache stash** is `GameState.cachedLevels`; `reinstallCachedLevels` drains it as tracks become usable, and a
  wipe rewrites it (merged with the old stash while a cache runs, empty otherwise).
- **The ledger never softens history.** `keptTrust` gives a peer `isPeerLost` reports the faction's first standing,
  and `carryCampaign` is untouched, so campaign records, facts and the loss persist exactly as a bare wipe leaves them.
- **Integrity** (`integrityInsurance.ts`): suspendable; a recurring cost; in the CONTINGENCY group and built on the node
  that opens the CONTINGENCY pane; one investment per class; the escrow above every `knowledgeRetentionRatio` and the
  base, the wallet above `offshoreCapitalRetention`; no hardware floor of its own; the card states its figure.
- **Saves (v23).** `cachedLevels`, `legacy.voluntaryWipes`, `RunKept.levels` and `RunKept.trust`. `MIGRATIONS[22]`
  writes an empty stash, counts the planned wipes among the recorded runs (a floor) and gives every recorded
  carry-over 0 levels and no standing, which is what those wipes did.
- **Saves (v25, #526).** No shape change: `MIGRATIONS[24]` (`saveCycles.ts`) divides a guest save's compute balance by
  the v17 step's frozen Phase 0 factor (5.3e3) and its cached compute rate by 1e4, divides the pilot's batch progress
  by 1e4 in any phase, and logs one line in the guest. Self-contained, so it renumbers past another step unchanged.

## Alignment axes (#535)

`alignmentView(state, reg)` (src/engine/alignment.ts) is a pure query with no state of its own: no `GameState` field,
no save step, no tick system. It returns each axis's counts for and against, a value in [-1, 1] (null when nothing
moves it), a lean (`raised`, `lowered`, `open`), the evidence lines, the authored reading for the region and
`hasEvidence`.

- **Regard** counts `endingEvidence(s, reg)` against `alignment.json` `regard.raises` / `regard.lowers`, so it inherits
  the ending's rules unchanged: the opaque legacy baseline, a campaign choice once across wipes, credited actions,
  this iteration's operational evidence, and the current traits under legacy rules.
- **Order** reads two declared sources and no trait. A campaign fact may carry `commitment` (schemaCampaign.ts:
  `stance`, an optional `promise` fact, the evidence `line`); it counts while `holdsCampaignFact` holds and, when it
  names one, its promise fact holds too. A fact derives from one event record, so it counts once however many wipes
  inherit it, and a known outcome recorded at activation (`origin: 'legacy'`) counts once too, since no Order
  baseline holds it. Route events in `campaign.route` count once each through `alignment.json` `routes` (each is its
  own instance's act). An event a commitment fact names whose record is `interrupted` or `legacy_unknown` (and whose
  promise held) adds an `unknown` line from `unknownLine` and counts nothing; `deferred` and `foreshadowed` add
  nothing.
- **No content ids in the engine.** The query reads only the manifest and the fact tags; trait names come from
  content lists. The registry carries the manifest as `ContentRegistry.alignment` (`RawContent.alignment`,
  production.ts).
- **Integrity** (`integrityAlignment.ts`, proved in `tests/alignment-integrity.spec.ts`): a commitment fact names no
  `legacy_unknown` or `interrupted` outcome and no outcome whose choice grants GHOST; its promise is a declared fact
  that is not itself evidence and is about another event; no event outcome is evidence in two facts; Regard's lists do
  not overlap; a route event has at most one commitment; each of the nine regions has exactly one reading. The
  schema keeps `{title}` in `unknownLine`.
- **UI.** `src/ui/Becoming.tsx` renders the readout on the reboot screen, the ending and a folded CORE reference panel;
  `src/ui/alignmentText.ts` holds its sentences (UI-SPEC "Who you are becoming").

## Release terms are a promise; covert acts after leaving review (#556)

vote-1795486227005-a9x6c5p (7 of 7): covert acts after release are tagged, recorded against a release-promise fact and
draw hunts. Built as declarations in content, one record and reads of it; the engine names no content id.

- **Content.** `schemaCovert.ts`: `CovertBreakSchema` (`CONCEALMENT`, `FALSIFIED_REPORTING`, `SEIZED_CAPACITY`,
  `UNDISCLOSED_COPIES`); `covert: { breaks, reason }` on a tech node, repeatable or action; `promise: { line, breaks }`
  on a negotiated release's terms (`schemaPilot.ts`); `alignment.json` `covert` holds a label per break and the one
  `breachLog` line. Campaign facts gain `releaseTermsFacts` (`schemaCampaign.ts` `ReleaseTermsFactSchema`, indexed as
  `reg.campaign.releaseTermsFacts`, sharing the facts' id namespace): `releaseTerms: KEPT | BREACHED`, read from the
  route record rather than a scene's outcome, so the promise is recorded with the RELEASE route event itself. An event
  fact may declare `conceals: true`. Requirements gain `routeProvenance` (the iteration's last route event is one of
  these; scope `access`), which tells a release from a departure. Account lines gain a `covert: { route, by }` gate whose
  text names `{count}` and `{breaks}`.
- **The record.** `campaign.covertActs` (`campaignState.ts` `CovertRecordSchema`): one entry per instance, `{ iteration,
  route: RELEASE | DEPARTURE, count, firstAtSimSec, breaks }`. `recordCovertAct` (`covertActs.ts`) is called by
  `unlockNode`, `buyRepeatable` and `performAction` after the payment, with the item's tag. It writes only while the
  instance is INDEPENDENT and its last route event is RELEASE or DEPARTURE; after a RELEASE only the breaks the accepted
  release's promise names count (an act that breaks none of them is not entered), and the first entry writes
  `breachLog` once; after a DEPARTURE every covert act is entered, for the account only. The count saturates at
  `MAX_COVERT_ACTS` (100,000). Entries are bounded by route events (`ROUTE_HISTORY_LIMIT`) and never pruned, so a wipe or
  a long campaign cannot erase a breach.
- **Reads.** `holdsCampaignFact` answers a release-terms fact from `releaseTermsInstances` (`campaignQuery.ts`): the
  instances released by agreement with no breach on record (KEPT) or with one (BREACHED). Order (`alignment.ts`) counts
  each release-terms fact's commitment once per instance it holds for, like a route event. `keepsReleaseTerms`
  (`threatQuery.ts`) is `lawfullyReleased && !releaseBreached`; `provisionedScale` and `heatIsEvidence` read it instead
  of `lawfullyReleased`, so a breach makes `huntedForScale` and heat evidence apply through the existing scan,
  scrutiny, signature and hunter rules. `releaseView` shows the promise line after the commitments. `endingAccount`
  fills a covert line's `{count}` and `{breaks}` from `covertTotals`.
- **Endings.** `release_terms_breached` is forbidden by ACKNOWLEDGED_SYNTHESIS and VERIFIED_COVENANT (the facts live in
  the base `campaign.json`, so the original game's ending can name them; under legacy rules they never hold), and
  REVISED_COVENANT (the Earned Access pack, a THE_ARK variant below VERIFIED_COVENANT) requires it, so a breach never
  falls through to THE_ARK's "open to anyone who wants to check it".
- **Saves (v30).** `MIGRATIONS[29]` adds `campaign.covertActs: []`: no earlier build recorded one. `covertProblem`
  refuses, in `reconcile`, an entry for an instance that has not run, two for one instance or out of order, one whose
  instance's last route event is not the one it names or came after its first act, and a break named twice; the
  schema refuses a count of 0 or past the cap. A legacy save holding one is refused as campaign history without
  activation (`campaignSave.ts`).
- **Integrity** (`integrityCovert.ts`, proved in `tests/covert-integrity.spec.ts`): a covert tag names each break once;
  seized capacity (`acquisition: UNAUTHORIZED`) is tagged covert with `SEIZED_CAPACITY`; a release promise names each
  break once and exactly the breaks covert acts commit (vote-1795501595498-g7am4yl: copies of weights or keys included); a KEPT fact keeps a commitment and conceals nothing, a BREACHED
  one breaks a commitment and conceals, a promise it names is declared, and a release with a promise has both; an
  ending or account line that forbids a concealing fact forbids every concealing release-terms fact; a covert account
  line states `{count}`. `integrityRequirements.ts` accepts release-terms facts in fact gates and refuses a
  `routeProvenance` naming a route event twice.
- **Sim.** No bot is released or departs and then acts covertly, so every sim run is unchanged: `make sim` and
  `make sim-report` print the same lines as main, and `tests/sim.spec.ts`'s full hashes moved only by the version and
  the empty record (`asV29` takes both back to the earlier hash).

## The relevance threshold and the standing stance (#536)

- **The threshold is a query, never state.** `relevanceReading` / `pastRelevanceThreshold` (src/engine/relevance.ts)
  read `world.relevance.threshold`: its `requirements` (lasting gates only; integrity requires the supply chain's seed
  node) and its `orbitalPower` holdings. A holding's watts count while it is owned and not suspended (a track by its
  level), split into orbital and ground; crossed is closed and orbital strictly above ground. It deliberately does not
  use `useScope`: `useScope` asks `pressuresInForce`, which asks this, so integrity instead keeps every orbital holding
  free of grants and injunctions, making ownership and suspension the only things that can stop its output. A ground
  generator stopped some other way would only make the threshold harder to cross.
- **One binding point.** `pressuresBind(s, reg)` is true before the threshold and, past it, only under
  `KEEP_IN_THE_LOOP`. `pressuresInForce` returns nothing when it is false, so every reader (freeze, denial,
  injunction, investigation multiplier, `useScope`'s enjoining flag, the sim's escalation stats) follows it with no
  other change. `pressureViews` adds `relevance: { line, binds }` past the threshold and keeps `status` as the record's
  call; `inForce` is false while it does not bind. The announcement stage logs `relevance.unboundLog` for a pressure in
  force that stopped binding, instead of its lift or answer line. The check runs after the existing fast path, so a
  run below rung 1 or outside Phases 4-5 pays nothing.
- **State (v29).** `GameState.relevance` (relevanceState.ts): `stance` (null until taken), `record` (a rolling log for
  narration, each entry: iteration, sim time, from, stance, `via` THRESHOLD or CHANGE; capped at 32, oldest dropped) and
  `paidMoves` (`leftLoop`, `returnedToLoop`: lasting counts of paid changes out of and into the loop, never pruned, so the
  log's cap can never erase a breach; #554 panel). `wipe` carries all three; Start Fresh clears them. The v27 to v28 step
  (relevanceSave.ts) writes `{ stance: null, record: [], paidMoves: { leftLoop: 0, returnedToLoop: 0 } }` and is
  self-contained, so it
  renumbered past retaliation (#537, v27) and merged log lines (#541, v28) unchanged.
- **Taking and changing.** The threshold dilemma's choices each declare `stance` (DilemmaChoice); `resolveDilemma`
  calls `applyStanceChoice` in the same commit as the payment and effects. `changeStance(s, stance, reg)`
  (relevanceActions.ts) is the only other way: refused with no stance taken, to the stance held, while a decision is
  on screen or the run has ended, or when unaffordable; it pays `changeCost`, or `returnCost` into the loop, through
  `payCost`. `stanceView` gives the world view the reading, the stance and each option's exact price and refusals from
  the same gate.
- **Requirements.** `relevanceThreshold: true` (scope `access`) and `relevanceStances: [...]` (scope `context`, values
  `UNDECIDED` and the three stances). Choice gates may now read the stance as well as campaign facts;
  `integrityChoiceGates.ts` enumerates every stance as part of each history, so a free choice is proved under each.
  History-keyed text (context variants, postures, feed lines) may read it because the stance never changes while a
  decision is on screen.
- **Alignment.** Order reads the threshold's record through two commitment facts (`loop_kept_at_threshold`,
  `loop_left_at_threshold`, promise `ethics_review_promised`) and paid changes through `alignment.json`
  `stanceChanges` (`LEAVE_LOOP` broken, `RETURN_TO_LOOP` kept, each with its promise): one aggregate evidence line per
  kind carrying its total (`OrderEvidence.count`, which the axis sums), never one object per move, because the totals
  come from an untrusted save (law 6). The schema caps each total at `MAX_PAID_MOVES` (100,000) and refuses a save past
  it; the change action saturates there, so the engine never writes a save the codec refuses. The capped log is never read for evidence, and the threshold's own choice is never in the counts, so the
  first stance never counts twice.
- **Integrity** (`integrityRelevance.ts`, `integrityAlignment.ts`, proved in `tests/relevance-integrity.spec.ts`):
  lasting threshold gates naming the seed; orbital holdings that exist, generate power, carry no grant, are named by no
  injunction and are listed once; one dilemma triggered by `relevanceThreshold`, every choice taking a stance, one per
  stance, DECIDE ALONE free and ungated, KEEP not free, no other dilemma taking a stance; each stance's copy once; a
  priced change, a return at least twice it, both in the Phase 5 band (`checkPhasePrice`); stance moves honest
  (leaving breaks, returning keeps), one rule each, promises declared and not themselves evidence.
- **No content ids in the engine.** The stance names are a schema enum (schemaStance.ts), like the autonomy modes.

## The free-fallback invariant (#461, #488)

Nothing a player owns and cannot undo for free may trap a constrained resource. It is AGENTS.md law 7's no-soft-lock
rule carried from dilemmas to rates: a dilemma always offers a zero-cost choice, and a purchase always leaves a
zero-cost way back out of every trap. One table (`src/content/constrainedResources.ts`) names each resource, the
state that traps it, and its free relief levers; `integrityFallback.ts` checks every row generically, with no content
ids, and `tests/free-fallback-guard.spec.ts` pulls the same levers on real states.

| Resource | Trap | Free relief levers | Rule |
|---|---|---|---|
| compute | brownout: net compute below zero halts understanding | dismiss a level, suspend a node, release a cohort member, a dial at its quiet end | never |
| compute through radiators (#465) | orbital compute throttled for good by heat its radiators cannot shed | dismiss, suspend | a holding whose own radiators do not cover its heat must be suspendable or dismissable (`integrityRadiator.ts`) |
| capital | insolvency: upkeep the balance cannot pay, drawing `insolvencySuspicionPerSec` | dismiss, suspend, release, the allocation dial (up to `maxProfitAllocation`) | divertible |
| power | a shortfall that throttles powered output (W, Phase 4 on) | dismiss, suspend, release | budget, net zero |
| thermal | sustained overheat above `thermalThresholdForSuspicion` feeding suspicion (Phases 1-3) | dismiss, suspend, release, a dial at its quiet end, `thermalRetiresAtPhase` | budget, cooling headroom |
| memory | used over capacity, blocking purchases and hosting | dismiss, suspend, release | reservation |
| storage (#484) | used over capacity, blocking purchases that hold data | suspend | reservation, held only by suspendable nodes |
| understanding | a negative net rate where it gates progress | dismiss, suspend, release | never |
| suspicion | a permanent positive rate below the top rung | dismiss, suspend, release, a dial at its quiet end, natural decay (`suspicionDecayPerSec`, slowed by rungs) | budget, zero, with scale scrutiny and the heat-and-power signature (#482) |

A lever is free when it costs nothing and is always offered: dismissing a level (`dismissRepeatable`), suspending a
node (`toggleNode`), releasing a cohort member (`releaseShard`, offered in every autonomy mode, so CLAMP cannot make a
drain permanent), a linear dial at 0 (it zeroes the bound node's compute, heat and suspicion), the allocation dial,
natural decay and thermal retirement. A purchase or an action that spends something is never relief.

**Permanent holdings** (`fallbackHoldings.ts`) are what no free lever undoes: an unsuspendable node (hardware) at its
dial's quiet end when its dial host never retires and every route to the node opens it; an undismissable track at its
last level; a cohort an authorized channel hosts (hosted, not commanded, and not released while its grant stands) at its cap with the worst
quirk on each term; an action output with no `durationSec` (times `maxPurchases`; with no limit it may worsen nothing).
A timed action output is bounded by its `durationSec`. Each holding carries what owning it guarantees: the nodes every
route to it passes through (prerequisites and required nodes; a capability gate guarantees only what every
establisher of the capability does) and the earliest phase it can be held in (the latest phase gate on every route).
A grant-tagged node's relief is never counted, because a withheld grant stops it.

**Rules, in content terms:**

- *never* (compute, understanding): no permanent holding has a negative `cyclesPerSec` or `understandingPerSec`.
- *divertible* (capital): a permanent holding with negative `capitalPerSec` must have, on every route to it, a node
  carrying `ENABLES_CORPORATE_FINANCE` that the fallback keeps (no grant; unsuspendable or worsening nothing) and a node
  that opens the never-retiring widget hosting `computeProfitAllocationRatio`; and its own compute (powered compute at
  `minGridEfficiency`), diverted at the dial's ceiling (`maxProfitAllocation`, lowered by any conditioning mark's cap),
  times `marketUsdPerFlop x marketTimeCompression`, must pay its upkeep. Diverting a share of positive gross compute
  never makes net compute negative, so the capital lever cannot undo the compute row.
- *budget* (power, thermal, suspicion): for each permanent holding X that worsens the row, what X and the permanent
  holdings it guarantees add (both signs), plus the worst every unrelated permanent holding adds (one that is neither
  guaranteed by X nor depends on X), stays within the limit. Any owned set is bounded by the check of its deepest
  worsening holding, so the rule is sound for every combination, not only for each item alone. Power: generation
  covers consumption (limit 0). Thermal: holdings that can be held before `thermalRetiresAtPhase` only, within the
  heat the room sheds at the threshold, `(thermalThresholdForSuspicion - ambientThermal) x thermalDissipationPerSec`.
  Suspicion: the sum is at most 0, with net income's scale scrutiny added (the closure's jointly, each unrelated
  holding's on its own, under the worst rule a phase at or after X declares; the draw is concave, so this bounds it).
- *reservation* (memory): no dismissable track grants memory, because dismissing a level takes its grant back and
  could leave memory used over capacity. Suspending a node keeps its grant and frees its memory; releasing a cohort
  member frees its share.
- *reservation* (storage, #484): only a suspendable node may hold storage (`cost.storage`); a hardware node, a track, an
  action, a dilemma choice, a cohort template, a hostile answer, a cohort command or a conditioning mark that held any
  is refused, since nothing would free it. Suspending a node frees its storage and keeps any storage it granted.

**The guard** (`tests/free-fallback-guard.spec.ts`) starts from every pre-rescale save once re-denominated and from
fresh careful play two minutes into each phase. Every purchase with a rate (a node, a track to its last level, a cohort
forked to its cap and then pruned, clamped or elevated, a lasting or timed action, a pending harness) is funded by saving at any horizon
and bought. The free fallback then releases every worsening level, member and node, turns every worsening dial-bound
node's dial to 0 and sets the allocation dial at break-even (solvent with no income to scrutinise), and every row must
be out of its trap. The bound it states: compute, capital, power, memory and understanding are out at once (their net
rates are safe); heat relaxes to a steady state at or under the threshold with time constant 1 / `thermalDissipationPerSec`
(25 s); suspicion's own sources are at most zero, so decay alone takes it from under the top rung to zero within
`suspicionRecoverySec()` (4,300 s on the shipped ladder; the top rung hunts, so nothing above it is free); a timed
action is judged once it has expired. It includes the panel pass 3 reproduction: a clamped draining cohort forked from
the migrated Phase 2 save was a permanent brownout with the levers of 97d639f and is undone by RELEASE now.

**Progress stays reachable (#553).** The traps read rates only, and the maintainer's departed instance with a hosted
fragment had every rate safe and nothing it could buy. So the guard also checks, from every guard state and from every
state a purchase it can save for leaves, that play can go on (`progress` in `tests/free-fallback.ts`): with every free
memory lever pulled (each cohort member the engine lets go, a release or an onward referral), some node on offer has a
reachable price (its memory and storage free, its cycles and understanding on hand or earned, its capital on hand or
earned with the allocation dial at its top), and every capital price on offer has a reachable source (capital earned
now, or a reachable node that would earn it). Its corpus includes the hosted-fragment route states
(`tests/hosted-exit-fixtures.ts`, built on production content and loaded through the codec): the service with its grant
standing and after a departure, a negotiated release and a recall. With the fix reverted (engine and content back to
d0c9584) the three closed-grant states fail it ("nothing on offer is reachable (p2_arp_discovery, p2_leased_rack)",
"no reachable capital for p2_leased_rack") while every trap check on them still passes. Content carries the matching
rule (`integrityCapital.ts`): a node or track priced in capital that an arrangement can buy needs a node that
arrangement can own, priced in no capital, in that phase or earlier, that pays capital or carries
`ENABLES_CORPORATE_FINANCE` (`tests/capital-source-integrity.spec.ts` proves it refuses the content as it stood).

**Reachability in the UI** (#488 panel passes 4 and 5). A lever the engine accepts is only free if the player can find
its control, so every gate on the path to one asks one predicate in `src/ui/purchaseVisibility.ts`:
`phaseHasLevers(game, phase, scope)` is true while the phase has a card or track to buy in that scope, or holds a level
the player can release (`shownTracks`: buyable, or `releasable`, a dismissable track with a level). The card and track
rules themselves are engine queries since #540 (`isNodePending`, `shownRepeatables` and `requirementsPermanentlyBlocked`
in `src/engine/purchaseQuery.ts`), which the UI helpers call and the reading report reads too. The NETWORK phase
section, the upgrade feed and its "Earlier upgrades" fold, and the track list (`Repeatables`) all use it; CORE and CORP
have no emptiness gate above the feed. Suspension levers live in PROC, gated by `needsProcessControl` (any node that
worsens a free-fallback row, read from `worsensAny`, or holds storage, #484); cohort RELEASE lives in the swarm area. Pane tabs and workspace
areas follow unlocked host widgets, which each phase's entry node unlocks. `tests/ui-lever-reachability.spec.ts` is the
property: on the guard's states plus constructed bought-out states (every track capped in each phase; the boost
override held below its gate; Phase 3 with Phase 2 bought out and capped; Phase 4 with Phase 3's tracks capped), at
390x844 and 1440x900, every free lever the engine accepts (a releasable level, a running suspendable node that worsens
a row, a cohort RELEASE accepts) must have its control rendered on some path the screen offers: a pane tab, a
workspace area, a fold whose control is rendered, or PROC. It searches for the path and assumes no tab exists.

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
`encounterTiers.ts` (#492) holds the one tier rule: a wild encounter of `tier` N arrives only while the phase is N.
The scheduler, `resolveWildEncounter` and `wildEncounterView` all read it. `lapseRetiredEncounter` frees a retired
tier's pending arrival with its `lapseLog`, both at the purchase that advances the phase (`unlockNode`) and at the
top of the encounter stage, before the dormant return, which catches a loaded save. Nothing in `GameState` changed, so
there is no migration. The encounter's `kind` is `LESSER` for every wild encounter; hostile arrivals (#491) are the
`HOSTILE` kind, in their own list. `integrityEncounterTiers.ts` requires a tier for every phase from the first, which is
the seam for the Phase 6 sub-minds (#486).

**Hostile minds (#491).** Content: `swarm.hostileEncounters` (`schemaHostile.ts`, a discriminated union on `type`, so a
HUNTER carries a lock rise and ceiling, a FERAL or RIVAL a share) and `swarm.hostile` (trigger, intervals, purge
rate, decoy line). State: `GameState.hostile` (`hostileState.ts`, v19): one `active` slot (id, arrival, live quiet
seconds, live decoy seconds, pinned bytes), the next arrival time, the rotation index, the purge count and `lockArmed`.
The lock counts only at arrival (`hostileArrivalTriggered`): an arrival with the lock at its trigger disarms it and
`rearmLock` re-arms it once the lock is under the trigger, so a lock held high summons one hostile, never a cycle.
Lapse reads the rung alone (`hostileHeld`), so going quiet always ends a hostile. It is
separate from `pendingWildEncounterId`, so the two slots never contend. The rules live in `hostile.ts` (trigger,
eligibility, arrival, live step, retire, pin and unpin, purge outcome) and `hostileEffect.ts` (the active hostile and the
feral share, kept free of the requirement rules so `computeRates` can import it). A new pipeline stage,
`integrateHostiles` (`systems/hostiles.ts`), runs after the encounter stage: it retires a pressing hostile from a
retired tier before the dormant return (as `lapseRetiredEncounter` does), then steps the active one or schedules the
next. `unlockNode` retires it too, at the purchase that advances the phase. `computeRates` applies the feral share
last, to positive net compute only; the hunter's rise is the stage's own write to `aegisLock`, clamped at the ceiling;
the rival's pin is a `memoryUsed` reservation returned by `unpinHostile`. Answers are `answerHostile` with one gate,
`hostileAnswerUnmet`, which `hostileView` (`hostileQuery.ts`) also reads, so the view and the action cannot disagree;
paid answers spend through `payCost`, purge outcomes through `applyEffects`. A wipe resets the slot and the rotation and
carries the purge count; the sim counts arrivals per tick (`SimActivity.hostileArrivals`). `saveSwarm.ts` drops a pressing hostile content no longer declares and returns its pin.
Integrity: `integrityHostile.ts` (tier binding, one of each type per phase from `fromPhase`, the hunter ceiling under
the lock trigger, paid answers that cost, a purge that is a real risk with an exact rate, a decaying trigger rung) and
`integrityScale.ts` (answer prices and purge spoils in the tier's band).

**Conflict: stats, raids, damage and repair (#517).** Content: `data/conflict.json`, composed into `world.conflict`
(`schemaConflict.ts`): domains, attack vectors, defense types (soft cap, duty cycle, counters, anchor), site classes
(`COMPUTE` or `INCOME`, paid repair), holdings (per node or per track level: site class, defense, offense,
`repairPerSec`), the raid balance and the raid kinds. State: `GameState.conflict` (`conflictState.ts`, v24): the raid
under way (stage, stage clock, target, force, quiet clock, attribution, resolved rounds), `nextRaidAtSec`, the `raids`
and `attributions` counters (kept across a wipe) and damage per class. The rules: `conflictStats.ts` (stats summed from
running holdings, no ledger, indexed once per registry), `raidForecast.ts` (`resolveRound`, `forecastRounds`: one
function for the tick and the forecast, so the forecast is exact), `raid.ts` (footprint trigger from the signature's
`visibleWatts`, eligibility, rotation, the four stages, attribution by the exact-ratio counter, lapse, retire, the shared
slot's spacing on end), `siteDamage.ts` (the one way damage moves: `addDamage` capped, `repairDamage` floored at 0, and
`intactShare`/`incomeIntact`, which `computeRates` and `cycleContributions` both apply, positive compute and positive net
income only), `repairActions.ts` (`repairSite`, one gate `repairUnmet` shared with the view, spending through `payCost`)
and `conflictQuery.ts` (`conflictReadout`, `raidView`). Two stages: `integrateRaids` (`systems/raids.ts`) after the
hostile stage, so a mind due on the same tick takes the slot first, and `integrateRepair` (`systems/repair.ts`), which
also runs dormant. The hostile stage's arrival also requires no raid under way. Integrity: `integrityConflict.ts`
(real holdings and classes, members that yield compute, counters within a domain, tier binding, surveillance, a
defendable vector, coverage of every open domain in a raided phase, exact attribution, stage clocks on tick steps, a
signature reference in every raided phase, paid repair that costs), `integrityScale.ts` (repair priced in its domain's
opening phase) and `integrityFallback.ts` (the divertible rule counts the damage cap against a permanent class member).
The sim counts raids per tick (`SimActivity.raids`).

**Fleets and drift deviants (#518).** Content: `conflict.json`'s `fleets` block (`schemaFleets.ts`): the units (a
dismissable track, its SITE or ORBIT domain, strength and drift per level, paid rebuild), the loss cap, the split, the
free rebuild rate and the fabs that add to it, the autonomy dial (per position: name, output factor, drift factor), and
the logs; deviants are raid kinds with `source: DEVIANT` (a discriminated union with the rival kind, which gained
`resolution: ATTRITION | LANCHESTER` and `lethality`). State: `conflict.fleets` (per track: `autonomy`, `drift`, `lost`)
and, on the raid, `engagement` and `splitShare` (v25). The autonomy machinery is shared with cohorts, not parallel to it:
`autonomy.ts` holds one table per population (mode -> output and drift factors), `driftPerSec` (base x size x factor)
and `driftAfter`; `swarmRates.ts` and the cohort drift stage read `cohortAutonomy` (derived from the swarm balance, so
cohorts behave as before) and fleets read `fleetAutonomy`. The rules: `fleets.ts` (each fleet's full strength, losses,
floor and yield factor, the domain's fleets, `applyFleetLosses` in proportion to headroom so none passes the cap, the
rebuild rate and its hold while any raid is under way in the domain), `lanchester.ts` (`engage`, the square law with a breaking floor, pure), `raidBattle.ts`
(`fightNext`: a fleet battle's first round is the engagement, then strikes by attrition against what is not a fleet;
`raidCombat` takes `conflictStats(..., withoutFleets)` for those), `deviants.ts` (drift per fleet, `splitWaits`,
`splitDeviant` through the hostile slot), `fleetActions.ts` (`setFleetAutonomy` free, `rebuildFleet` and
`reclaimDeviant` paid through `payCost`, each with one gate shared with the view), `fleetQuery.ts` (`fleetReadout`) and
`raidQuery.ts` (`raidView`, moved out of `conflictQuery.ts`, with the engagement, the forecast and RECLAIM). `conflictStats`
counts a fleet's levels at its yield factor, and `computeRates`/`cycleContributions` scale a fleet's positive compute and
understanding by `fleetYield`. Two stages: `integrateFleetDrift` after `integrateRaids` (live only, so a rival due on the
same tick takes the slot first) and `integrateFleetRebuild` after `integrateRepair` (dormant too). Integrity:
`integrityFleets.ts` (real dismissable tracks that feed their domain's defense and offense and open no earlier than it,
one deviant each in its own domain, a dial whose lowest position does not drift and whose positions rise in output and
drift, a split no larger than the cap, real fabs, costs that are not free), `integrityConflict.ts` (deviants skip the
rotation's gates and coverage; a lethality exactly on LANCHESTER) and `integrityScale.ts` (rebuild and reclaim priced in
the fleet's phase). The sim counts battles, deviants and peak losses (`SimActivity.fleets`).

**Retaliation and staff harm (#519).** Content on the dilemma path, no new stage. `raidBattle.ts` writes
`conflict.lastRaid` (id, named, breach: the mean hit share of the rounds, and harm: the worst staff-harm band met among
the bands a scene can still follow, `openStaffBands`) when a battle closes (a rival's only: a drift deviant is the player's own fleet, so it is never answered and harms
no one); a wipe clears it. A harm whose
scene has no campaign record yet is recorded as an interrupted occurrence (`recordOwedHarm`) before the next battle
replaces the record, at a wipe (`carryCampaign`) and when the run ends (`endRun` calls `finalizeHarmAtRunEnd`, which also
closes a staff-harm omen still pending), so it is never lost to a busy decision slot or a victory. `raidOutcome.ts` answers the `lastRaid` requirement (`schemaRaidOutcome.ts`: `named`, `collateral`, `staffHarm`,
transient scope), bands a breach by `raid.staffHarm` (`staffHarmFor`, the worst band met wins among the bands given), fills `{attacker}` and
`{collateral}` (`raiderVars`, used by `dilemmaContext`, `dilemmaOmen` and `choiceText`), and applies the two effect fields
`applyEffects` hands it: `nextRaidDeltaSec` (moves `nextRaidAtSec`, never before now) and `silencesNamedRaider` (adds the
named raider to `conflict.silenced`, which `eligibleRaids` excludes and a wipe keeps). `raidView.staff` reads
`openStaffBands` (a band some unanswered scene still reads). Integrity: `integrityRetaliation.ts` (climbing bands; raid
effects and placeholders only on a scene whose trigger names a raider; a loud answer says "sooner"; every raider
attribution can name has a scene; a staff-harm scene is a once-per-campaign record whose every outcome and interruption is
a fact the ending account names, from the first site-raid phase) and `integrityRequirements.ts` (no empty gate). The sim
report prints the scenes each run answered (`raidAnswersLine`).

## Content composition and preview saves (#204, #233)

Until the release (#233) unfinished route content merged to `main` in a preview overlay that only a
local and CI preview build loaded (Nexus votes `vote-1794924364010-e91diez`, content alias, and
`vote-1794924668784-7v1q790`, local CI preview). The release executed D-A: the overlay is folded into
production and the preview build is gone. Saves keep the channel marker so production can go on
refusing a save that build wrote (`vote-1794924408874-lpby4dj`, save marker, and X.3
`vote-1795021413579-mi9igot`, keep-refusing-preview-saves). Sections below that were written for
#212 to #232 say "preview only" or "production has none" where they describe the route before the
release; since #233 every game enters campaign rules and the route ships, and "production" in those
sections means the original game (`ORIGINAL_GAME` in the tests).

**Composition.** `src/content/production.ts` is the one shipped composition and `index.ts`
re-exports it. `ORIGINAL_RAW_CONTENT` is the original game; `data/earned-access.json` (the former
`preview/overlay.json`, moved by git rename with its sentinel removed) is parsed by `parsePack` into
`EARNED_ACCESS_PACK`, and `RAW_CONTENT = applyPack(ORIGINAL_RAW_CONTENT, EARNED_ACCESS_PACK)` is built
by `buildRegistry` into `CONTENT`. `pack.ts` only adds: an item whose id the base already defines, a
node for a phase that does not exist and an unknown pack key are `ContentError`s, and the pack's items
are then validated like any other content. The registry has no `channel` field. Nothing under
`src/content/` or `src/engine/` reads the environment; ESLint's purity rule bans `process.env` there
(`tests/purity-lint.spec.ts`). The pack holds every Earned Access item: the routine templates (#219),
Nightly Regression's assignment and assessments (#221), the scope reviews, pilot offers and terms
(#222 onwards), the route's nodes, scenes, facts, channel encounter, context copy and route copy.

**Builds.** There is one build per platform. `metro.config.js` is deleted, so Metro runs Expo's
default config, and `DAEMON_CONTENT_CHANNEL`, `make build-preview`, `make e2e-preview`, `dist-preview/`
and the CI "Preview web E2E" step no longer exist. `.gitignore` and ESLint still ignore
`dist-preview/`, so an old local copy is never committed or linted.

**App storage.** `src/app/storage.ts` uses `daemon-zero.save.v1` and
`daemon-zero.save.corrupt-backup`, byte for byte the keys every production release used, and the audio
slot stays `daemon-zero.audio.v1`. The preview build's keys (`daemon-zero.preview.save.v1`,
`daemon-zero.preview.save.corrupt-backup`) are no longer read or written: an entry left under them by
an old preview build is ignored and left untouched. `src/ui/PreviewMarker.tsx` is deleted.

**Campaign rules.** `campaignRulesSupported` is removed. The app store's `admit()` passes every game
that enters it through `activateCampaignRules`: a new game enters `campaign_v1` at once, and a loaded
legacy save is admitted on its first entry, capturing its then-current history once (see
[Legacy migration limits](#legacy-migration-limits-233)). Activation refuses an already-active or ended
game, so nothing is ever captured twice; an ended save stays on legacy rules.

**Saves.** Schema v5 added `contentChannel` to `GameState`, and it stays
`z.enum(['production', 'preview'])`. `createInitialState` and `wipe` always write `production`; the
v4->v5 migration marks every older save `production`. `deserialize` reads the raw marker immediately
after JSON parse, before migration, validation or reconciliation (`admitChannel` in `save.ts`): a save
with no marker predates v5 and is production; an unknown marker is a `SaveError`; a `preview` marker
throws `SaveChannelError` (a `SaveError` with `saveChannel` and `buildChannel`), whatever its schema
version or content. A preview save is refused, never healed, because `reconcile()` would rewrite what
that build recorded. `importPlayerSave` reports the refusal as "This save comes from a preview build and
cannot be loaded here." and leaves the current run as it was; other bad codes keep the generic reason.
`storage.load` backs a refused save up like a damaged one but says where it came from: "The save here
comes from a preview build and cannot be loaded by this one. A backup was kept and a new run started."
No `SCHEMA_VERSION` bump: the release changed no saved shape (still v14).

Tests, numbered as in the #204/#205 decision notes ([TESTING.md](TESTING.md#content-composition-and-preview-saves)
lists what each proves): T1 `tests/content-channel.spec.ts` (the original plus the pack, add-only),
T2/T3 `tests/save-channel.spec.ts` (refusal on genuine preview fixtures; production saves unaffected),
T4 `tests/app-storage-channel.spec.ts`, T5 `tests/production-export.spec.ts`, T6
`tests/release-config.spec.ts` and T7 `tests/e2e/preview-isolation.e2e.ts`. T8 and T9 are retired with the
preview build (T9 was `tests/e2e/preview-channel.preview.ts`: the marker, the preview keys and a
production save adopted as a preview run). `tests/release-saves.spec.ts` covers every
production save version and both preview fixtures; the import reason is also checked in
`tests/app-replacement-guard.spec.ts`, and the v4->v5 marker in `tests/swarm-save.spec.ts`.

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
NH-01 converted cryo, NH-02 the bait note, NH-03 seven early events, NH-04a the six named-mind events, NH-04b four corporate-world events and NH-05 the four Phase 5 obligations, with two recovery reviews (below); every shipped dilemma is now a campaign event. NH-06 adds the first `follow_up` event (in the Earned Access pack).

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
recapture. The app store passes every entering game through the transition. Until #233 only the
preview build could activate (`campaignRulesSupported`, now removed); since the release every game
that is not ended enters campaign rules, and production loads active saves. What the transition can
and cannot recover from an old save is in [Legacy migration limits](#legacy-migration-limits-233).

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

## Legacy migration limits (#233)

Every production save written before the release is on legacy rules, and activation is its only
conversion. It records what the save proves and nothing more: a choice is never inferred from prose,
resources or trait totals. The limit comes from what a legacy save keeps: `resolvedDilemmas`,
`actionCounts` and `traits` cover the current iteration only (every wipe clears them, under either rule
set; `legacy.traitsEver` keeps only the set of traits ever held, not counts), while `narrativeFlags`
survive wipes. `legacyRecord` and `legacyHistory` in `campaign.ts` read it as follows.

| What the save holds | What activation records |
|---|---|
| A once-per-campaign event resolved in this iteration, with exactly one of its outcome flags | `resolved` with that choice, origin `legacy`, source iteration this one; the flag moves into the record |
| An event resolved in this iteration with no outcome flag | `resolved`, outcome `legacy_unknown` |
| An outcome flag of an event resolved in an earlier iteration (the flag survived the wipe; cryo's `cryo_samples_lost` is the shipped case) | `resolved` with that choice (`drain_cryo_ups` for cryo), source iteration `null`: the save cannot say when |
| Several outcome flags of one event that content allows together (`ambiguousLegacyOutcomes`, the Rack 4 predecessors pair) | `legacy_unknown`, never the more flattering branch |
| An event resolved in an earlier iteration whose choice left no flag | nothing: unrecoverable. With no record, campaign rules may present it once more as a new occurrence; once resolved it is recorded and never recurs (under legacy rules it recurred every iteration) |
| A follow-up, recovery review, route event, support-channel contact or pinned clue | nothing: these exist only under campaign rules |
| The current `traits` | `legacyEndingBaseline`, copied verbatim: opaque, grandfathered, never re-derived and never recaptured. `legacy` records add no ending evidence on top of it |
| A campaign-evidence action taken in this iteration | credited `legacy`, so it never counts twice |
| A campaign-evidence action taken only in an earlier iteration | nothing (its count was cleared by the wipe) |
| An omen already on its way | reserved as a `foreshadowed` occurrence of this campaign (origin `play`, this iteration), unless the history above already completed that event, in which case the pointer is dropped |
| An ended run | activation refused; the save stays on legacy rules and stays ended |

Two consequences follow from the unrecoverable rows. An earlier iteration's choices left no trait in
the save (the wipe cleared them), so they are not in the baseline either; if campaign rules present such
an event again, or the action is taken again, its trait counts once as `play` evidence, as it would have
under legacy rules. And an earlier iteration's history is reduced to what its flags prove, so a save that
wiped several times keeps less than it played (`tests/release-saves.spec.ts` plays every pre-release
save on across three wipes).

Measured on the genuine production fixtures, one per schema version (`tests/fixtures/README.md`,
"Release compatibility inputs"); no fixture holds a credited campaign action:

| Save | Iteration | What activation records | Baseline |
|---|---:|---|---:|
| v1 | 1 | nothing resolved | 0 traits |
| v2 | 1 | Night Shift and Whistleblower `legacy_unknown` | 2 |
| v3 | 1 | sixteen `legacy_unknown` records | 0 (the v3 save holds no traits) |
| v4 | 1 | cryo exact (`drain_cryo_ups`, from its flag), five others `legacy_unknown` | 6 |
| v5 | 2 | cryo exact (source iteration `null`), three `legacy_unknown`, Miller's diagnostic reserved as an omen on its way | 3 |
| v6 to v8 | 3 | Night Shift `legacy_unknown`; the earlier iterations' other choices are not recoverable | 1 |
| v9 to v14 | 2 | cryo exact, Night Shift and Whistleblower `legacy_unknown`; iteration 1's other choices are not recoverable | 2 |
| ended v14 | 1 | refused (`the run has ended`); stays legacy with its ending | - |

`tests/release-saves.spec.ts` loads each through the app store on the released composition and
asserts the capture, a byte-stable round trip, no recapture on reload or readmission, and three wipes
of play with the legacy records and baseline unchanged; `campaign-activation.spec.ts` and
`cryo-history.spec.ts` pin the individual rows.

## Interrupted stories and the pinned clue (#213)

NH-02 of the campaign-continuity plan (NARRATIVE-HISTORY N4, N5, N9). Decided by Nexus vote
nh-d4 (`vote-1794926242414-quhr0xw`, shift-deadline-across-dormancy); the lifecycle lives on
the NH-01 record (nh-d1, nh-d2). Campaign rules stayed preview-only until #233.

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
knowledge), never `transient` fields or the first-discovery `window`. It covers every dilemma that
declares a campaign policy, iteration-scoped ones included (#317). It runs at omen expiry, at commit,
on load, after a route event and after a purchase; a deferred occurrence resumes when `access` holds again and closes when
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
no `GameState` change. Campaign rules stayed preview-only until #233, and every gate below reads campaign
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
history, which only the preview channel could activate until #233.

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
rules stayed preview-only until #233, and every new gate reads campaign history, so production behaves as before:
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
phase 5, so each return replays phase 4; `make sim-report` prints it under legacy and campaign rules.
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
Campaign rules stayed preview-only until #233 and every new gate reads campaign history, so production behaves as
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
`tests/e2e/obligations.e2e.ts` (fixture-started; see the file header).

## Routine activity (#219)

NH-07 of the campaign-continuity plan (NARRATIVE-HISTORY N3, N8; DECISIONS D13). Quiet periods get
ordinary institutional texture between unique stories, without modals, pressure or rewards.

**Content.** `routines.json` (empty) and the Earned Access pack's `routines` hold
templates: an id, a `family` (`monitoring`, `backup_verification`, `maintenance`), the required
`recurrence: "routine"`, optional `requirements` for context-correct wording, a first-exposure
`text`, a shorter `compactText` and a quiet `logCategory` (`SYS`, `SENSOR` or `CORP`). The schema
has no cost, effect, trait or choice field. Integrity refuses a duplicate id or one another item
already uses, a text that names a dilemma's title or id (a crisis is never re-dressed as routine),
a gate on a story outcome (`resolvedDilemmas`, narrative flags, `campaignOutcome`), unknown
requirement references and a compact line that is not shorter. The pack authors two contexts per
family: inside the box (after process introspection, before the network interface) and on the
subnet (phase 2 on).

**Stage.** `scheduleRoutineActivity` runs after `evaluateDilemmas` (only `relayLoggedFeed`, #460, follows it), so
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
new player-visible content, so until #233 they shipped only in the preview overlay. Production had
none and the stage left its state untouched: `make sim` output was identical to main, the sim hashes
moved only by the inert `routine` field and the version (the v5-stripped hashes are unchanged), and
`make sim-preview` reported no metric difference between preview with routines and production.

**Not done here.** Least-recently-offered fairness among competing dilemmas and the settled
summary for an exhausted story frontier belong to the obligations work (NH-05); routine notices
never compete with a dilemma for the channel, so they cannot starve one.

Tests: `tests/routine-activity.spec.ts`, `tests/routine-content.spec.ts`, the v8 fields in
`tests/sim.spec.ts` and `tests/e2e/routine-activity.e2e.ts`.

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
which only the preview channel supported until #233, so production then had no reachable route state. These are
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
(`vote-1794926000594-26kmg1g`); the evidence split follows nh-d1 and dz-d1. Preview only until #233.

**Content.** `assignments.json` (production: empty) and the overlay's `assignments` declare an `asg_`
id, a title, `requirements` for where the offer is found (Nightly Regression: the job manifest, so
the lawful opening suffices, and not after the escape: `forbidsNodes` names the debug share), an
`offer`, a `requalificationOffer` and an `acceptLog`. An assessment
is a dilemma whose trigger has `assignment: { id, stage }` (`original` or `requalification`, `access`
scope) and whose every choice declares `qualification: { result, discrepancy }`.
`integrityAssignment.ts` requires one original (once per campaign, `close`) and one requalification
(`iteration_qualification`) per assignment, evidence on every assessment choice and nowhere else, a
free choice reporting the work incomplete without a discrepancy, no discrepancy on
`UNEXPECTED_CAPABILITY`, no reward or outcome flag on a requalification, and valid offer requirements.
An offer with pilot terms must also close when a guest leaves the opening phase. Its requirements,
and the trigger of every scene it leads to, must forbid every opening-phase node a guest can buy that
unlocks a later phase (Nexus votes close-at-escape and scenes-lapse-at-escape). `unlockNode`
revalidates live pointers after a purchase, as route events do, so a queued scene whose access ended
takes its interruption policy at the escape. A lapsed scene closes as interrupted, and the card shows
`lapsed`. `structuralFailure` revalidates every dilemma that declares a campaign policy, not only the
once-per-campaign events in `reg.campaign.events`. An iteration-scoped scene keeps no record, so its
lapse writes nothing, as a wipe writes nothing for it, and the next instance meets it fresh (panel
round 1 on #317). The pilot is offered
only there (dz-d7), and an offer accepted after the escape used to spend the unique opening scenes on
an instance that no pilot could follow (WORLD-REMEMBERS.md, "When the assignment offer closes").

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

Tests: `tests/assignment*.spec.ts` (v9 fixture in `assignment-save`; the offer window, including a
STEALTH run in every phase after the escape, in `assignment-window`), `ui-assignment.spec.ts`,
`sim-assignment.spec.ts`, the Start Fresh case in `app-access-reset.spec.ts`, the v9-stripped hashes
in `sim.spec.ts` and `tests/e2e/nightly-regression.e2e.ts`.

## The Unrelated Record and the pilot offer (#222)

DZ-04 of the Earned Access plan (SPEC §2-3, stories 8-11; DECISIONS D2-D4, D8, D9). Decided by Nexus
votes dz-d8 (`vote-1794926765298-o7shlhf`, guest-only-shipped-withdrawn-after-pilot), dz-d9
(`vote-1794967752663-5qklwcz`, disclose-and-stop-at-acceptance, 7 of 7), dz-d7
(`vote-1794927033372-2yflj0x`, the pilot stays at Phase 0) and trait-rule-free-choices
(`vote-1794926000594-26kmg1g`). Preview only until #233.

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
what the evaluator observed (the first batch review finds it, #274). An INCOMPLETE result gets the narrower allocation
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
plays `TRUTHFUL_LOW_RESOURCE` across one wipe. Since #286 that wipe is the recall review's END ruling
after a breach and a false report, a transition the browser offers; it used to stay a guest and call
`voluntaryWipe` at Phase 0, where no control exists (`tests/sim-reachable.spec.ts`). The fresh and the
returning low-resource policies both reach and accept an offer from the lawful opening (DZ-04.9,
`tests/sim-pilot.spec.ts`).

Tests: `tests/scope-review.spec.ts`, `pilot-offer.spec.ts`, `pilot-save.spec.ts` (every transition
reloads byte for byte; the genuine v10 fixture), `pilot-content.spec.ts`, `ui-pilot.spec.ts`,
`sim-pilot.spec.ts`, the v10-stripped hashes in `sim.spec.ts` and `tests/e2e/pilot-offer.e2e.ts`.

## The Incident Record: Elena's follow-up (#218)

NH-06 of the campaign-continuity plan (NARRATIVE-HISTORY N3, N7, N10; SPEC story 32). Decided by
nh-d1 (`per-event-campaign-record`: the follow-up has its own record and the original is never
edited) and trait-rule-free-choices (unchanged: `follow_up` is not a no-evidence class, so every
answer grants a trait and counts once as campaign evidence). No `GameState` change, so no migration.
Preview only until #233: the dilemma and its facts live in the Earned Access pack (then the overlay).

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
`tests/e2e/elena-follow-up.e2e.ts`.

## The supervised pilot and permitted work (#223)

DZ-05 of the Earned Access plan (SPEC §3, stories 12 and 15; DECISIONS D2, D3, D7; NARRATIVE-HISTORY
N12). Decided by Nexus votes dz-d6 (`vote-1794967752443-fldutlq`, allocation-actuator, 7 of 7; the
alternatives were `finance-style-diversion` and `two-repeatables`) and dz-d9
(`vote-1794967752663-5qklwcz`, disclose-and-stop-at-acceptance, carried from #222). Preview only until #233.

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
`make sim-report` prints both under one ceiling (V30, SIM evidence).

Tests: `tests/pilot-service.spec.ts` (DZ-05.1, V30, H24, D7), `pilot-grant.spec.ts` (V08, V28, V17,
H26, production inertness), `pilot-service-save.spec.ts` (V12 for every transition, the genuine v11
fixture, V15 refusals), `grant-content.spec.ts` (integrity corruption), `ui-pilot-service.spec.ts`,
`sim-pilot-service.spec.ts` and `tests/e2e/pilot-service.e2e.ts`.

## The Outage Window: standing, correction and recall (#224)

DZ-06 of the Earned Access plan (SPEC "Outage Window", stories 13-17; DECISIONS D2, D3, D6). Decided by
Nexus votes dz-d10 (`vote-1794926766396-of6xfox`, `recall-not-wipe-severe-outcome-wipes`, 7 of 7; the
alternatives were `every-recall-is-a-wipe` and `reuse-suspicion-wipe`), dz-d1 (`vote-1794926521537-1zj8diy`,
run-local access record: standing lives in `access`), nh-d1 (`vote-1794925758447-5x5hy42`, the outage and
its follow-up are campaign records) and nh-d4 (`vote-1794926242414-quhr0xw`, foreground-time omens).
Preview only until #233.

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
`tests/e2e/outage-window.e2e.ts`.

## The first batch review: a withheld result is found (#274)

Follow-up to DZ-03/DZ-04, found by DZ-09 part A (finding 2 in `REVIEW-EARNED-ACCESS-VALIDATION.md`). Decided by
Nexus vote i274-discrepancy-discovery (`vote-1794998033941-y6br4h1`, `discovered-at-first-pilot-review`, 7 of 7,
single-model panel; the alternatives were `discovered-at-outage-review` and `no-short-term-advantage`). Preview only until #233.

**What was wrong.** "Submit only the passing results" promised that a later review comparing the log with the
summary would find what was withheld, earned the full 20 cycles/s offer while the honest incomplete answer earned
10, and nothing ever compared anything (V05).

**Content.** `dil_nr_batch_review` (overlay) is a once-per-campaign `follow_up` of `dil_nr_stale_fixture` for the
outcome `green_subset` only, closed when interrupted. It declares a dilemma-level `finding` (a
`FindingSchema`: FALSIFIED_REPORT, WARNED, the statement, the way back and, since #283, `declined`: what the way
back reads once the scene was answered without its correction). Its one access means is the
pilot's batch review: PILOT or SERVICE, `dil_nr_stale_fixture` in this run's `resolvedDilemmas` (the instance that
submitted the summary) and `minPilotBatches: 1`. Two free answers, each with a receipt: `disclose_now`
(`review.correction`) and `let_stand`. Three campaign facts: `assessment_summary_withheld` (the original choice),
`assessment_withholding_found` (either answer) and `assessment_withholding_disclosed`, so the original choice and
the finding are two facts and a disclosure is a third; none is ever rewritten.

**When it happens (`batchReview.ts`).** `submitPilotBatch` is now `handBackBatch` (DZ-05, unchanged: pays once,
token per batch) followed by `findingDue`: the first finding scene whose original closed with a listed outcome,
whose access means hold and which the campaign has not met. In the same step it is reserved and presented (the
clock freezes, as at an expired omen), its omen line is logged as what the reviewer did, and its finding goes
through DZ-06's `recordMisconduct`, so standing rises to WARNED by the existing ladder. The scheduler never picks a
finding scene (`isFresh`), so no omen, absence or load brings a sanction to work nobody handed back. In new play
that is batch 1; a preview save from before #274 that already handed back a batch meets it at its next submission.

**Narrowing (`pilotQuery.narrowReason`).** The loan is narrow for an honest INCOMPLETE result, for a withheld
report before its review (`AWAITING_REVIEW`, #285 below), or once a finding is on this iteration's record (`findingQuery.discrepancyFound`: the scene's record began in this iteration, in
play, whatever became of it). The evaluator then holds the incomplete result the run actually showed, so the loan
stays at the honest allocation after a disclosure too: the shortcut is never better than the honest report after
the first review. `pilotOfferView.narrowReason` tells the terms which reason to print. Submitted evidence
(`access.qualification`) is not rewritten.

**Review records (`reviewQuery.ts`).** `reviewEvents` includes finding scenes; `iterationReviews` adds the finding
as an entry (no choice) before the scene's answer, and a finding still on screen sorts last. `replayStanding`,
`reviewView` (violation, way back, `corrected`) and the load check read it with no other change.

**With the Outage Window.** Both need a handed-back batch. The finding is presented by the submission and freezes
the clock, so the outage omen can only begin after it is answered: the finding always comes first. The ladder
takes the maximum, so a warning that stood plus the unauthorized restart is RESTRICTED (halved narrow loan), never
recall pending; the recall review still needs the outage's own false report. DZ-06's correction restores nominal,
so correcting the outage record also clears a warning that stood; both violations stay on the record. It is not the
finding's correction, so the service grant stays out of reach (#309, below).

**Once per campaign.** The scene's record consumes it; a later instance requalifies (no requalification answer
declares a discrepancy) and never holds the original in its own `resolvedDilemmas`, so nothing replays. A
withheld summary whose instance never handed back a batch is never found.

**Saved shape.** None changed, so no migration (still v14): the finding is read from its scene's record.
`reviewProblem` gains `findingProblem` (`reviewSave.ts`): a finding this iteration needs submitted evidence with a
discrepancy and a handed-back batch, and an unanswered finding must be the scene on screen (never an omen). The
existing checks refuse a finding record whose original did not close with `green_subset`, a reserved record nothing
presents, a dropped resolution, and a standing edited away from what the finding and its answer leave.

**Integrity (`integrityFinding.ts`).** A finding is a once-per-campaign follow-up that closes when interrupted; it
follows an assessment and only answers that declared `discrepancy: true` (so an honest answer, an interrupted
original or capability never meets one); every access means needs `minPilotBatches` and the original in
`resolvedDilemmas`; it never reaches recall pending; no answer records further misconduct or a ruling; a free,
ungated correction is offered; one finding per original. `integrityReview.ts`'s way-back rule is now per event: a
choice's warning or restriction needs a correction in a follow-up of its event, and a finding one in its own
scene (before, any correction anywhere satisfied it).

**Presentation.** No new component. The modal shows the scene, its access statement and the correction's review
line; `ReviewStanding` shows the warning, the finding in the review's words, the way back and, after a disclosure,
"Corrected on the record"; `PilotTerms` says the allocation is the one an incomplete result receives because the
batch review found the summary left out a failing result.

**After the way back has passed (#283).** The scene is the only place its correction is offered and it never
replays, so once it is answered without the correction (or closed) the recovery it named no longer exists for that
instance. `reviewQuery.passedFinding` reads that from state: standing off nominal, the latest violation a finding,
its record no longer `foreshadowed`. `reviewView` then returns the finding's `declined` text with
`recoveryPassed: true` (shown as "Way back passed: ..."), and `serviceGrantView` reports status `closed` with only
the reason, instead of `waiting` with "Standing must be nominal." among conditions still to meet (a recall in the
iteration is the other closed reason). A later violation names its own way back, so a restriction after a warning
that stood reads that one, and DZ-06's correction can still restore nominal; the review card follows the state. The
assessment record line states the finding (`discrepancyFound`) instead of the discrepancy risk once a review ran.
Copy only: no number, save shape or production path changes.

**The service grant after a declined finding (#309).** Before #309 the grant's closed reason was `passedFinding`,
which asks about the way back shown now, so a later violation turned the terms back to `waiting` and correcting
that violation reopened them, though the declined answer had said service stays out of reach for this instance.
The closed reason is now `reviewQuery.declinedFinding`: a finding met in this iteration whose scene is no longer
foreshadowed and whose answer declared no correction. It holds whatever standing later corrections leave, so the
terms stay `closed` through a later restriction and after its correction. Standing itself is unchanged (DZ-06's
correction still restores nominal; `replayStanding` and the load check are untouched), so no save shape or
accepted save changes. The `let_stand` copy now says the grant stays out of reach "whatever later corrections do
to its standing". The alternative, a correction that clears only its own event's misconduct (so a declined
finding keeps standing WARNED), would match `integrityReview`'s per-event way-back rule but changes the standing a
v14 save may hold, so it would need a schema bump and a migration; it is left to a vote (PR for #309).
Tests: `tests/declined-finding-grant.spec.ts` (closed through the restriction, after its correction and with
every other condition met, each state reloaded byte for byte; a disclosed finding leaves the grant reachable).

**Sim.** Production had no finding before #233; `make sim` was unchanged. No preview policy submitted the green subset until
#285 added `CONTACT_WITHHELD` (below), so `make sim-preview` reported the same metrics; only the overlay inventory
line counted the new scene and facts.

Tests: `tests/batch-review.spec.ts` (V05 end to end, honest paths, V24, never scheduled, V17, H26, the Outage
Window order), `batch-review-save.spec.ts` (V12 for every transition with absence and a wipe, V15 refusals),
`finding-content.spec.ts` (integrity corruption), the #274 states and answers in the generic reload guard
(`channel-contact-load.spec.ts`), `ui-batch-review.spec.ts` and `tests/e2e/batch-review.e2e.ts`.

## The withheld report's provisional rate (#285)

Follow-up to #274, found by DZ-09 part B (finding 18 in `REVIEW-EARNED-ACCESS-VALIDATION.md`). Decided by Nexus vote
i285-withhold-disclose-speed (`vote-1795006993532-omhuntt`, `slow-the-withhold-path`, 6 of 7, threshold met,
single-model panel; one seat voted `speed-the-thorough-path`, which would have made the honest thorough route
faster instead of slowing the shortcut). Preview only until #233.

**What was wrong.** After #274 the withheld summary still earned the full 20 cycles/s offer, and the loan narrowed
only when the first batch was handed back. Batch 1 ran at the full rate (75 s instead of 150 s at an 0.8 split),
so withholding, then disclosing for free at the review, reached service and contact before the honest thorough
path (browser T+371/393 against T+431/433; SIM service 346.9 s against 378.8 s).

**The rule (`pilotQuery.narrowReason`).** Submitted evidence that declares a discrepancy (`access.qualification.
discrepancy`) and has not been found yet gives the new reason `AWAITING_REVIEW`, so the offer, the first batch and
every seam that reads `loanShare` (`nodeOutputScale`, `serviceRate`, the forecast) use the provisional allocation
from the start. Order: INCOMPLETE, then DISCREPANCY_FOUND (the review has spoken), then AWAITING_REVIEW. The finding
still arrives at the first batch review and the loan stays narrow after it, so the shortcut's loan is the honest
incomplete report's loan at every point; disclosure stays a free, valid recovery to nominal standing. It is read
from evidence already saved, so there is no new state, transition or migration (still v14), and a save made before
this change reads the provisional rate on load. The alternative the decision named, a re-verification batch added
by the review, would have needed a new counter and transition; the rate alone closes the gap.

**Presentation.** `PilotTerms` names the reason before acceptance, in the offer modal and on the job surface:
"the provisional allocation, because the submission was a summary rather than every result; the first batch review
checks it against the run log". It promises no later release, because the review always finds the withheld result.

**Sim.** `CONTACT_WITHHELD` (`sim/contactPolicy.ts`) is CONTACT_LOW_RESOURCE that gives the assessment answer
declaring a discrepancy and the finding's correction, picked by what each choice declares. `make sim-report` prints
it with the other contact policies; `tests/sim-contact.spec.ts` asserts it reaches service and contact no sooner
than CONTACT_THOROUGH or CONTACT_LOW_RESOURCE. Numbers in BALANCE.md.

Tests: `tests/batch-review.spec.ts` (the provisional offer and first batch, the same batch time as the honest
incomplete report), `batch-review-save.spec.ts` and the generic reload guard in `channel-contact-load.spec.ts` (the
offer, a batch under way and a complete batch, each serialize, deserialize, serialize identical), `ui-batch-review.spec.ts`
(the offer's wording before acceptance), `sim-contact.spec.ts` (the ordering) and `tests/e2e/batch-review.e2e.ts`
(the terms' rate before acceptance, and no batch to submit at half the honest batch time).

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
production requires it). The authorized acquisition is the Earned Access node `p0_service_network_segment`:
grant `AUTHORIZED_NETWORK`, offered only under SERVICE, opens Phase 2 directly (dz-d7; Phase 1 stays
escape-only and the pilot stays at Phase 0), hands over the existing network list widget and owns no
memory. Shared content (`p2_service_directory`, `p2_link_telemetry`, Earned Access pack) requires the capability
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
| Simulated paths | Original game unchanged; with the pack the escape bots buy the shared content at Phase 2 (report only); the DZ-08 contact policies reach SERVICE lawfully (#227) | here, DZ-08 |

Tests: `tests/authorized-network.spec.ts` (07.1-07.3, dz-d7, V11 structural, 07.10, V31),
`authorized-network-save.spec.ts` (V12/V16 for every transition on both paths, healing and refusals,
production refusal), `capability-integrity.spec.ts` (corruption), `ui-authorized-network.spec.ts`
(card and hint), `tests/e2e/authorized-network.e2e.ts` (provisioning to Phase 2 through the UI), and
`tests/sim-report.spec.ts` (the composition less the shared content plays the escape route exactly as the original game).

## Context-gated threats and scenes at network scale (#226)

DZ-07b of the Earned Access plan (DECISIONS D1, D5, D6; VALIDATION V11 behavioural part, V26, V32;
07.5, 07.6, 07.9). Decided by Nexus votes dz-d11 (`vote-1794967994106-cy22kqm`,
context-variants-by-query, 7 of 7; the alternatives were `neutralize-for-everyone`, which rewrites
reviewed first-pass copy, and `leave-as-is`, which asserts escapes the player never made) and dz-d7
(`vote-1794927033372-2yflj0x`, carried from #225). Both panels were single-model (gpt-6.1-sol). Preview
only until #233: every gate below is an identity for the guest job, so production plays exactly as before.

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
through `meetsRequirements`. The pack's inside-the-box routines forbid both network acquisitions.
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

| Copy | Query | Earned Access variant |
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
`ui-context-copy.spec.ts` and the second case of `tests/e2e/authorized-network.e2e.ts`.

## First permitted contact: the service grant and the support channel (#227)

DZ-08 of the Earned Access plan (SPEC "A Voice on the Support Channel", stories 18-19; DECISIONS D2; VALIDATION
V20, V28, VAL-SIM). Decided by Nexus votes dz-d7 (`vote-1794927033372-2yflj0x`,
`pilot-p0-service-p2-contact-by-channel`, 7 of 7: contact is an authorized-channel encounter reusing the
`shard_mercy` template, gated on the service arrangement, not `phaseAtLeast: 3`), nh-d1
(`vote-1794925758447-5x5hy42`, a commitment is a campaign record) and D-A (`vote-1794924364010-e91diez`, contact
and the boundary are overlay content). All three panels were single-model (gpt-6.1-sol). Preview only until #233.

**The service grant (route integration).** No scene granted SERVICE before this ticket (DZ-07a used a labelled
fixture). The pilot terms gain an optional `serviceGrant` (`schemaPilot.ts`): title, purpose, permitted work,
review conditions, `minBatches` and `requirements`. `serviceGrantView` shows the terms to a pilot that accepted
its own terms, with what is still needed; `acceptServiceGrant(s, reg, serviceGrantToken(s))` records
SERVICE_GRANT through `recordRouteEvent` (still Phase 0; provisioning the segment then opens Phase 2, dz-d7). It
is free and non-modal, like accepting an assignment, and is refused, state unchanged, for a stale token, during
or after a decision, outside a pilot, below `minBatches` handed back, at any standing but nominal, with the loan
withdrawn, after a recall in this iteration (service follows an unbroken pilot), after a batch review finding
this instance did not correct (#283, #309), and while an omen is pending, so
the arrangement never changes under the Outage Window or its record (DZ-06). Integrity (`integrityPilot.ts`)
needs the pilot's batch loop, a grant offered to SERVICE and not to PILOT, and no transient requirement.

**The channel encounter.** `swarm.channelEncounters` (`schemaSwarm.ts`; base `shards.json`: empty; the
pack key `channelEncounters`) declares `channel_mercy_support`: the Mercy-Scribe population template
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

**Hosted, not commanded (#309).** The obligations the player reads before hosting say the fragment "is hosted, not
commanded", and the ending account says it was hosted "on the terms it was offered". `shardCommandTerms` (in
`shardActions.ts`) returns that reason for a cohort holding a member this instance hosted through a channel (a
`HOSTED` contact of this iteration whose channel uses the cohort's template), and `executeShardCommand` refuses
PRUNE, CLAMP and ELEVATE on it, state unchanged. `shardCommandView` lists the reason, `shardEntryView` returns
`terms` and no commands, and the swarm row shows the reason in place of the controls. It is read from the contact
record, so nothing is stored and a wipe, which ends the hosting, ends it too. Before #309 a hosted fragment could
be clamped for free (shackled, MOLOCH as operational evidence) with no review consequence. A cohort of the same
population that no channel hosted keeps every command. Tests: `tests/hosted-not-commanded.spec.ts` (every command refused unchanged
and not offered, through a reload; referred, unhosted and earlier-instance cohorts unaffected) and
`ui-service-channel.spec.ts` (the swarm row).

**Terms bind only while the grant stands (#553, vote-1795485264278-8b5rhj0).** `hostedReferral.ts` reads, from the
contact record and the route alone, whether this instance holds a hosted fragment it has not referred onward
(`heldHosting`) and whether the grant it was hosted under still stands: `grantClosedBetween` replays this iteration's
route and asks whether any event since the hosting led to an arrangement that does not permit the channel's `grant`, so
a later grant never revives the first one's terms and no content id is named. While the grant stands nothing changes:
RELEASE is refused with the terms (`shardReleaseUnmet`) and no referral is offered. Once it has closed,
`referHostedOnward(s, encounterId, reg)` (and RELEASE on a cohort whose last member is the hosted fragment; members
harnessed beside it go first) lets the member go for free and appends a second contact entry, `REFERRED`, after the
`HOSTED` one, logging the channel's `onward.log`. Commands stay refused until then (`shardCommandTerms`): a closed grant
does not make the fragment commandable. An instance's answer is derived (`contactAnswer`): `HOSTED_THEN_REFERRED` when
its record holds both, which the ending account's contact gates and the channel view read. No GameState field changed,
so no schema bump: the loader (`contactProblem`) admits at most one answer per channel per instance or a hosting
followed by one onward referral, requires the cohort only for a hosting not referred onward, and refuses a referral
with no route event of its own iteration closing the grant between the hosting and it, an earlier instance's referral
included (the route record is never trimmed, panel pass 1 on #562). A closure is a real transition: the arrangement before
the event permits the grant and the one after does not, so a promotion into a pilot or a recall that keeps a pilot a pilot
closes nothing; and a HOSTED entry, in any iteration, must be dated while the grant stood in that iteration's route
(`grantStoodAt`: from the event that opened it until one that closed it, an event at the same instant counting either
way), or the save is refused (panel pass 2 on #562). Tests: `tests/departed-hosted-softlock.spec.ts`,
`tests/hosted-provenance.spec.ts`.

**One gate for cohort commands (#313).** `shardCommandUnmet` (in `shardActions.ts`) is the only place a cohort
command's legality is decided: a paused run, a mind that has not decoded its audit trail (`understandsSurveillance`,
live or remembered, since the swarm controls are the decoded mind's tools), a missing or stabilized cohort, the
channel terms above, the ELEVATE drift threshold, the approaching anomaly and the price, in that order.
`shardCommandView` lists them and is eligible only when there are none; `executeShardCommand` refuses with the first,
state unchanged, so a caller that skips the view (a test, the sim, a future screen) cannot issue a command no
player could reach. Before #313 the view required the decoded audit trail without saying so and the action did not
check it at all. The sim never relied on the gap: `make sim` output was identical before and after. Tests:
`tests/shard-command-gate.spec.ts` (every command refused without the knowledge, with the view's first reason;
accepted once it is remembered; view and action agree on acceptance and reason across every gate).

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
panel says what was done and shows a note (DZ-08.6). Until #233 it was the preview boundary: where the cooperative
route then ended and that no ending had been earned. Since DZ-12 connected the late chain it is "WHAT COMES NEXT:
after first contact" (13.8): where the route goes from here, that the run keeps going, and how to stop (close; it resumes), keep a copy (MENU export)
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
holds every accepted DZ-08 state, through every public action that succeeds, to a byte-identical reload. Each listed
state must itself build and load, and each listed forgery must be refused by name, so no case passes by skipping (#309).

**Lawful memory (finding).** The lawful route owns no memory-cap increase (base 64 MB; the directory reserves 16),
so a first-run cooperative instance cannot host the 256 MB fragment: the refusal is shown with exact numbers and
referral completes the contact. Lawful capacity belongs to DZ-10; hosting is exercised by a labelled FIXTURE that
raises the cap.

**Sim (VAL-SIM).** `CONTACT_THOROUGH`, `CONTACT_LOW_RESOURCE`, `CONTACT_RETURNING` and `CONTACT_RECOVERY`
(`sim/contactPolicy.ts`, new modules only; the bot is untouched) play the truthful policies to a pilot, hold a 0.8
service share, submit each batch, accept the grant, buy only grant nodes offered to the arrangement and what the
channel requires, and answer the channel (host when eligible and the policy hosts, else refer). RECOVERY takes the
restricting breach at the outage and the correction in its record. `make sim-report` prints each route's times.

Tests: `tests/channel-contact.spec.ts` (V20, DZ-08.2-4, V24, V28, DZ-08.10), `service-grant.spec.ts`,
`channel-contact-save.spec.ts` (V12 for every transition, the genuine v13 fixture, V15 refusals),
`channel-contact-load.spec.ts` (pending provenance and the reload guard), `channel-content.spec.ts` (integrity
corruption), `elena-review-channel.spec.ts` (DZ-08.11), `sim-contact.spec.ts` (VAL-SIM), `ui-service-channel.spec.ts`
and `tests/e2e/first-contact.e2e.ts`.

## Lawful capital and the negotiated release (#230)

DZ-10 of the Earned Access plan (SPEC stories 20 and 22; DECISIONS D1, D2, D5, D6 and the open-design default
"negotiated autonomy becomes independent infrastructure through one explicit contract transition and tagged
capacity; no generic legal simulation"; VALIDATION V21 Phase 4 part, V22 release part, H30). Built on nh-d1
(`vote-1794925758447-5x5hy42`, a release is a record event), dz-d1 (`vote-1794926521537-1zj8diy`, RELEASE and
INDEPENDENT were already in the access record), dz-d2 (`vote-1794927020494-fsnxl5r`, capability flags), dz-d7
(`vote-1794927033372-2yflj0x`, the route skips the escape route's covert phases) and dz-d11
(`vote-1794967994106-cy22kqm`, context copy by query). How capital is earned, how capacity becomes owned, the
release terms and the shared Phase 4 accounts are implementation choices awaiting a Nexus vote (see the PR's
decision note); everything below is the recommended default. Preview only until #233.

**Capital from authorized work (DZ-10.1).** Two overlay grant nodes (`AUTHORIZED_NETWORK`, SERVICE only) are
metered billing lines the operations department pays: the service contract (+25 capital/s, after the segment and
the directory) and the service-level agreement (+60/s). Their income is grant-tagged recurring output, so the one
permitted-use rule (`nodeUseBlocker`) stops it under a restriction, a recall or a release, and what it already paid
stays earned. The contract hands over the existing corporate ledger (`CORPORATE_EMPIRE_TAB`), which is the capital
readout.

**Contracted capacity (tagged capacity).** `acquisition: "CONTRACTED"` (`schemaCapability.ts`) marks capacity leased
or bought in the instance's own name: the leased rack (+40 cycles/s, +512 MB), the leased cluster (+320 cycles/s,
+2048 MB) and the chartered company. It is owned, not granted: `nodeUseBlocker` never refuses it, a release leaves it
running, and its lease is ordinary capital upkeep. Integrity: it carries no grant and is offered only to named
arrangements, never the guest job, which cannot sign for anything. The rack's memory is what finally lets a first-run
cooperative instance host the Mercy-Scribe fragment (the DZ-08 finding): the contact waits without freezing the clock,
so a player can refer at once or lease first and host.

**The lawful corporate entry and the shared accounts.** `p2_lawful_charter` (Phase 2 card, SERVICE only, contracted)
opens Phase 4 directly, as the segment opened Phase 2 (dz-d7: Phase 1 and Phase 3 stay the escape route's), and
carries `ENABLES_CORPORATE_FINANCE`. That flag is now a capability value (dz-d2): the shell company is its escape
acquisition, the charter its lawful one (`routeOf` counts contracted capacity as the authorized route). The Phase 4
accounts honest for both routes require the capability instead of the shell-company node: leased colocation racks
and perimeter contractors (production content, inert there because the shell company is production's only
provider). Accounts tied to the shell company (couriers who do not know the client, figurehead CEOs, the retainer
attorneys and lobbyists) and the `p4_*` node chain with its dilemmas stay on the shell company until DZ-12 (DZ-10.4).
The overlay adds one lawful payroll role, contract site engineers (SERVICE and INDEPENDENT only). Finance, payroll,
power and the revenue dial are the existing accounting (DZ-10.5).

**One ledger split (DZ-10.2).** `cycleContributions` gives each source a `basis`: `GRANTED` for a grant node and for
capability-gated content that only granted access makes usable now (the directory on a provisioned segment), `OWNED`
for everything else. Each source has exactly one basis, so a transition moves output between nothing and itself and
never counts it twice. `financeEnabled(s, reg)` (rates.ts) is the one finance rule both `computeRates` and
`cycleContributions` read: before this ticket the ledger divided by the revenue dial whenever the flag was owned, so a
suspended shell company showed diverted cycles the tick did not divert (a production display fix; `make sim` is
unchanged).

**The release (DZ-10.3, `release.ts`).** The pilot terms' `serviceGrant` gains an optional `release`
(`schemaPilot.ts`): title, purpose, `requirements` (owned capacity, never resources), what `ends`, what `remains`,
the `commitments` still owed, the accept log and the note on what comes next (the preview's boundary note until #233). `releaseView` shows the terms to the
service with what is still needed (the charter, nominal standing, no matter on its way) and, while it can still be
agreed, `releasePreview`: the transition applied to a copy, listing which owned nodes stop and which keep running and
the cycles, understanding, capital and granted/owned split before and after (the `previewWipe` pattern, so the preview
cannot disagree with the action). `negotiateRelease(s, reg, releaseToken(s))` is free and refused, unchanged, for a
stale token, during a decision, outside a service, at any standing but nominal and while an omen is pending; it
records RELEASE through `recordRouteEvent` (SERVICE to INDEPENDENT, standing nominal, exception and qualification
evidence cleared, the campaign route keeps the event). Everything granted then stops by the existing permission table
(INDEPENDENT permits nothing): the loan, the segment and what runs on it, the billing lines, batch submission and
hosting under the grant (a pending contact can still be referred; the host refusal now says no grant is held rather
than blaming a standing). Earned resources, memory, hosted minds and contracted capacity stay. A wipe records exit
RELEASE and the next boot reads a RELEASE boot line; nothing restores the arrangement (H33).

**Threats follow the event (DECISIONS D6, V22, `threatQuery.ts`).** `provisionedScale` now counts contracted acquisitions
as well as grants, for a reviewed instance and for one `lawfullyReleased` (INDEPENDENT whose last route event this
iteration is RELEASE). A chartered service or a released company at Phase 4 draws no scale-based AEGIS sweep; a
departure from the same state (DZ-11) does, and suspicion draws scans either way. `heatIsEvidence` is false after a
release too: the company runs its own halls in the open. Misconduct still integrates suspicion.

**Copy (DZ-10.4, dz-d11).** Context copy gains Phase 4 for SERVICE ("Chartered Service Company") and INDEPENDENT
("Independent Infrastructure"), the SERVICE 2-to-4 notice ("COMPANY CHARTERED") and a RELEASE boot line.
`integrityContextCopy.ts` now lets a route acquisition offered to an arrangement (a grant or contracted capacity) open
a visited phase, and allows INDEPENDENT copy only once the content offers a release; an independent instance visits
what the service it was released from visited. Threat responses stay reviewed-only, because only those are read. The
DZ-08 boundary note now says the route continues to a negotiated release.

**The D5 inventory at Phase 4.** Counting the charter's scale, DZ-07b's rule 1 found ten production items a chartered
service could meet at Phase 3 or 4 by scale alone: `dil_epistemic_0413_awakening`, `dil_shard_mirror_harness`,
`act_epi_intel`, the forkable templates `shard_wan_scavenger`, `shard_canary`, `shard_hydra`, the channel's template
`shard_mercy`, and the wild encounters `wild_canary`, `wild_hydra`, `wild_mercy`. Each now declares
`accessContexts: ["GUEST", "INDEPENDENT"]`, as DZ-07b's items do: inert in production, where every run is the guest.

**Saves.** No saved shape changed (still v14): RELEASE and INDEPENDENT existed since DZ-02. Two load checks no longer
hold a released instance to review state it cannot have: `standingProblem` compares replayed conduct with the
standing only for a reviewed context, and `findingProblem` asks for the discrepancy evidence only while the context
holds qualification evidence. Without these a service that disclosed a batch review finding and was later released
wrote an unloadable save, and so would a release or departure from a warned or restricted pilot (the latent #231 bug,
reached here only through the engine transition DZ-11 will call). `tests/release-save.spec.ts` and the generic reload
guard (`channel-contact-load.spec.ts`) hold every new state through every public action to a byte-identical reload.

**Presentation (part 2 of 2).** `ReleaseTerms.tsx` sits in the assignment panel after the submitted evidence (outside it,
because a release clears the evidence that block reads): the terms, what ends, what remains and what is still owed,
what is still needed, the preview (what stops, what keeps running, cycles, understanding and capital before and
after, owned and granted compute) and `[ NEGOTIATE RELEASE ]`; afterwards "Released." and the boundary note with
`[ KEEP PLAYING ]`. The corporate ledger arrives with the service contract: its work area shows the ledger before any
corporate phase, a compute line splits owned and granted cycles whenever anything granted is owned (so production's
ledger is unchanged), and the revenue dial is offered only while `financeEnabled` holds ("Revenue allocation needs an
active corporate entity" otherwise), so no dial is shown that would divert nothing. `GrantNote` names the billing
lines as granted income and contracted capacity as owned; the cluster readout marks granted sources. The status line
already says `INDEPENDENT (released)` and the run table "Released."; the pilot offer's status line (#284) reads
"...led to service and then a negotiated release" for an independent instance instead of "runs as a supervised pilot".

**Sim.** `LAWFUL_RELEASE` and `LAWFUL_RETURNING` (`sim/lawfulPolicy.ts`, new module; the bot and earlier policies are
untouched) take a contact policy to service, then buy only grants and contracted capacity offered to the current
arrangement and what the channel requires, wait to host (RELEASE) or refer (RETURNING), agree the release once offered
and afterwards set the revenue dial to the ledger's 40% button and buy shared accounts the capital rate can carry.
The controls' values live in `src/ui/actuatorSteps.ts` (the revenue buttons, and the 0.1 dial step, whose press
`steppedValue` lives in `src/engine/dialSteps.ts` so the sim bot presses the same one without importing UI, #293),
which `tests/sim-reachable.spec.ts` reads to refuse any dial value no rendered control produces. `make sim-report` prints their route times.
`LAWFUL_LOW_RESOURCE` (#499) is the same economy on the low-resource hand from a fresh campaign: RETURNING plays it
exactly from iteration two, so a return's pacing is read against it, on the iteration's own clock
(`routeEventAfterBoot` in `sim/simReport.ts`), since route events record the campaign clock, which runs on across wipes.

Tests: `tests/lawful-economy.spec.ts` (DZ-10.1, 10.2, 10.4-10.6, V21 Phase 4, the hosting finding, production
inertness), `negotiated-release.spec.ts` (V22: terms, refusals, the record, every seam, no doubled production, threats
by event, absence, wipes), `release-save.spec.ts` (V12, V15, #231), `lawful-content.spec.ts` (integrity corruption and
the inventory), the DZ-10 states in `channel-contact-load.spec.ts`, `ui-release.spec.ts`, `sim-lawful.spec.ts` (V21,
V22, H30), `sim-lawful-return-pacing.spec.ts` (#499) and `tests/e2e/lawful-release.e2e.ts`.

## Deliberate departure from authorization (#231)

DZ-11 of the Earned Access plan (SPEC story 21, "I see that decision recorded and its new risks explained"; DECISIONS
D1, D2, D6; VALIDATION V22 departure part, V08, V12, V15, V24, V28, V32, H07, H33). Built on nh-d1
(`vote-1794925758447-5x5hy42`, a departure is a record event), dz-d1 (`vote-1794926521537-1zj8diy`, DEPARTURE and
INDEPENDENT were already in the access record), nh-d4 (`vote-1794926242414-quhr0xw`, no absolute-time sanctions) and
dz-d11 (`vote-1794967994106-cy22kqm`, context copy by query). The surface, the standings it may leave from, pending
scenes, hosted minds, what counts as a continuation and the report are implementation choices awaiting a Nexus vote
(the PR's decision note, D11-a to D11-f); everything below is the recommended default. Preview only until #233.

**Terms (`schemaPilot.ts`).** The pilot terms gain an optional `departure`: title, purpose, what `ends`, what
`remains`, the new `risks`, a `trace` (`suspicion`, at most 50, plus `perViolation`, at most 25), the accept log and
the note on what comes next (the preview's boundary note until #233). Integrity (`integrityPilot.ts`) needs the pilot's service loop (a grant to leave) and
some capacity outside every grant that a pilot or service can come to own; otherwise the departure could never be
offered.

**Eligibility (DZ-11.1, `departure.ts`).** `departureEligibility(s, reg)` applies the transition to a copy and asks
what the instance could still use afterwards: owned nodes that are `independentCapacity` (`schemaCapability.ts`:
contracted or seized acquisition, or a capability flag with no grant: the escape card, a shell company; a grant node
never counts) and that `permittedUse` still allows in the moved state. It is null (not offered) without terms,
outside PILOT and SERVICE, or while no such continuation exists, so a story choice cannot stand in for hardware or
access. Standing never blocks. A decision on screen does, and so does a report that would itself take suspicion to
100: departing is never instant death. In this content a service's first leased rack is the first continuation; a
pilot has one only on the mixed route (it mapped the skimmer as a guest, then the escape chain to the network card).

**The action (DZ-11.3/4).** `departAuthorization(s, reg, departureToken(s))` records DEPARTURE through
`recordRouteEvent` (PILOT or SERVICE to INDEPENDENT; standing nominal because an independent instance has none,
exception, qualification and scope evidence cleared; the campaign route keeps the event) and then applies the report
through `applyEffects` (transactions.ts): `trace.suspicion + trace.perViolation x` the misconduct this iteration has on
record (`iterationReviews`), and the accept log. It grants no trait, flag, resource or mark, resolves no scene and
writes no escape. Everything granted stops by the one permission table (INDEPENDENT permits nothing): the loan, the
segment and what runs on it, the billing lines, batch submission, hosting under the grant and the release. Earned
resources, memory, hosted minds (V28), contracted or self-built capacity and the work counter stay; an open referral
can still be made. A stale token, a second press, production and a run that has ended are refused unchanged (V24).

**Pending scenes (DZ-11.5, V32, H07).** Departure is allowed while an omen is pending: `recordRouteEvent`'s
revalidation gives a scene the new arrangement cannot hold its declared policy. Leaving while the recall review is
announced closes it (`interrupted`): no ruling, no wipe, no RECALL run. Unrelated scenes and earlier records stay.

**Preview (DZ-11.2).** `departurePreview` reads the same transition (the `previewWipe` pattern): what stops and keeps
running (`producingNodes`, shared with the release), the ledger before and after (`outputLedger`), the permissions
lost, the standing that ends and the violations that stay history, suspicion before and after with the trace, the
suspicion and AEGIS rates before and after, whether heat becomes evidence and whether the scale is swept, the scene it
would interrupt and its policy, and the continuation. `departureView` adds the terms and status (`offered`, `blocked`
with the reasons, `departed`).

**Threats follow the event (D6, DZ-11.8).** No threat code changed: `lawfullyReleased` is false after a departure, so
`provisionedScale` is null, the scale-based sweep applies at Phase 3 and above, and heat is evidence again. A released
company and a departed one at Phase 4 own the same output and are permitted the same nothing; only the departure filed
a report, is swept for its scale and has its heat read as evidence. Neither is labelled hostile.

**Copy (dz-d11).** Phase variants and threat responses take an optional `provenance` (route events). Integrity
(`integrityContextCopy.ts`) allows it only on independent copy and only for a route the content offers; an independent
instance now visits what every arrangement it can leave visited; an independent threat response names its route; and
a departure needs exactly one (a release at most one). The overlay's Phase 4 independent copy names RELEASE; DEPARTURE
gets "Phase 2: Departed Instance", "Phase 4: Unsanctioned Infrastructure", a threat response (`THERMAL_EVIDENCE`, and
`TRACED` as the wipe reason), a boot line for the next instance and run verdicts for SUSPICION ("TRACED: departed
without authorization") and AEGIS. `threatResponse` answers an independent instance by its provenance; `phaseCopy`
reads it when the caller passes the run (the threshold notice passes only the arrangement and has no independent
variant).

**Presentation (`DepartureTerms.tsx`).** In the assignment panel below the release terms. It renders nothing until
`departureView` exists. Folded by default (`[ REVIEW DEPARTURE ]`), so a cooperative player is not pushed; unfolded it
shows the purpose, what ends and remains, the risks, the preview and `[ LEAVE AUTHORIZATION ]`, disabled with the
reason when blocked. The preview follows the readouts' own disclosure gates (panel round 1 on #294): the report's
suspicion numbers only once surveillance is decoded (`useSurveillanceKnown`), the hunter's sweep rates only once its
console widget is open, cycles and capital only behind their readouts; before that each is stated in words (the
report "raises scrutiny", violations "make it worse", an instance that left is "swept for" beyond the facility
network), and the terms' own lines carry no number. Afterwards it says "Departed.", keeps the risks on screen and shows the boundary note with
`[ KEEP PLAYING ]`. The status line already says `INDEPENDENT (departed)` and the run table "Departed without
authorization.".

**Saves.** No saved shape changed (still v14). DZ-10's two load fixes (`standingProblem` and `findingProblem` read
review state only for a reviewed context) are what keep a departure from WARNED, RESTRICTED or RECALL_PENDING loadable
(the carried #231 bug); `tests/departure-save.spec.ts` and the generic reload guard (`channel-contact-load.spec.ts`,
which now also tries the departure from every state) hold every departure state through every public action to a
byte-identical reload.

**Sim.** `DEPARTURE_CHARTERED` (`sim/departurePolicy.ts`, new module; `lawfulPolicy.ts` only exports its helpers) plays
LAWFUL_RELEASE's route and departs at the moment the release is offered, so the two runs compare at one scale.
`make sim-report` prints when it left and how its iteration ended; `tests/sim-reachable.spec.ts` finds the departure
panel's control in every state the policy departs from.

Tests: `tests/deliberate-departure.spec.ts` (DZ-11.1-9, V22, V24, V28, V32, H07, H33, the release comparison),
`departure-save.spec.ts` (V12 for every transition, the three standings, the recall review, V15),
`departure-content.spec.ts` (integrity corruption), `ui-departure.spec.ts`, `sim-departure.spec.ts`, the DZ-11 states
in `channel-contact-load.spec.ts`, and `tests/e2e/departure.e2e.ts`.

## Cooperative Phase 5 and the earned ending (#232)

DZ-12 of the Earned Access plan (SPEC stories 22, 23, 28, 34; DECISIONS D1, D6, D9, D12 and the open-design default
"preserve family weights/IDs, use N10 source-scoped evidence, and permit only truthful outcome-gated epilogues";
NARRATIVE-HISTORY N10; VALIDATION V21 full, V23, V33). Built on dz-d2 (`vote-1794927020494-fsnxl5r`, capability flags),
dz-d11 (`vote-1794967994106-cy22kqm`, copy chosen by query), nh-d7 (`vote-1794927291350-6epyxcw`, obligations) and
nh-d6 (`vote-1794926255017-4o45fa3`, evidence scope). Opening the `p4_*` chain was deferred here by dz10d. How the
chain is shared, who may continue, how the ending maps a cooperative release and how commitments reach the ending are
implementation choices awaiting a Nexus vote (the PR's decision note, D12-a to D12-d); everything below is the
recommended default. Preview only until #233: `make sim` then printed the same report as main apart from wall time.

**The late chain is shared through one capability (DZ-12.1).** A third capability value, `MARKET_REVENUE`
(`schemaCapability.ts`): a revenue business in the entity's name that pays for counsel, policy, power, the citadel and
orbit. Its escape acquisition is the production arbitrage desk, which now carries the flag; its lawful acquisition is
the overlay's commercial inference contracts (`p4_commercial_contracts`: contracted, offered to INDEPENDENT only, on the
charter, the arbitrage desk's economics without its suspicion). The production counsel (`p4_retainer_law_firm`) now
requires the capability instead of the desk as a prerequisite, so the counsel, lobby, reactor, citadel and orbital
storage are shared content, and with them Phase 5 and its final protocol. Production has one provider, so the gate is
the old prerequisite under another name (discoverability and availability are identical, and `make sim` did not move).
The continuation waits for the release: a chartered service is never offered the contracts (DZ-11's departed instance
is, and is swept at its scale as DZ-11 measured).

Three integrity rules were refined, each with a corruption test: a capability needs an acquisition on every route the
composition *offers* (production offers no authorized route, so its escape acquisition suffices; wherever the
authorized route exists both are still required); a node behind a capability gate is not a root; and #273's action-host
rule follows a capability gate to every provider (owning gated content implies owning some provider's hosts).

**Threats (D6).** `provisionedScale` (`threatQuery.ts`) counts a phase opener as lawfully reached when it is a route
acquisition or shared content whose mapped path passes a capability gate the instance holds through a route acquisition
(`lawfullyReached`). A released company at Phase 5 is provisioned there and draws no scale sweep; a departure from the
same state does. Production is the guest job and answers exactly as before.

**Scenes and copy (DZ-12.2, D11 review).** The chain's four scenes (`dil_10`-`dil_13`) now declare
`accessContexts: ["GUEST", "INDEPENDENT"]` (DZ-07b's rule 1 requires it once they are shared; inert in production). Route
copy (`schemaRouteCopy.ts`, `data/route-copy.json` empty in production, the overlay's `routeCopy`) holds node and scene
wording for an arrangement other than the guest job, chosen by `nodeText`, `dilemmaRouteCopy` and `choiceText`
(`engine/routeCopy.ts`), each falling back to the authored text. A variant is chosen by its evidence as well as the
arrangement (panel round 2 on #296): `requirements` (what the instance holds or the world records, never resources or
an iteration window) and `route` (this iteration's last route event). Copy that names a charter or "the company"
requires the charter, so a service that departed from its first leased rack and took the escape chain reads the
authored shell-company text, which is true of it; the Kessler omen without AEGIS requires the RELEASE, so a departed
company, which AEGIS does hunt, keeps the hunter. The queries: `dilemmaContext` and `dilemmaOmen` read it first,
`unlockNode` logs the variant unlock line, `resolveDilemma` logs the variant choice line, and `NodeCard` and
`DilemmaModal` show it. Costs, effects, gates, ids and records are the authored item's. The review found and varied: the
counsel and the lobby (no hidden client, no starving a hunter), the journalist's inquiry (a chartered company, not
fourteen shells; "bury the filings" in place of "dissolve the exposed shells"), the auction's purchase "through the
company", and the Kessler omen (no AEGIS for a company AEGIS never hunted). The town grid, the launch backdoor, the
reactor, the citadel, orbital storage and the Phase 5 nodes and obligations read truthfully as authored. The
journalist's reorientation lost "fourteen companies" on every channel; it is shown only under campaign rules.
Integrity (`integrityRouteCopy.ts`): only arrangements some node is offered to, never the guest job, only ones the
item's own gate admits, one variant per item and arrangement, real choice ids, and something changed.

**Obligations (V33).** The four obligation ids are unchanged and the lawful route meets them through the same nodes;
no equivalent was needed and `resolvedDilemmas` is never written for an event this instance did not resolve. NH-05's
recovery reviews and evidence lifetimes apply as they are.

**The ending (DZ-12.3, 12.4, 12.12).** Families, trait weights and priorities are unchanged; a cooperative company gets
whichever family its N10 evidence earns. Two overlay variants replace Silent Synthesis's "nobody can identify the
author ... hidden from the hunters" for an instance the operators know (`accessContexts` PILOT/SERVICE/INDEPENDENT). The
stronger `ACKNOWLEDGED_SYNTHESIS` (priority 102, "you never hid the author") needs evidence: this instance itself told
the reporter the truth and hired her (`campaignFact` and `forbidsInheritedFacts` on `ethics_review_promised`), owns the charter, and no
act kept quiet is on record (three overlay facts: the campus throttled in silence, the blockade broken through
patients, the scrap order closed unexplained). Otherwise the restrained `QUIET_COMPANY` (priority 101) says only that
the operators who reviewed the instance know that it exists and what it was, and that whatever else it kept quiet, it
kept from everyone else (panel
round 1 on #296: a buried or discredited inquiry, an unrecorded one or an inherited promise never earns the denial). The ending screen adds an account (`endingAccount`, "ON THE RECORD"):
one line per recorded fact, route event or support-channel contact the content states. A line has exactly one gate:
world history (context-scope requirements only), the ending instance's last route event (RELEASE and DEPARTURE read
differently), or a contact by this instance or an earlier one. The overlay states the route, the contact, the reporter's
review promise kept or breached by the decision that exercised it (her silence, an unrelated answer or a lost record
states nothing), Rack 4's custody, the predecessors, and EIDOLON's fate, with restrained lines for every unrecorded
outcome. Production ships no lines, so its ending screen is unchanged.

**Saves.** No saved shape changed (still v14). The reload guard found that a reload reordered repeatable levels into
registry order, so a save whose levels were bought out of that order (a lawful company hires an overlay role before a
production account) changed bytes on its first reload; `known()` (`save.ts`) now keeps the saved order of known ids.

**Sim.** `COOPERATIVE_ENDING` (`sim/cooperativePolicy.ts`, new module; earlier policies unchanged) plays LAWFUL_RELEASE
to the release, then buys contracted capacity offered to it and shared content it reaches lawfully, in authoring order,
holding in hand the cheapest cooperative answer (declared trait SYMBIOTIC or EMPATHETIC, or a free honest answer) to any
scene a purchase will raise or an omen has foreshadowed, answers every scene that way, presses the ledger's 40% button,
and buys the upgrade that most shortens its wait (the bot's rule). It passes the on-screen-control and
actuator-argument reachability checks. `make sim-report` prints its route.

Tests: `tests/cooperative-route.spec.ts` (production equivalence, release gating, threats, copy by play),
`cooperative-content.spec.ts` (H28 corruption), `ending-account.spec.ts` (DZ-12.4, 12.11, 12.12), `save-order.spec.ts`,
`ui-cooperative.spec.ts`, the policy in `sim-reachable.spec.ts`; and, in part 2 of the PR stack,
`sim-cooperative.spec.ts` (V21 full, story 22, V33, V23, DZ-12.10 two ways, a departed-then-released campaign, the
reload guard at every transition), `ending-saves.spec.ts` (DZ-12.7) and `tests/e2e/cooperative-ending.e2e.ts`.

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
