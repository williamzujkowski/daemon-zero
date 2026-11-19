/**
 * Distinctions claim only what the record proves. Each must test something, name a declared campaign
 * fact, and never be satisfiable by an unrecorded outcome: a fact that lists 'legacy_unknown' or
 * 'interrupted' says the record is silent, and silence is never a distinction.
 */
import type { ContentRegistry } from './registry';
import type { Achievement } from './schemaAchievement';
import { INTERRUPTED_FACT_OUTCOME, LEGACY_UNKNOWN_OUTCOME } from './schemaCampaign';

const SILENT = new Set<string>([LEGACY_UNKNOWN_OUTCOME, INTERRUPTED_FACT_OUTCOME]);

function factProblems(reg: ContentRegistry, entry: Achievement): string[] {
  const id = entry.requirements.campaignFact;
  if (id === undefined) return [];
  const fact = reg.campaign.facts.get(id);
  if (!fact) return [`achievement "${entry.id}": campaignFact "${id}" is not a declared campaign fact`];
  const silent = fact.outcomes.filter((outcome) => SILENT.has(outcome));
  return silent.length === 0 ? [] : [`achievement "${entry.id}": campaignFact "${id}" holds on an unrecorded outcome (${silent.join(', ')})`];
}

export function checkAchievementIntegrity(reg: ContentRegistry): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const entry of reg.achievements) {
    if (seen.has(entry.id)) problems.push(`achievements: duplicate id "${entry.id}"`);
    seen.add(entry.id);
    const { forbidsTraits, campaignFact } = entry.requirements;
    if (forbidsTraits === undefined && campaignFact === undefined && entry.maxWipes === undefined) {
      problems.push(`achievement "${entry.id}": tests nothing, so every ending would earn it`);
    }
    problems.push(...factProblems(reg, entry));
  }
  return problems;
}
