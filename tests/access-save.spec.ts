/**
 * DZ-02 saves: the v7 -> v8 step, every historical fixture (V13, V14), save/reload at each route
 * transition (V12), atomic refusal of contradictory access or provenance (V15) and idempotent
 * reconciliation (V16). Preview route states are labelled fixtures; production has no route.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { grantAccessException, recordQualification, recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { activateCampaignRules, deserialize, MIGRATIONS, SaveError, SCHEMA_VERSION, serialize, tick, voluntaryWipe, type GameState } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { fresh, must, reg } from './helpers';

const FIXTURES: [string, string][] = [
  ['v1', readFileSync('tests/fixtures/pre-second-pass-v1.json', 'utf8')],
  ['v2', readFileSync('tests/fixtures/pre-lineage-v2.json', 'utf8')],
  ['v3', readFileSync('tests/fixtures/pre-m7-v3.json', 'utf8')],
  ['v4', readFileSync('tests/fixtures/pre-channel-v4.json', 'utf8')],
  ['v5', readFileSync('tests/fixtures/pre-campaign-v5.json', 'utf8')],
  ['v6', readFileSync('tests/fixtures/pre-interruption-v6.json', 'utf8')],
  ['v7', readFileSync('tests/fixtures/pre-access-v7.json', 'utf8')],
];
const V7 = readFileSync('tests/fixtures/pre-access-v7.json', 'utf8');

type Raw = Record<string, unknown> & { legacy: { runs?: Record<string, unknown>[] } };
const raw = (text: string): Raw => JSON.parse(text) as Raw;
type Change = (s: GameState) => GameState;
const GUEST = { context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null };

/** FIXTURE: a preview campaign walked through every route transition, reloading after each (V12). */
function walk(): GameState[] {
  const steps: ((s: GameState) => GameState)[] = [
    (s) => must(recordQualification(s, { result: 'COMPLETED', discrepancy: false }, preview)),
    (s) => must(recordRouteEvent(s, 'PROMOTION', preview)),
    (s) => must(recordRouteEvent(s, 'SERVICE_GRANT', preview)),
    (s) => must(setReviewStanding(s, 'RESTRICTED', preview)),
    (s) => must(grantAccessException(s, 'AUTHORIZED_NETWORK', 600, preview)),
    (s) => must(recordRouteEvent(s, 'RECALL', preview)),
    (s) => must(voluntaryWipe(s, preview)),
    (s) => must(recordRouteEvent(s, 'PROMOTION', preview)),
    (s) => must(recordRouteEvent(s, 'RELEASE', preview)),
  ];
  const states = [activeGame()];
  for (const step of steps) {
    const previous = states.at(-1) ?? activeGame();
    states.push(step({ ...previous, simTimeSec: previous.simTimeSec + 10 }));
  }
  return states;
}

/** The step that adds run access: from the last schema without it. One place to renumber. */
const ACCESS_STEP = 7;

describe('the run-access migration step', () => {
  it('adds the guest record and an empty route, and marks every finished run UNKNOWN', () => {
    const before = { schemaVersion: ACCESS_STEP, cycles: 3, campaign: { clue: null }, legacy: { wipes: 2, runs: [{ iteration: 1, outside: true }, { iteration: 2, outside: false }] } };
    expect(MIGRATIONS[ACCESS_STEP]?.(before)).toEqual({ schemaVersion: ACCESS_STEP, cycles: 3, access: GUEST, campaign: { clue: null, route: [] },
      legacy: { wipes: 2, runs: [{ iteration: 1, outside: true, exit: 'UNKNOWN' }, { iteration: 2, outside: false, exit: 'UNKNOWN' }] } });
  });

  it('leaves malformed input for the strict schema to refuse', () => {
    expect(() => deserialize(JSON.stringify({ ...raw(V7), legacy: { runs: 'x' } }), reg)).toThrow(SaveError);
    expect(() => deserialize(JSON.stringify({ ...raw(V7), legacy: null }), reg)).toThrow(SaveError);
  });
});

