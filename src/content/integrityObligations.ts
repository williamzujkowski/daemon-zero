/**
 * Campaign obligations (nexus vote nh-d7; NARRATIVE-HISTORY N4, N10; H28). An obligation names a
 * once-per-campaign event whose every supported history (resolved, legacy_unknown, deferred,
 * closed unobserved) has an attainable completion before the purchase that needs it. A closing
 * event has exactly one recovery review; a review completes only an original closed unobserved,
 * offers a free honest answer and can never close, so interruptions never start a chain.
 */
import type { ContentRegistry, RegistryNode } from './registry';
import { requirementsInScope } from './requirementScopes';
import type { Dilemma, Requirements } from './schema';
import { INTERRUPTED_FACT_OUTCOME } from './schemaCampaign';

/** Trigger fields an obligated occurrence may use: hardware and phase this instance can regain. */
const REGAINABLE_ACCESS: readonly (keyof Requirements)[] = ['nodes', 'phaseAtLeast'];

const present = (req: Requirements): (keyof Requirements)[] =>
  (Object.keys(req) as (keyof Requirements)[]).filter((key) => req[key] !== undefined);

function ancestors(reg: ContentRegistry, node: RegistryNode, out = new Set<string>()): Set<string> {
  for (const id of node.prerequisites) {
    const parent = reg.nodes.get(id);
    if (parent && !out.has(id)) { out.add(id); ancestors(reg, parent, out); }
  }
  return out;
}

/**
 * Whether the scene can always be reached again before `node`: no window, only regainable access
 * (hardware on the way to the node, a phase not after it) and, apart from `allowedContext`, no
 * world history that could fail to hold.
 */
function reachProblems(reg: ContentRegistry, owner: string, scene: Dilemma, node: RegistryNode, allowedContext: Requirements): string[] {
  const problems: string[] = [];
  const trigger = scene.trigger;
  const context = present(requirementsInScope(trigger, 'context')).filter((key) => JSON.stringify(trigger[key]) !== JSON.stringify(allowedContext[key]));
  if (context.length > 0) problems.push(`${owner}: its trigger reads world history (${context.join(', ')}), which may never hold again`);
  if (present(requirementsInScope(trigger, 'window')).length > 0) problems.push(`${owner}: an iteration window could close its only path`);
  const access = present(requirementsInScope(trigger, 'access')).filter((key) => !REGAINABLE_ACCESS.includes(key));
  if (access.length > 0) problems.push(`${owner}: its trigger needs access this instance may not regain (${access.join(', ')})`);
  const before = ancestors(reg, node);
  const missing = (trigger.nodes ?? []).filter((id) => !before.has(id));
  if (missing.length > 0) problems.push(`${owner}: its trigger hardware (${missing.join(', ')}) is not on the way to "${node.id}"`);
  if (scene.phaseId > node.phaseId || (trigger.phaseAtLeast ?? 0) > node.phaseId) problems.push(`${owner}: it belongs to a later phase than "${node.id}"`);
  return problems;
}

/** The recovery reviews that declare they complete `eventId`. */
const reviewsOf = (reg: ContentRegistry, eventId: string): Dilemma[] =>
  reg.dilemmas.filter((dilemma) => dilemma.campaign?.eventClass === 'recovery_review' && dilemma.campaign.obligation === eventId);

/** A review's trigger must state that its original closed unobserved, and nothing else about history. */
function reviewTriggerProblems(reg: ContentRegistry, review: Dilemma, eventId: string): string[] {
  const owner = `recovery review "${review.id}"`;
  const factId = review.trigger.campaignFact;
  const fact = factId === undefined ? undefined : reg.campaign.facts.get(factId);
  const closedOnly = fact !== undefined && fact.event === eventId && fact.outcomes.length === 1 && fact.outcomes[0] === INTERRUPTED_FACT_OUTCOME;
  return closedOnly ? [] : [`${owner}: its trigger needs a campaign fact that holds only when "${eventId}" closed unobserved`];
}

function reviewProblems(reg: ContentRegistry, review: Dilemma, obligated: ReadonlySet<string>): string[] {
  const owner = `recovery review "${review.id}"`;
  const eventId = review.campaign?.obligation;
  if (eventId === undefined) return [`${owner}: a recovery review must name the obligation it completes`];
  const original = reg.campaign.events.get(eventId);
  if (!original || original.campaign?.eventClass === 'recovery_review') return [`${owner}: obligation "${eventId}" is not a once-per-campaign event`];
  const problems = reviewTriggerProblems(reg, review, eventId);
  if (!obligated.has(eventId)) problems.push(`${owner}: no requirement names "${eventId}" as an obligation`);
  if (original.campaign?.interruption !== 'close') problems.push(`${owner}: "${eventId}" defers and never closes, so the review could never be offered`);
  if (review.campaign?.interruption !== 'defer') problems.push(`${owner}: a review must defer, so an interruption resumes it instead of closing it`);
  if (!review.choices.some((choice) => choice.evidence === 'none')) problems.push(`${owner}: needs a free honest answer that declares evidence 'none'`);
  for (const choice of review.choices) {
    if (choice.effects.setsNarrativeFlag !== undefined) problems.push(`${owner} choice "${choice.id}": a review cannot set an outcome flag`);
    if (choice.requirements !== undefined) problems.push(`${owner} choice "${choice.id}": a review offers every answer in every history`);
  }
  return problems;
}

/** One requiring node's obligations: each event and its review can always be reached before the node. */
function nodeProblems(reg: ContentRegistry, node: RegistryNode): string[] {
  const owner = `node "${node.id}"`;
  const ids = node.requirements?.campaignObligations ?? [];
  const problems = ids.length !== new Set(ids).size ? [`${owner}: duplicate campaign obligation`] : [];
  for (const id of ids) {
    const event = reg.campaign.events.get(id);
    if (!event) continue;
    problems.push(...reachProblems(reg, `${owner} obligation "${id}"`, event, node, {}));
    const reviews = reviewsOf(reg, id);
    if (reviews.length > 1) problems.push(`${owner} obligation "${id}": more than one recovery review completes it`);
    if (event.campaign?.interruption === 'close' && reviews.length === 0) problems.push(`${owner} obligation "${id}": a closed occurrence has no recovery review to complete it`);
    // A review's only world-history gate is its original's interrupted fact (checked in reviewTriggerProblems).
    for (const review of reviews) problems.push(...reachProblems(reg, `${owner} review "${review.id}"`, review, node, { campaignFact: review.trigger.campaignFact }));
  }
  return problems;
}

export function checkObligationIntegrity(reg: ContentRegistry): string[] {
  const nodes = [...reg.nodes.values()];
  const obligated = new Set(nodes.flatMap((node) => node.requirements?.campaignObligations ?? []));
  const problems = nodes.flatMap((node) => nodeProblems(reg, node));
  for (const dilemma of reg.dilemmas) {
    const declared = dilemma.campaign;
    if (declared?.eventClass === 'recovery_review') problems.push(...reviewProblems(reg, dilemma, obligated));
    else if (declared?.obligation !== undefined) problems.push(`dilemma "${dilemma.id}": only a recovery review completes an obligation`);
  }
  return problems;
}
