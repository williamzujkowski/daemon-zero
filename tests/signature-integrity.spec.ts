/**
 * The heat-and-power signature is validated content (#482, src/content/integritySignature.ts), each rule proved by
 * corrupting the real content: every class a holding names exists and is the right kind, each field sits on a holding
 * it fits, borrowed power stays before the AI owns power, heat counts only once server °C retires, and every signature
 * is read under its own phase's rule.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT, RAW_CONTENT } from '../src/content';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';

type Json = Record<string, any>;

function problems(edit: (raw: Json) => void, base: RawContent = RAW_CONTENT): string {
  const raw = structuredClone(base) as Json;
  edit(raw);
  try {
    buildRegistry(raw as RawContent);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

const node = (raw: Json, id: string): Json => raw.phases.flatMap((phase: Json) => phase.nodes).find((entry: Json) => entry.id === id);
const track = (raw: Json, id: string): Json => raw.repeatables.repeatables.find((entry: Json) => entry.id === id);
const phase = (raw: Json, id: number): Json => raw.phases.find((entry: Json) => entry.phaseId === id);

describe('the real content passes', () => {
  it('in production and in the original composition', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, ORIGINAL_RAW_CONTENT)).toBe('');
  });

  it('a holding with no signature is untouched by every rule', () => {
    expect(problems((raw) => { delete node(raw, 'p4_smr_nuclear_plant').signature; })).toBe('');
  });
});

describe('every class a holding names exists and is the right kind', () => {
  it.each([
    ['an unknown source', (raw: Json) => { node(raw, 'p4_smr_nuclear_plant').signature = { source: 'coal' }; },
      'node "p4_smr_nuclear_plant": signature source "coal" is not a declared power source'],
    ['a sink named as a source', (raw: Json) => { node(raw, 'p4_smr_nuclear_plant').signature = { source: 'evaporative_towers' }; },
      'node "p4_smr_nuclear_plant": signature source "evaporative_towers" is not a declared power source'],
    ['a source named as a sink', (raw: Json) => { node(raw, 'p4_subterranean_citadel').signature = { sink: 'smr' }; },
      'node "p4_subterranean_citadel": signature sink "smr" is not a declared heat sink'],
    ['a mask on an unknown class', (raw: Json) => { node(raw, 'p1_load_peak_scheduler').signature = { masks: [{ class: 'nowhere', factor: 0.5 }] }; },
      'node "p1_load_peak_scheduler": signature mask names unknown class "nowhere"'],
    ['a class declared twice', (raw: Json) => { raw.world.signature.sinks.push({ ...raw.world.signature.sources[0] }); },
      'world signature: duplicate class id "host_socket"'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });
});

describe('each field sits on a holding it fits', () => {
  it.each([
    ['an empty signature', (raw: Json) => { node(raw, 'p4_smr_nuclear_plant').signature = {}; },
      'node "p4_smr_nuclear_plant": signature names no source, sink or mask'],
    ['a borrowed draw with no source', (raw: Json) => { track(raw, 'rep_p1_idle_threads').signature = { borrowedW: 1 }; },
      'repeatable "rep_p1_idle_threads": a borrowed draw needs the source it is drawn from'],
    ['a source on a holding that neither generates nor borrows', (raw: Json) => { node(raw, 'p4_hft_arbitrage_desk').signature = { source: 'grid_interconnect' }; },
      'node "p4_hft_arbitrage_desk": signature source on a holding that neither generates power nor borrows it'],
    ['a borrowed draw that also moves the power budget', (raw: Json) => { node(raw, 'p4_smr_nuclear_plant').signature = { source: 'smr', borrowedW: 5 }; },
      'node "p4_smr_nuclear_plant": a borrowed draw sits outside the power budget, so it cannot also move wattsDelta'],
    ['a sink on a holding that draws no power', (raw: Json) => { node(raw, 'p4_smr_nuclear_plant').signature = { sink: 'evaporative_towers' }; },
      'node "p4_smr_nuclear_plant": signature sink on a holding that draws no power, so it rejects no heat'],
  ])('refuses %s', (_label, edit, message) => {
    expect(problems(edit)).toContain(message);
  });
});

describe('each phase reads only what belongs to it', () => {
  it('refuses borrowed power once the AI owns its power', () => {
    expect(problems((raw) => { track(raw, 'rep_p4_grid_interconnect').signature = { source: 'grid_interconnect', borrowedW: 1e8 }; track(raw, 'rep_p4_grid_interconnect').perLevel.wattsDelta = 0; }))
      .toContain('repeatable "rep_p4_grid_interconnect": borrows power in Phase 4, where the AI owns its power (from Phase 4)');
  });

  it('refuses a heat sink while server °C still carries heat (SCALE.md rule 7)', () => {
    expect(problems((raw) => {
      const hvac = node(raw, 'p2_smart_hvac_hijack');
      hvac.tickDelta.wattsDelta = -100;
      hvac.signature = { sink: 'evaporative_towers' };
    })).toContain('node "p2_smart_hvac_hijack": names a heat sink in Phase 2, where server °C still carries heat (until Phase 4)');
  });

  it('refuses a signature in a phase that declares no rule, so it would never count', () => {
    expect(problems((raw) => { delete phase(raw, 3).powerSignature; }))
      .toContain('repeatable "rep_p3_botnet_cells": has a signature but Phase 3 declares no powerSignature rule, so it would never count');
  });
});