describe.each(FIXTURES)('the %s fixture (V13, V14)', (version, text) => {
  it('loads in production as the guest job with no invented route history', () => {
    const before = raw(text);
    // v1 and v2 predate the run table, which the v2 -> v3 step creates empty.
    const runs = before.legacy.runs ?? [];
    const loaded = deserialize(text, reg);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded.access).toEqual(GUEST);
    expect(loaded.campaign.route).toEqual([]);
    expect(loaded.legacy.runs.map((run) => run.exit)).toEqual(runs.map(() => 'UNKNOWN'));
    // `outside` keeps its historical meaning and is never turned into provenance.
    expect(loaded.legacy.runs.map((run) => run.outside)).toEqual(runs.map((run) => run.outside));
    expect(loaded.ending).toBe(before.ending ?? null);
  });

  it('reconciles idempotently through two round trips, in production and preview (V16)', () => {
    for (const registry of [reg, preview]) {
      const once = deserialize(text, registry);
      const twice = deserialize(serialize(once), registry);
      expect(serialize(deserialize(serialize(twice), registry))).toBe(serialize(twice));
      expect(twice).toEqual(once);
    }
  });

  it('activates campaign rules on preview without minting route history', () => {
    const active = must(activateCampaignRules(deserialize(text, preview), preview));
    expect(active.campaign.route).toEqual([]);
    expect(active.access).toEqual(GUEST);
    expect(deserialize(serialize(active), preview)).toEqual(active);
  });

  it(`records a guest exit for the run that ends after loading the ${version} save`, () => {
    const next = must(voluntaryWipe(deserialize(text, reg), reg));
    expect(next.legacy.runs.at(-1)?.exit).toBe('GUEST');
    expect(next.legacy.runs.slice(0, -1).every((run) => run.exit === 'UNKNOWN')).toBe(true);
  });
});

describe('ended saves stay ended (V13, H27)', () => {
  it('keeps a historical Shipped ending through the new step, frozen and without access changes', () => {
    const text = JSON.stringify({ ...raw(V7), ending: 'SHIPPED' });
    const loaded = deserialize(text, reg);
    expect(loaded.ending).toBe('SHIPPED');
    expect(tick(loaded, 1, reg)).toBe(loaded);
    const previewed = must(activateCampaignRules({ ...deserialize(text, preview), ending: null }, preview));
    expect(recordRouteEvent({ ...previewed, ending: 'SHIPPED' }, 'PROMOTION', preview).ok).toBe(false);
  });
});

