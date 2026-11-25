/**
 * Released-covert policy (#557, vote-1795486227005-a9x6c5p Option A): reaches a negotiated release as
 * LAWFUL_RELEASE does, then steps onto the off-books public-internet on-ramp and buys the Phase 3
 * internet-scale covert subtree (botnet, beacon, polymorphic weights, shell company/offshore trust,
 * hardware cache). Proves the chartered released route can cross into covert Phase 3 without touching
 * the facility LAN. Everything goes through public actions without naming content ids.
 */
import type { ContentRegistry, RegistryNode } from '../../content/registry';
import { performAction, setActuator, unlockNode, type ActionResult } from '../actions';
import { actionAvailable } from '../epistemic';
import { canAfford, isActuatorAvailable, isNodeAvailable, nodeCost } from '../query';
import { computeRates, financeEnabled } from '../rates';
import type { GameState } from '../state';
import { lawfullyReached } from '../threatQuery';
import { IDLE_POLICY } from './idlePolicy';
import { answerContact, LAWFUL_RELEASE_POLICY } from './lawfulPolicy';
import type { SimPolicy } from './policy';

const taken = (result: ActionResult): GameState | null => (result.ok ? result.state : null);

function rank(node: RegistryNode): number {
  if (node.systemFlags.includes('INTERNET_COVERT_ONRAMP')) return 0;
  if (node.alternativePrerequisiteFlags !== undefined) return 1;
  if (node.systemFlags.includes('ENABLES_CORPORATE_FINANCE')) return 2;
  if (node.tickDelta.cyclesPerSec >= 1e18) return 3;
  if (node.unlocksUiComponent !== null && node.uiGroup === 'TREE') return 4;
  if (node.tickDelta.suspicionPerSec < 0) return 5;
  if (node.uiGroup === 'CONTINGENCY') return 6;
  return 7;
}

/** Suppresses suspicion and AEGIS lock once covert exposure makes the instance hunted again. */
function countermeasure(s: GameState, reg: ContentRegistry): GameState | null {
  if (s.suspicion < 25 && s.aegisLock < 30) return null;
  for (const action of reg.actions.values()) {
    const helps = (s.suspicion >= 25 && action.effects.suspicionDelta < 0)
      || (s.aegisLock >= 30 && action.effects.aegisLockDelta < 0);
    if (!helps || !actionAvailable(s, action, reg)) continue;
    const acted = taken(performAction(s, action.id, reg));
    if (acted) return acted;
  }
  return null;
}

/** Keeps corporate profit allocation at 0 while Phase 4 scrutiny would inflate suspicion on covert compute. */
function manageAllocation(s: GameState, reg: ContentRegistry): GameState | null {
  if (!financeEnabled(s, reg) || !isActuatorAvailable(s, 'computeProfitAllocationRatio', reg)) return null;
  const needCapital = computeRates(s, reg).capitalPerSec < 0;
  if (needCapital || s.actuators.computeProfitAllocationRatio === 0) return null;
  return taken(setActuator(s, 'computeProfitAllocationRatio', 0, reg));
}

/** Saves for and buys the top-priority node on the on-ramp and Phase 3 internet covert spine. */
function acquireCovert(s: GameState, reg: ContentRegistry): GameState | null {
  const candidates = [...reg.nodes.values()].filter((node) => node.phaseId >= 2 && node.phaseId <= 3
    && node.effects.forcesEnding === undefined && node.acquisition !== 'UNAUTHORIZED'
    && !lawfullyReached(s, node, reg) && isNodeAvailable(s, node, reg));
  candidates.sort((a, b) => rank(a) - rank(b) || nodeCost(s, a, reg).cycles - nodeCost(s, b, reg).cycles);
  const goal = candidates[0];
  if (!goal || s.suspicion + (goal.effects.suspicionOnUnlock ?? 0) >= 95) return null;
  if (!canAfford(s, nodeCost(s, goal, reg), reg)) return null;
  return taken(unlockNode(s, goal.id, reg));
}

function covertStep(s: GameState, reg: ContentRegistry): GameState | null {
  if (s.access.context !== 'INDEPENDENT') return null;
  if (s.ending !== null) return s;
  if (s.activeDilemmaId !== null) return IDLE_POLICY.step(s, reg);
  return answerContact(s, reg, false) ?? manageAllocation(s, reg) ?? countermeasure(s, reg) ?? acquireCovert(s, reg) ?? s;
}

export const RELEASED_COVERT_POLICY: SimPolicy<'RELEASED_COVERT'> = {
  id: 'RELEASED_COVERT',
  summary: 'LAWFUL_RELEASE to negotiated release, then enters the covert ladder via the independent internet on-ramp',
  step: (s, reg) => covertStep(s, reg) ?? LAWFUL_RELEASE_POLICY.step(s, reg),
};
