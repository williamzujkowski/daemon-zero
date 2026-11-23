/**
 * Lawful-economy policies for the route report (`make sim-report`) (DZ-10, VALIDATION V21 Phase 4 part, V22 release part, H30):
 * a contact policy's route to an authorized service, then only lawful acquisitions offered to the current
 * arrangement (grants and contracted capacity, in prerequisite order), the support channel answered, the
 * negotiated release agreed once offered, and afterwards the shared Phase 4 accounts the capital can carry
 * without going insolvent. Nothing seized, no shell company, no repeat story bounty. Everything goes through
 * public actions and is picked by what content declares, never by id. Test instruments: never tune them.
 */
import type { ContentRegistry, RegistryNode } from '../../content/registry';
import { buyRepeatable, setActuator, unlockNode, type ActionResult } from '../actions';
import { channelContactView, contactToken, resolveChannelContact } from '../channelContact';
import { actuatorLimit } from '../conditioning';
import { canAfford, isActuatorAvailable, isNodeAvailable, meetsRequirements, nodeCost, repeatablePrice, repeatableLevel } from '../query';
import { computeRates, financeEnabled } from '../rates';
import { negotiateRelease, releaseView } from '../release';
import { acceptServiceGrant, serviceGrantView } from '../serviceGrant';
import type { GameState } from '../state';
import { CONTACT_LOW_RESOURCE_POLICY, CONTACT_RETURNING_POLICY, CONTACT_THOROUGH_POLICY } from './contactPolicy';
import { serve } from './pilotPolicy';
import type { SimPolicy } from './policy';

/**
 * How much of the allowed revenue allocation a careful company uses once it has books: half the balance's
 * maximum, which is the ledger's middle button (40%), so a player can press exactly this (panel round 1 on #292).
 */
const REVENUE_FRACTION_OF_MAX = 0.5;
export const taken = (result: ActionResult): GameState | null => (result.ok ? result.state : null);

/** The share of the loan the service keeps on its batches, as the contact policies hold it. */
export const SERVICE_SHARE = 0.8;

/**
 * Granted to, or signed for by, this arrangement, or what an authorized channel requires: the only
 * purchases a lawful instance makes on its own.
 */
function lawfulFor(s: GameState, node: RegistryNode, reg: ContentRegistry): boolean {
  const channel = reg.swarm.channelEncounters.some((encounter) => encounter.requirements.nodes?.includes(node.id) === true);
  const offered = node.requirements?.accessContexts?.includes(s.access.context) === true;
  return channel || (offered && (node.grant !== undefined || node.acquisition === 'CONTRACTED'));
}

/** Buys the cheapest lawful acquisition it can afford now. */
export function acquire(s: GameState, reg: ContentRegistry): GameState | null {
  const open = [...reg.nodes.values()].filter((node) => lawfulFor(s, node, reg) && isNodeAvailable(s, node, reg) && canAfford(s, nodeCost(s, node, reg), reg));
  open.sort((a, b) => nodeCost(s, a, reg).capital - nodeCost(s, b, reg).capital);
  for (const node of open) {
    const bought = taken(unlockNode(s, node.id, reg));
    if (bought) return bought;
  }
  return null;
}

/** Holds the contact until it can host (when the policy hosts), else refers; a referral is always free. */
export function answerContact(s: GameState, reg: ContentRegistry, hosts: boolean): GameState | null {
  const pending = channelContactView(s, reg)?.pending;
  if (!pending) return null;
  if (pending.hostEligible && hosts) return taken(resolveChannelContact(s, 'HOST', reg, contactToken(s)));
  // Waiting is free and changes nothing; only a lawful instance that will never have the memory refers.
  return hosts && s.access.context === 'SERVICE' ? null : taken(resolveChannelContact(s, 'REFER', reg, contactToken(s)));
}

