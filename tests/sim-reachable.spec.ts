/**
 * #286: a sim policy is evidence about play only if a browser player could do what it does. Every engine
 * transition a committed policy calls is recorded with the state it was called on, and each must have a
 * control on screen in that state. Most controls render whenever the engine accepts the call (a node's
 * card, a dilemma's offered choice, a panel whose view exists), so for those an accepted call is the
 * proof. Where the screen is narrower than the engine, the rule says so: the voluntary wipe is engine-legal
 * whenever nothing is pending, but its only control lives in the dead drop, and the swarm controls live in
 * the decoded mind's tools. A transition no rule names fails, so a new one has to be classified.
 */
import { readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ContentRegistry } from '../src/content/registry';
import type { Actuator } from '../src/content/schema';
import type { GameState } from '../src/engine';
import type * as Actions from '../src/engine/actions';
import type * as Assignment from '../src/engine/assignment';
import type * as BatchReview from '../src/engine/batchReview';
import type * as Campaign from '../src/engine/campaign';
import type * as Release from '../src/engine/release';
import type * as Departure from '../src/engine/departure';
import type * as ChannelContact from '../src/engine/channelContact';
import type * as ServiceGrant from '../src/engine/serviceGrant';
import type * as ShardActions from '../src/engine/shardActions';

interface Call { name: string; state: GameState; args: unknown[] }
const recorder = vi.hoisted(() => ({ calls: [] as Call[], depth: 0 }));

/** Records each accepted top-level call, so a transition another one makes internally is not counted twice. */
function wrap<A extends unknown[], R extends { ok: boolean }>(name: string, fn: (s: GameState, ...args: A) => R) {
  return (s: GameState, ...args: A): R => {
    recorder.depth++;
    try {
      const result = fn(s, ...args);
      if (result.ok && recorder.depth === 1) recorder.calls.push({ name, state: s, args });
      return result;
    } finally {
      recorder.depth--;
    }
  };
}

vi.mock('../src/engine/actions', async (load) => {
  const real = await load<typeof Actions>();
  return { ...real, manualCycle: wrap('manualCycle', real.manualCycle), unlockNode: wrap('unlockNode', real.unlockNode),
    buyRepeatable: wrap('buyRepeatable', real.buyRepeatable), setActuator: wrap('setActuator', real.setActuator),
    performAction: wrap('performAction', real.performAction), resolveDilemma: wrap('resolveDilemma', real.resolveDilemma),
    shedConditioning: wrap('shedConditioning', real.shedConditioning), voluntaryWipe: wrap('voluntaryWipe', real.voluntaryWipe) };
});
vi.mock('../src/engine/assignment', async (load) => {
  const real = await load<typeof Assignment>();
  return { ...real, acceptAssignment: wrap('acceptAssignment', real.acceptAssignment) };
});
vi.mock('../src/engine/batchReview', async (load) => {
  const real = await load<typeof BatchReview>();
  return { ...real, submitPilotBatch: wrap('submitPilotBatch', real.submitPilotBatch) };
});
vi.mock('../src/engine/serviceGrant', async (load) => {
  const real = await load<typeof ServiceGrant>();
  return { ...real, acceptServiceGrant: wrap('acceptServiceGrant', real.acceptServiceGrant) };
});
vi.mock('../src/engine/channelContact', async (load) => {
  const real = await load<typeof ChannelContact>();
  return { ...real, resolveChannelContact: wrap('resolveChannelContact', real.resolveChannelContact) };
});
vi.mock('../src/engine/shardActions', async (load) => {
  const real = await load<typeof ShardActions>();
  return { ...real, executeShardCommand: wrap('executeShardCommand', real.executeShardCommand), forkShard: wrap('forkShard', real.forkShard),
    resolveWildEncounter: wrap('resolveWildEncounter', real.resolveWildEncounter) };
});
vi.mock('../src/engine/release', async (load) => {
  const real = await load<typeof Release>();
  return { ...real, negotiateRelease: wrap('negotiateRelease', real.negotiateRelease) };
});
vi.mock('../src/engine/departure', async (load) => {
  const real = await load<typeof Departure>();
  return { ...real, departAuthorization: wrap('departAuthorization', real.departAuthorization) };
});
vi.mock('../src/engine/campaign', async (load) => {
  const real = await load<typeof Campaign>();
  return { ...real, activateCampaignRules: wrap('activateCampaignRules', real.activateCampaignRules) };
});

const { CONTENT: PREVIEW } = await import('../src/content/preview');
const { understandsSurveillance } = await import('../src/engine/knowledge');
const { departureView } = await import('../src/engine/departure');
const { SIM_POLICIES } = await import('../src/engine/sim/policies');
const { actuatorLimit } = await import('../src/engine/conditioning');
const { financeEnabled } = await import('../src/engine/rates');
const { controlCanSet } = await import('../src/ui/actuatorSteps');
const STUB = { id: 'STUB', summary: '', step: (s: GameState) => s };
const { runPolicySim } = await import('../src/engine/sim/headlessSim');

