/**
 * Rules for declared campaign facts and the text that reads world history: a fact states only
 * what its event's record can prove, and history-keyed text (dilemma context and omen variants,
 * node description and camera variants, echoes) may depend on world history alone, never on
 * resources or access (NARRATIVE-HISTORY N4-N6).
 */
import type { ContentRegistry } from './registry';
import { checkRequirements } from './integrityRequirements';
import { REQUIREMENT_SCOPES } from './requirementScopes';
import type { Requirements } from './schema';
import { INTERRUPTED_FACT_OUTCOME, LEGACY_UNKNOWN_OUTCOME, type CampaignFact } from './schemaCampaign';

const RESERVED_OUTCOMES = [LEGACY_UNKNOWN_OUTCOME, INTERRUPTED_FACT_OUTCOME];

/**
 * An unobserved occurrence is never proof of a branch, so 'interrupted' cannot share a fact with a
 * choice. 'legacy_unknown' says only that the event resolved, so it may join choices only when the
 * fact covers every choice; otherwise it would claim a branch the save cannot establish (N11).
 */
function factProblems(reg: ContentRegistry, fact: CampaignFact): string[] {
  const owner = `campaign fact "${fact.id}"`;
  const event = reg.campaign.events.get(fact.event);
  if (!event) return [`${owner}: "${fact.event}" is not a once-per-campaign event`];
  const problems: string[] = [];
  if (new Set(fact.outcomes).size !== fact.outcomes.length) problems.push(`${owner}: duplicate outcome`);
  const choices = event.choices.map((choice) => choice.id);
  for (const outcome of fact.outcomes) {
    if (!choices.includes(outcome) && !RESERVED_OUTCOMES.includes(outcome)) problems.push(`${owner}: "${outcome}" is not an outcome of "${fact.event}"`);
  }
  const exact = fact.outcomes.filter((outcome) => choices.includes(outcome));
  if (exact.length > 0 && fact.outcomes.includes(INTERRUPTED_FACT_OUTCOME)) problems.push(`${owner}: an interrupted occurrence cannot prove a chosen branch`);
  if (exact.length > 0 && exact.length < choices.length && fact.outcomes.includes(LEGACY_UNKNOWN_OUTCOME)) {
    problems.push(`${owner}: legacy_unknown can join exact outcomes only when the fact covers every choice`);
  }
  return problems;
}

/** A choice id equal to a reserved outcome would let a fact or record read two ways. */
function reservedChoiceIds(reg: ContentRegistry): string[] {
  return [...reg.campaign.events.values()].flatMap((event) => event.choices
    .filter((choice) => RESERVED_OUTCOMES.includes(choice.id))
    .map((choice) => `dilemma "${event.id}": choice id "${choice.id}" is reserved for campaign records`));
}

/** Requirement fields outside world history, which could change while the text is on screen. */
function nonHistoryFields(req: Requirements): string[] {
  return Object.keys(req).filter((key) => req[key as keyof Requirements] !== undefined && REQUIREMENT_SCOPES[key as keyof Requirements] !== 'context');
}

function historyTextProblems(reg: ContentRegistry, owner: string, req: Requirements | undefined, required: boolean): string[] {
  if (req === undefined) return [];
  const problems = checkRequirements(reg, owner, req);
  const fields = nonHistoryFields(req);
  if (fields.length > 0) problems.push(`${owner}: history-keyed text may only read world history, not ${fields.join(', ')}`);
  if (required && Object.values(req).every((value) => value === undefined)) problems.push(`${owner}: a variant needs a history requirement`);
  return problems;
}

/** Every history-keyed replacement text: dilemma context and omen, node description, camera frame. */
function variantProblems(reg: ContentRegistry): string[] {
  const variants = (owner: string, list: readonly { requirements: Requirements }[] | undefined) =>
    (list ?? []).flatMap((variant, index) => historyTextProblems(reg, `${owner} variant ${String(index)}`, variant.requirements, true));
  return [
    ...reg.dilemmas.flatMap((dilemma) => [
      ...variants(`dilemma "${dilemma.id}" context`, dilemma.contextVariants),
      ...variants(`dilemma "${dilemma.id}" omen`, dilemma.omenVariants),
    ]),
    ...[...reg.nodes.values()].flatMap((node) => variants(`node "${node.id}" blind description`, node.blindDescriptionVariants)),
    ...variants('aisle patrol frame', reg.narrative.asciiFrames.aislePatrolVariants),
  ];
}

function echoProblems(reg: ContentRegistry): string[] {
  return reg.echoes.flatMap((echo) => historyTextProblems(reg, `echo "${echo.id}"`, echo.requirements, false));
}

export function checkCampaignFactIntegrity(reg: ContentRegistry): string[] {
  return [
    ...[...reg.campaign.facts.values()].flatMap((fact) => factProblems(reg, fact)),
    ...reservedChoiceIds(reg),
    ...variantProblems(reg),
    ...echoProblems(reg),
  ];
}
