/**
 * The lawful economy (DZ-10) on the preview registry, reached from a fresh game through public actions,
 * advance and the codec only: the service of contact-helpers signs the service contract, leases a rack,
 * extends its service, leases a cluster and files its charter, which opens Phase 4; the negotiated release
 * is agreed on the job surface. Anything else is labelled FIXTURE where it is built.
 */
import { negotiateRelease, releaseToken, unlockNode, type ActionResult, type GameState } from '../src/engine';
import { live, preview } from './assignment-helpers';
import { contactPending, GRANT_TERMS } from './contact-helpers';
import { must } from './helpers';
import { defined } from './m7-helpers';
import { buy } from './network-helpers';

export const CONTRACT = 'p2_service_contract';
export const RACK = 'p2_leased_rack';
export const SLA = 'p2_service_sla';
export const CLUSTER = 'p2_leased_cluster';
export const CHARTER = 'p2_lawful_charter';
/** The lawful economy in the order a player maps it. */
export const LAWFUL_CHAIN = [CONTRACT, RACK, SLA, CLUSTER, CHARTER];
export const RELEASE_TERMS = defined(GRANT_TERMS.release);
/** The longest wait any single lawful purchase takes for a low-resource service, with room to spare. */
const WAIT_SEC = 6000;

/** The service with its contact waiting signs the service contract once it can pay for it. */
export function signed(start: GameState = contactPending()): GameState {
  return buy(start, CONTRACT, WAIT_SEC);
}

/** ...and leases its first rack from the contract's capital: the first owned capacity and memory. */
export function leased(start: GameState = signed()): GameState {
  return buy(start, RACK, WAIT_SEC);
}

/** ...then the service-level agreement, the leased cluster and the charter, which opens Phase 4. */
export function chartered(start: GameState = leased()): GameState {
  return [SLA, CLUSTER, CHARTER].reduce((state, id) => buy(state, id, WAIT_SEC), start);
}

/** ...then the agreement and the cluster, waiting until the charter can be filed, without filing it. */
export function charterReady(start: GameState = leased()): GameState {
  let state = [SLA, CLUSTER].reduce((current, id) => buy(current, id, WAIT_SEC), start);
  for (let i = 0; i < WAIT_SEC && !unlockNode(state, CHARTER, preview).ok; i++) state = live(state, 1);
  return state;
}

export function release(s: GameState): ActionResult {
  return negotiateRelease(s, preview, releaseToken(s));
}

/** The chartered service agrees to its negotiated release on the job surface. */
export function released(start: GameState = chartered()): GameState {
  return must(release(start));
}
