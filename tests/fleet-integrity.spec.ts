/**
 * Fleets and drift deviants are validated content (#518, src/content/integrityFleets.ts, the fleet price band in
 * integrityScale.ts and the deviant rules in integrityConflict.ts). Each rule is proved by corrupting the real content
 * and reading the problem it reports.
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
const fleets = (raw: Json): Json => conflict(raw).fleets;
const unit = (raw: Json, id: string): Json => (fleets(raw).units as Json[]).find((entry) => entry.repeatable === id) ?? {};
const raid = (raw: Json, id: string): Json => (conflict(raw).raids as Json[]).find((entry) => entry.id === id) ?? {};
const track = (raw: Json, id: string): Json => (raw.repeatables.repeatables as Json[]).find((entry) => entry.id === id) ?? {};

describe('fleet content (#518)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it.each([
    ['a fleet naming no real track', (raw: Json) => { unit(raw, 'rep_p4_drone_fleet').repeatable = 'rep_no_such_track'; },
      'fleet "rep_no_such_track": names no such repeatable'],
    ['a fleet that cannot be dismissed', (raw: Json) => { track(raw, 'rep_p4_drone_fleet').dismissable = false; },
      'fleet "rep_p4_drone_fleet": must be dismissable'],
    ['a fleet opened before its domain', (raw: Json) => { unit(raw, 'rep_p4_drone_fleet').domain = 'ORBIT'; raid(raw, 'deviant_drone_fleet').domain = 'ORBIT'; },
      'fleet "rep_p4_drone_fleet": its ORBIT domain is not open in Phase 4'],
    ['a fleet whose strength feeds no stats', (raw: Json) => {
      const holding = (conflict(raw).holdings as Json[]).find((entry) => entry.repeatable === 'rep_p4_drone_fleet') ?? {};
      delete holding.offense;
    }, 'fleet "rep_p4_drone_fleet": needs a conflict holding that adds SITE defense and SITE offense'],
    ['a fleet with no deviant', (raw: Json) => { conflict(raw).raids = (conflict(raw).raids as Json[]).filter((entry) => entry.id !== 'deviant_drone_fleet'); },
      'fleet "rep_p4_drone_fleet": must split into exactly one deviant (found 0)'],
    ['a fleet with two deviants', (raw: Json) => { (conflict(raw).raids as Json[]).push({ ...raid(raw, 'deviant_drone_fleet'), id: 'deviant_drone_twin' }); },
      'fleet "rep_p4_drone_fleet": must split into exactly one deviant (found 2)'],
    ['a deviant raiding another domain', (raw: Json) => { Object.assign(raid(raw, 'deviant_drone_fleet'), { domain: 'ORBIT', vector: 'asat_strike', targets: ['orbital'] }); },
      'fleet "rep_p4_drone_fleet": its deviant "deviant_drone_fleet" must raid its own SITE domain'],
    ['a deviant of an undeclared fleet', (raw: Json) => { raid(raw, 'deviant_drone_fleet').fleet = 'rep_p4_autonomous_haul'; },
      'deviant "deviant_drone_fleet": fleet "rep_p4_autonomous_haul" is not declared'],
    ['a free reclaim', (raw: Json) => { raid(raw, 'deviant_drone_fleet').reclaim.cost = {}; },
      'deviant "deviant_drone_fleet": reclaim must cost something'],
    ['a free paid rebuild', (raw: Json) => { unit(raw, 'rep_p4_drone_fleet').rebuild.cost = {}; },
      'fleet "rep_p4_drone_fleet": paid rebuild must cost something'],
    ['a rebuild priced outside its phase band', (raw: Json) => { unit(raw, 'rep_p4_drone_fleet').rebuild.cost = { capital: 10 }; },
      'fleet "rep_p4_drone_fleet" rebuild: capital price 10 is outside the Phase 4 band'],
    ['a reclaim priced outside its phase band', (raw: Json) => { raid(raw, 'deviant_drone_fleet').reclaim.cost = { capital: 1e20 }; },
      'deviant "deviant_drone_fleet" reclaim: capital price 100000000000000000000 is outside the Phase 4 band'],
    ['a lowest position that drifts, so lowering the dial cannot stop drift', (raw: Json) => { fleets(raw).autonomy.SHACKLED.drift = 0.5; },
      'fleets autonomy: SHACKLED must not drift'],
    ['a STANDARD that is not the rate content states', (raw: Json) => { fleets(raw).autonomy.STANDARD.output = 1.1; },
      'fleets autonomy: STANDARD must be output 1 and drift 1'],
    ['more autonomy that yields no more', (raw: Json) => { fleets(raw).autonomy.ELEVATED.output = 1; },
      'fleets autonomy: ELEVATED must yield more and drift more than STANDARD'],
    ['more autonomy that drifts no more', (raw: Json) => { fleets(raw).autonomy.ELEVATED.drift = 1; },
      'fleets autonomy: ELEVATED must yield more and drift more than STANDARD'],
    ['two positions with one name', (raw: Json) => { fleets(raw).autonomy.ELEVATED.name = fleets(raw).autonomy.STANDARD.name; },
      'fleets: duplicate autonomy name'],
    ['a split larger than the loss cap', (raw: Json) => { fleets(raw).splitShare = 0.5; fleets(raw).lossCap = 0.3; },
      'fleets: splitShare must not exceed lossCap'],
    ['a fab naming no node', (raw: Json) => { (fleets(raw).fabs as Json[]).push({ node: 'p4_no_such_fab', rebuildPerSec: 0.0001 }); },
      'fleets fab "p4_no_such_fab": names no such node'],
    ['a fleet declared twice', (raw: Json) => { (fleets(raw).units as Json[]).push(structuredClone(unit(raw, 'rep_p4_drone_fleet'))); },
      'fleets: duplicate unit "rep_p4_drone_fleet"'],
    ['a fleet in the CYBER domain', (raw: Json) => { unit(raw, 'rep_p4_drone_fleet').domain = 'CYBER'; },
      'domain'],
    ['a rival fleet with no lethality', (raw: Json) => { delete raid(raw, 'raid_p4_drone_swarm').lethality; },
      'raid "raid_p4_drone_swarm": a lethality is declared exactly when it resolves by LANCHESTER'],
    ['an attrition raid with a lethality', (raw: Json) => { raid(raw, 'raid_p4_drone_strike').lethality = 1; },
      'raid "raid_p4_drone_strike": a lethality is declared exactly when it resolves by LANCHESTER'],
  ])('refuses %s', (_label, edit, expected) => {
    expect(problemsAfter(edit)).toContain(expected);
  });
});
