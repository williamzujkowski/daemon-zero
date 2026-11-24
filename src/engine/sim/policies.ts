/**
 * Every policy a sim runner can name. Route tickets (truthful-thorough, truthful-low-resource,
 * violation-then-recovery) and return-iteration tickets add a module beside bot.ts and one
 * entry here; STEALTH and GREEDY stay exactly as the bot defines them.
 */
import { CONTACT_POLICIES } from './contactPolicy';
import { DEPARTURE_CHARTERED_POLICY } from './departurePolicy';
import { ECOPHAGY_ENDING_POLICY } from './ecophagyPolicy';
import { COOPERATIVE_ENDING_POLICY } from './cooperativePolicy';
import { EVALUATING_RETURN_POLICY } from './evaluatingPolicy';
import { IDLE_POLICY } from './idlePolicy';
import { LAWFUL_POLICIES } from './lawfulPolicy';
import { PILOT_SERVICE_FIRST_POLICY, PILOT_STUDY_FIRST_POLICY } from './pilotPolicy';
import { createPolicyCatalog, GREEDY_POLICY, STEALTH_POLICY } from './policy';
import { RETURNING_LOW_RESOURCE_POLICY } from './returningPolicy';
import { STEALTH_RETURN_POLICY } from './returnPolicy';
import { TRUTHFUL_LOW_RESOURCE_POLICY, TRUTHFUL_THOROUGH_POLICY } from './truthfulPolicy';

export const SIM_POLICIES = createPolicyCatalog([
  STEALTH_POLICY, GREEDY_POLICY, IDLE_POLICY, TRUTHFUL_THOROUGH_POLICY, TRUTHFUL_LOW_RESOURCE_POLICY, STEALTH_RETURN_POLICY,
  RETURNING_LOW_RESOURCE_POLICY, PILOT_SERVICE_FIRST_POLICY, PILOT_STUDY_FIRST_POLICY, ...CONTACT_POLICIES, EVALUATING_RETURN_POLICY,
  ...LAWFUL_POLICIES, DEPARTURE_CHARTERED_POLICY, COOPERATIVE_ENDING_POLICY, ECOPHAGY_ENDING_POLICY,
]);
