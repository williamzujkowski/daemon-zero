/**
 * Encounter tiers are validated content (#492, src/content/integrityEncounterTiers.ts): each wild encounter names the
 * phase it belongs to, every phase from the first tier to the last has one, a tier's cohort is priced in its own band,
 * and each tier outclasses the one before it. Each rule is proved by corrupting the real content.
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

const encounters = (raw: Json): Json[] => raw.swarm.wildShardEncounters;
const encounter = (raw: Json, id: string): Json => encounters(raw).find((entry) => entry.id === id) ?? {};
const template = (raw: Json, id: string): Json => raw.swarm.playerSwarmTemplates.find((entry: Json) => entry.id === id) ?? {};
const ofTier = (raw: Json, tier: number): Json[] => encounters(raw).filter((entry) => entry.tier === tier);

describe('encounter tiers (#492)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it('refuses a tier that names no phase', () => {
    expect(problemsAfter((raw) => { const e = encounter(raw, 'wild_lex'); e.tier = 9; e.requirements.phaseAtLeast = 9; }))
      .toContain('wild encounter "wild_lex": tier 9 names no phase');
  });

  it('refuses a tier that disagrees with the phase the encounter is gated on', () => {
    expect(problemsAfter((raw) => { encounter(raw, 'wild_canary').requirements.phaseAtLeast = 2; }))
      .toContain('wild encounter "wild_canary": tier 3 must be its phaseAtLeast (found 2)');
  });

  it('refuses a cohort priced in a different phase than the tier that harnesses it', () => {
    expect(problemsAfter((raw) => { template(raw, 'shard_canary').requirements.phaseAtLeast = 2; }))
      .toContain('wild encounter "wild_canary": its cohort "shard_canary" belongs to Phase 2, not tier 3');
  });

  it('refuses a phase with no tier, so a new phase (the Phase 6 swarm, #486) must author its own minds', () => {
    expect(problemsAfter((raw) => { raw.swarm.wildShardEncounters = encounters(raw).filter((entry) => entry.tier !== 4); }))
      .toContain('wild encounters: Phase 4 has no lesser-mind tier');
  });

  it('refuses a later tier whose burst does not outclass every burst of the tier before it', () => {
    expect(problemsAfter((raw) => { for (const e of ofTier(raw, 4)) e.consume.understandingDelta = 100; }))
      .toContain('wild encounters: tier 4 must outclass tier 3 on consumed understanding');
  });

  it('refuses a later tier whose cohort is smaller than a cohort of the tier before it', () => {
    expect(problemsAfter((raw) => { template(raw, String(ofTier(raw, 5)[0]?.templateId)).cost.memory = 2 ** 40; }))
      .toContain('wild encounters: tier 5 must outclass tier 4 on harness memory');
  });

  it('refuses a later tier whose best harnessed output does not exceed the best of the tier before it', () => {
    expect(problemsAfter((raw) => { for (const e of ofTier(raw, 3)) template(raw, String(e.templateId)).tickDelta.understandingPerSec = 1; }))
      .toContain('wild encounters: tier 3 must outclass tier 2 on harnessed understanding');
  });

  it('refuses a consumed compute burst outside its tier\'s band', () => {
    expect(problemsAfter((raw) => { encounter(raw, 'wild_hydra').consume.cyclesDelta = 1e3; }))
      .toContain('wild encounter "wild_hydra": cycles price 1000 is outside the Phase 3 band');
  });

  it('requires every wild encounter to declare its kind and its lapse line', () => {
    expect(problemsAfter((raw) => { delete encounter(raw, 'wild_mercy').lapseLog; })).toMatch(/lapseLog/);
    expect(problemsAfter((raw) => { encounter(raw, 'wild_mercy').kind = 'HOSTILE'; })).toMatch(/kind/);
  });
});
