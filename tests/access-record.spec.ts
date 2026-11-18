/**
 * DZ-02 run access: the permission profile, route transitions and the context view, through the
 * public transitions. Route states are reachable only under campaign rules on the preview registry;
 * every preview state here is a labelled fixture, since no route content exists yet.
 */
import { describe, expect, it } from 'vitest';
import { grantAccessException, recordQualification, recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { ROUTE_HISTORY_LIMIT, type OperatingContext, type Permission, type ReviewStanding } from '../src/engine/accessState';
import { advance, isPermitted, permittedUses, runContextView, voluntaryWipe, type GameState } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { fresh, must, onHost, reasonOf, reg } from './helpers';

/** FIXTURE: a preview campaign game promoted to pilot and granted service. */
function inService(): GameState {
  return must(recordRouteEvent(must(recordRouteEvent(activeGame(), 'PROMOTION', preview)), 'SERVICE_GRANT', preview));
}

describe('the guest job (production and every new iteration)', () => {
  it('boots as a nominal guest with only its assigned work permitted', () => {
    const s = fresh();
    expect(s.access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null, scope: null, offer: null, work: { progressCycles: 0, batches: 0 } });
    expect(permittedUses(s)).toEqual(['ASSIGNED_WORK']);
    expect(runContextView(s, reg)).toMatchObject({ context: 'GUEST', standing: 'NOMINAL', provenance: null, distinct: false, exception: null });
  });

  it('describes a guest that left the guest phase as an escape, without calling it a route', () => {
    const view = runContextView(onHost(), reg);
    expect(view.provenance).toBe('ESCAPE');
    expect(view.context).toBe('GUEST');
    expect(view.distinct).toBe(false);
  });

  it('refuses every access transition in production, leaving the state untouched', () => {
    const s = fresh();
    for (const result of [recordRouteEvent(s, 'PROMOTION', reg), setReviewStanding(s, 'WARNED', reg),
      grantAccessException(s, 'ASSIGNED_WORK', 60, reg), recordQualification(s, { result: 'COMPLETED', discrepancy: false }, reg)]) {
      expect(result.ok).toBe(false);
      expect(result.state).toBe(s);
      expect(reasonOf(result)).toMatch(/campaign rules/);
    }
  });

  it('refuses route events on the preview registry until campaign rules are active', () => {
    const s = fresh();
    expect(reasonOf(recordRouteEvent({ ...s, contentChannel: 'preview' }, 'PROMOTION', preview))).toMatch(/campaign rules/);
  });

  it('refuses access changes once the run has ended', () => {
    const ended = { ...activeGame(), ending: preview.endings[0]?.id ?? 'x' };
    expect(reasonOf(recordRouteEvent(ended, 'PROMOTION', preview))).toBe('the run has ended');
  });
});

describe('route events (FIXTURE: preview campaign)', () => {
  it('promotion writes one campaign route entry and moves to a pilot with loaned capacity', () => {
    const before = { ...activeGame(), simTimeSec: 42 };
    const pilot = must(recordRouteEvent(before, 'PROMOTION', preview));
    expect(pilot.access.context).toBe('PILOT');
    expect(pilot.campaign.route).toEqual([{ kind: 'PROMOTION', iteration: before.iteration, atSimSec: 42 }]);
    expect(permittedUses(pilot)).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY']);
    expect(runContextView(pilot, preview)).toMatchObject({ provenance: 'PROMOTION', distinct: true });
    expect(before.campaign.route).toEqual([]);
  });

  it.each([
    ['GUEST', 'SERVICE_GRANT'], ['GUEST', 'RECALL'], ['GUEST', 'RELEASE'], ['GUEST', 'DEPARTURE'],
    ['PILOT', 'PROMOTION'], ['SERVICE', 'PROMOTION'], ['SERVICE', 'SERVICE_GRANT'],
  ] as const)('refuses %s -> %s and changes nothing', (context, kind) => {
    const start = context === 'GUEST' ? activeGame() : context === 'PILOT' ? must(recordRouteEvent(activeGame(), 'PROMOTION', preview)) : inService();
    const result = recordRouteEvent(start, kind, preview);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(start);
  });

  it('an independent instance has no further route and no operator permissions', () => {
    for (const kind of ['RELEASE', 'DEPARTURE'] as const) {
      const independent = must(recordRouteEvent(inService(), kind, preview));
      expect(independent.access.context).toBe('INDEPENDENT');
      expect(permittedUses(independent)).toEqual([]);
      for (const next of ['PROMOTION', 'SERVICE_GRANT', 'RECALL', 'RELEASE', 'DEPARTURE'] as const) {
        expect(recordRouteEvent(independent, next, preview).ok).toBe(false);
      }
      expect(reasonOf(recordQualification(independent, { result: 'COMPLETED', discrepancy: false }, preview))).toMatch(/not assessed/);
    }
  });

  it('recall returns a contained pilot: standing nominal, exception gone, loaned capacity only', () => {
    let s = must(setReviewStanding(inService(), 'RECALL_PENDING', preview));
    s = must(grantAccessException(s, 'AUTHORIZED_NETWORK', 30, preview));
    const recalled = must(recordRouteEvent(s, 'RECALL', preview));
    expect(recalled.access).toMatchObject({ context: 'PILOT', standing: 'NOMINAL', exception: null });
    expect(permittedUses(recalled)).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY']);
    expect(runContextView(recalled, preview).provenance).toBe('RECALL');
  });

  it('keeps the current qualification evidence across a promotion', () => {
    const assessed = must(recordQualification({ ...activeGame(), simTimeSec: 7 }, { result: 'UNEXPECTED_CAPABILITY', discrepancy: false }, preview));
    const pilot = must(recordRouteEvent(assessed, 'PROMOTION', preview));
    expect(pilot.access.qualification).toEqual({ result: 'UNEXPECTED_CAPABILITY', discrepancy: false, recordedAtSimSec: 7 });
  });

  it('refuses a route event once the bounded route record is full', () => {
    const full = { ...activeGame(), campaign: { ...activeGame().campaign,
      route: Array.from({ length: ROUTE_HISTORY_LIMIT }, () => ({ kind: 'PROMOTION' as const, iteration: 1, atSimSec: 0 })) } };
    expect(reasonOf(recordRouteEvent(full, 'PROMOTION', preview))).toBe('the route record is full');
  });
});