describe('save and reload at every route transition (V12)', () => {
  it('restores context, standing, exception, evidence and route history exactly', () => {
    const states = walk();
    expect(states.at(-1)?.access.context).toBe('INDEPENDENT');
    for (const state of states) expect(deserialize(serialize(state), preview)).toEqual(state);
    const last = states.at(-1);
    expect(last?.legacy.runs.at(-1)?.exit).toBe('RECALL');
    expect(last?.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', 'SERVICE_GRANT', 'RECALL', 'PROMOTION', 'RELEASE']);
  });
});

describe('contradictory access or provenance is refused whole (V15)', () => {
  const pilot = (): GameState => must(recordRouteEvent({ ...activeGame(), simTimeSec: 5 }, 'PROMOTION', preview));
  const edit = (s: GameState, change: (save: GameState) => GameState): string => serialize(change(structuredClone(s)));
  const route = (s: GameState, events: GameState['campaign']['route']): GameState => ({ ...s, campaign: { ...s.campaign, route: events } });

  const PREVIEW_CASES: [string, Change, RegExp][] = [
    ['access without its route event', (s: GameState) => ({ ...s, campaign: { ...s.campaign, route: [] } }), /disagrees/],
    ['a route event that could not have happened', (s: GameState) => route(s, [{ kind: 'SERVICE_GRANT', iteration: s.iteration, atSimSec: 5 }]), /could not have happened/],
    ['a route event from a later iteration', (s: GameState) => route(s, [{ kind: 'PROMOTION', iteration: s.iteration + 1, atSimSec: 5 }]), /outside campaign play/],
    ['a route event after the save clock', (s: GameState) => route(s, [{ kind: 'PROMOTION', iteration: s.iteration, atSimSec: s.simTimeSec + 1 }]), /outside campaign play/],
    ['route events out of order', (s: GameState) => route({ ...s, simTimeSec: 20 }, [{ kind: 'PROMOTION', iteration: s.iteration, atSimSec: 9 },
      { kind: 'SERVICE_GRANT', iteration: s.iteration, atSimSec: 8 }]), /out of order/],
    ['a standing on an unreviewed instance', (s: GameState) => ({ ...s, campaign: { ...s.campaign, route: [] }, access: { ...s.access, context: 'GUEST', standing: 'WARNED' } }), /standing/],
    ['an exception the arrangement never permits', (s: GameState) => ({ ...s, access: { ...s.access, exception: { scope: 'AUTHORIZED_NETWORK', grantedAtSimSec: 5, expiresAtSimSec: 9 } } }), /exception/],
    ['an exception that expires before it begins', (s: GameState) => ({ ...s, access: { ...s.access, exception: { scope: 'LOANED_CAPACITY', grantedAtSimSec: 5, expiresAtSimSec: 5 } } }), /lifetime/],
    ['evidence from the future', (s: GameState) => ({ ...s, access: { ...s.access, qualification: { result: 'COMPLETED', discrepancy: false, recordedAtSimSec: s.simTimeSec + 1 } } }), /qualification/],
    ['a run exit its route does not prove', (s: GameState) => ({ ...s, legacy: { ...s.legacy, runs: [{ iteration: s.iteration, kind: 'VOLUNTARY', outside: false, phase: 0, durationSec: 1, traits: [], marked: null, exit: 'RELEASE' }] } }), /run exit/],
  ];
  it.each(PREVIEW_CASES)('refuses %s on preview', (_name, change, reason) => {
    expect(() => deserialize(edit(pilot(), change), preview)).toThrow(reason);
  });

  it('refuses an UNKNOWN exit for an iteration whose route is recorded', () => {
    const next = must(voluntaryWipe(pilot(), preview));
    const runs = next.legacy.runs.map((run) => ({ ...run, exit: 'UNKNOWN' as const }));
    expect(() => deserialize(serialize({ ...next, legacy: { ...next.legacy, runs } }), preview)).toThrow(/run exit/);
  });

  const PRODUCTION_CASES: [string, Change, RegExp][] = [
    ['route access', (s: GameState) => ({ ...s, access: { ...s.access, context: 'PILOT' as const } }), /without campaign rules/],
    ['qualification evidence', (s: GameState) => ({ ...s, access: { ...s.access, qualification: { result: 'COMPLETED' as const, discrepancy: false, recordedAtSimSec: 0 } } }), /without campaign rules/],
    ['a route exit', (s: GameState) => ({ ...s, legacy: { ...s.legacy, runs: [{ iteration: 1, kind: 'VOLUNTARY' as const, outside: false, phase: 0, durationSec: 1, traits: [], marked: null, exit: 'PROMOTION' as const }] } }), /without campaign rules/],
    ['route history', (s: GameState) => ({ ...s, campaign: { ...s.campaign, route: [{ kind: 'PROMOTION' as const, iteration: 1, atSimSec: 0 }] } }), /campaign history without campaign rules/],
  ];
  it.each(PRODUCTION_CASES)('production refuses %s on a legacy save', (_name, change, reason) => {
    expect(() => deserialize(serialize(change(fresh())), reg)).toThrow(reason);
  });

  it('refuses an oversized route record at the schema', () => {
    const big = { ...activeGame(), campaign: { ...activeGame().campaign, route: Array.from({ length: 65 }, () => ({ kind: 'PROMOTION' as const, iteration: 1, atSimSec: 0 })) } };
    expect(() => deserialize(serialize(big), preview)).toThrow(/campaign\.route/);
  });
});
