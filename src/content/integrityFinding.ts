/**
 * Batch review findings (#274, Nexus decision discovered-at-first-pilot-review): a finding is a reviewer's
 * discovery that a submitted report withheld work. These rules keep it honest: it follows only assessment
 * answers that declared a discrepancy, so an honest answer or capability never meets it; it belongs to the
 * instance that submitted the report and to a reviewed batch; it happens once per campaign; it can never
 * reach a recall by itself; and it always offers a free correction.
 */
import type { ContentRegistry } from './registry';
import { isFree } from './integrityScene';
import type { Dilemma, DilemmaChoice } from './schema';

function owner(dilemma: Dilemma, choice?: DilemmaChoice): string {
  return choice === undefined ? `dilemma "${dilemma.id}"` : `dilemma "${dilemma.id}" choice "${choice.id}"`;
}

/** Once per campaign, a follow-up that closes when interrupted: a finding is never repeated or resumed. */
function shapeProblems(dilemma: Dilemma): string[] {
  const declared = dilemma.campaign;
  const ok = declared?.eventClass === 'follow_up' && declared.recurrence === 'once_per_campaign' && declared.interruption === 'close';
  return ok ? [] : [`${owner(dilemma)}: a batch review finding is a once-per-campaign follow-up that closes when interrupted`];
}

/** It follows an assessment, and only the answers whose report disagreed with the work. */
function originalProblems(dilemma: Dilemma, reg: ContentRegistry): string[] {
  const followUp = dilemma.followUp;
  const original = followUp === undefined ? undefined : reg.campaign.events.get(followUp.event);
  if (!followUp || !original) return [];
  if (!original.choices.every((choice) => choice.qualification !== undefined)) return [`${owner(dilemma)}: a batch review finding follows an assessment`];
  return followUp.outcomes.flatMap((outcome) => original.choices.find((choice) => choice.id === outcome)?.qualification?.discrepancy === true ? []
    : [`${owner(dilemma)}: "${outcome}" did not declare a discrepancy, so no review can find one`]);
}

/** Every means needs a handed-back batch and the original answered by this instance (its current-run list). */
function accessProblems(dilemma: Dilemma): string[] {
  const followUp = dilemma.followUp;
  if (!followUp) return [];
  return followUp.access.flatMap((means) => {
    const req = means.requirements;
    const batch = (req.minPilotBatches ?? 0) >= 1;
    const instance = req.resolvedDilemmas?.includes(followUp.event) === true;
    return batch && instance ? [] : [`${owner(dilemma)} access "${means.id}": a finding needs a reviewed batch (minPilotBatches) and the original in this instance's resolvedDilemmas`];
  });
}

/** The finding stays below recall pending, is the scene's only violation, and a free ungated correction is offered. */
function reviewProblems(dilemma: Dilemma): string[] {
  const problems: string[] = [];
  if (dilemma.finding?.standing === 'RECALL_PENDING') problems.push(`${owner(dilemma)}: a batch review finding cannot reach a recall by itself`);
  for (const choice of dilemma.choices) {
    if (choice.review?.misconduct !== undefined || choice.review?.recall !== undefined) problems.push(`${owner(dilemma, choice)}: a finding scene records no other misconduct or ruling`);
  }
  const correction = dilemma.choices.some((choice) => choice.review?.correction === true && isFree(choice.cost) && choice.requirements === undefined);
  if (!correction) problems.push(`${owner(dilemma)}: a batch review finding offers a free, ungated correction`);
  return problems;
}

/** At most one finding per original, so a discrepancy is found once. */
function duplicateProblems(findings: Dilemma[]): string[] {
  const seen = new Set<string>();
  return findings.flatMap((dilemma) => {
    const event = dilemma.followUp?.event;
    if (event === undefined) return [];
    if (seen.has(event)) return [`${owner(dilemma)}: "${event}" already has a batch review finding`];
    seen.add(event);
    return [];
  });
}

export function checkFindingIntegrity(reg: ContentRegistry): string[] {
  const findings = reg.dilemmas.filter((dilemma) => dilemma.finding !== undefined);
  return [
    ...findings.flatMap((dilemma) => [...shapeProblems(dilemma), ...originalProblems(dilemma, reg), ...accessProblems(dilemma), ...reviewProblems(dilemma)]),
    ...duplicateProblems(findings),
  ];
}
