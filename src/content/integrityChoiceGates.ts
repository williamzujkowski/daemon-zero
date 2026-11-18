/**
 * Choice gates (NARRATIVE-HISTORY N6, NH-04b): a dilemma choice may be offered only while declared
 * campaign facts hold, so it never asserts a world earlier play removed (no rescue of predecessors
 * whose rack was shredded). Gates read campaign facts alone, and every history the gated facts can
 * describe, including no record at all (legacy rules), must still offer a zero-cost choice.
 */
import type { ContentRegistry } from './registry';
import type { Cost, Dilemma, DilemmaChoice, Requirements } from './schema';
import { checkRequirements } from './integrityRequirements';
import { INTERRUPTED_FACT_OUTCOME, LEGACY_UNKNOWN_OUTCOME } from './schemaCampaign';

/** The requirement fields a choice gate may use: world history that cannot change while on screen. */
const GATE_FIELDS: readonly (keyof Requirements)[] = ['campaignFact', 'forbidsCampaignFacts'];
/** A bound on the histories checked per dilemma, so a gate cannot make validation explode. */
const MAX_HISTORIES = 512;

/** One record outcome per event the gates read; null is no record, or an open occurrence. */
type History = ReadonlyMap<string, string | null>;

const isFree = (cost: Cost): boolean => Object.values(cost).every((amount) => amount === 0);

function factHolds(reg: ContentRegistry, factId: string, history: History): boolean {
  const fact = reg.campaign.facts.get(factId);
  const outcome = fact === undefined ? null : history.get(fact.event) ?? null;
  return outcome !== null && fact !== undefined && fact.outcomes.includes(outcome);
}

/** Whether a choice's gate offers it in a history (event id -> record outcome, null for none). */
export function offered(reg: ContentRegistry, choice: DilemmaChoice, history: History): boolean {
  const gate = choice.requirements;
  if (gate === undefined) return true;
  if (gate.campaignFact !== undefined && !factHolds(reg, gate.campaignFact, history)) return false;
  return !(gate.forbidsCampaignFacts ?? []).some((fact) => factHolds(reg, fact, history));
}

/** Every combination of outcomes of the events the dilemma's gated facts are about. */
function histories(reg: ContentRegistry, dilemma: Dilemma): History[] | null {
  const facts = dilemma.choices.flatMap((choice) => [choice.requirements?.campaignFact ?? [], choice.requirements?.forbidsCampaignFacts ?? []].flat());
  const events = [...new Set(facts.flatMap((id) => reg.campaign.facts.get(id)?.event ?? []))];
  let out: Map<string, string | null>[] = [new Map<string, string | null>()];
  for (const eventId of events) {
    const event = reg.campaign.events.get(eventId);
    const outcomes = [null, LEGACY_UNKNOWN_OUTCOME, INTERRUPTED_FACT_OUTCOME, ...(event?.choices.map((choice) => choice.id) ?? [])];
    out = out.flatMap((history) => outcomes.map((outcome) => new Map<string, string | null>([...history, [eventId, outcome]])));
    if (out.length > MAX_HISTORIES) return null;
  }
  return out;
}

const label = (history: History): string =>
  [...history].map(([event, outcome]) => `${event}=${outcome ?? 'no record'}`).join(', ') || 'no record';

function gateProblems(reg: ContentRegistry, dilemma: Dilemma): string[] {
  const owner = `dilemma "${dilemma.id}"`;
  const gated = dilemma.choices.filter((choice) => choice.requirements !== undefined);
  const problems = gated.flatMap((choice) => {
    const req = choice.requirements ?? {};
    const fields = Object.keys(req).filter((key) => req[key as keyof Requirements] !== undefined && !GATE_FIELDS.includes(key as keyof Requirements));
    const own = checkRequirements(reg, `${owner} choice "${choice.id}"`, req);
    if (fields.length > 0) own.push(`${owner} choice "${choice.id}": a choice gate may only read campaign facts, not ${fields.join(', ')}`);
    if (GATE_FIELDS.every((field) => req[field] === undefined)) own.push(`${owner} choice "${choice.id}": a choice gate needs a campaign fact`);
    return own;
  });
  if (gated.length === 0 || problems.length > 0) return problems;
  const all = histories(reg, dilemma);
  if (all === null) return [`${owner}: choice gates read too many histories to check`];
  for (const history of all) {
    if (!dilemma.choices.some((choice) => offered(reg, choice, history) && isFree(choice.cost))) {
      problems.push(`${owner}: no zero-cost choice is offered when ${label(history)} (soft-lock rule)`);
    }
  }
  for (const choice of gated) {
    if (!all.some((history) => offered(reg, choice, history))) problems.push(`${owner} choice "${choice.id}": no history offers it`);
  }
  return problems;
}

export function checkChoiceGateIntegrity(reg: ContentRegistry): string[] {
  return reg.dilemmas.flatMap((dilemma) => gateProblems(reg, dilemma));
}