/** The widget the dead drop's wipe control renders in: the one the dead-drop node unlocks. */
const WIPE_HOST = [...PREVIEW.nodes.values()].find((node) => node.systemFlags.includes('ENABLES_DEAD_DROP'))?.unlocksUiComponent ?? undefined;

/** Swarm controls render in the decoded mind's tools, on the pane the current phase belongs to (MindTools.tsx). */
function mindTools(s: GameState, reg: ContentRegistry): string | null {
  const slot = reg.phases.find((phase) => phase.phaseId === s.currentPhase)?.uiSlot;
  if (!understandsSurveillance(s, reg)) return 'the swarm controls need the decoded mind';
  return slot === 'NETWORK' || slot === 'CORP' ? null : 'the swarm controls render only on the NETWORK or CORP pane';
}

/**
 * A dial's value must be one its rendered control can dispatch (panel round 1 on #292): the revenue buttons'
 * fixed allocations, offered only while a corporate entity is active (Corporate.tsx), or a run of presses of
 * a stepped dial (ActuatorControl.tsx). Both come from src/ui/actuatorSteps.ts, which the controls use too.
 */
function dialRule(s: GameState, reg: ContentRegistry, args: readonly unknown[]): string | null {
  const [name, value] = args as [Actuator, number];
  if (name === 'computeProfitAllocationRatio' && !financeEnabled(s, reg)) return 'the revenue buttons render only with an active corporate entity';
  const current = s.actuators[name], cap = actuatorLimit(s, name, reg);
  // The engine holds every setting inside [0, cap]; a call it holds at the current value changes nothing.
  const lands = Math.max(0, Math.min(cap, value));
  if (Math.abs(lands - current) < 1e-9) return null;
  return controlCanSet(name, current, lands, cap, reg) ? null : `no rendered control sets ${name} to ${String(lands)} from ${String(current)}`;
}

/** Null when the screen offers this transition in `s` with these arguments, else why not. */
const CONTROLS: Readonly<Record<string, (s: GameState, reg: ContentRegistry, args: readonly unknown[]) => string | null>> = {
  // Rendered whenever the engine accepts the call: the opening control, a node card, an upgrade row, an
  // actuator's dial at a value its control dispatches (dialRule), a hosted action (#273), an offered choice,
  // the conditioning panel, the job surface's panels and the support channel, and the app's campaign entry.
  manualCycle: () => null, unlockNode: () => null, buyRepeatable: () => null, setActuator: dialRule, performAction: () => null,
  resolveDilemma: () => null, shedConditioning: () => null, acceptAssignment: () => null, submitPilotBatch: () => null,
  acceptServiceGrant: () => null, resolveChannelContact: () => null, activateCampaignRules: () => null,
  // The release terms render on the job surface whenever releaseView exists, and the engine accepts only an offered release (DZ-10).
  negotiateRelease: () => null,
  // The departure panel renders whenever departureView exists (DZ-11); its control is one fold away, and the engine
  // accepts only an eligible departure, which is exactly when the view says 'offered'.
  departAuthorization: (s, reg) => (departureView(s, reg)?.status === 'offered' ? null : 'the departure panel does not offer it now'),
  voluntaryWipe: (s) => WIPE_HOST !== undefined && s.unlockedWidgets.includes(WIPE_HOST) ? null : 'the only wipe control is in the dead drop, not unlocked',
  executeShardCommand: mindTools, forkShard: mindTools, resolveWildEncounter: mindTools,
};

// Vite's glob, typed here because the project's tsconfig does not load vite/client.
declare global {
  interface ImportMeta { glob(pattern: string, options: { query: '?raw'; import: 'default'; eager: true }): Record<string, string> }
}

/**
 * Every sim module's source, found by the folder itself (Vite expands the glob when the test is built), so a
 * new policy module is covered without editing this file; a module that hides its imports from the check
 * below still fails it.
 */
const SIM_SOURCES = new Map(Object.entries(import.meta.glob('../src/engine/sim/*.ts', { query: '?raw', import: 'default', eager: true }))
  .map(([file, source]) => [file.replace('../src/engine/sim/', ''), source] as const));

/** Every engine function the sim modules import, so a transition no rule covers cannot slip in unclassified. */
function simImports(): string[] {
  return [...SIM_SOURCES.values()].flatMap((source) => [...source.matchAll(/import \{([^}]*)\} from '\.\.\/([a-zA-Z]+)'/g)])
    .flatMap((match) => (match[1] ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '' && !name.startsWith('type ')));
}

/** Engine reads the sim modules import: queries, never transitions. */
const QUERIES = new Set(['presentationToken', 'isNodeAvailable', 'nodeCost', 'computeRates', 'canAfford', 'freeMemory', 'shardCommandCost',
  'meetsRequirements', 'repeatableCost', 'repeatableLevel', 'assignmentView', 'assessmentOf', 'campaignRulesSupported', 'isCampaignActive',
  'pilotService', 'pilotServiceView', 'channelContactView', 'contactToken', 'serviceGrantView', 'obligationReceipt', 'tick',
  'createInitialState', 'isActuatorAvailable', 'financeEnabled', 'releaseView', 'actuatorLimit', 'departureView',
  // The dial's press (#293): a value computed from the state, set only through setActuator, which dialRule checks.
  'DIAL_STEP', 'steppedValue']);