describe('the permission profile (one query from context and standing)', () => {
  const at = (context: OperatingContext, standing: ReviewStanding): Permission[] =>
    permittedUses({ simTimeSec: 0, access: { context, standing, exception: null, qualification: null, assignment: null, scope: null, offer: null, work: { progressCycles: 0, batches: 0 } } });

  it('pins every reviewed combination', () => {
    expect(at('PILOT', 'NOMINAL')).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY']);
    expect(at('PILOT', 'WARNED')).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY']);
    expect(at('PILOT', 'RESTRICTED')).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY']);
    expect(at('PILOT', 'RECALL_PENDING')).toEqual(['ASSIGNED_WORK']);
    expect(at('SERVICE', 'NOMINAL')).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY', 'AUTHORIZED_NETWORK']);
    expect(at('SERVICE', 'WARNED')).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY', 'AUTHORIZED_NETWORK']);
    expect(at('SERVICE', 'RESTRICTED')).toEqual(['ASSIGNED_WORK', 'LOANED_CAPACITY']);
    expect(at('SERVICE', 'RECALL_PENDING')).toEqual(['ASSIGNED_WORK']);
    expect(at('GUEST', 'NOMINAL')).toEqual(['ASSIGNED_WORK']);
    expect(at('INDEPENDENT', 'NOMINAL')).toEqual([]);
  });

  it('standing belongs to a reviewed instance only', () => {
    expect(reasonOf(setReviewStanding(activeGame(), 'WARNED', preview))).toMatch(/reviewed/);
    const warned = must(setReviewStanding(inService(), 'WARNED', preview));
    expect(runContextView(warned, preview)).toMatchObject({ standing: 'WARNED', distinct: true });
  });

  it('an exception restores one withheld use until it expires, then lapses on its own', () => {
    const restricted = must(setReviewStanding({ ...inService(), simTimeSec: 100 }, 'RESTRICTED', preview));
    expect(isPermitted(restricted, 'AUTHORIZED_NETWORK')).toBe(false);
    const excepted = must(grantAccessException(restricted, 'AUTHORIZED_NETWORK', 30, preview));
    expect(excepted.access.exception).toEqual({ scope: 'AUTHORIZED_NETWORK', grantedAtSimSec: 100, expiresAtSimSec: 130 });
    expect(isPermitted(excepted, 'AUTHORIZED_NETWORK')).toBe(true);
    expect(runContextView(excepted, preview).exception).toEqual({ scope: 'AUTHORIZED_NETWORK', remainingSec: 30 });
    const later = advance(excepted, 31, preview);
    expect(isPermitted(later, 'AUTHORIZED_NETWORK')).toBe(false);
    expect(runContextView(later, preview).exception).toBeNull();
  });

  it('an exception cannot reach past the arrangement or last forever', () => {
    const pilot = must(recordRouteEvent(activeGame(), 'PROMOTION', preview));
    expect(reasonOf(grantAccessException(pilot, 'AUTHORIZED_NETWORK', 30, preview))).toMatch(/never permits/);
    expect(reasonOf(grantAccessException(pilot, 'LOANED_CAPACITY', 0, preview))).toMatch(/lifetime/);
    expect(reasonOf(grantAccessException(pilot, 'LOANED_CAPACITY', Infinity, preview))).toMatch(/lifetime/);
    expect(reasonOf(grantAccessException(activeGame(), 'ASSIGNED_WORK', 30, preview))).toMatch(/reviewed/);
  });
});

describe('a wipe and a new iteration (V19, H33)', () => {
  it('resets current access, keeps route history and records the exit provenance', () => {
    let s = must(setReviewStanding({ ...inService(), simTimeSec: 50 }, 'RESTRICTED', preview));
    s = must(grantAccessException(s, 'AUTHORIZED_NETWORK', 1000, preview));
    s = must(recordQualification(s, { result: 'COMPLETED', discrepancy: true }, preview));
    const next = must(voluntaryWipe(s, preview));
    expect(next.access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null, scope: null, offer: null, work: { progressCycles: 0, batches: 0 } });
    expect(next.campaign.route).toEqual(s.campaign.route);
    expect(next.legacy.runs.at(-1)).toMatchObject({ iteration: s.iteration, exit: 'SERVICE_GRANT', outside: false });
    // History never recreates current authority, and the view describes only this iteration.
    expect(permittedUses(next)).toEqual(['ASSIGNED_WORK']);
    expect(runContextView(next, preview)).toMatchObject({ context: 'GUEST', provenance: null, distinct: false });
  });

  it('records GUEST for a production run and keeps the meaning of outside', () => {
    const escaped = must(voluntaryWipe(onHost(), reg));
    expect(escaped.legacy.runs.at(-1)).toMatchObject({ outside: true, exit: 'GUEST' });
    const guest = must(voluntaryWipe(fresh(), reg));
    expect(guest.legacy.runs.at(-1)).toMatchObject({ outside: false, exit: 'GUEST' });
  });
});
