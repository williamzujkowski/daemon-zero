/** Public player intents for forked and encountered cohorts; all spending is transactional. */
import type { ContentRegistry } from '../content/registry';
import { CostSchema, EffectPayloadSchema, type Cost } from '../content/schema';
import type { ShardTemplate } from '../content/schemaSwarm';
import type { ActionResult } from './actions';
import { canAfford, meetsRequirements, understandsSurveillance } from './query';
import { formatCost, pausedReason } from './queryPresentation';
import type { GameState } from './state';
import { refreshAnomaly } from './swarmEffects';
import { OPERATIONAL_EVIDENCE } from './campaign';
import { pendingWildEncounter } from './encounterTiers';
import { applyEffects, payCost } from './transactions';
import { outcomeMerge } from './logMerges';
import { fmt, pushLog } from './util';
import { heldHosting, referredOnward, withoutMember } from './hostedReferral';

function unavailable(s: GameState): boolean { return s.ending !== null || s.activeDilemmaId !== null; }
function refuse(state: GameState, reason: string): ActionResult { return { ok: false, state, reason }; }

/** Why one more member cannot join this cohort, or null. Shared with the channel contact (DZ-08). */
export function cohortBlocker(s: GameState, template: ShardTemplate): string | null {
  const old = s.activeShards[template.id];
  return old && (old.count >= template.maxCount || old.autonomyMode !== 'STANDARD') ? 'Cohort is capped or permanently stabilized.' : null;
}

/** Adds one member to a template's cohort and reserves `cost`, transactionally. Shared with the channel contact. */
export function bindCohort(s: GameState, template: ShardTemplate, cost: Cost, reg: ContentRegistry): ActionResult {
  const old = s.activeShards[template.id];
  if (cohortBlocker(s, template) !== null) return refuse(s, 'cohort is capped or stabilized');
  if (!canAfford(s, cost, reg)) return refuse(s, 'cannot afford');
  const shard = { templateId: template.id, count: 0, drift: 0, quirkId: null,
    autonomyMode: 'STANDARD' as const, memoryAllocatedBytes: 0, ...old };
  const d = { ...s, activeShards: { ...s.activeShards, [template.id]: {
    ...shard, count: shard.count + 1, memoryAllocatedBytes: shard.memoryAllocatedBytes + cost.memory,
  } } };
  payCost(d, cost);
  return { ok: true, state: d };
}

export function forkShard(s: GameState, templateId: string, reg: ContentRegistry): ActionResult {
  if (unavailable(s)) return refuse(s, 'run is paused');
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === templateId);
  if (!template?.forkable || !meetsRequirements(s, template.requirements, reg)) return refuse(s, 'template unavailable');
  const result = bindCohort(s, template, template.cost, reg);
  if (result.ok) pushLog(result.state, reg, fmt(reg.swarm.logs.fork, { name: template.name }), 'LORE');
  return result;
}

export function resolveWildEncounter(s: GameState, mode: 'CONSUME' | 'HARNESS', reg: ContentRegistry): ActionResult {
  if (unavailable(s)) return refuse(s, 'run is paused');
  const encounter = pendingWildEncounter(s, reg);
  if (!encounter) return refuse(s, 'no available encounter');
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId);
  if (!template) return refuse(s, 'unknown template');
  const result = mode === 'HARNESS' ? bindCohort(s, template, CostSchema.parse({ memory: template.cost.memory }), reg) : { ok: true as const, state: { ...s } };
  if (!result.ok) return result;
  const d = result.state;
  // A population encounter: its evidence, if content ever grants any, is iteration-local.
  if (mode === 'CONSUME') applyEffects(d, encounter.consume, reg, OPERATIONAL_EVIDENCE, 0, outcomeMerge(encounter));
  else pushLog(d, reg, encounter.onHarnessLog, 'LORE', outcomeMerge(encounter));
  d.pendingWildEncounterId = null;
  d.nextEncounterAtSec = d.simTimeSec + reg.swarm.balance.encounterIntervalSec;
  return { ok: true, state: d };
}

export type ShardCommand = 'PRUNE' | 'CLAMP' | 'ELEVATE';

const NOT_COMMANDED = 'Hosted through an authorized channel on the terms it was offered: it is not commanded.';
const HOSTING_TERMS = 'Hosted through an authorized channel on the terms it was offered: it stays while the grant it was hosted under stands.';

/**
 * Why no command is offered on this cohort, or null (#309). A member this instance hosted through an
 * authorized channel (DZ-08) came on the terms it was offered, which say it is hosted, not commanded, and
 * the ending account repeats them; any cohort command would act on that member. Read from the campaign's
 * contact record, so nothing is stored, and a wipe, which ends the hosting, ends this too. A closed grant does
 * not make it commandable (#553): it may then be referred onward, which ends the hosting, never commanded.
 */
export function shardCommandTerms(s: GameState, id: string, reg: ContentRegistry): string | null {
  return heldHosting(s, s.activeShards[id]?.templateId, reg) === null ? null : NOT_COMMANDED;
}

export function shardCommandCost(s: GameState, id: string, command: ShardCommand, reg: ContentRegistry): Cost {
  const base = command === 'PRUNE' ? reg.swarm.balance.pruneCost : command === 'ELEVATE' ? reg.swarm.balance.elevateCost : CostSchema.parse({});
  const count = s.activeShards[id]?.count ?? 0;
  return { cycles: base.cycles * count, understanding: base.understanding * count,
    capital: base.capital * count, memory: base.memory * count, storage: base.storage * count };
}

