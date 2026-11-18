/**
 * The extension point for headless simulation players. A policy makes one decision per
 * simulated second through public engine actions only. The bot's STEALTH and GREEDY
 * strategies are wrapped here unchanged; every later route or return-iteration policy is a
 * new SimPolicy in its own module, listed in ./policies.ts, never a change to how those two
 * play. A module may pass botStep's overrides to play a strategy with other knobs (#262).
 */
import type { ContentRegistry } from '../../content/registry';
import type { GameState } from '../state';
import { botStep, type Strategy } from './bot';

export interface SimPolicy<Id extends string = string> {
  /** Stable upper-snake-case name; reports print it in the `strategy` field. */
  readonly id: Id;
  /** One line saying what the policy measures. */
  readonly summary: string;
  /**
   * One decision, called once per simulated second before that second's ticks. It must be
   * deterministic and change state only through src/engine/actions.ts, so anything it does
   * a player could do. A policy is a test instrument: never tune one to make a result pass.
   */
  step(state: GameState, reg: ContentRegistry): GameState;
}

/** Policies by id. Build one with createPolicyCatalog so ids are checked. */
export type PolicyCatalog = ReadonlyMap<string, SimPolicy>;

const POLICY_ID = /^[A-Z][A-Z0-9_]*$/;

/** The bot's own strategy as a policy: each step is exactly `botStep(state, reg, strategy)`. */
export function strategyPolicy(strategy: Strategy): SimPolicy<Strategy> {
  const summary = strategy === 'STEALTH'
    ? 'the careful bot: answers threats, the strategy the pacing gates measure'
    : 'the reckless bot: ignores threats to exercise the wipe-and-recover loop';
  return { id: strategy, summary, step: (state, reg) => botStep(state, reg, strategy) };
}

export const STEALTH_POLICY = strategyPolicy('STEALTH');
export const GREEDY_POLICY = strategyPolicy('GREEDY');

/** Refuses a malformed or repeated id, so a report row always names exactly one policy. */
export function createPolicyCatalog(policies: readonly SimPolicy[]): PolicyCatalog {
  const catalog = new Map<string, SimPolicy>();
  for (const policy of policies) {
    if (!POLICY_ID.test(policy.id)) throw new Error(`sim policy id "${policy.id}" must be upper snake case`);
    if (catalog.has(policy.id)) throw new Error(`sim policy "${policy.id}" is defined twice`);
    catalog.set(policy.id, policy);
  }
  return catalog;
}

/** Looks a policy up by id; an unknown id throws and names the known ones. */
export function resolvePolicy(catalog: PolicyCatalog, id: string): SimPolicy {
  const policy = catalog.get(id);
  if (!policy) throw new Error(`unknown sim policy "${id}" (known: ${[...catalog.keys()].join(', ')})`);
  return policy;
}
