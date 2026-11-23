/**
 * Radiator area is validated content (#465, integrityRadiator.ts), each rule proved by corrupting the real content:
 * only a heat sink is area-bound, radiator is deployed only into an area-bound sink, compute that needs radiator can
 * find some, and a holding whose own radiators cannot shed its heat has a free way back.
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

const node = (raw: Json, id: string): Json =>
  (raw.phases as Json[]).flatMap((phase) => phase.nodes as Json[]).find((entry) => entry.id === id) ?? {};
const track = (raw: Json, id: string): Json => (raw.repeatables.repeatables as Json[]).find((entry) => entry.id === id) ?? {};
const classes = (raw: Json, kind: 'sources' | 'sinks'): Json[] => raw.world.signature[kind] as Json[];

describe('radiator area (#465)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it('refuses watts per km² on a power source: only a heat sink sheds through radiator', () => {
    expect(problemsAfter((raw) => { (classes(raw, 'sources').find((cls) => cls.id === 'space_solar') ?? {}).wattsPerKm2 = 1e9; }))
      .toMatch(/source "space_solar" declares wattsPerKm2/);
  });

  it('refuses radiator deployed into a sink that is not area-bound', () => {
    expect(problemsAfter((raw) => { node(raw, 'p5_neuromorphic_substrate').signature.sink = 'underground_aquifer'; }))
      .toMatch(/node "p5_neuromorphic_substrate": deploys radiator area, but its sink is not area-bound/);
  });

  it('refuses a radiator-only holding that deploys none: a sink with no draw and no radiator rejects nothing', () => {
    expect(problemsAfter((raw) => { delete track(raw, 'rep_p5_radiator_wings').signature.radiatorKm2; }))
      .toMatch(/repeatable "rep_p5_radiator_wings": signature sink on a holding that draws no power/);
  });

  it('refuses orbital compute nobody can switch off when its own radiators cannot shed its heat', () => {
    expect(problemsAfter((raw) => { node(raw, 'p5_orbital_compute_platform').suspendable = false; }))
      .toMatch(/node "p5_orbital_compute_platform": rejects more heat through "orbital_radiator" than its own radiators shed but cannot be undone/);
    expect(problemsAfter((raw) => { track(raw, 'rep_p5_orbital_compute_tranches').dismissable = false; }))
      .toMatch(/repeatable "rep_p5_orbital_compute_tranches": rejects more heat/);
  });

  it('admits a permanent holding whose own radiators cover its heat: it throttles nobody', () => {
    // The cores carry 3 km² for their 2.6 GW, so radiator is not why they need a free lever (their signature still is).
    const problems = problemsAfter((raw) => { node(raw, 'p5_neuromorphic_substrate').suspendable = false; });
    expect(problems).not.toMatch(/p5_neuromorphic_substrate": rejects more heat/);
    expect(problems).toMatch(/p5_neuromorphic_substrate": draws suspicion but cannot be suspended/);
  });

  it('refuses compute on an area-bound sink when nothing deploys radiator into it', () => {
    expect(problemsAfter((raw) => {
      for (const id of ['p5_neuromorphic_substrate', 'p5_orbital_compute_platform', 'p5_cislunar_foundry']) delete node(raw, id).signature.radiatorKm2;
      for (const id of ['rep_p5_orbital_compute_tranches', 'rep_p5_radiator_wings']) delete track(raw, id).signature.radiatorKm2;
    })).toMatch(/compute rejects heat through "orbital_radiator", but nothing deploys radiator into it/);
  });
});
