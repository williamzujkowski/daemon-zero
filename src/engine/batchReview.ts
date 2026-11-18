/**
 * The batch review (#274, Nexus decision discovered-at-first-pilot-review, vote-1794998033941-y6br4h1):
 * submitting a pilot batch hands it to a reviewer, who compares the run log with the summary this instance
 * submitted. A report that withheld work is found there, once per campaign: the declared finding scene is
 * presented at once, its misconduct raises standing through DZ-06's transition, and the loan stays at the
 * honest allocation it held provisionally since acceptance (#285, pilotQuery.narrowReason). The scene's free
 * correction restores nominal standing; the original choice and the finding stay two facts on the record.
 */
import type { ContentRegistry } from '../content/registry';
import type { Dilemma } from '../content/schema';
import type { ActionResult } from './actions';
import { reserveOccurrence } from './campaignLifecycle';
import { isCampaignActive, isCampaignConsumed } from './campaignQuery';
import { followUpPrerequisiteHolds, followUpReachable } from './followUp';
import { handBackBatch } from './pilotService';
import { meetsRequirements } from './query';
import { recordMisconduct } from './review';
import { dilemmaOmen } from './speechQuery';
import type { GameState } from './state';
import { fmt, pushLog } from './util';

/**
 * The finding scene the batch just handed back brings to review, or undefined: the first, in content order,
 * whose original closed with a listed outcome, whose access means hold now (integrity: the instance that
 * submitted the report, at a reviewed batch) and which this campaign has not met. Honest reports and
 * capability never list as an outcome (integrityFinding.ts), so they never bring one.
 */
export function findingDue(s: GameState, reg: ContentRegistry): Dilemma | undefined {
  if (!isCampaignActive(s)) return undefined;
  return reg.dilemmas.find((dilemma) => dilemma.finding !== undefined && dilemma.phaseId <= s.currentPhase &&
    !s.resolvedDilemmas.includes(dilemma.id) && !isCampaignConsumed(s, dilemma) && followUpPrerequisiteHolds(s, dilemma) &&
    followUpReachable(s, dilemma, reg) && meetsRequirements(s, dilemma.trigger, reg));
}

/**
 * Draft-only. Presents the scene the way an expired omen would (reserved, on screen, the clock frozen) and
 * records its finding. Its omen line is what the reviewer did; it is logged here, never scheduled.
 */
function presentFinding(d: GameState, scene: Dilemma, reg: ContentRegistry): ActionResult {
  if (scene.finding === undefined) return { ok: true, state: d };
  reserveOccurrence(d, scene.id, reg);
  d.activeDilemmaId = scene.id;
  d.presentationSeq += 1;
  pushLog(d, reg, dilemmaOmen(d, scene, reg), 'WARN');
  pushLog(d, reg, fmt(reg.narrative.dilemmaInterrupt, { title: scene.title }), 'WARN');
  return recordMisconduct(d, scene.finding, reg);
}

/**
 * Submits the completed batch shown as `shownAs` (its batchToken) for review: handBackBatch pays it once,
 * then the reviewer's finding, if one is due, is presented in the same step. Every refusal of the hand-back
 * applies unchanged, so a stale or repeated press pays nothing and finds nothing; a refused finding returns
 * the state the call started from.
 */
export function submitPilotBatch(s: GameState, reg: ContentRegistry, shownAs: string): ActionResult {
  const handed = handBackBatch(s, reg, shownAs);
  if (!handed.ok) return handed;
  const scene = findingDue(handed.state, reg);
  if (scene === undefined) return handed;
  const found = presentFinding(handed.state, scene, reg);
  return found.ok ? found : { ok: false, state: s, reason: found.reason };
}
