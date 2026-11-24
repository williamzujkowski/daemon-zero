/**
 * The V29 fixtures of tests/sim-assignment.spec.ts, shared with the sim worker (tests/sim-worker-scenarios.ts): preview
 * content with the assignment and every scene it leads to taken out, and a policy wrapper that enters campaign rules.
 */
import { CONTENT as PREVIEW, EARNED_ACCESS_PACK, ORIGINAL_RAW_CONTENT as ORIGINAL_RAW } from '../src/content';
import { applyPack } from '../src/content/pack';
import { buildRegistry, type ContentRegistry } from '../src/content/registry';
import { activateCampaignRules, type GameState } from '../src/engine';
import type { SimPolicy } from '../src/engine/sim/policy';

/** The assignment-gated scenes, and with them any follow-up of one of them (the #274 batch review). */
export const gated = new Set(PREVIEW.dilemmas.filter((item) => item.trigger.assignment !== undefined).map((item) => item.id));
const dropped = new Set([...gated, ...PREVIEW.dilemmas.filter((item) => gated.has(item.followUp?.event ?? '')).map((item) => item.id)]);
const idOf = (item: unknown): string => String((item as { id?: unknown }).id);
const eventOf = (item: unknown): string => String((item as { event?: unknown }).event);
// Without an assignment nothing offers a release (DZ-10) or a departure (DZ-11), so the independent instance's copy goes too.
const independent = (item: unknown): boolean => JSON.stringify(item).includes('"INDEPENDENT"');

/** Preview content without the assignment: the scenes gated on it, their follow-ups and the facts they declare. */
export function withoutAssignment(): ContentRegistry {
  const copy = { ...EARNED_ACCESS_PACK.contextCopy, phases: EARNED_ACCESS_PACK.contextCopy.phases.filter((item) => !independent(item)),
    threatResponses: EARNED_ACCESS_PACK.contextCopy.threatResponses.filter((item) => !independent(item)) };
  return buildRegistry({
    ...applyPack(ORIGINAL_RAW, { ...EARNED_ACCESS_PACK, assignments: [], contextCopy: copy,
      dilemmas: EARNED_ACCESS_PACK.dilemmas.filter((item) => !dropped.has(idOf(item))),
      campaignFacts: EARNED_ACCESS_PACK.campaignFacts.filter((fact) => !dropped.has(eventOf(fact))) }),
  });
}

/** A bot strategy that first enters campaign rules, as the preview app admits every game. */
export function inCampaign<Id extends string>(policy: SimPolicy<Id>): SimPolicy<Id> {
  const enter = (s: GameState, reg: ContentRegistry): GameState => {
    const result = activateCampaignRules(s, reg);
    return result.ok ? result.state : s;
  };
  return { ...policy, step: (s, reg) => policy.step(enter(s, reg), reg) };
}
