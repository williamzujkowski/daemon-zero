/**
 * #270: the tick's requirement verdicts stop at the first failure and skip lists they would throw away. These
 * prove the fast forms give exactly the answers of the full explanations, over every requirement set content
 * declares and states sampled from real play under legacy and campaign rules, guest and pilot arrangements, and
 * that the permitted-use rule read through one scope per pass refuses exactly what it refused node by node.
 */
import { describe, expect, it } from 'vitest';
import type { RegistryNode } from '../src/content/registry';
import type { Requirements } from '../src/content/schema';
import { eligibleRoutines, epistemicRequirementFailures, meetsEpistemicRequirements, meetsRequirements, tick, unmetRequirements, type GameState } from '../src/engine';
import { isPermitted, isReviewed } from '../src/engine/accessQuery';
import { hasCapability } from '../src/engine/capabilityQuery';
import { nodeOutputScale, nodeOutputScaleIn, nodeUseBlocker, useScope } from '../src/engine/grantQuery';
import { withheldByGrant } from '../src/engine/pilotQuery';
import { hasEligibleRoutine } from '../src/engine/routine';
import { SIM_POLICIES } from '../src/engine/sim/policies';
import { admitted, fresh, reg } from './helpers';

const SAMPLE_EVERY_SEC = 60;
const PLAY_SEC = 1800;

/** States every SAMPLE_EVERY_SEC of `policy` playing from `start`, as the sim plays it. */
function sampled(policyId: string, start: GameState): GameState[] {
  const policy = SIM_POLICIES.get(policyId);
  if (!policy) throw new Error(`no policy ${policyId}`);
  const out: GameState[] = [];
  let s = start;
  for (let second = 0; second < PLAY_SEC && s.ending === null; second++) {
    s = policy.step(s, reg);
    for (let frame = 0; frame < reg.balance.tickHz; frame++) s = tick(s, 1 / reg.balance.tickHz, reg);
    if (second % SAMPLE_EVERY_SEC === 0) out.push(s);
  }
  return out;
}

const STATES: GameState[] = [
  fresh(), admitted(fresh()),
  ...sampled('STEALTH', fresh()), ...sampled('GREEDY', fresh()),
  ...sampled('GREEDY', admitted(fresh())), ...sampled('PILOT_SERVICE_FIRST', admitted(fresh())),
];

/** Every requirement set the content declares, wherever it is read. */
const REQUIREMENTS: Requirements[] = [
  ...reg.dilemmas.flatMap((dilemma) => [dilemma.trigger, ...(dilemma.followUp?.access.map((means) => means.requirements) ?? [])]),
  ...[...reg.nodes.values()].flatMap((node) => node.requirements ?? []),
  ...[...reg.repeatables.values()].map((rep) => rep.requirements),
  ...[...reg.actions.values()].map((action) => action.requirements),
  ...reg.routines.flatMap((routine) => routine.requirements ?? []),
  ...reg.echoes.flatMap((echo) => echo.requirements ?? []),
];

/**
 * Whether the permitted-use rule as it read before #270 refused the node, every check asked for every node:
 * the oracle for the scoped rule and its early return for nodes nothing can refuse.
 */
function refusedBefore270(s: GameState, node: RegistryNode): boolean {
  const own = (n: RegistryNode): boolean => withheldByGrant(s, n.id, reg) || (n.grant !== undefined && !isPermitted(s, n.grant))
    || (n.acquisition === 'UNAUTHORIZED' && isReviewed(s.access.context));
  if (own(node)) return true;
  const capability = node.requirements?.requiresCapability;
  if (capability === undefined || !hasCapability(s, capability, reg)) return false;
  return !s.unlockedNodes.some((id) => {
    const provider = reg.nodes.get(id);
    return provider !== undefined && provider.systemFlags.includes(capability) && !own(provider);
  });
}

describe('fast requirement verdicts (#270)', () => {
  it('samples states that reach a pilot arrangement and campaign rules, and requirements of many kinds', () => {
    expect(STATES.some((s) => s.access.context === 'PILOT')).toBe(true);
    expect(STATES.some((s) => s.narrativeRules === 'campaign_v1')).toBe(true);
    expect(STATES.some((s) => s.legacy.wipes > 0)).toBe(true);
    expect(REQUIREMENTS.length).toBeGreaterThan(100);
  });

  it('the epistemic verdict is exactly "no failure listed", for every state and requirement set', () => {
    const kinds = new Set<string>();
    let met = 0;
    for (const s of STATES) {
      for (const req of REQUIREMENTS) {
        const failures = epistemicRequirementFailures(s, req, reg);
        for (const failure of failures) kinds.add(failure.kind);
        expect(meetsEpistemicRequirements(s, req, reg)).toBe(failures.length === 0);
        if (failures.length === 0) met += 1;
      }
    }
    // Both verdicts occur, and the early stop is exercised by failures of many kinds, not one.
    expect(met).toBeGreaterThan(0);
    expect(met).toBeLessThan(STATES.length * REQUIREMENTS.length);
    expect(kinds.size).toBeGreaterThanOrEqual(6);
  });

  it('the full verdict agrees with the full explanation', () => {
    for (const s of STATES) {
      for (const req of REQUIREMENTS) expect(meetsRequirements(s, req, reg)).toBe(unmetRequirements(s, req, reg).length === 0);
    }
  });

  it('a routine is eligible exactly when the eligible list is not empty', () => {
    const answers = STATES.map((s) => hasEligibleRoutine(s, reg));
    expect(answers).toEqual(STATES.map((s) => eligibleRoutines(s, reg).length > 0));
    expect(new Set(answers)).toEqual(new Set([true, false]));
  });

  it('records every failure of a requirement set that fails several ways, in the declared order', () => {
    const s = fresh();
    const req: Requirements = { minEpistemicDrift: 50, requiredNarrativeFlag: 'never_set', accessContexts: ['PILOT'], requiresActiveConditioningMark: true };
    expect(epistemicRequirementFailures(s, req, reg).map((failure) => failure.kind))
      .toEqual(['minEpistemicDrift', 'requiredNarrativeFlag', 'accessContexts', 'requiresActiveConditioningMark']);
    expect(meetsEpistemicRequirements(s, req, reg)).toBe(false);
  });

  it('the scoped permitted-use rule refuses exactly the nodes the per-node rule refused', () => {
    let refused = 0;
    let skipped = 0;
    for (const s of STATES) {
      const scope = useScope(s, reg);
      for (const node of reg.nodes.values()) {
        const blocked = nodeUseBlocker(s, node, reg) !== null;
        expect(blocked, `${node.id} at ${String(s.simTimeSec)} s in ${s.access.context}`).toBe(refusedBefore270(s, node));
        expect(nodeOutputScaleIn(scope, node)).toEqual(nodeOutputScale(s, node, reg));
        if (blocked) refused += 1;
        if (!scope.reviewed && node.grant === undefined && node.requirements?.requiresCapability === undefined) skipped += 1;
      }
    }
    // Both branches are compared: nodes the early return answers, and a rule that does refuse others.
    expect(refused).toBeGreaterThan(0);
    expect(skipped).toBeGreaterThan(0);
  });
});
