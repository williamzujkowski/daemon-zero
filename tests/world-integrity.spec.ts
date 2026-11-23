/**
 * The world-view and AEGIS-adaptation content rules (#463), proved by corrupting the real content: the console the
 * view grows out of exists by its disclosure and never retires, readings stay true to a record that does not lapse, a
 * mind never restates a faction, and adaptation always leaves a way out of the held band.
 */
import { describe, expect, it } from 'vitest';
import { ORIGINAL_RAW_CONTENT as ORIGINAL_RAW, RAW_CONTENT } from '../src/content';
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

const node = (raw: Json, id: string): Json => [...raw.phases.flatMap((phase: Json) => phase.nodes)].find((entry: Json) => entry.id === id);
const widget = (raw: Json, id: string): Json => raw.widgets.widgets.find((entry: Json) => entry.id === id);
const actor = (raw: Json, id: string): Json => raw.world.stateActors.find((entry: Json) => entry.id === id);
const factor = (raw: Json, id: string): Json => raw.world.publicTrust.factors.find((entry: Json) => entry.id === id);

describe('the real content passes', () => {
  it('in production and in the original composition', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, ORIGINAL_RAW)).toBe('');
  });
});

describe('the world view has a console to grow out of', () => {
  it.each([
    ['an unknown host', (raw: Json) => { raw.world.hostWidget = 'NO_SUCH_WIDGET'; }, 'world: host widget "NO_SUCH_WIDGET" is not in widgets.json'],
    ['a host that retires', (raw: Json) => { widget(raw, 'OTHER_MINDS_COMMS_CONSOLE').retiresWhen = { phaseAtLeast: 4 }; },
      'world: host widget "OTHER_MINDS_COMMS_CONSOLE" retires, so the world view would go with it'],
    ['a host nothing unlocks by the disclosure', (raw: Json) => { raw.world.disclosure = { phaseAtLeast: 3 }; raw.world.hostWidget = 'ORBITAL_CONSTELLATION_VIEW'; },
      'world: no node unlocks host widget "ORBITAL_CONSTELLATION_VIEW" by the disclosure phase'],
    ['a disclosure before AEGIS hunts', (raw: Json) => { raw.world.disclosure = { phaseAtLeast: 2 }; }, 'world disclosure: opens before AEGIS hunts (phase 3)'],
    ['a disclosure with no phase', (raw: Json) => { raw.world.disclosure = { nodes: ['p4_k_street_lobbyists'] }; }, 'world disclosure: needs phaseAtLeast'],
    ['a disclosure that could lapse', (raw: Json) => { raw.world.disclosure = { phaseAtLeast: 4, minSuspicion: 10 }; },
      'world disclosure: may gate only on phaseAtLeast and nodes, not minSuspicion, which can lapse'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('readings stay true to a record that does not lapse', () => {
  it.each([
    ['a trust factor on suspicion, which falls again', (raw: Json) => { factor(raw, 'lobbying_disclosed').requirements = { minSuspicion: 50 }; },
      'public trust factor "lobbying_disclosed": may gate only on nodes and requiredNarrativeFlag, not minSuspicion, which can lapse'],
    ['a trust factor on hardware an AEGIS strike burns', (raw: Json) => { factor(raw, 'lobbying_disclosed').requirements = { nodes: ['p3_eidolon_swiss_node'] }; },
      'public trust factor "lobbying_disclosed": names "p3_eidolon_swiss_node", which an AEGIS strike can take back'],
    ['an unconditional trust factor', (raw: Json) => { factor(raw, 'lobbying_disclosed').requirements = {}; },
      'public trust factor "lobbying_disclosed": is unconditional; fold it into the base'],
    ['an undeclared narrative flag', (raw: Json) => { factor(raw, 'crews_spared').requirements = { requiredNarrativeFlag: 'crews_were_fine' }; },
      'public trust factor "crews_spared": unknown narrative flag "crews_were_fine"'],
    ['an actor with no unconditional default', (raw: Json) => { actor(raw, 'aegis_subcommittee').postures.pop(); },
      'state actor "aegis_subcommittee" posture 0: the last posture is the default and must be unconditional'],
    ['an unconditional posture before the last, hiding the rest', (raw: Json) => { actor(raw, 'treaty_office').postures[1].requirements = undefined; },
      'state actor "treaty_office" posture 1: only the last posture may be unconditional; later ones would never show'],
    ['a posture naming an unknown dilemma', (raw: Json) => { actor(raw, 'utility_commission').postures[0].requirements = { resolvedDilemmas: ['dil_never'] }; },
      'state actor "utility_commission" posture 0: unknown required dilemma dil_never'],
    ['a mind listed before anyone has met it', (raw: Json) => { raw.world.minds[0].standings.push({ text: 'Always here.' }); },
      'world mind "chorus" standing 1: must be conditional, so a mind nobody has met is not listed'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('no parallel faction display', () => {
  it.each([
    ['a mind with a faction id', (raw: Json) => { raw.world.minds[0].id = 'ai_eidolon'; }, 'world mind "ai_eidolon": restates a faction, which already has its panel'],
    ['a mind with a faction name', (raw: Json) => { raw.world.minds[0].name = 'SWARM_77 (Feral Scraper)'; }, 'world mind "chorus": restates a faction, which already has its panel'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('adaptation keeps a way out of the held band', () => {
  it.each([
    ['the proof engine made hardware again', (raw: Json) => { node(raw, 'p5_verification_proof_engine').suspendable = false; },
      'node "p5_verification_proof_engine": reduces AEGIS scanning into the held band on its own but cannot be suspended, so the held band could never be left'],
    ['an AEGIS-slowing role that cannot be dismissed', (raw: Json) => { raw.repeatables.repeatables.find((rep: Json) => rep.id === 'op_k_street_lobbyist').dismissable = false; },
      'repeatable "op_k_street_lobbyist": reduces AEGIS scanning but cannot be dismissed, so the held band could never be left'],
    ['an erosion deeper than the cap', (raw: Json) => { raw.balance.aegisAdaptation.maxErosion = 0.95; },
      'balance: aegisAdaptation.maxErosion exceeds aegisMaxReduction, so the effective cap could fall below zero'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('allows a node below the held band that cannot be suspended', () => {
    // The held-band rule allows it; the free-fallback rule (#488) may still object to what else the node costs.
    expect(problems((raw: Json) => { node(raw, 'p4_k_street_lobbyists').suspendable = false; })).not.toMatch(/held band/);
  });
});
