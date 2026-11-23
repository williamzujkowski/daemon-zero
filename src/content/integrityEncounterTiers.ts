/**
 * Encounter tiers are validated content (#492, docs/SCALE.md "Other minds scale with the player"). A wild encounter's
 * tier is the phase it is met in, its phase gate and its cohort's band phase; every phase from the first tier to the
 * last phase has one, so a new phase (the Phase 6 swarm, #486) must author its own minds; and each tier outclasses
 * the one before it, so retiring a tier never hands the player a weaker mind.
 */
import type { ContentRegistry } from './registry';
import type { EncounterKind, WildEncounter } from './schemaSwarm';

/** The kinds that climb the ladder. A hostile kind (#491) has its own lifecycle and is measured by its own rules. */
const LADDER_KINDS: ReadonlySet<EncounterKind> = new Set(['LESSER']);

function checkTierBinding(reg: ContentRegistry, encounter: WildEncounter): string[] {
  const owner = `wild encounter "${encounter.id}"`, problems: string[] = [];
  if (!reg.phases.some((phase) => phase.phaseId === encounter.tier)) problems.push(`${owner}: tier ${String(encounter.tier)} names no phase`);
  const gate = encounter.requirements.phaseAtLeast;
  if (gate !== encounter.tier) problems.push(`${owner}: tier ${String(encounter.tier)} must be its phaseAtLeast (found ${String(gate)})`);
  const template = reg.swarm.playerSwarmTemplates.find((entry) => entry.id === encounter.templateId);
  const band = template?.requirements.phaseAtLeast ?? 0;
  if (template && band !== encounter.tier) {
    problems.push(`${owner}: its cohort "${template.id}" belongs to Phase ${String(band)}, not tier ${String(encounter.tier)}`);
  }
  return problems;
}

/** What a tier is measured on: its burst, the memory its cohort reserves, and the understanding its cohort yields. */
interface TierMeasure { burst: number[]; memory: number[]; output: number[] }

function measure(reg: ContentRegistry, tier: WildEncounter[]): TierMeasure {
  const templates = tier.flatMap((encounter) => reg.swarm.playerSwarmTemplates.filter((entry) => entry.id === encounter.templateId));
  return { burst: tier.map((encounter) => encounter.consume.understandingDelta), memory: templates.map((entry) => entry.cost.memory),
    output: templates.map((entry) => entry.tickDelta.understandingPerSec) };
}

/** Every burst and cohort of a later tier exceeds every one of the tier before; its best output exceeds the best before. */
function checkOutclass(tier: number, previous: number, later: TierMeasure, earlier: TierMeasure): string[] {
  const problems: string[] = [], label = `wild encounters: tier ${String(tier)} must outclass tier ${String(previous)} on`;
  if (Math.min(...later.burst) <= Math.max(...earlier.burst)) problems.push(`${label} consumed understanding`);
  if (Math.min(...later.memory) <= Math.max(...earlier.memory)) problems.push(`${label} harness memory`);
  if (Math.max(...later.output) <= Math.max(...earlier.output)) problems.push(`${label} harnessed understanding`);
  return problems;
}

function checkLadder(reg: ContentRegistry): string[] {
  const lesser = reg.swarm.wildShardEncounters.filter((encounter) => LADDER_KINDS.has(encounter.kind));
  if (lesser.length === 0) return [];
  const first = Math.min(...lesser.map((encounter) => encounter.tier));
  const last = Math.max(...reg.phases.map((phase) => phase.phaseId));
  const problems: string[] = [];
  let previous: { tier: number; measure: TierMeasure } | null = null;
  for (let tier = first; tier <= last; tier++) {
    const own = lesser.filter((encounter) => encounter.tier === tier);
    if (own.length === 0) { problems.push(`wild encounters: Phase ${String(tier)} has no lesser-mind tier`); continue; }
    const current = measure(reg, own);
    if (previous) problems.push(...checkOutclass(tier, previous.tier, current, previous.measure));
    previous = { tier, measure: current };
  }
  return problems;
}

export function checkEncounterTierIntegrity(reg: ContentRegistry): string[] {
  return [...reg.swarm.wildShardEncounters.flatMap((encounter) => checkTierBinding(reg, encounter)), ...checkLadder(reg)];
}
