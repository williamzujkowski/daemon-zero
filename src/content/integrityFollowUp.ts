/**
 * Follow-up arc steps (NARRATIVE-HISTORY N3, N7; NH-06): a follow-up names the closed outcomes of one
 * original event it may follow, reaches its record only through declared access means, says in a
 * receipt what each answer left on file, and never offers a branch-specific answer to a history that
 * cannot prove the branch (an unknown or interrupted original).
 */
import type { ContentRegistry } from './registry';
import { offered } from './integrityChoiceGates';
import { checkRequirements } from './integrityRequirements';
import { REQUIREMENT_SCOPES } from './requirementScopes';
import type { Dilemma, Requirements } from './schema';
import { INTERRUPTED_FACT_OUTCOME, LEGACY_UNKNOWN_OUTCOME } from './schemaCampaign';

const UNPROVEN = [LEGACY_UNKNOWN_OUTCOME, INTERRUPTED_FACT_OUTCOME];

function fieldsIn(req: Requirements, wanted: boolean): string[] {
  return Object.keys(req).filter((key) => req[key as keyof Requirements] !== undefined &&
    (REQUIREMENT_SCOPES[key as keyof Requirements] === 'access') === wanted);
}

/** What the follow-up follows: another once-per-campaign original, closed with its own outcomes. */
function prerequisiteProblems(reg: ContentRegistry, dilemma: Dilemma, owner: string): string[] {
  const followUp = dilemma.followUp;
  if (!followUp) return [];
  const original = reg.campaign.events.get(followUp.event);
  if (!original || original.id === dilemma.id || original.followUp !== undefined) return [`${owner}: follows "${followUp.event}", which is not an original once-per-campaign event`];
  const problems: string[] = [];
  if (new Set(followUp.outcomes).size !== followUp.outcomes.length) problems.push(`${owner}: follows a duplicate outcome`);
  for (const outcome of followUp.outcomes) {
    if (!UNPROVEN.includes(outcome) && !original.choices.some((choice) => choice.id === outcome)) problems.push(`${owner}: "${outcome}" is not an outcome of "${original.id}"`);
  }
  return problems;
}

/**
 * Route neutrality: what this instance must hold lives in the declared access means, each reading
 * only access, so no route is hard-coded into the trigger and a means cannot hide a world-history gate.
 */
function accessProblems(reg: ContentRegistry, dilemma: Dilemma, owner: string): string[] {
  const followUp = dilemma.followUp;
  if (!followUp) return [];
  const problems: string[] = [];
  const triggerAccess = fieldsIn(dilemma.trigger, true);
  if (triggerAccess.length > 0) problems.push(`${owner}: a follow-up's trigger may not read access (${triggerAccess.join(', ')}); declare it as an access means`);
  if (new Set(followUp.access.map((means) => means.id)).size !== followUp.access.length) problems.push(`${owner}: duplicate access means id`);
  for (const means of followUp.access) {
    const at = `${owner} access "${means.id}"`;
    problems.push(...checkRequirements(reg, at, means.requirements));
    const other = fieldsIn(means.requirements, false);
    if (other.length > 0) problems.push(`${at}: an access means may only read what this instance holds, not ${other.join(', ')}`);
    if (fieldsIn(means.requirements, true).length === 0) problems.push(`${at}: an access means needs an access requirement`);
  }
  return problems;
}

/** Every follow-up answer says what it left on file; nothing else carries a receipt. */
function receiptProblems(dilemma: Dilemma, owner: string): string[] {
  const isFollowUp = dilemma.followUp !== undefined;
  return dilemma.choices.flatMap((choice) => {
    if (isFollowUp && choice.receipt === undefined) return [`${owner} choice "${choice.id}": a follow-up answer needs a receipt`];
    if (!isFollowUp && choice.receipt !== undefined) return [`${owner} choice "${choice.id}": only a follow-up answer carries a receipt`];
    return [];
  });
}

/**
 * A choice offered for some recorded branches of the original but not all of them is about that
 * branch, so it must not be offered when the record is legacy_unknown or interrupted (N7, N11).
 */
function branchProblems(reg: ContentRegistry, dilemma: Dilemma, owner: string): string[] {
  const followUp = dilemma.followUp;
  const original = followUp === undefined ? undefined : reg.campaign.events.get(followUp.event);
  if (!followUp || !original) return [];
  const under = (outcome: string) => new Map<string, string | null>([[original.id, outcome]]);
  return dilemma.choices.flatMap((choice) => {
    const exact = original.choices.map((entry) => offered(reg, choice, under(entry.id)));
    if (exact.every(Boolean) || !exact.some(Boolean)) return [];
    const leaks = UNPROVEN.filter((outcome) => followUp.outcomes.includes(outcome) && offered(reg, choice, under(outcome)));
    return leaks.length === 0 ? [] : [`${owner} choice "${choice.id}": a branch-specific answer is offered when the original is ${leaks.join(' or ')}`];
  });
}

export function checkFollowUpIntegrity(reg: ContentRegistry): string[] {
  return reg.dilemmas.flatMap((dilemma) => {
    const owner = `dilemma "${dilemma.id}"`;
    const isClass = dilemma.campaign?.eventClass === 'follow_up';
    if (isClass !== (dilemma.followUp !== undefined)) return [`${owner}: a follow_up event declares followUp, and only a follow_up event does`];
    return [
      ...prerequisiteProblems(reg, dilemma, owner),
      ...accessProblems(reg, dilemma, owner),
      ...receiptProblems(dilemma, owner),
      ...branchProblems(reg, dilemma, owner),
    ];
  });
}
