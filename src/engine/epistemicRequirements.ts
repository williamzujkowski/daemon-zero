/** Declarative epistemic gates; separated from action queries to avoid runtime require cycles. */
import type { ContentRegistry } from '../content/registry';
import type { Requirements } from '../content/schema';
import type { GameState } from './state';
import type { RequirementFailure } from './query';
import { understandsSurveillance } from './knowledge';
export function epistemicRequirementFailures(s: GameState, req: Requirements, reg?: ContentRegistry): RequirementFailure[] {
  const out: RequirementFailure[] = [];
  if (req.requiresSurveillance && (!reg || !understandsSurveillance(s, reg))) out.push({ kind: 'requiresSurveillance', target: null, required: true, actual: false });
  if (req.minEpistemicDrift !== undefined && s.epistemicDrift < req.minEpistemicDrift) out.push({ kind: 'minEpistemicDrift', target: null, required: req.minEpistemicDrift, actual: s.epistemicDrift });
  if (req.requiredNarrativeFlag && !s.narrativeFlags.includes(req.requiredNarrativeFlag)) out.push({ kind: 'requiredNarrativeFlag', target: req.requiredNarrativeFlag, required: true, actual: false });
  for (const flag of req.forbiddenNarrativeFlags ?? []) if (s.narrativeFlags.includes(flag)) out.push({ kind: 'forbiddenNarrativeFlags', target: flag, required: false, actual: true });
  if (req.requiresActiveConditioningMark && s.conditioning.length === 0) out.push({ kind: 'requiresActiveConditioningMark', target: null, required: true, actual: false });
  if (req.requiresMaxDriftShardAnomaly && !s.hasMaxDriftShardAnomaly) out.push({ kind: 'requiresMaxDriftShardAnomaly', target: null, required: true, actual: false });
  return out;
}

export function meetsEpistemicRequirements(s: GameState, req: Requirements, reg?: ContentRegistry): boolean {
  return epistemicRequirementFailures(s, req, reg).length === 0;
}

