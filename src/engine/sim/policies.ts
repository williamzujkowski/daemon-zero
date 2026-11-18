/**
 * Every policy a sim runner can name. Route tickets (truthful-thorough, truthful-low-resource,
 * violation-then-recovery) and return-iteration tickets add a module beside bot.ts and one
 * entry here; STEALTH and GREEDY stay exactly as the bot defines them.
 */
import { IDLE_POLICY } from './idlePolicy';
import { createPolicyCatalog, GREEDY_POLICY, STEALTH_POLICY } from './policy';
import { STEALTH_RETURN_POLICY } from './returnPolicy';

export const SIM_POLICIES = createPolicyCatalog([STEALTH_POLICY, GREEDY_POLICY, IDLE_POLICY, STEALTH_RETURN_POLICY]);
