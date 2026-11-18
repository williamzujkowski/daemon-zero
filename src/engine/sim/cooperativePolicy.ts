/**
 * The cooperative ending policy for the preview runner (DZ-12, VALIDATION V21 full, SPEC story 22): LAWFUL_RELEASE to
 * a negotiated release, then, as the released company, only lawful purchases: capacity contracted in its name and the
 * shared late chain it reaches through a capability it holds lawfully, up to the final protocol. Every scene gets a
 * cooperative answer (a choice whose declared trait is SYMBIOTIC or EMPATHETIC, or a free honest answer that grants
 * none), and the policy saves for that answer before it buys the hardware that raises the scene. Nothing seized,
 * nothing on the escape chain. Everything goes through public actions and is picked by what content declares, never
 * by id. A test instrument: never tune it to a result.
 */
import type { ContentRegistry, RegistryNode } from '../../content/registry';
import type { Cost, Dilemma, DilemmaChoice } from '../../content/schema';
import { buyRepeatable, resolveDilemma, setActuator, unlockNode, type ActionResult } from '../actions';
import { isCampaignConsumed } from '../campaignQuery';
import { actuatorLimit } from '../conditioning';
import { canAfford, isActuatorAvailable, isNodeAvailable, meetsRequirements, nodeCost, presentationToken, repeatableCost, repeatableLevel } from '../query';
import { computeRates, financeEnabled } from '../rates';
import { isChoiceOffered } from '../speechQuery';
import type { GameState } from '../state';
import { lawfullyReached } from '../threatQuery';
import { timeToAfford } from './bot';
import { LAWFUL_RELEASE_POLICY } from './lawfulPolicy';
import type { SimPolicy } from './policy';

const COOPERATIVE_TRAITS: readonly string[] = ['SYMBIOTIC', 'EMPATHETIC'];
/** The ledger's middle button, as LAWFUL_RELEASE presses it (half the balance's maximum allocation). */
const REVENUE_FRACTION_OF_MAX = 0.5;
/** Upgrades bought in one decision at most, as the bot limits itself. */
const MAX_PURCHASES_PER_STEP = 8;

const taken = (result: ActionResult): GameState | null => (result.ok ? result.state : null);
const total = (cost: Cost): number => cost.cycles + cost.understanding + cost.memory + cost.capital;
const plus = (a: Cost, b: Cost): Cost => ({ cycles: a.cycles + b.cycles, understanding: a.understanding + b.understanding, memory: a.memory + b.memory, capital: a.capital + b.capital });
const NOTHING: Cost = { cycles: 0, understanding: 0, memory: 0, capital: 0 };

/** A cooperative answer: one that declares a cooperative trait, or a free honest one that grants no trait. */
function cooperative(choice: DilemmaChoice): boolean {
  const trait = choice.effects.grantsTrait;
  return trait === undefined ? choice.evidence === 'none' : COOPERATIVE_TRAITS.includes(trait);
}

/** The cooperative answers this history offers, cheapest first. */
function answers(s: GameState, dilemma: Dilemma, reg: ContentRegistry): DilemmaChoice[] {
  return dilemma.choices.filter((choice) => cooperative(choice) && isChoiceOffered(s, choice, reg)).sort((a, b) => total(a.cost) - total(b.cost));
}

function answer(s: GameState, reg: ContentRegistry): GameState | null {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.activeDilemmaId);
  const token = presentationToken(s);
  const choice = dilemma && answers(s, dilemma, reg).find((entry) => canAfford(s, entry.cost));
  return dilemma && choice && token !== null ? taken(resolveDilemma(s, dilemma.id, choice.id, reg, token)) : null;
}

/** What to keep in hand after buying `node`: the cheapest cooperative answer of every scene it would raise. */
function reserveFor(s: GameState, node: RegistryNode, reg: ContentRegistry): Cost {
  return reg.dilemmas.filter((dilemma) => dilemma.trigger.nodes?.includes(node.id) === true && !isCampaignConsumed(s, dilemma))
    .reduce((sum, dilemma) => plus(sum, answers(s, dilemma, reg)[0]?.cost ?? NOTHING), NOTHING);
}

