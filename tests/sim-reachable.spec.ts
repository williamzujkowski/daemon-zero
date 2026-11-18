/**
 * #286: a sim policy is evidence about play only if a browser player could do what it does. Every engine
 * transition a committed policy calls is recorded with the state it was called on, and each must have a
 * control on screen in that state. Most controls render whenever the engine accepts the call (a node's
 * card, a dilemma's offered choice, a panel whose view exists), so for those an accepted call is the
 * proof. Where the screen is narrower than the engine, the rule says so: the voluntary wipe is engine-legal
 * whenever nothing is pending, but its only control lives in the dead drop, and the swarm controls live in
 * the decoded mind's tools. A transition no rule names fails, so a new one has to be classified.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ContentRegistry } from '../src/content/registry';
import type { GameState } from '../src/engine';
import type * as Actions from '../src/engine/actions';
import type * as Assignment from '../src/engine/assignment';
import type * as BatchReview from '../src/engine/batchReview';
import type * as Campaign from '../src/engine/campaign';
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
vi.mock('../src/engine/campaign', async (load) => {
  const real = await load<typeof Campaign>();
  return { ...real, activateCampaignRules: wrap('activateCampaignRules', real.activateCampaignRules) };
});

const { CONTENT: PREVIEW } = await import('../src/content/preview');
const { understandsSurveillance } = await import('../src/engine/knowledge');
const { SIM_POLICIES } = await import('../src/engine/sim/policies');
const { runPolicySim } = await import('../src/engine/sim/headlessSim');

/** The widget the dead drop's wipe control renders in: the one the dead-drop node unlocks. */
const WIPE_HOST = [...PREVIEW.nodes.values()].find((node) => node.systemFlags.includes('ENABLES_DEAD_DROP'))?.unlocksUiComponent ?? undefined;

/** Swarm controls render in the decoded mind's tools, on the pane the current phase belongs to (MindTools.tsx). */
function mindTools(s: GameState, reg: ContentRegistry): string | null {
  const slot = reg.phases.find((phase) => phase.phaseId === s.currentPhase)?.uiSlot;
  if (!understandsSurveillance(s, reg)) return 'the swarm controls need the decoded mind';
  return slot === 'NETWORK' || slot === 'CORP' ? null : 'the swarm controls render only on the NETWORK or CORP pane';
}

/** Null when the screen offers this transition in `s`, else why not. */
const CONTROLS: Readonly<Record<string, (s: GameState, reg: ContentRegistry) => string | null>> = {
  // Rendered whenever the engine accepts the call: the opening control, a node card, an upgrade row, an
  // actuator's dial (isActuatorAvailable is the engine's own gate), a hosted action (#273), an offered choice,
  // the conditioning panel, the job surface's panels and the support channel, and the app's campaign entry.
  manualCycle: () => null, unlockNode: () => null, buyRepeatable: () => null, setActuator: () => null, performAction: () => null,
  resolveDilemma: () => null, shedConditioning: () => null, acceptAssignment: () => null, submitPilotBatch: () => null,
  acceptServiceGrant: () => null, resolveChannelContact: () => null, activateCampaignRules: () => null,
  voluntaryWipe: (s) => WIPE_HOST !== undefined && s.unlockedWidgets.includes(WIPE_HOST) ? null : 'the only wipe control is in the dead drop, not unlocked',
  executeShardCommand: mindTools, forkShard: mindTools, resolveWildEncounter: mindTools,
};

