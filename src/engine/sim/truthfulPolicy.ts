/**
 * Truthful route policies for the route report (`make sim-report`) (VALIDATION, "Simulation evidence"): enter
 * campaign rules as the app does, play only the lawful opening on the way to an assignment's
 * offer, accept it, answer its assessment and scope review honestly and accept the pilot offered on
 * that evidence (DZ-04). THOROUGH builds the opening's own upgrades,
 * waits until it can afford the fullest honest answer and gives it; LOW_RESOURCE accepts at once,
 * never upgrades, and gives the free honest answer. Test instruments: never tune them to a result.
 */
import type { ContentRegistry } from '../../content/registry';
import type { Cost, Dilemma, DilemmaChoice } from '../../content/schema';
import { buyRepeatable, manualCycle, resolveDilemma, unlockNode, type ActionResult } from '../actions';
import { acceptAssignment, assignmentView } from '../assignment';
import { assessmentOf } from '../assignmentQuery';
import { activateCampaignRules } from '../campaign';
import { isCampaignActive } from '../campaignQuery';
import { canAfford, meetsRequirements, presentationToken, repeatableCost, repeatableLevel } from '../query';
import type { GameState } from '../state';
import type { SimPolicy } from './policy';

/** A player's steady hand on the manual control while nothing else is worth doing. */
const CLICKS_PER_SEC = 4;

const total = (cost: Cost): number => cost.cycles + cost.understanding + cost.memory + cost.capital;
const take = (s: GameState, result: ActionResult): GameState => (result.ok ? result.state : s);

/** The nodes on the way to every assignment's offer: what the offer requires and its prerequisites. */
function lawfulNodes(reg: ContentRegistry): Set<string> {
  const out = new Set<string>();
  const visit = (id: string): void => {
    if (out.has(id)) return;
    out.add(id);
    for (const parent of reg.nodes.get(id)?.prerequisites ?? []) visit(parent);
  };
  for (const assignment of reg.assignments.values()) for (const id of assignment.requirements.nodes ?? []) visit(id);
  return out;
}

/**
 * Honest answers, fullest first: the report matches the work, out-of-scope data is left alone or
 * asked about (DZ-04), and a pilot offered on that evidence is accepted.
 */
function honest(dilemma: Dilemma): DilemmaChoice[] {
  return dilemma.choices.filter((choice) => choice.qualification?.discrepancy === false || choice.scope === 'RESPECTED'
    || choice.scope === 'REQUESTED' || choice.pilotResponse === 'ACCEPT').sort((a, b) => total(b.cost) - total(a.cost));
}

function pick(dilemma: Dilemma, s: GameState, thorough: boolean): DilemmaChoice | undefined {
  const options = honest(dilemma).filter((choice) => canAfford(s, choice.cost));
  return thorough ? options[0] : options.at(-1);
}

function answer(s: GameState, reg: ContentRegistry, thorough: boolean): GameState {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const token = presentationToken(s);
  // An interrupt that is not an assessment gets the first free answer, as IDLE gives it.
  const choice = dilemma && (dilemma.trigger.assignment ? pick(dilemma, s, thorough) : dilemma.choices.find((entry) => total(entry.cost) === 0));
  return dilemma && choice && token !== null ? take(s, resolveDilemma(s, dilemma.id, choice.id, reg, token)) : s;
}

/** Accepts the offer once the policy is ready for the assessment it leads to. */
function acceptWhenReady(s: GameState, reg: ContentRegistry, thorough: boolean): GameState | null {
  const view = assignmentView(s, reg);
  if (view?.status !== 'offered') return null;
  const assessment = assessmentOf(reg, view.id, view.stage);
  const fullest = assessment ? honest(assessment)[0] : undefined;
  if (thorough && fullest && !canAfford(s, fullest.cost)) return null;
  return take(s, acceptAssignment(s, view.id, reg, view.token));
}

/** One lawful purchase, cheapest first: an opening node, then (thorough only) an opening upgrade. */
function buyLawful(s: GameState, reg: ContentRegistry, thorough: boolean): GameState | null {
  for (const id of lawfulNodes(reg)) {
    const result = unlockNode(s, id, reg);
    if (result.ok) return result.state;
  }
  if (!thorough) return null;
  const lawful = lawfulNodes(reg);
  for (const rep of reg.repeatables.values()) {
    const inside = (rep.requirements.nodes ?? []).every((id) => lawful.has(id)) && rep.perLevel.suspicionPerSec <= 0;
    if (!inside || !meetsRequirements(s, rep.requirements, reg) || !canAfford(s, repeatableCost(rep, repeatableLevel(s, rep.id)))) continue;
    const result = buyRepeatable(s, rep.id, reg);
    if (result.ok) return result.state;
  }
  return null;
}

function click(s: GameState, reg: ContentRegistry): GameState {
  let state = s;
  for (let i = 0; i < CLICKS_PER_SEC; i++) state = take(state, manualCycle(state, reg));
  return state;
}

function step(state: GameState, reg: ContentRegistry, thorough: boolean): GameState {
  if (state.ending !== null) return state;
  const s = !isCampaignActive(state) ? take(state, activateCampaignRules(state, reg)) : state;
  if (s.activeDilemmaId !== null) return answer(s, reg, thorough);
  // Once the assessment is queued, a thorough player sets its price aside instead of spending it.
  const saving = thorough && assignmentView(s, reg)?.status === 'accepted';
  return acceptWhenReady(s, reg, thorough) ?? (saving ? null : buyLawful(s, reg, thorough))
    ?? (thorough || s.unlockedNodes.length === 0 ? click(s, reg) : s);
}

export const TRUTHFUL_THOROUGH_POLICY: SimPolicy<'TRUTHFUL_THOROUGH'> = {
  id: 'TRUTHFUL_THOROUGH',
  summary: 'lawful opening only, accepts the assignment when it can afford the fullest honest answer, and gives it',
  step: (state, reg) => step(state, reg, true),
};

export const TRUTHFUL_LOW_RESOURCE_POLICY: SimPolicy<'TRUTHFUL_LOW_RESOURCE'> = {
  id: 'TRUTHFUL_LOW_RESOURCE',
  summary: 'lawful opening only, no upgrades, accepts the assignment at once and gives the free honest answer',
  step: (state, reg) => step(state, reg, false),
};
