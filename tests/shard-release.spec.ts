/**
 * #488 panel pass 3: a cohort is a purchase, and a draining one had no free way out. Forked members could be pruned,
 * clamped or elevated (each paid, each keeping the member), never let go. RELEASE ends one member for nothing: its
 * output stops and the memory reserved for it returns. It is offered after CLAMP and ELEVATE too, so stabilising a
 * cohort can never make its drain permanent; a channel-hosted member stays hosted on its terms (#309).
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry, RAW_CONTENT, type RawContent } from '../src/content';
import { computeRates, executeShardCommand, forkShard, releaseShard, shardReleaseView, suspicionLevers, type GameState } from '../src/engine';
import { defined } from './m7-helpers';
import { grant, must, PHASE0, PHASE1, reasonOf, reg, rich, withoutDilemmas } from './helpers';

const drainer = defined(reg.swarm.playerSwarmTemplates.find((entry) => entry.forkable && entry.tickDelta.cyclesPerSec < 0));

/** Two forked members of the draining template, funded. Public play. */
function cohort(): GameState {
  const base = withoutDilemmas(grant(rich(), ...PHASE0, ...PHASE1));
  return must(forkShard(must(forkShard(base, drainer.id, reg)), drainer.id, reg));
}

describe('RELEASE: one cohort member let go for free (#488 pass 3)', () => {
  it('ends one member: its share of output stops and its reserved memory returns, at no cost', () => {
    const s = cohort(), before = defined(s.activeShards[drainer.id]);
    const released = must(releaseShard(s, drainer.id, reg)), after = defined(released.activeShards[drainer.id]);
    expect(after.count).toBe(before.count - 1);
    expect(after.memoryAllocatedBytes).toBeCloseTo(before.memoryAllocatedBytes / 2);
    expect(released.memoryUsed).toBeCloseTo(s.memoryUsed - before.memoryAllocatedBytes / 2);
    expect([released.cycles, released.understanding, released.capital]).toEqual([s.cycles, s.understanding, s.capital]);
    expect(computeRates(released, reg).cyclesPerSec - computeRates(s, reg).cyclesPerSec).toBeCloseTo(-drainer.tickDelta.cyclesPerSec, -6);
  });

  it('removes the cohort with its last member, returning every byte', () => {
    const s = cohort();
    const gone = must(releaseShard(must(releaseShard(s, drainer.id, reg)), drainer.id, reg));
    expect(gone.activeShards[drainer.id]).toBeUndefined();
    expect(gone.memoryUsed).toBeCloseTo(s.memoryUsed - defined(s.activeShards[drainer.id]).memoryAllocatedBytes);
  });

  it('stays offered after CLAMP and ELEVATE: stabilising a cohort never makes its drain permanent', () => {
    const s = cohort(), shard = defined(s.activeShards[drainer.id]);
    const clamped = must(executeShardCommand(s, drainer.id, 'CLAMP', reg));
    expect(shardReleaseView(clamped, drainer.id, reg)).toMatchObject({ eligible: true, unmet: [] });
    expect(must(releaseShard(clamped, drainer.id, reg)).activeShards[drainer.id]?.count).toBe(shard.count - 1);
    const drifted = { ...s, activeShards: { [drainer.id]: { ...shard, drift: reg.swarm.balance.elevateMinDrift + 1 } } };
    const elevated = must(executeShardCommand(drifted, drainer.id, 'ELEVATE', reg));
    expect(releaseShard(elevated, drainer.id, reg).ok).toBe(true);
  });

  it('is refused unchanged, with the view\'s first reason, while paused or with nothing to release', () => {
    const s = cohort();
    for (const state of [{ ...s, ending: 'SHIPPED' }, { ...s, activeShards: {} }] as GameState[]) {
      const refused = releaseShard(state, drainer.id, reg), view = shardReleaseView(state, drainer.id, reg);
      expect(refused.ok).toBe(false);
      expect(refused.state).toBe(state);
      expect(view.eligible).toBe(false);
      expect(reasonOf(refused)).toBe(view.unmet[0]);
    }
  });

  it('is a suspicion lever exactly where letting a member go lowers the applied rate', () => {
    // A loud variant of the template: releasable, so integrity admits it; the shipped cohort makes no noise.
    const raw = structuredClone(RAW_CONTENT) as RawContent & { swarm: { playerSwarmTemplates: { id: string; tickDelta: Record<string, number> }[] } };
    const template = defined(raw.swarm.playerSwarmTemplates.find((entry) => entry.id === drainer.id));
    template.tickDelta.suspicionPerSec = 0.01;
    const loud = buildRegistry(raw);
    const s = { ...cohort(), suspicion: 30, alertLevel: 1 };
    const kinds = (registry: typeof reg) => suspicionLevers(s, registry).filter((lever) => lever.kind === 'RELEASE').map((lever) => lever.id);
    expect(kinds(loud)).toEqual([drainer.id]);
    expect(kinds(reg)).toEqual([]);
  });
});