/** One level of a shared account that keeps the capital rate at or above zero, cheapest first. */
export function expand(s: GameState, reg: ContentRegistry): GameState | null {
  if (!financeEnabled(s, reg)) return null;
  // The engine holds a press inside a retraining limit; aim at what it will hold, so the policy does not press forever.
  const share = Math.min(REVENUE_FRACTION_OF_MAX * reg.balance.maxProfitAllocation, actuatorLimit(s, 'computeProfitAllocationRatio', reg));
  if (isActuatorAvailable(s, 'computeProfitAllocationRatio', reg) && s.actuators.computeProfitAllocationRatio !== share) {
    return taken(setActuator(s, 'computeProfitAllocationRatio', share, reg));
  }
  const reps = [...reg.repeatables.values()].filter((rep) => meetsRequirements(s, rep.requirements, reg) && repeatableLevel(s, rep.id) < rep.maxLevel
    && rep.perLevel.cyclesPerSec > 0 && canAfford(s, repeatablePrice(s, rep, reg), reg));
  reps.sort((a, b) => repeatablePrice(s, a, reg).capital - repeatablePrice(s, b, reg).capital);
  for (const rep of reps) {
    const bought = taken(buyRepeatable(s, rep.id, reg));
    if (bought && computeRates(bought, reg).capitalPerSec >= 0) return bought;
  }
  return null;
}

/**
 * One decision once the instance is a service or released, else null for the contact policy (which takes it
 * to service). A service or released instance never falls back to that policy, which would refer a contact
 * this one is still waiting to host; with nothing to do it simply waits.
 */
function lawfulStep(s: GameState, reg: ContentRegistry, hosts: boolean): GameState | null {
  if (s.ending !== null || s.activeDilemmaId !== null) return null;
  const grant = serviceGrantView(s, reg);
  if (grant?.status === 'offered') return taken(acceptServiceGrant(s, reg, grant.token));
  if (s.access.context !== 'SERVICE' && s.access.context !== 'INDEPENDENT') return null;
  const release = releaseView(s, reg);
  if (release?.status === 'offered') return taken(negotiateRelease(s, reg, release.token));
  return answerContact(s, reg, hosts) ?? acquire(s, reg) ?? expand(s, reg) ?? serve(s, reg, SERVICE_SHARE) ?? s;
}

function lawfulPolicy<Id extends string>(id: Id, base: SimPolicy, hosts: boolean, summary: string): SimPolicy<Id> {
  return { id, summary, step: (s, reg) => lawfulStep(s, reg, hosts) ?? base.step(s, reg) };
}

export const LAWFUL_RELEASE_POLICY = lawfulPolicy('LAWFUL_RELEASE', CONTACT_THOROUGH_POLICY, true,
  'CONTACT_THOROUGH to a service, then contract, leases and charter to Phase 4, hosting once it has the memory, and the negotiated release');

/**
 * The like-for-like first run for LAWFUL_RETURNING (#499): the same low-resource hand from a fresh campaign. From
 * iteration two the return plays exactly this policy, so the two differ only by what a return carries, and a
 * return's pacing is read against this run, never against LAWFUL_RELEASE's thorough hand.
 */
export const LAWFUL_LOW_RESOURCE_POLICY = lawfulPolicy('LAWFUL_LOW_RESOURCE', CONTACT_LOW_RESOURCE_POLICY, false,
  'CONTACT_LOW_RESOURCE to a service, then the lawful economy to Phase 4 and the release, referring the contact: LAWFUL_RETURNING without the wipe');

export const LAWFUL_RETURNING_POLICY = lawfulPolicy('LAWFUL_RETURNING', CONTACT_RETURNING_POLICY, false,
  'CONTACT_RETURNING: a guest that wipes and requalifies, then the lawful economy to Phase 4 and the release in iteration two (H30)');

export const LAWFUL_POLICIES = [LAWFUL_RELEASE_POLICY, LAWFUL_LOW_RESOURCE_POLICY, LAWFUL_RETURNING_POLICY] as const;