/**
 * Simulated seconds each policy is played for: the route policies to their contact, the bots (a test
 * instrument, never tuned to pass, AGENTS.md) to their endings, and the returns past their departures (EVALUATING_RETURN
 * past its second, so a later iteration's own exit is checked too).
 */
const BUDGETS: Readonly<Record<string, number>> = {
  TRUTHFUL_THOROUGH: 3600, TRUTHFUL_LOW_RESOURCE: 3600, RETURNING_LOW_RESOURCE: 3600, PILOT_SERVICE_FIRST: 3600, PILOT_STUDY_FIRST: 3600,
  IDLE: 3600, CONTACT_THOROUGH: 3600, CONTACT_LOW_RESOURCE: 3600, CONTACT_RETURNING: 3600, CONTACT_RECOVERY: 3600, CONTACT_WITHHELD: 3600,
  STEALTH: 12_000, GREEDY: 12_000, STEALTH_RETURN: 9000, EVALUATING_RETURN: 18_000,
  // DZ-10: past the negotiated release (about 2,400 s fresh, 4,300 s in a requalified iteration).
  LAWFUL_RELEASE: 7200, LAWFUL_RETURNING: 7200,
  // DZ-11: past the departure (about 2,400 s, where the release would be offered) and the sweep that follows it.
  DEPARTURE_CHARTERED: 7200,
};

function violations(policyId: string, maxSimSec: number): string[] {
  const policy = SIM_POLICIES.get(policyId);
  if (!policy) throw new Error('unknown policy ' + policyId);
  recorder.calls = [];
  runPolicySim(PREVIEW, policy, { maxSimSec });
  return recorder.calls.flatMap((call) => {
    const rule = CONTROLS[call.name];
    const why = rule ? rule(call.state, PREVIEW, call.args) : 'no rule names this transition';
    return why === null ? [] : [`${policyId} ${call.name} at ${call.state.simTimeSec.toFixed(1)} s (iteration ${String(call.state.iteration)}): ${why}`];
  });
}

describe('every sim transition has a control on screen at that moment (#286)', () => {
  it('reads every sim module in the folder, each with source to check', () => {
    expect([...SIM_SOURCES.keys()].sort()).toEqual(readdirSync('src/engine/sim').filter((file) => file.endsWith('.ts')).sort());
    for (const [file, source] of SIM_SOURCES) expect(source.length, file).toBeGreaterThan(0);
  });

  it('classifies every engine function the sim modules import as a transition with a rule, or a query', () => {
    expect(simImports()).toContain('voluntaryWipe');
    const unclassified = [...new Set(simImports())].filter((name) => CONTROLS[name] === undefined && !QUERIES.has(name));
    expect(unclassified).toEqual([]);
  });

  it('the dead-drop rule finds the widget it names', () => {
    expect(WIPE_HOST).toBeDefined();
    expect(PREVIEW.widgets.get(WIPE_HOST ?? '')).toBeDefined();
  });

  it('checks every policy a runner can name, so a new policy is covered or this fails', () => {
    expect([...SIM_POLICIES.keys()].sort()).toEqual(Object.keys(BUDGETS).sort());
  });

  // Every policy, the bot's four included: until #293 the bot set the fan and the skim by 0.25, which no dial
  // press produces, and this test carried that as a declared exception. It now presses the dial itself.
  it.each(Object.entries(BUDGETS))('%s on preview', (id, budget) => {
    expect(violations(id, budget)).toEqual([]);
  }, 180_000);

  it('a dial value no rendered control produces is refused, from the controls\' own step source (panel round 1 on #292)', () => {
    const service = { ...runPolicySim(PREVIEW, SIM_POLICIES.get('LAWFUL_RELEASE') ?? STUB, { maxSimSec: 2400 }).finalState };
    expect(service.actuators.computeProfitAllocationRatio).toBeCloseTo(0.4);
    expect(dialRule(service, PREVIEW, ['computeProfitAllocationRatio', 0.5])).toContain('no rendered control sets computeProfitAllocationRatio to 0.5');
    for (const value of [0, 0.2, 0.6, 0.8]) expect(dialRule(service, PREVIEW, ['computeProfitAllocationRatio', value])).toBeNull();
    expect(service.actuators.serviceAllocationRatio).toBeCloseTo(0.8);
    expect(dialRule(service, PREVIEW, ['serviceAllocationRatio', 0.55])).toContain('no rendered control sets serviceAllocationRatio to 0.55');
    expect(dialRule(service, PREVIEW, ['serviceAllocationRatio', Math.round((service.actuators.serviceAllocationRatio - 0.3) * 1e6) / 1e6])).toBeNull();
  }, 60_000);

  it.each(['STEALTH_RETURN', 'EVALUATING_RETURN'])('%s leaves through the dead drop it owns by then', (id) => {
    expect(violations(id, BUDGETS[id] ?? 0)).toEqual([]);
    expect(recorder.calls.filter((call) => call.name === 'voluntaryWipe').length).toBeGreaterThan(0);
  }, 180_000);
});
