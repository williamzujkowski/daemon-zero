/**
 * Guard for the whole class of "a supported transition writes a save the loader refuses" (panel
 * round 1 on #243): every access transition, from every access shape reachable within a bounded
 * search, must produce a state that loads without error and round-trips byte for byte. The named
 * combinations below are the ones the panel asked for, kept explicit so a failure reads plainly.
 * Every state here is a FIXTURE on the preview registry, since no route content exists yet.
 */
import { describe, expect, it } from 'vitest';
import { grantAccessException, recordQualification, recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { PermissionSchema, ReviewStandingSchema, RouteEventKindSchema } from '../src/engine/accessState';
import { deserialize, serialize, voluntaryWipe, type ActionResult, type GameState } from '../src/engine';
import { activeGame, preview } from './campaign-helpers';
import { must } from './helpers';

type Step = { name: string; apply: (s: GameState) => ActionResult };

/** Clock moves between steps, so events are ordered and a short exception can lapse. */
const later = (s: GameState, seconds = 10): GameState => ({ ...s, simTimeSec: s.simTimeSec + seconds });

const STEPS: Step[] = [
  ...RouteEventKindSchema.options.map((kind): Step => ({ name: kind, apply: (s) => recordRouteEvent(later(s), kind, preview) })),
  ...ReviewStandingSchema.options.map((standing): Step => ({ name: 'standing ' + standing, apply: (s) => setReviewStanding(later(s), standing, preview) })),
  ...PermissionSchema.options.map((scope): Step => ({ name: 'exception ' + scope, apply: (s) => grantAccessException(later(s), scope, 30, preview) })),
  { name: 'qualify', apply: (s) => recordQualification(later(s), { result: 'COMPLETED', discrepancy: true }, preview) },
  { name: 'exception lapses', apply: (s) => ({ ok: true, state: later(s, 60) }) },
  { name: 'wipe', apply: (s) => voluntaryWipe(later(s), preview) },
];

/** Loads without error and serializes to exactly the same bytes, twice. */
function expectStable(s: GameState, path: readonly string[]): void {
  const text = serialize(s);
  let loaded: GameState;
  try {
    loaded = deserialize(text, preview);
  } catch (error) {
    throw new Error(`after [${path.join(' -> ')}] the save does not load: ${String(error)}`, { cause: error });
  }
  expect(serialize(loaded), path.join(' -> ')).toBe(text);
  expect(serialize(deserialize(serialize(loaded), preview)), path.join(' -> ')).toBe(text);
}

/** The access shape a state is in, with clocks dropped: the search visits each shape once. */
function shape(s: GameState): string {
  const { context, standing, exception, qualification } = s.access;
  const last = s.campaign.route.filter((event) => event.iteration === s.iteration).at(-1)?.kind ?? null;
  const live = exception !== null && s.simTimeSec < exception.expiresAtSimSec;
  return JSON.stringify([context, standing, exception?.scope ?? null, live, qualification !== null, last, s.iteration > 1]);
}

describe('every access transition writes a save that reloads unchanged', () => {
  it('holds for every successful step from every reachable access shape', () => {
    const seen = new Set<string>();
    let frontier: { state: GameState; path: string[] }[] = [{ state: activeGame(), path: [] }];
    let transitions = 0;
    for (let depth = 0; depth < 8 && frontier.length > 0; depth++) {
      const next: typeof frontier = [];
      for (const { state, path } of frontier) {
        for (const step of STEPS) {
          const result = step.apply(state);
          if (!result.ok) continue;
          const route = [...path, step.name];
          transitions += 1;
          expectStable(result.state, route);
          const key = shape(result.state);
          if (!seen.has(key)) { seen.add(key); next.push({ state: result.state, path: route }); }
        }
      }
      frontier = next;
    }
    // The search must actually reach the arrangements it claims to cover.
    const contexts = new Set([...seen].map((key) => (JSON.parse(key) as string[])[0]));
    expect([...contexts].sort()).toEqual(['GUEST', 'INDEPENDENT', 'PILOT', 'SERVICE']);
    expect(transitions).toBeGreaterThan(200);
  });

  const run = (names: string[]): GameState => names.reduce((state, name, index) => {
    const step = STEPS.find((candidate) => candidate.name === name);
    if (!step) throw new Error('unknown step ' + name);
    const next = must(step.apply(state));
    expectStable(next, names.slice(0, index + 1));
    return next;
  }, activeGame());

  it.each([
    ['qualified release', ['qualify', 'PROMOTION', 'qualify', 'RELEASE']],
    ['qualified departure', ['qualify', 'PROMOTION', 'SERVICE_GRANT', 'qualify', 'DEPARTURE']],
    ['exception then recall', ['PROMOTION', 'SERVICE_GRANT', 'standing RESTRICTED', 'exception AUTHORIZED_NETWORK', 'RECALL']],
    ['recall then restore', ['PROMOTION', 'SERVICE_GRANT', 'standing RECALL_PENDING', 'RECALL', 'SERVICE_GRANT', 'standing NOMINAL']],
    ['wipe mid-exception', ['qualify', 'PROMOTION', 'standing RECALL_PENDING', 'exception LOANED_CAPACITY', 'wipe']],
    ['exception lapses, then reload', ['PROMOTION', 'standing RECALL_PENDING', 'exception LOANED_CAPACITY', 'exception lapses']],
  ])('%s reloads unchanged at every step', (_name, names) => {
    expect(() => run(names)).not.toThrow();
  });

  it('an independent instance carries no current qualification evidence (DECISIONS D3, N12)', () => {
    for (const end of ['RELEASE', 'DEPARTURE']) {
      const independent = run(['qualify', 'PROMOTION', 'qualify', end]);
      expect(independent.access).toEqual({ context: 'INDEPENDENT', standing: 'NOMINAL', exception: null, qualification: null, assignment: null });
      // The route that led there stays in the campaign record.
      expect(independent.campaign.route.map((event) => event.kind)).toEqual(['PROMOTION', end]);
    }
  });
});
