/**
 * The conflict foundation is validated content (#517, src/content/integrityConflict.ts, the repair price band in
 * integrityScale.ts and the damage-aware divertible rule in integrityFallback.ts). Each rule is proved by corrupting
 * the real content and reading the problem it reports.
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

const conflict = (raw: Json): Json => raw.world.conflict;
const byId = (list: Json[], id: string, key = 'id'): Json => list.find((entry) => entry[key] === id) ?? {};
const raid = (raw: Json, id: string): Json => byId(conflict(raw).raids as Json[], id);
const holding = (raw: Json, key: 'node' | 'repeatable', id: string): Json => byId(conflict(raw).holdings as Json[], id, key);

describe('conflict content (#517)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it.each([
    ['a holding naming neither node nor repeatable', (raw: Json) => { delete holding(raw, 'node', 'p3_botnet_mesh').node; },
      'conflict holding: must name exactly one of node and repeatable'],
    ['a holding naming both', (raw: Json) => { holding(raw, 'node', 'p3_botnet_mesh').repeatable = 'rep_p3_botnet_cells'; },
      'conflict holding: must name exactly one of node and repeatable'],
    ['a holding naming no real node', (raw: Json) => { holding(raw, 'node', 'p3_botnet_mesh').node = 'p3_no_such_node'; },
      'conflict holding node "p3_no_such_node": names no such node'],
    ['an undeclared site class', (raw: Json) => { holding(raw, 'node', 'p3_botnet_mesh').siteClass = 'nowhere'; },
      'conflict holding node "p3_botnet_mesh": site class "nowhere" is not declared'],
    ['a member of an income class', (raw: Json) => { holding(raw, 'node', 'p3_botnet_mesh').siteClass = 'books'; },
      'conflict holding node "p3_botnet_mesh": site class "books" holds income, which has no member holdings'],
    ['a class member with no compute to lose', (raw: Json) => { holding(raw, 'node', 'p3_polymorphic_weights').siteClass = 'botnet'; },
      'conflict holding node "p3_polymorphic_weights": a member of site class "botnet" must yield compute, or damage takes nothing from it'],
    ['an undeclared defense type', (raw: Json) => { holding(raw, 'node', 'p3_polymorphic_weights').defense[0].type = 'wishful_thinking'; },
      'conflict holding node "p3_polymorphic_weights": defense type "wishful_thinking" is not declared'],
    ['a holding that adds nothing', (raw: Json) => { conflict(raw).holdings.push({ node: 'p0_proc_self' }); },
      'conflict holding node "p0_proc_self": adds nothing to the conflict'],
    ['a duplicate holding', (raw: Json) => { conflict(raw).holdings.push({ node: 'p3_botnet_mesh', siteClass: 'botnet' }); },
      'conflict: duplicate holding "p3_botnet_mesh"'],
  ])('refuses %s', (_label, edit, problem) => {
    expect(problemsAfter(edit)).toContain(problem);
  });

  it.each([
    ['a counter for an undeclared vector', (raw: Json) => { byId(conflict(raw).defenseTypes, 'guards').counters.siege = 1; },
      'defense type "guards": counters vector "siege", which is not declared'],
    ['a counter across domains', (raw: Json) => { byId(conflict(raw).defenseTypes, 'guards').counters.ddos = 1; },
      'defense type "guards": a SITE defense cannot counter CYBER vector "ddos"'],
  ])('refuses %s', (_label, edit, problem) => {
    expect(problemsAfter(edit)).toContain(problem);
  });

  it.each([
    ['a tier that is not its phase gate', (raw: Json) => { raid(raw, 'raid_p3_ddos').requirements.phaseAtLeast = 4; },
      'raid "raid_p3_ddos": tier 3 must be its phaseAtLeast (found 4)'],
    ['a raid before raid.fromPhase', (raw: Json) => { Object.assign(raid(raw, 'raid_p3_ddos'), { tier: 2 }); raid(raw, 'raid_p3_ddos').requirements.phaseAtLeast = 2; },
      'raid "raid_p3_ddos": tier 2 is before raid.fromPhase'],
    ['a raid in a domain not yet open', (raw: Json) => { Object.assign(raid(raw, 'raid_p4_drone_strike'), { tier: 3 }); raid(raw, 'raid_p4_drone_strike').requirements.phaseAtLeast = 3; },
      'raid "raid_p4_drone_strike": its SITE domain is not open in Phase 3'],
    ['a raid a mind cannot read', (raw: Json) => { delete raid(raw, 'raid_p3_ddos').requirements.requiresSurveillance; },
      'raid "raid_p3_ddos": must require surveillance, where its panel is shown'],
    ['a vector from another domain', (raw: Json) => { raid(raw, 'raid_p3_ddos').vector = 'drone_strike'; },
      'raid "raid_p3_ddos": a CYBER raid cannot come by SITE vector "drone_strike"'],
    ['an undeclared vector', (raw: Json) => { raid(raw, 'raid_p3_ddos').vector = 'telepathy'; },
      'raid "raid_p3_ddos": vector "telepathy" is not declared'],
    ['an undefendable vector', (raw: Json) => { for (const type of conflict(raw).defenseTypes) delete type.counters.ddos; },
      'raid "raid_p3_ddos": no holding provides a defense that counters "ddos"'],
    ['a target in another domain', (raw: Json) => { raid(raw, 'raid_p3_ddos').targets = ['halls']; },
      'raid "raid_p3_ddos": a CYBER raid cannot strike SITE site class "halls"'],
    ['an undeclared target', (raw: Json) => { raid(raw, 'raid_p3_ddos').targets = ['moon']; },
      'raid "raid_p3_ddos": target "moon" is not a site class'],
    ['a raided phase with no signature reference', (raw: Json) => { delete raw.phases[3].powerSignature; },
      'raid "raid_p3_ddos": Phase 3 declares no signature reference for its force'],
  ])('refuses %s', (_label, edit, problem) => {
    expect(problemsAfter(edit)).toContain(problem);
  });

  it('refuses a raided phase that leaves an open domain unraided', () => {
    expect(problemsAfter((raw) => {
      conflict(raw).raids = (conflict(raw).raids as Json[]).filter((entry) => !(entry.tier === 4 && entry.domain === 'SITE'));
    })).toContain('raids: Phase 4 has raids but none in the open SITE domain');
  });

  it.each([
    ['attribution that is never in doubt', (raw: Json) => { conflict(raw).raid.attribution.successes = 3; },
      'raid attribution: successes must be fewer than the cycle, or attribution is never in doubt'],
    ['an inexact attribution stride', (raw: Json) => { Object.assign(conflict(raw).raid.attribution, { cycle: 4, stride: 2 }); },
      'raid attribution: stride must be coprime to the cycle, or "successes of every cycle" is not exact'],
    ['a footprint floor over its ceiling', (raw: Json) => { conflict(raw).raid.footprint.floor = 3; },
      'raid footprint: floor must not exceed ceiling'],
    ['a stage clock between tick steps', (raw: Json) => { conflict(raw).raid.roundSec = 15.05; },
      'raid roundSec: must be a whole number of tick steps (1 / 10 s)'],
    ['free paid repair', (raw: Json) => { byId(conflict(raw).siteClasses, 'halls').repair.cost = {}; },
      'site class "halls": paid repair must cost something'],
    ['a repair priced outside its phase band', (raw: Json) => { byId(conflict(raw).siteClasses, 'halls').repair.cost = { capital: 1e14 }; },
      'site class "halls" repair: capital price 100000000000000 is outside the Phase 4 band'],
  ])('refuses %s', (_label, edit, problem) => {
    expect(problemsAfter(edit)).toContain(problem);
  });

  it('refuses a damage cap above a half, the bound that keeps every effect within reach of free repair', () => {
    expect(problemsAfter((raw) => { conflict(raw).raid.damageCap = 0.6; })).toContain('world: conflict.raid.damageCap');
  });

  it('counts raid damage against a permanent holding that must pay its own upkeep (the free-fallback divertible rule)', () => {
    // The citadel pays its upkeep from its own diverted compute: 2.3 times over at the shipped grid floor of 0.2, so
    // 1.1 times over with the half a raid at the cap leaves. At a floor of 0.12 it pays 1.4 times over undamaged and
    // 0.7 times damaged, so only the damage-aware rule refuses it.
    const edit = (raw: Json, damaged: boolean) => {
      raw.balance.minGridEfficiency = 0.12;
      if (!damaged) holding(raw, 'node', 'p4_subterranean_citadel').siteClass = undefined;
    };
    expect(problemsAfter((raw) => { edit(raw, false); })).not.toContain('node "p4_subterranean_citadel": costs money each second');
    expect(problemsAfter((raw) => { edit(raw, true); })).toContain('node "p4_subterranean_citadel": costs money each second');
  });
});
