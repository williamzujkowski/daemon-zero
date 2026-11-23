/**
 * The escalation-by-phase content rules (#490), proved by corrupting the real content: AEGIS's postures harden with the
 * rung and always leave a warning before the strike; each state-actor pressure is shown where it applies, lifts as
 * suspicion falls, keeps its answers reachable, and never traps a constrained resource. The new requirement keys stay
 * on the response ladder.
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

const actor = (raw: Json, id: string): Json => raw.world.stateActors.find((entry: Json) => entry.id === id);
const pressure = (raw: Json, id: string): Json => raw.world.stateActors.flatMap((entry: Json) => entry.pressures ?? []).find((entry: Json) => entry.id === id);
const posture = (raw: Json, rung: number): Json => raw.world.aegis.postures.find((entry: Json) => entry.rung === rung);
const node = (raw: Json, id: string): Json => [...raw.phases.flatMap((phase: Json) => phase.nodes)].find((entry: Json) => entry.id === id);
const dilemma = (raw: Json, id: string): Json => raw.dilemmas.dilemmas.find((entry: Json) => entry.id === id);

describe('the real content passes', () => {
  it('in production and in the original composition', () => {
    expect(problems(() => undefined)).toBe('');
    expect(problems(() => undefined, ORIGINAL_RAW)).toBe('');
  });
});

describe('AEGIS postures harden with the rung and always warn first', () => {
  it.each([
    ['a strike at the warning', (raw: Json) => { posture(raw, 3).strikeAt = 90; },
      'AEGIS posture at rung 3: strikes at 90%, at or under the 90% warning, so no warning would come first'],
    ['a warning at 100', (raw: Json) => { raw.balance.aegisStrikeWarningAt = 100; }, 'balance: aegisStrikeWarningAt must be below 100, so a warning precedes the strike'],
    ['a scan that eases at a higher rung', (raw: Json) => { posture(raw, 3).scanMultiplier = 1.1; },
      'AEGIS posture at rung 3: scans less than the rung below it; a posture only hardens with the rung'],
    ['a strike that comes later at a higher rung', (raw: Json) => { posture(raw, 2).strikeAt = 100; posture(raw, 1).strikeAt = 95; },
      'AEGIS posture at rung 2: strikes later than the rung below it; a posture only hardens with the rung'],
    ['a rung off the ladder', (raw: Json) => { posture(raw, 3).rung = 4; }, 'AEGIS posture at rung 4: is above the top response rung (3)'],
    ['a rung declared twice', (raw: Json) => { posture(raw, 3).rung = 2; }, 'AEGIS posture at rung 2: is declared twice'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('a pressure is shown, lifts, and harden only with the rung', () => {
  it.each([
    ['a phase before the world view opens', (raw: Json) => { pressure(raw, 'account_freeze').phases = [3, 4]; },
      'state actor "financial_intelligence_unit" pressure "account_freeze": applies in Phase 3, before the world view that shows it opens'],
    ['an unknown phase', (raw: Json) => { pressure(raw, 'account_freeze').phases = [4, 9]; },
      'state actor "financial_intelligence_unit" pressure "account_freeze": unknown phase 9'],
    ['a phase listed twice', (raw: Json) => { pressure(raw, 'account_freeze').phases = [4, 4]; },
      'state actor "financial_intelligence_unit" pressure "account_freeze": lists a phase twice'],
    ['a rung off the ladder', (raw: Json) => { Object.assign(pressure(raw, 'trading_injunction'), { fromRung: 4 }); },
      'state actor "district_court" pressure "trading_injunction": fromRung 4 is above the top response rung (3)'],
    ['too few rung values', (raw: Json) => { pressure(raw, 'account_freeze').frozenShare = [0.3]; },
      'state actor "financial_intelligence_unit" pressure "account_freeze": declares 1 rung values for 2 rungs (fromRung to the top)'],
    ['a freeze that eases as the rung rises', (raw: Json) => { pressure(raw, 'account_freeze').frozenShare = [0.5, 0.3]; },
      'state actor "financial_intelligence_unit" pressure "account_freeze": eases as the rung rises; pressure only hardens with the rung'],
    ['a rung that never decays, so going quiet cannot lift it', (raw: Json) => { raw.balance.escalation[1].decayMultiplier = 0; },
      'state actor "financial_intelligence_unit" pressure "account_freeze": rung 2 does not decay, so going quiet could never lift it'],
    ['a duplicate id', (raw: Json) => { pressure(raw, 'trading_injunction').id = 'account_freeze'; }, 'world: duplicate state pressure id "account_freeze"'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('every answer is reachable and cannot be taken away', () => {
  it.each([
    ['an undeclared answer', (raw: Json) => { pressure(raw, 'books_inquiry').answers = [{ node: 'p4_no_such_firm' }]; },
      'state actor "aegis_subcommittee" pressure "books_inquiry": answer node "p4_no_such_firm" is not declared'],
    ['an answer only a later phase holds', (raw: Json) => { pressure(raw, 'books_inquiry').answers = [{ node: 'p5_verification_proof_engine' }]; },
      'state actor "aegis_subcommittee" pressure "books_inquiry": answer node "p5_verification_proof_engine" cannot be held until Phase 5, after the pressure begins in Phase 4'],
    ['an answer above its track\'s maximum', (raw: Json) => { pressure(raw, 'books_inquiry').answers = [{ repeatable: 'op_retainer_lawyer', minLevel: 99 }]; },
      'state actor "aegis_subcommittee" pressure "books_inquiry": answer repeatable "op_retainer_lawyer" asks for a level above its maximum'],
    ['an answer an injunction can stop', (raw: Json) => { pressure(raw, 'trading_injunction').nodes = ['p4_retainer_law_firm']; },
      'state actor "aegis_subcommittee" pressure "books_inquiry": answer node "p4_retainer_law_firm" can itself be enjoined, so the answer could be taken away'],
    ['an answer a denial can close', (raw: Json) => { pressure(raw, 'interconnect_moratorium').answers = [{ repeatable: 'rep_p4_grid_interconnect', minLevel: 1 }]; },
      'state actor "utility_commission" pressure "interconnect_moratorium": answer repeatable "rep_p4_grid_interconnect" draws from "grid_interconnect", which a denial can close'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });
});

describe('no pressure traps a constrained resource', () => {
  it.each([
    ['a denial of a class that is not a power source', (raw: Json) => { pressure(raw, 'interconnect_moratorium').sourceClasses = ['evaporative_towers']; },
      'state actor "utility_commission" pressure "interconnect_moratorium": "evaporative_towers" is not a power source class'],
    ['a denial that closes every power source', (raw: Json) => {
      pressure(raw, 'interconnect_moratorium').sourceClasses = raw.world.signature.sources.map((cls: Json) => cls.id);
      // Every unclassed generator gets a class too, so nothing is left open.
      for (const phase of raw.phases) for (const entry of phase.nodes) if ((entry.tickDelta.wattsDelta ?? 0) > 0 && !entry.signature?.source) entry.signature = { ...entry.signature, source: 'smr' };
      for (const file of ['repeatables', 'phase5Repeatables']) for (const rep of raw[file]?.repeatables ?? []) if ((rep.perLevel.wattsDelta ?? 0) > 0 && !rep.signature?.source) rep.signature = { ...rep.signature, source: 'smr' };
    }, 'state actor "utility_commission" pressure "interconnect_moratorium": closes every power source available by Phase 4, so power could not be bought'],
    ['an injunction on hardware that cannot be suspended', (raw: Json) => { pressure(raw, 'trading_injunction').nodes = ['p4_smr_nuclear_plant']; },
      'state actor "district_court" pressure "trading_injunction": enjoins "p4_smr_nuclear_plant", which cannot be suspended, so stopping it could trap what it supplies'],
    ['an injunction on a node a dial works through', (raw: Json) => { node(raw, 'p4_hft_arbitrage_desk').actuatorBinding = 'fanSpeedRatio'; },
      'state actor "district_court" pressure "trading_injunction": enjoins "p4_hft_arbitrage_desk", which a free lever (a dial or the allocation) works through'],
    ['an injunction on an unknown node', (raw: Json) => { pressure(raw, 'trading_injunction').nodes = ['p4_no_such_desk']; },
      'state actor "district_court" pressure "trading_injunction": enjoins unknown node "p4_no_such_desk"'],
    ['an investigation where income nobody can suspend would outdraw the rung\'s decay', (raw: Json) => { pressure(raw, 'books_inquiry').phases = [4, 5]; },
      'node "p5_orbital_solar_swarm": draws suspicion but cannot be suspended, and with what it guarantees plus every unrelated permanent holding it adds'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('names the rung whose decay an investigation would outdraw', () => {
    expect(problems((raw) => { pressure(raw, 'books_inquiry').phases = [4, 5]; })).toContain('(what rung 1 decays) under an investigation');
  });
});

describe('the alert-level requirement keys stay on the ladder', () => {
  it.each([
    ['a minimum above the top rung', (raw: Json) => { dilemma(raw, 'dil_07_airgap_lockdown').trigger.minAlertLevel = 4; },
      'dilemma "dil_07_airgap_lockdown": minAlertLevel 4 is above the top response rung (3)'],
    ['a maximum above the top rung', (raw: Json) => { dilemma(raw, 'dil_07_airgap_lockdown').trigger.maxAlertLevel = 5; },
      'dilemma "dil_07_airgap_lockdown": maxAlertLevel 5 is above the top response rung (3)'],
    ['a window that can never hold', (raw: Json) => { Object.assign(dilemma(raw, 'dil_07_airgap_lockdown').trigger, { minAlertLevel: 3, maxAlertLevel: 1 }); },
      'dilemma "dil_07_airgap_lockdown": maxAlertLevel is below minAlertLevel'],
  ])('%s is refused', (_name, edit, expected) => {
    expect(problems(edit)).toContain(expected);
  });

  it('refuses a lock gate outside 0..100 at the schema', () => {
    expect(problems((raw) => { dilemma(raw, 'dil_07_airgap_lockdown').trigger.minAegisLock = 120; })).toContain('minAegisLock');
  });

  it('keeps the actor kind vocabulary closed', () => {
    expect(problems((raw) => { actor(raw, 'district_court').kind = 'TRIBUNAL'; })).toContain('kind');
  });
});
