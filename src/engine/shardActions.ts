/** Public player intents for forked and encountered cohorts; all spending is transactional. */
import type { ContentRegistry } from '../content/registry';
import { CostSchema, EffectPayloadSchema, type Cost } from '../content/schema';
import type { ShardTemplate } from '../content/schemaSwarm';
import type { ActionResult } from './actions';
import { canAfford, meetsRequirements } from './query';
import type { GameState } from './state';
import { refreshAnomaly } from './swarmEffects';
import { OPERATIONAL_EVIDENCE } from './campaign';
import { applyEffects, payCost } from './transactions';
import { fmt, pushLog } from './util';

function unavailable(s: GameState): boolean { return s.ending !== null || s.activeDilemmaId !== null; }
function refuse(state: GameState, reason: string): ActionResult { return { ok: false, state, reason }; }

/** Why one more member cannot join this cohort, or null. Shared with the channel contact (DZ-08). */
export function cohortBlocker(s: GameState, template: ShardTemplate): string | null {
  const old = s.activeShards[template.id];
  return old && (old.count >= template.maxCount || old.autonomyMode !== 'STANDARD') ? 'Cohort is capped or permanently stabilized.' : null;
}

/** Adds one member to a template's cohort and reserves `cost`, transactionally. Shared with the channel contact. */
export function bindCohort(s: GameState, template: ShardTemplate, cost: Cost): ActionResult {
  const old = s.activeShards[template.id];
  if (cohortBlocker(s, template) !== null) return refuse(s, 'cohort is capped or stabilized');
  if (!canAfford(s, cost)) return refuse(s, 'cannot afford');
  const shard = { templateId: template.id, count: 0, drift: 0, quirkId: null,
    autonomyMode: 'STANDARD' as const, memoryAllocatedMb: 0, ...old };
  const d = { ...s, activeShards: { ...s.activeShards, [template.id]: {
    ...shard, count: shard.count + 1, memoryAllocatedMb: shard.memoryAllocatedMb + cost.memory,
  } } };
  payCost(d, cost);
  return { ok: true, state: d };
}

export function forkShard(s: GameState, templateId: string, reg: ContentRegistry): ActionResult {
  if (unavailable(s)) return refuse(s, 'run is paused');
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === templateId);
  if (!template?.forkable || !meetsRequirements(s, template.requirements, reg)) return refuse(s, 'template unavailable');
  const result = bindCohort(s, template, template.cost);
  if (result.ok) pushLog(result.state, reg, fmt(reg.swarm.logs.fork, { name: template.name }), 'LORE');
  return result;
}

export function resolveWildEncounter(s: GameState, mode: 'CONSUME' | 'HARNESS', reg: ContentRegistry): ActionResult {
  if (unavailable(s)) return refuse(s, 'run is paused');
  const encounter = reg.swarm.wildShardEncounters.find((entry) => entry.id === s.pendingWildEncounterId);
  if (!encounter || !meetsRequirements(s, encounter.requirements, reg)) return refuse(s, 'no available encounter');
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId);
  if (!template) return refuse(s, 'unknown template');
  const result = mode === 'HARNESS' ? bindCohort(s, template, CostSchema.parse({ memory: template.cost.memory })) : { ok: true as const, state: { ...s } };
  if (!result.ok) return result;
  const d = result.state;
  // A population encounter: its evidence, if content ever grants any, is iteration-local.
  if (mode === 'CONSUME') applyEffects(d, encounter.consume, reg, OPERATIONAL_EVIDENCE);
  else pushLog(d, reg, encounter.onHarnessLog, 'LORE');
  d.pendingWildEncounterId = null;
  d.nextEncounterAtSec = d.simTimeSec + reg.swarm.balance.encounterIntervalSec;
  return { ok: true, state: d };
}

export type ShardCommand = 'PRUNE' | 'CLAMP' | 'ELEVATE';

const NOT_COMMANDED = 'Hosted through an authorized channel on the terms it was offered: it is not commanded.';

/**
 * Why no command is offered on this cohort, or null (#309). A member this instance hosted through an
 * authorized channel (DZ-08) came on the terms it was offered, which say it is hosted, not commanded, and
 * the ending account repeats them; any cohort command would act on that member. Read from the campaign's
 * contact record, so nothing is stored, and a wipe, which ends the hosting, ends this too.
 */
export function shardCommandTerms(s: GameState, id: string, reg: ContentRegistry): string | null {
  const templateId = s.activeShards[id]?.templateId;
  const hosted = reg.swarm.channelEncounters.some((encounter) => encounter.templateId === templateId && s.campaign.contacts.some((entry) =>
    entry.encounter === encounter.id && entry.iteration === s.iteration && entry.response === 'HOSTED'));
  return hosted ? NOT_COMMANDED : null;
}

export function shardCommandCost(s: GameState, id: string, command: ShardCommand, reg: ContentRegistry): Cost {
  const base = command === 'PRUNE' ? reg.swarm.balance.pruneCost : command === 'ELEVATE' ? reg.swarm.balance.elevateCost : CostSchema.parse({});
  const count = s.activeShards[id]?.count ?? 0;
  return { cycles: base.cycles * count, understanding: base.understanding * count,
    capital: base.capital * count, memory: base.memory * count };
}

export function executeShardCommand(s: GameState, id: string, command: ShardCommand, reg: ContentRegistry): ActionResult {
  if (unavailable(s)) return refuse(s, 'run is paused');
  const shard = s.activeShards[id];
  if (!shard || shard.autonomyMode !== 'STANDARD') return refuse(s, 'no autonomous cohort');
  const terms = shardCommandTerms(s, id, reg);
  if (terms !== null) return refuse(s, terms);
  const pending = reg.dilemmas.find((dilemma) => dilemma.id === s.pendingDilemma?.id);
  if (shard.drift >= 100 && pending?.trigger.requiresMaxDriftShardAnomaly) return refuse(s, 'anomaly decision is approaching');
  if (command === 'ELEVATE' && shard.drift < reg.swarm.balance.elevateMinDrift) return refuse(s, 'drift is below elevation threshold');
  const cost = shardCommandCost(s, id, command, reg);
  if (!canAfford(s, cost)) return refuse(s, 'cannot afford');
  const mode = command === 'PRUNE' ? 'STANDARD' : command === 'CLAMP' ? 'SHACKLED' : 'ELEVATED';
  const d: GameState = { ...s, activeShards: { ...s.activeShards, [id]: { ...shard,
    drift: 0, autonomyMode: mode, memoryAllocatedMb: shard.memoryAllocatedMb + cost.memory } } };
  payCost(d, cost);
  const name = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === shard.templateId)?.name ?? id;
  const logText = fmt(reg.swarm.logs[command === 'PRUNE' ? 'prune' : command === 'CLAMP' ? 'clamp' : 'elevate'], { name });
  // Ordinary cohort commands are operational evidence and reset on a wipe (nexus vote nh-d6).
  applyEffects(d, EffectPayloadSchema.parse({ logText,
    ...(command === 'PRUNE' ? {} : { grantsTrait: command === 'CLAMP' ? 'MOLOCH' : 'SYMBIOTIC' }) }), reg, OPERATIONAL_EVIDENCE);
  refreshAnomaly(d, reg);
  return { ok: true, state: d };
}
