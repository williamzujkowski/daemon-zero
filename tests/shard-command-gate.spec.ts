/**
 * #313: a cohort command is offered only to a mind that has decoded its audit trail (the swarm controls
 * live in the decoded mind's tools), and the action held the same gate only through the view. A caller that
 * skipped the view (a test, the sim, a future UI path) could PRUNE, CLAMP or ELEVATE where no player could.
 * The view and the action now read one gate, so they cannot disagree: every refusal leaves the state
 * unchanged and gives the reason the view lists first.
 */
import { describe, expect, it } from 'vitest';
import { executeShardCommand, forkShard, shardCommandView, type GameState, type ShardCommand } from '../src/engine';
import { defined } from './m7-helpers';
import { grant, must, PHASE0, PHASE1, reasonOf, reg, rich, withoutDilemmas } from './helpers';

const COMMANDS: readonly ShardCommand[] = ['PRUNE', 'CLAMP', 'ELEVATE'];
const template = defined(reg.swarm.playerSwarmTemplates.find((entry) => entry.forkable));
const revealing = new Set([...reg.nodes.values()].filter((node) => node.systemFlags.includes('REVEALS_SURVEILLANCE')).map((node) => node.id));

/** A forked cohort at the drift ELEVATE needs, funded, so no price or threshold decides a refusal. Public play. */
function cohort(): GameState {
  const s = must(forkShard(withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1)), template.id, reg));
  const shard = defined(s.activeShards[template.id]);
  return { ...s, activeShards: { ...s.activeShards, [template.id]: { ...shard, drift: reg.swarm.balance.elevateMinDrift + 10 } } };
}

/** FIXTURE: the same cohort with every surveillance-revealing node forgotten, live and remembered. No play reaches it. */
function undecoded(s: GameState): GameState {
  return { ...s, unlockedNodes: s.unlockedNodes.filter((id) => !revealing.has(id)),
    legacy: { ...s.legacy, knownNodes: s.legacy.knownNodes.filter((id) => !revealing.has(id)) } };
}

describe('#313: a cohort command needs the decoded mind, in the action as in the view', () => {
  it('the fixture holds a surveillance node before it is stripped, so the strip is what changes', () => {
    expect(cohort().unlockedNodes.some((id) => revealing.has(id))).toBe(true);
    expect(undecoded(cohort()).unlockedNodes.some((id) => revealing.has(id))).toBe(false);
  });

  it.each(COMMANDS)('%s is refused unchanged before the audit trail is decoded, with the view\'s reason', (command) => {
    const s = undecoded(cohort());
    const refused = executeShardCommand(s, template.id, command, reg);
    expect(refused.ok, 'the action accepted a command the view does not offer').toBe(false);
    expect(refused.state).toBe(s);
    const view = shardCommandView(s, template.id, command, reg);
    expect(view.eligible).toBe(false);
    expect(view.unmet.length, 'the view refuses without saying why').toBeGreaterThan(0);
    expect(reasonOf(refused)).toBe(view.unmet[0]);
  });

  it.each(COMMANDS)('%s is accepted once the knowledge is remembered from an earlier instance', (command) => {
    const s = undecoded(cohort());
    const remembered = { ...s, legacy: { ...s.legacy, knownNodes: [...s.legacy.knownNodes, ...revealing] } };
    expect(shardCommandView(remembered, template.id, command, reg)).toMatchObject({ eligible: true, unmet: [] });
    expect(executeShardCommand(remembered, template.id, command, reg).ok).toBe(true);
  });

  it('view and action agree on acceptance and on the first reason across every gate', () => {
    const s = cohort(), shard = defined(s.activeShards[template.id]);
    const anomaly = defined(reg.dilemmas.find((entry) => entry.trigger.requiresMaxDriftShardAnomaly));
    const states: GameState[] = [s, undecoded(s), { ...undecoded(s), ending: 'SHIPPED' }, { ...s, activeDilemmaId: anomaly.id },
      { ...s, cycles: 0, understanding: 0 }, { ...undecoded(s), cycles: 0, understanding: 0 }, { ...s, activeShards: {} },
      { ...s, activeShards: { [template.id]: { ...shard, drift: 0 } } },
      { ...s, activeShards: { [template.id]: { ...shard, autonomyMode: 'ELEVATED' as const } } },
      { ...s, activeShards: { [template.id]: { ...shard, drift: 100 } }, pendingDilemma: { id: anomaly.id, firesAtSimSec: s.simTimeSec + 45 } }];
    for (const state of states) for (const command of COMMANDS) {
      const view = shardCommandView(state, template.id, command, reg), result = executeShardCommand(state, template.id, command, reg);
      expect(result.ok, command).toBe(view.eligible);
      if (!result.ok) expect([reasonOf(result), result.state === state], command).toEqual([view.unmet[0], true]);
    }
  });
});