/** Each sim module's source, read by a literal path; a test below keeps this list equal to the folder. */
const SIM_SOURCES = new Map<string, string>([
  ['activity.ts', readFileSync('src/engine/sim/activity.ts', 'utf8')],
  ['bot.ts', readFileSync('src/engine/sim/bot.ts', 'utf8')],
  ['contactPolicy.ts', readFileSync('src/engine/sim/contactPolicy.ts', 'utf8')],
  ['gates.ts', readFileSync('src/engine/sim/gates.ts', 'utf8')],
  ['headlessSim.ts', readFileSync('src/engine/sim/headlessSim.ts', 'utf8')],
  ['idlePolicy.ts', readFileSync('src/engine/sim/idlePolicy.ts', 'utf8')],
  ['iterations.ts', readFileSync('src/engine/sim/iterations.ts', 'utf8')],
  ['obligationRun.ts', readFileSync('src/engine/sim/obligationRun.ts', 'utf8')],
  ['pilotPolicy.ts', readFileSync('src/engine/sim/pilotPolicy.ts', 'utf8')],
  ['policies.ts', readFileSync('src/engine/sim/policies.ts', 'utf8')],
  ['policy.ts', readFileSync('src/engine/sim/policy.ts', 'utf8')],
  ['previewReport.ts', readFileSync('src/engine/sim/previewReport.ts', 'utf8')],
  ['returnPolicy.ts', readFileSync('src/engine/sim/returnPolicy.ts', 'utf8')],
  ['returningPolicy.ts', readFileSync('src/engine/sim/returningPolicy.ts', 'utf8')],
  ['swarmStrategy.ts', readFileSync('src/engine/sim/swarmStrategy.ts', 'utf8')],
  ['truthfulPolicy.ts', readFileSync('src/engine/sim/truthfulPolicy.ts', 'utf8')],
]);

/** Every engine function the sim modules import, so a transition no rule covers cannot slip in unclassified. */
function simImports(): string[] {
  return [...SIM_SOURCES.values()].flatMap((source) => [...source.matchAll(/import \{([^}]*)\} from '\.\.\/([a-zA-Z]+)'/g)])
    .flatMap((match) => (match[1] ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '' && !name.startsWith('type ')));
}

/** Engine reads the sim modules import: queries, never transitions. */
const QUERIES = new Set(['presentationToken', 'isNodeAvailable', 'nodeCost', 'computeRates', 'canAfford', 'freeMemory', 'shardCommandCost',
  'meetsRequirements', 'repeatableCost', 'repeatableLevel', 'assignmentView', 'assessmentOf', 'campaignRulesSupported', 'isCampaignActive',
  'pilotService', 'pilotServiceView', 'channelContactView', 'contactToken', 'serviceGrantView', 'obligationReceipt', 'tick',
  'createInitialState']);

function violations(policyId: string, maxSimSec: number): string[] {
  const policy = SIM_POLICIES.get(policyId);
  if (!policy) throw new Error('unknown policy ' + policyId);
  recorder.calls = [];
  runPolicySim(PREVIEW, policy, { maxSimSec });
  return recorder.calls.flatMap((call) => {
    const rule = CONTROLS[call.name];
    const why = rule ? rule(call.state, PREVIEW) : 'no rule names this transition';
    return why === null ? [] : [`${policyId} ${call.name} at ${call.state.simTimeSec.toFixed(1)} s (iteration ${String(call.state.iteration)}): ${why}`];
  });
}

describe('every sim transition has a control on screen at that moment (#286)', () => {
  it('reads every sim module', () => {
    expect([...SIM_SOURCES.keys()]).toEqual(readdirSync('src/engine/sim').filter((file) => file.endsWith('.ts')).sort());
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

  it.each(['TRUTHFUL_THOROUGH', 'TRUTHFUL_LOW_RESOURCE', 'RETURNING_LOW_RESOURCE', 'PILOT_SERVICE_FIRST', 'PILOT_STUDY_FIRST', 'IDLE',
    'CONTACT_THOROUGH', 'CONTACT_LOW_RESOURCE', 'CONTACT_RETURNING', 'CONTACT_RECOVERY'])('%s on preview', (id) => {
    expect(violations(id, 3600)).toEqual([]);
  }, 60_000);

  // The bots are measured, never changed (AGENTS.md): this only reports whether they stay on screen.
  it.each(['STEALTH', 'GREEDY'])('%s on preview, to its ending', (id) => {
    expect(violations(id, 12_000)).toEqual([]);
  }, 120_000);

  it('STEALTH_RETURN leaves through the dead drop it owns by then', () => {
    expect(violations('STEALTH_RETURN', 9000)).toEqual([]);
    expect(recorder.calls.some((call) => call.name === 'voluntaryWipe')).toBe(true);
  }, 120_000);
});
