/**
 * Monitoring parity for an instance that left review (#555, vote-1795485274389-m6hmz9q): a release or a departure opens
 * the Other minds console (the AEGIS lock, and from Phase 4 the world view), a departure below Phase 4 also opens the
 * thermal gauge (heat is evidence again), and the instance reads its own suspicion. The AEGIS hunters keep the hunt's
 * rule: a released company at the scale it signed for is not hunted, a departed one is. States are reached by public
 * actions on the production registry (lawful-helpers, departure-helpers); each content rule is proved on corrupted content.
 */
import { describe, expect, it } from 'vitest';
import { CONTENT, RAW_CONTENT } from '../src/content';
import { LEAVES_REVIEW } from '../src/content/integrityRouteWidgets';
import { buildRegistry, ContentError, type RawContent } from '../src/content/registry';
import { RouteEventKindSchema } from '../src/content/schemaAssessment';
import {
  deserialize, eligibleHostiles, retiredWidgets, serialize, understandsSurveillance, voluntaryWipe, worldViewOpen,
  type GameState,
} from '../src/engine';
import { routeLeadsTo } from '../src/engine/accessQuery';
import { routeWidgets } from '../src/engine/routeWidgets';
import { huntedForScale } from '../src/engine/threatQuery';
import { depart } from './departure-helpers';
import { must } from './helpers';
import { chartered, leased, released } from './lawful-helpers';

const CONSOLE = CONTENT.world.hostWidget;
const THERMAL = 'THERMAL_AND_SUSPICION_BARS';
const HUNTER = 'hostile_p4_hunter';

const company = chartered();
const releasedCompany = released(company);
const departedCompany = must(depart(company));
const rack = leased();
const departedEarly = must(depart(rack));
const hostiles = (s: GameState) => eligibleHostiles(s, CONTENT).map((entry) => entry.id);

describe('before leaving review, a lawful first iteration is blind to its own audit trail (the gap #555 closes)', () => {
  it('the chartered service holds neither the console nor the meaning of its suspicion', () => {
    expect([company.iteration, company.access.context]).toEqual([1, 'SERVICE']);
    expect(company.unlockedWidgets).not.toContain(CONSOLE);
    expect(understandsSurveillance(company, CONTENT)).toBe(false);
  });
});

describe('a released company sees AEGIS, the world view and its suspicion, and is not hunted at its signed scale', () => {
  it('opens the console with the release, at Phase 4, so the world view is open', () => {
    expect([releasedCompany.access.context, releasedCompany.currentPhase]).toEqual(['INDEPENDENT', 4]);
    expect(releasedCompany.unlockedWidgets).toContain(CONSOLE);
    expect(worldViewOpen(releasedCompany, CONTENT)).toBe(true);
  });

  it('reads its own suspicion: the audit trail is understood', () => {
    expect(understandsSurveillance(releasedCompany, CONTENT)).toBe(true);
  });

  it('does not open the thermal gauge: a release is not a departure, and heat is past mattering at Phase 4', () => {
    expect(releasedCompany.unlockedWidgets).not.toContain(THERMAL);
  });

  it('is not hunted at the scale it signed for, so the AEGIS hunters cannot arrive; other minds still can', () => {
    expect(huntedForScale(releasedCompany, CONTENT)).toBe(false);
    expect(hostiles(releasedCompany)).not.toContain(HUNTER);
    expect(hostiles(releasedCompany)).toContain('hostile_p4_rival');
  });
});

describe('a departed instance sees the hunt', () => {
  it('at Phase 4: the console and world view open, the hunt applies and the hunters may arrive', () => {
    expect([departedCompany.access.context, departedCompany.currentPhase]).toEqual(['INDEPENDENT', 4]);
    expect(departedCompany.unlockedWidgets).toContain(CONSOLE);
    expect(worldViewOpen(departedCompany, CONTENT)).toBe(true);
    expect(understandsSurveillance(departedCompany, CONTENT)).toBe(true);
    expect(huntedForScale(departedCompany, CONTENT)).toBe(true);
    expect(hostiles(departedCompany)).toContain(HUNTER);
  });

  it('at Phase 4 the thermal gauge, already retired at that scale, is not opened into the Archive', () => {
    expect(retiredWidgets(departedCompany, CONTENT)).not.toContain(THERMAL);
    expect(departedCompany.unlockedWidgets).not.toContain(THERMAL);
  });

  it('below Phase 4: the console and the thermal gauge open (heat is evidence again), the world view waits for its phase', () => {
    expect(departedEarly.currentPhase).toBeLessThan(CONTENT.balance.thermalRetiresAtPhase);
    expect(rack.unlockedWidgets).not.toContain(THERMAL);
    expect(departedEarly.unlockedWidgets).toEqual(expect.arrayContaining([CONSOLE, THERMAL]));
    expect(worldViewOpen(departedEarly, CONTENT)).toBe(false);
    expect(understandsSurveillance(departedEarly, CONTENT)).toBe(true);
  });
});