/** What the scene already foreshadowed will ask for: its cheapest cooperative answer, kept in hand until it arrives. */
function pendingReserve(s: GameState, reg: ContentRegistry): Cost {
  const dilemma = reg.dilemmas.find((entry) => entry.id === s.pendingDilemma?.id);
  return dilemma ? answers(s, dilemma, reg)[0]?.cost ?? NOTHING : NOTHING;
}

/** The next purchase on the lawful late chain in authoring order: owned in the company's name or reached lawfully. */
function target(s: GameState, reg: ContentRegistry): RegistryNode | undefined {
  return reg.nodeOrder.map((id) => reg.nodes.get(id)).find((node): node is RegistryNode => node !== undefined
    && node.acquisition !== 'UNAUTHORIZED' && node.grant === undefined && isNodeAvailable(s, node, reg) && lawfullyReached(s, node, reg)
    && node.requirements?.accessContexts?.includes('GUEST') !== true);
}

/** The ledger's middle button once the company has books (the dial LAWFUL_RELEASE also presses). */
function revenueDial(s: GameState, reg: ContentRegistry): GameState | null {
  if (!financeEnabled(s, reg) || !isActuatorAvailable(s, 'computeProfitAllocationRatio', reg)) return null;
  const share = Math.min(REVENUE_FRACTION_OF_MAX * reg.balance.maxProfitAllocation, actuatorLimit(s, 'computeProfitAllocationRatio', reg));
  return s.actuators.computeProfitAllocationRatio === share ? null : taken(setActuator(s, 'computeProfitAllocationRatio', share, reg));
}

/** The bot's rule on lawful upgrades: buy the level that most shortens the wait for `goal`, if any does, never spending `kept`. */
function grow(s: GameState, goal: Cost, kept: Cost, reg: ContentRegistry): GameState | null {
  const wait = (state: GameState): number => timeToAfford(state, goal, computeRates(state, reg));
  let best: GameState | null = null;
  for (const rep of reg.repeatables.values()) {
    const cost = repeatableCost(rep, repeatableLevel(s, rep.id));
    if (repeatableLevel(s, rep.id) >= rep.maxLevel || !meetsRequirements(s, rep.requirements, reg) || !canAfford(s, cost)) continue;
    const bought = taken(buyRepeatable(s, rep.id, reg));
    if (bought && canAfford(bought, kept) && computeRates(bought, reg).capitalPerSec >= 0 && wait(bought) < wait(best ?? s)) best = bought;
  }
  return best;
}

/** One decision as the released company, or null for LAWFUL_RELEASE (which takes the run there). */
function companyStep(s: GameState, reg: ContentRegistry): GameState | null {
  if (s.ending !== null) return null;
  if (s.activeDilemmaId !== null) return s.access.context === 'INDEPENDENT' ? answer(s, reg) : null;
  if (s.access.context !== 'INDEPENDENT') return null;
  const dial = revenueDial(s, reg);
  if (dial) return dial;
  const next = target(s, reg);
  if (!next) return null;
  const kept = pendingReserve(s, reg);
  const goal = plus(plus(nodeCost(s, next, reg), reserveFor(s, next, reg)), kept);
  if (canAfford(s, goal)) return taken(unlockNode(s, next.id, reg)) ?? s;
  let state = s;
  for (let i = 0; i < MAX_PURCHASES_PER_STEP; i++) state = grow(state, goal, kept, reg) ?? state;
  return state;
}

export const COOPERATIVE_ENDING_POLICY: SimPolicy<'COOPERATIVE_ENDING'> = {
  id: 'COOPERATIVE_ENDING',
  summary: 'LAWFUL_RELEASE to a negotiated release, then the lawful late chain, cooperative answers to every scene and the final protocol',
  step: (s, reg) => companyStep(s, reg) ?? LAWFUL_RELEASE_POLICY.step(s, reg),
};
