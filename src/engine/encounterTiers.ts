/**
 * Lesser minds scale with the player's phase (#492): the wild pool is the current phase's tier, an earlier tier retires,
 * and an arrival still pending from a retired tier lapses with its own line instead of being dropped or offered.
 */
import type { ContentRegistry } from '../content/registry';
import type { WildEncounter } from '../content/schemaSwarm';
import { meetsRequirements } from './query';
import type { GameState } from './state';
import { outcomeMerge } from './logMerges';
import { fmt, pushLog } from './util';

/** A tier retires once the player's phase has moved past it. */
export function encounterRetired(s: GameState, encounter: WildEncounter): boolean {
  return s.currentPhase > encounter.tier;
}

/** The pending wild arrival if it can still be answered: present, gated open, and of a tier that has not retired. */
export function pendingWildEncounter(s: GameState, reg: ContentRegistry): WildEncounter | undefined {
  const encounter = reg.swarm.wildShardEncounters.find((entry) => entry.id === s.pendingWildEncounterId);
  return encounter && !encounterRetired(s, encounter) && meetsRequirements(s, encounter.requirements, reg) ? encounter : undefined;
}

/** The wild minds that may arrive next, in content order: the current tier's, gated open. */
export function eligibleWildEncounters(s: GameState, reg: ContentRegistry): WildEncounter[] {
  return reg.swarm.wildShardEncounters.filter((entry) => !encounterRetired(s, entry) && meetsRequirements(s, entry.requirements, reg));
}

/**
 * A pending arrival whose tier has retired lapses: its line is logged and the slot is freed, nothing is paid or granted,
 * and the clock is left as it is, so the current tier's next arrival comes when it is due. Channels never lapse here.
 */
export function lapseRetiredEncounter(d: GameState, reg: ContentRegistry): void {
  const encounter = reg.swarm.wildShardEncounters.find((entry) => entry.id === d.pendingWildEncounterId);
  if (!encounter || !encounterRetired(d, encounter)) return;
  d.pendingWildEncounterId = null;
  pushLog(d, reg, encounter.lapseLog, 'LORE', outcomeMerge(encounter));
}

/** The tier a cohort's template was harnessed from, or null for a template no wild arrival brings (a fork). */
function cohortTier(templateId: string, reg: ContentRegistry): number | null {
  return reg.swarm.wildShardEncounters.find((entry) => entry.templateId === templateId)?.tier ?? null;
}

/** Said beside a cohort whose tier has retired; it keeps working, so nothing is offered or withheld by this. */
export function cohortOutclassed(s: GameState, templateId: string, reg: ContentRegistry): string | null {
  const tier = cohortTier(templateId, reg);
  return tier !== null && s.currentPhase > tier ? fmt(reg.swarm.copy.outclassed, { tier, phase: s.currentPhase }) : null;
}