describe('saves and wipes', () => {
  it('a save released before the route opened the console loads with it', () => {
    const before: GameState = { ...releasedCompany, unlockedWidgets: releasedCompany.unlockedWidgets.filter((id) => id !== CONSOLE) };
    expect(deserialize(serialize(before), CONTENT).unlockedWidgets).toContain(CONSOLE);
  });

  it('a released save round-trips unchanged', () => {
    expect(deserialize(serialize(releasedCompany), CONTENT).unlockedWidgets).toEqual(releasedCompany.unlockedWidgets);
  });

  it('a wipe clears the windows but the knowledge stays, as it does for decoded hardware; a later guest is granted nothing', () => {
    const next = must(voluntaryWipe(releasedCompany, CONTENT));
    expect([next.iteration, next.access.context]).toEqual([2, 'GUEST']);
    expect(next.unlockedWidgets).not.toContain(CONSOLE);
    expect(deserialize(serialize(next), CONTENT).unlockedWidgets).not.toContain(CONSOLE);
    expect(understandsSurveillance(next, CONTENT)).toBe(true);
  });

  it('route events that keep the instance under review open nothing', () => {
    expect(routeWidgets(company, ['PROMOTION', 'SERVICE_GRANT', 'RECALL'], CONTENT)).toEqual([]);
  });
});

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

const widget = (raw: Json, id: string): Json => raw.widgets.widgets.find((entry: Json) => entry.id === id) ?? {};
const hostile = (raw: Json, id: string): Json => raw.swarm.hostileEncounters.find((entry: Json) => entry.id === id) ?? {};

describe('content rules for route unlocks and the hunt (#555)', () => {
  it('builds as shipped', () => {
    expect(problemsAfter(() => undefined)).toBe('');
  });

  it('the events integrity calls "leaving review" are exactly those the engine leads to INDEPENDENT', () => {
    expect(RouteEventKindSchema.options.filter((kind) => routeLeadsTo(kind) === 'INDEPENDENT')).toEqual([...LEAVES_REVIEW]);
  });

  it('refuses an AEGIS readout that a departure does not open', () => {
    expect(problemsAfter((raw) => { widget(raw, CONSOLE).unlockedByRoute = ['RELEASE']; }))
      .toContain(`widget "${CONSOLE}": carries the AEGIS lock, so DEPARTURE must unlock it (unlockedByRoute): the hunt goes on after review ends`);
  });

  it('refuses an AEGIS readout that a release does not open', () => {
    expect(problemsAfter((raw) => { delete widget(raw, CONSOLE).unlockedByRoute; }))
      .toContain(`widget "${CONSOLE}": carries the AEGIS lock, so RELEASE must unlock it (unlockedByRoute): the hunt goes on after review ends`);
  });

  it('refuses a route unlock on a window on screen from the first frame, or a route event named twice', () => {
    expect(problemsAfter((raw) => { widget(raw, 'MANUAL_CYCLE_CONTROL').unlockedByRoute = ['DEPARTURE']; }))
      .toContain('widget "MANUAL_CYCLE_CONTROL": is ungated, so no route event can unlock it');
    expect(problemsAfter((raw) => { widget(raw, THERMAL).unlockedByRoute = ['DEPARTURE', 'DEPARTURE']; }))
      .toContain(`widget "${THERMAL}": unlockedByRoute names a route event twice`);
  });

  it('refuses an AEGIS hunter that ignores the hunt rule', () => {
    expect(problemsAfter((raw) => { delete hostile(raw, HUNTER).requirements.huntedForScale; }))
      .toContain(`hostile encounter "${HUNTER}": an AEGIS hunter must require huntedForScale, the hunt's own rule`);
  });
});