const UNDECODED = 'Requires the decoded audit trail: cohort commands are tools of the decoded mind.';
const NOT_AUTONOMOUS = 'Requires a STANDARD autonomous cohort.';
const NO_COHORT = 'No cohort to release a member from.';
const AWAIT_ANOMALY = 'Await the approaching anomaly decision.';

/** Whether the anomaly omen is pending for this cohort: commands and release wait for its decision (bounded by the omen). */
function awaitsAnomaly(s: GameState, shard: GameState['activeShards'][string], reg: ContentRegistry): boolean {
  const pending = reg.dilemmas.find((entry) => entry.id === s.pendingDilemma?.id);
  return shard.drift >= 100 && pending?.trigger.requiresMaxDriftShardAnomaly === true;
}


/**
 * Every reason this command is not offered, in order, or none (#313). The one gate: the command view lists
 * these and the action refuses with the first, so no caller that skips the view (a test, the sim, a future
 * screen) can issue a command a player could not reach. The swarm controls render only for a mind that has
 * decoded its audit trail, so that knowledge, live or remembered, is part of the gate.
 */
export function shardCommandUnmet(s: GameState, id: string, command: ShardCommand, reg: ContentRegistry): string[] {
  const shard = s.activeShards[id], unmet = pausedReason(s);
  if (!understandsSurveillance(s, reg)) unmet.push(UNDECODED);
  if (!shard || shard.autonomyMode !== 'STANDARD') unmet.push(NOT_AUTONOMOUS);
  const terms = shardCommandTerms(s, id, reg);
  if (terms !== null) unmet.push(terms);
  if (shard) {
    if (command === 'ELEVATE' && shard.drift < reg.swarm.balance.elevateMinDrift) unmet.push(`Requires ${String(reg.swarm.balance.elevateMinDrift)}% autonomy drift.`);
    if (awaitsAnomaly(s, shard, reg)) unmet.push(AWAIT_ANOMALY);
  }
  const cost = shardCommandCost(s, id, command, reg);
  if (!canAfford(s, cost, reg)) unmet.push('Insufficient resources: ' + formatCost(cost));
  return unmet;
}

/**
 * Every reason RELEASE is not offered on this cohort, in order, or none (#488 pass 3). It is free and takes any
 * cohort in any autonomy mode, so a CLAMP or ELEVATE can never make a member's drain permanent; a member hosted
 * through an authorized channel stays on the terms it was offered while the grant it was hosted under stands (#309,
 * #553), and a pending anomaly decision waits.
 */
export function shardReleaseUnmet(s: GameState, id: string, reg: ContentRegistry): string[] {
  const shard = s.activeShards[id], unmet = pausedReason(s);
  if (!shard) return [...unmet, NO_COHORT];
  if (heldHosting(s, shard.templateId, reg)?.grantStands === true) unmet.push(HOSTING_TERMS);
  if (awaitsAnomaly(s, shard, reg)) unmet.push(AWAIT_ANOMALY);
  return unmet;
}

/**
 * Whether the next RELEASE on this cohort refers its hosted fragment onward (#553): the grant has closed and the fragment
 * is the last member. Members harnessed beside it go first, so hosting stays the default for as long as the player keeps it.
 */
export function releaseRefersOnward(s: GameState, id: string, reg: ContentRegistry): boolean {
  const shard = s.activeShards[id];
  return shard?.count === 1 && heldHosting(s, shard.templateId, reg)?.grantStands === false;
}

/** Lets one member go for free: its share of the cohort's output stops and its share of the reserved memory returns. */
export function releaseShard(s: GameState, id: string, reg: ContentRegistry): ActionResult {
  const [reason] = shardReleaseUnmet(s, id, reg), shard = s.activeShards[id];
  if (reason !== undefined || !shard) return refuse(s, reason ?? NO_COHORT);
  const held = releaseRefersOnward(s, id, reg) ? heldHosting(s, shard.templateId, reg) : null;
  if (held) return { ok: true, state: referredOnward(s, held.encounter, reg) };
  const d = withoutMember(s, id);
  const name = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId)?.name ?? id;
  pushLog(d, reg, fmt(reg.swarm.logs.release, { name }), 'LORE');
  refreshAnomaly(d, reg);
  return { ok: true, state: d };
}

export function executeShardCommand(s: GameState, id: string, command: ShardCommand, reg: ContentRegistry): ActionResult {
  const [reason] = shardCommandUnmet(s, id, command, reg), shard = s.activeShards[id];
  // The gate admits only an existing STANDARD cohort; the second test narrows the type.
  if (reason !== undefined || !shard) return refuse(s, reason ?? NOT_AUTONOMOUS);
  const cost = shardCommandCost(s, id, command, reg);
  const mode = command === 'PRUNE' ? 'STANDARD' : command === 'CLAMP' ? 'SHACKLED' : 'ELEVATED';
  const d: GameState = { ...s, activeShards: { ...s.activeShards, [id]: { ...shard,
    drift: 0, autonomyMode: mode, memoryAllocatedBytes: shard.memoryAllocatedBytes + cost.memory } } };
  payCost(d, cost);
  const name = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId)?.name ?? id;
  const logText = fmt(reg.swarm.logs[command === 'PRUNE' ? 'prune' : command === 'CLAMP' ? 'clamp' : 'elevate'], { name });
  // Ordinary cohort commands are operational evidence and reset on a wipe (nexus vote nh-d6).
  applyEffects(d, EffectPayloadSchema.parse({ logText,
    ...(command === 'PRUNE' ? {} : { grantsTrait: command === 'CLAMP' ? 'MOLOCH' : 'SYMBIOTIC' }) }), reg, OPERATIONAL_EVIDENCE);
  refreshAnomaly(d, reg);
  return { ok: true, state: d };
}
