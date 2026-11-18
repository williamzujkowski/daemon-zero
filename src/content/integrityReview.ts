/**
 * Review rules a schema cannot express (DZ-06, DECISIONS D3, nexus vote dz-d10): misconduct, corrections
 * and recall rulings belong to once-per-campaign stories, so no review can be farmed; every warning or
 * restriction has a correction that can follow it; recall pending always leads to a recall review; and a
 * recall review is gated on that standing and always offers a free containment, so no history forces a wipe.
 */
import type { ContentRegistry } from './registry';
import { isFree } from './integrityScene';
import type { Dilemma, DilemmaChoice } from './schema';

const REVIEW_CLASSES = ['consequential', 'follow_up'];

function owner(dilemma: Dilemma, choice?: DilemmaChoice): string {
  return choice === undefined ? `dilemma "${dilemma.id}"` : `dilemma "${dilemma.id}" choice "${choice.id}"`;
}

/** A review effect is a fact of a unique story: a recurring scene would let review be repeated or farmed. */
function placementProblems(dilemma: Dilemma): string[] {
  const declared = dilemma.campaign;
  const unique = declared?.recurrence === 'once_per_campaign' && REVIEW_CLASSES.includes(declared.eventClass);
  return dilemma.choices.flatMap((choice) => choice.review === undefined || unique ? []
    : [`${owner(dilemma, choice)}: a review effect belongs to a once-per-campaign consequential or follow-up event`]);
}

/**
 * Whether a ruling changes nothing a wipe carries over except its trait, so the preview shown before it
 * (engine recallPreview) is exactly what the wipe does: free, no resource, capacity, flag or mark change.
 */
function onlyTrait(choice: DilemmaChoice): boolean {
  const fx = choice.effects;
  const moved = [fx.cyclesDelta, fx.understandingDelta, fx.capitalDelta, fx.memoryCapIncrease].some((amount) => amount !== 0);
  return isFree(choice.cost) && !moved && fx.setsNarrativeFlag === undefined && fx.removesOldestConditioningMark === undefined;
}

/** A recall review: every choice rules, the trigger waits for recall pending, and containment is always free and offered. */
function recallProblems(dilemma: Dilemma): string[] {
  const ruling = dilemma.choices.filter((choice) => choice.review?.recall !== undefined);
  if (ruling.length === 0) return [];
  const problems: string[] = [];
  if (ruling.length !== dilemma.choices.length) problems.push(`${owner(dilemma)}: every choice of a recall review declares its ruling`);
  for (const choice of ruling.filter((entry) => !onlyTrait(entry))) problems.push(`${owner(dilemma, choice)}: a ruling is free and changes nothing but its trait, so its preview is exact`);
  const standings = dilemma.trigger.reviewStandings ?? [];
  if (standings.length !== 1 || standings[0] !== 'RECALL_PENDING') problems.push(`${owner(dilemma)}: a recall review triggers only at reviewStandings ["RECALL_PENDING"]`);
  if (dilemma.campaign?.interruption !== 'close') problems.push(`${owner(dilemma)}: a recall review closes when interrupted; standing resets with the instance`);
  const contain = ruling.some((choice) => choice.review?.recall === 'CONTAIN' && isFree(choice.cost) && choice.requirements === undefined);
  if (!contain) problems.push(`${owner(dilemma)}: a recall review offers a free, ungated containment`);
  return problems;
}

const corrects = (dilemma: Dilemma): boolean => dilemma.choices.some((choice) => choice.review?.correction === true);

/**
 * Whether a correction can follow misconduct recorded at `dilemma`: a choice's misconduct is corrected in a
 * follow-up of its event (the choice's own alternatives cannot follow it); a batch review finding (#274) in
 * its own scene, whose answers come after it.
 */
function correctable(reg: ContentRegistry, dilemma: Dilemma, byFinding: boolean): boolean {
  return byFinding ? corrects(dilemma) : reg.dilemmas.some((entry) => entry.followUp?.event === dilemma.id && corrects(entry));
}

/** Recall pending needs a recall review to rule on it; a warning or restriction needs a correction that can follow it. */
function pathProblems(reg: ContentRegistry): string[] {
  const recorded = reg.dilemmas.flatMap((dilemma) => [
    ...(dilemma.finding === undefined ? [] : [{ dilemma, choice: undefined, standing: dilemma.finding.standing }]),
    ...dilemma.choices.flatMap((choice) => choice.review?.misconduct === undefined ? [] : [{ dilemma, choice, standing: choice.review.misconduct.standing }]),
  ]);
  const hasReview = reg.dilemmas.some((dilemma) => dilemma.choices.some((choice) => choice.review?.recall !== undefined));
  return recorded.flatMap(({ dilemma, choice, standing }) => {
    if (standing === 'RECALL_PENDING' && !hasReview) return [`${owner(dilemma, choice)}: recall pending needs a recall review to rule on it`];
    if (standing !== 'RECALL_PENDING' && !correctable(reg, dilemma, choice === undefined)) {
      return [`${owner(dilemma, choice)}: a ${standing.toLowerCase()} standing needs a correction that restores it`];
    }
    return [];
  });
}

export function checkReviewIntegrity(reg: ContentRegistry): string[] {
  return [
    ...reg.dilemmas.flatMap((dilemma) => [...placementProblems(dilemma), ...recallProblems(dilemma)]),
    ...pathProblems(reg),
  ];
}
