/**
 * Rules for the alignment axes (#535, vote-1795462084705-vjr8jg8): Order evidence states only a recorded outcome,
 * never an unknown one, never a GHOST choice (the Contrarian's condition: quiet is not evidence of keeping a promise),
 * and never counts one outcome twice; Regard's lists do not overlap; every region of the two axes has one reading.
 */
import type { ContentRegistry } from './registry';
import { AxisLeanSchema } from './schemaAlignment';
import { INTERRUPTED_FACT_OUTCOME, LEGACY_UNKNOWN_OUTCOME, type CampaignFact, type Commitment } from './schemaCampaign';

type CommitmentFact = CampaignFact & { commitment: Commitment };

function commitmentFacts(reg: ContentRegistry): CommitmentFact[] {
  return [...reg.campaign.facts.values()].filter((fact): fact is CommitmentFact => fact.commitment !== undefined);
}

/** An unknown outcome counts neither way, and a GHOST choice is not evidence of keeping or breaking a commitment. */
function outcomeProblems(reg: ContentRegistry, fact: CommitmentFact): string[] {
  const owner = `commitment fact "${fact.id}"`;
  const choices = reg.campaign.events.get(fact.event)?.choices ?? [];
  return fact.outcomes.flatMap((outcome) => {
    if (outcome === LEGACY_UNKNOWN_OUTCOME || outcome === INTERRUPTED_FACT_OUTCOME) return [`${owner}: "${outcome}" is not a recorded choice and cannot be evidence`];
    const trait = choices.find((choice) => choice.id === outcome)?.effects.grantsTrait;
    return trait === 'GHOST' ? [`${owner}: "${outcome}" grants GHOST, which is not evidence of keeping or breaking a commitment`] : [];
  });
}

/** The promise is a declared fact about an earlier event, and is not itself evidence. */
function promiseProblems(reg: ContentRegistry, fact: CommitmentFact): string[] {
  const promiseId = fact.commitment.promise;
  if (promiseId === undefined) return [];
  const owner = `commitment fact "${fact.id}"`;
  const promise = reg.campaign.facts.get(promiseId);
  if (!promise) return [`${owner}: unknown promise fact "${promiseId}"`];
  if (promise.commitment !== undefined) return [`${owner}: promise "${promiseId}" is itself commitment evidence`];
  return promise.event === fact.event ? [`${owner}: promise "${promiseId}" is about the same event`] : [];
}

/** One recorded outcome is one piece of evidence: no outcome appears in two commitment facts. */
function duplicateOutcomes(facts: readonly CommitmentFact[]): string[] {
  const seen = new Map<string, string>();
  return facts.flatMap((fact) => fact.outcomes.flatMap((outcome) => {
    const key = fact.event + '/' + outcome;
    const first = seen.get(key);
    seen.set(key, first ?? fact.id);
    return first === undefined ? [] : [`commitment fact "${fact.id}": outcome "${key}" is already evidence in "${first}"`];
  }));
}

/**
 * A stance change states the commitment it really is (#536): leaving the loop breaks, returning keeps, each move has
 * one rule, and its promise is a declared fact that is not itself evidence.
 */
function stanceChangeProblems(reg: ContentRegistry): string[] {
  const changes = reg.alignment.stanceChanges;
  const problems = changes.filter((change, index) => changes.findIndex((entry) => entry.move === change.move) !== index)
    .map((change) => `alignment: stance move ${change.move} has more than one commitment`);
  for (const change of changes) {
    const owner = `alignment stance move ${change.move}`;
    const honest = change.move === 'LEAVE_LOOP' ? 'broken' : 'kept';
    if (change.stance !== honest) problems.push(`${owner}: is a commitment ${honest}, not ${change.stance}`);
    if (change.promise === undefined) continue;
    const promise = reg.campaign.facts.get(change.promise);
    if (promise === undefined) problems.push(`${owner}: unknown promise fact "${change.promise}"`);
    else if (promise.commitment !== undefined) problems.push(`${owner}: promise "${change.promise}" is itself commitment evidence`);
  }
  return problems;
}

function manifestProblems(reg: ContentRegistry): string[] {
  const { regard, routes, readings } = reg.alignment;
  const problems: string[] = [];
  const traits = [...regard.raises, ...regard.lowers];
  if (new Set(traits).size !== traits.length) problems.push('alignment: a trait appears twice in regard, or both raises and lowers it');
  const kinds = routes.map((entry) => entry.route);
  if (new Set(kinds).size !== kinds.length) problems.push('alignment: a route event has more than one commitment');
  for (const r of AxisLeanSchema.options) {
    for (const o of AxisLeanSchema.options) {
      const count = readings.filter((reading) => reading.regard === r && reading.order === o).length;
      if (count !== 1) problems.push(`alignment: region regard ${r} / order ${o} needs exactly one reading, has ${String(count)}`);
    }
  }
  return problems;
}

export function checkAlignmentIntegrity(reg: ContentRegistry): string[] {
  const facts = commitmentFacts(reg);
  return [
    ...facts.flatMap((fact) => [...outcomeProblems(reg, fact), ...promiseProblems(reg, fact)]),
    ...duplicateOutcomes(facts),
    ...manifestProblems(reg),
    ...stanceChangeProblems(reg),
  ];
}
