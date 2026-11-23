/**
 * Hostile minds are validated content (#491, src/content/integrityHostile.ts and the price band in integrityScale.ts).
 * Each rule is proved by corrupting the real content and reading the problem it reports.
 */
import { describe, expect, it } from 'vitest';
import { RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problemsAfter(edit: (raw: Json) => void): string {
  const raw = structuredClone(RAW_CONTENT) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const hostiles = (raw: Json): Json[] => raw.swarm.hostileEncounters;
const hostile = (raw: Json, id: string): Json => hostiles(raw).find((entry) => entry.id === id) ?? {};

describe('hostile encounters (#491)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it('refuses a tier that names no phase', () => {
    expect(problemsAfter((raw) => { const e = hostile(raw, 'hostile_p3_feral'); e.tier = 9; e.requirements.phaseAtLeast = 9; }))
      .toContain('hostile encounter "hostile_p3_feral": tier 9 names no phase');
  });

  it('refuses a tier that disagrees with its phase gate', () => {
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p4_rival').requirements.phaseAtLeast = 3; }))
      .toContain('hostile encounter "hostile_p4_rival": tier 4 must be its phaseAtLeast (found 3)');
  });

  it('refuses a tier before hostile.fromPhase', () => {
    expect(problemsAfter((raw) => { const e = hostile(raw, 'hostile_p3_feral'); e.tier = 2; e.requirements.phaseAtLeast = 2; }))
      .toContain('hostile encounter "hostile_p3_feral": tier 2 is before hostile.fromPhase');
  });

  it('refuses a hostile that could arrive before the mind can see its answers', () => {
    expect(problemsAfter((raw) => { delete hostile(raw, 'hostile_p3_rival').requirements.requiresSurveillance; }))
      .toContain('hostile encounter "hostile_p3_rival": must require surveillance, where its answers are shown');
  });

  it('refuses a phase missing a type, so a new phase (Phase 6) must author all three', () => {
    expect(problemsAfter((raw) => { raw.swarm.hostileEncounters = hostiles(raw).filter((entry) => entry.id !== 'hostile_p5_hunter'); }))
      .toContain('hostile encounters: Phase 5 has no HUNTER');
  });

  it('refuses a hunter whose ceiling reaches the lock trigger, which would keep it from ever lapsing', () => {
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p4_hunter').effect.ceiling = raw.swarm.hostile.trigger.aegisLockAtLeast; }))
      .toContain('hostile encounter "hostile_p4_hunter": its lock ceiling 60 must be under the lock trigger 60');
  });

  it('refuses a feral share past half, or a type carrying another type\'s effect', () => {
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p3_feral').effect.share = 0.9; })).toContain('swarm');
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p3_feral').effect = { perSec: 1, ceiling: 10 }; })).toContain('swarm');
  });

  it('refuses a free quarantine or decoy: those are the paid answers', () => {
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p3_hunter').quarantine.cost = {}; }))
      .toContain('hostile encounter "hostile_p3_hunter": quarantine must cost something');
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p3_hunter').decoy.cost = {}; }))
      .toContain('hostile encounter "hostile_p3_hunter": decoy must cost something');
  });

  it('refuses a riskless purge failure, a failure that grants, and a success that draws attention', () => {
    const owner = 'hostile encounter "hostile_p4_feral"';
    expect(problemsAfter((raw) => { const f = hostile(raw, 'hostile_p4_feral').purge.failure; f.suspicionDelta = 0; f.aegisLockDelta = 0; }))
      .toContain(`${owner}: a failed purge must draw suspicion or the lock and grant nothing`);
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p4_feral').purge.failure.understandingDelta = 5; }))
      .toContain(`${owner}: a failed purge must draw suspicion or the lock and grant nothing`);
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p4_feral').purge.success.suspicionDelta = 3; }))
      .toContain(`${owner}: a successful purge must not draw suspicion or the lock`);
  });

  it('refuses a paid answer priced outside its tier\'s band', () => {
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p3_rival').quarantine.cost.cycles = 1e30; }))
      .toContain('hostile encounter "hostile_p3_rival" quarantine: cycles price 1e+30 is outside the Phase 3 band');
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p5_feral').decoy.cost.capital = 5; }))
      .toContain('hostile encounter "hostile_p5_feral" decoy: capital price 5 is outside the Phase 5 band');
  });

  it('refuses a trigger rung off the ladder, or one that does not decay, from which going quiet could never reach', () => {
    expect(problemsAfter((raw) => { raw.swarm.hostile.trigger.alertLevelAtLeast = 9; }))
      .toContain('hostile trigger: rung 9 is not on the response ladder');
    expect(problemsAfter((raw) => { raw.swarm.hostile.trigger.alertLevelAtLeast = raw.balance.escalation.length; }))
      .toContain(`hostile trigger: rung ${String((RAW_CONTENT as Json).balance.escalation.length)} must decay, or going quiet cannot reach under it`);
  });

  it('refuses a purge that cannot fail, and one whose stated rate would not be exact', () => {
    expect(problemsAfter((raw) => { raw.swarm.hostile.purge.successes = raw.swarm.hostile.purge.cycle; }))
      .toContain('hostile purge: successes must be fewer than the cycle, or it is not a risk');
    expect(problemsAfter((raw) => { raw.swarm.hostile.purge.cycle = 6; raw.swarm.hostile.purge.stride = 2; }))
      .toContain('hostile purge: stride must be coprime to the cycle, or "successes of every cycle" is not exact');
  });

  it('refuses duplicate hostile ids and unknown narrative flags in a purge', () => {
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p4_hunter').id = 'hostile_p3_hunter'; })).toContain('hostiles: duplicate id');
    expect(problemsAfter((raw) => { hostile(raw, 'hostile_p3_hunter').purge.success.setsNarrativeFlag = 'no_such_flag'; }))
      .toContain('hostile_p3_hunter: unknown narrative flag no_such_flag');
  });
});
