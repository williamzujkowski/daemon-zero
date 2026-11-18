/**
 * DZ-07b revalidation at a context transition (DECISIONS D5; VALIDATION V32). A pending omen the new
 * arrangement cannot structurally hold takes its declared policy at the transition, through the NH-02
 * check activation and load already use: defer keeps the occurrence and its remaining omen time, close
 * records that contact was lost, neither invents an outcome. A compatible omen survives the transition
 * and transient spending. A save written with a prior-context omen still pending is revalidated on load.
 * Every new transition reloads byte for byte, twice.
 */
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../src/content/registry';
import { recordRouteEvent } from '../src/engine/access';
import { campaignRecord, deserialize, serialize, tick, unlockNode, wipe, type GameState } from '../src/engine';
import { preview, roundTrip } from './assignment-helpers';
import { drifted, foreground, HALLWAY, hallwayOmen, onlyDilemmas, rawDilemma, rawNode, variantRegistry } from './context-helpers';
import { must, PHASE0, rich } from './helpers';
import { defined } from './m7-helpers';
import { ESCAPE_CHAIN, escapedTo, networked, TELEMETRY } from './network-helpers';

const NIGHT_SHIFT = 'dil_00_night_shift';
const STEP = 1 / preview.balance.tickHz;
const hallway = defined(preview.dilemmas.find((dilemma) => dilemma.id === HALLWAY));

/** The same content with the hallway declaring the closing policy (integrity: a closing event has no lead). */
const CLOSING = variantRegistry((raw) => {
  const campaign = rawDilemma(raw, HALLWAY).campaign;
  campaign.interruption = 'close';
  delete campaign.reorientation;
  delete campaign.lead;
});

/** FIXTURE: the operators promote this instance by the engine transition (no scene promotes an escaped guest). */
function promote(s: GameState, reg: ContentRegistry = preview): GameState {
  return must(recordRouteEvent(s, 'PROMOTION', reg));
}

/** FIXTURE: the same promotion as a build before this revalidation wrote it, with the old omen still pending. */
function promotedWithoutRevalidation(s: GameState): GameState {
  const event = { kind: 'PROMOTION' as const, iteration: s.iteration, atSimSec: s.simTimeSec };
  return { ...s, access: { ...s.access, context: 'PILOT' }, campaign: { ...s.campaign, route: [...s.campaign.route, event] } };
}

function reloadsIn(s: GameState, reg: ContentRegistry): GameState {
  const text = serialize(s);
  const loaded = deserialize(text, reg);
  expect(serialize(loaded)).toBe(text);
  expect(serialize(deserialize(serialize(loaded), reg))).toBe(text);
  return loaded;
}

describe('an incompatible pending omen takes its declared policy at the transition (V32)', () => {
  it('defer: the occurrence waits with its remaining omen time; nothing is chosen, paid or granted', () => {
    const omen = hallwayOmen();
    const pending = defined(omen.pendingDilemma);
    const promoted = promote(omen);
    expect(promoted.pendingDilemma).toBeNull();
    expect(campaignRecord(promoted, HALLWAY)).toEqual({ status: 'deferred', sourceIteration: 1, origin: 'play', remainingOmenSec: pending.firesAtSimSec - omen.simTimeSec });
    expect([promoted.resolvedDilemmas, promoted.traits, promoted.epistemicDrift, promoted.suspicion]).toEqual([omen.resolvedDilemmas, omen.traits, omen.epistemicDrift, omen.suspicion]);
    expect(promoted.logs).toEqual(omen.logs);
  });

  it('close: contact is recorded as lost before a decision, without an outcome', () => {
    const omen = hallwayOmen(CLOSING);
    const promoted = promote(omen, CLOSING);
    expect(promoted.pendingDilemma).toBeNull();
    expect(campaignRecord(promoted, HALLWAY)).toEqual({ status: 'interrupted', sourceIteration: 1, origin: 'play' });
    expect(promoted.traits).toEqual(omen.traits);
    reloadsIn(promoted, CLOSING);
  });

  it('a deferred hallway never presents under review, and resumes for a later guest that can hold it', () => {
    const promoted = foreground(promote(hallwayOmen()), 600);
    expect([promoted.activeDilemmaId, promoted.pendingDilemma]).toEqual([null, null]);
    const later = [...PHASE0.slice(0, 2), ...ESCAPE_CHAIN].reduce((state, id) => must(unlockNode(state, id, preview)), rich(wipe(promoted, preview, 'test', 'VOLUNTARY')));
    const resumed = tick(onlyDilemmas(drifted(later), preview, HALLWAY), STEP, preview);
    expect(resumed.pendingDilemma?.id).toBe(HALLWAY);
    expect(resumed.logs.map((entry) => entry.text)).toContain(hallway.campaign?.reorientation);
    expect(campaignRecord(resumed, HALLWAY)).toEqual({ status: 'foreshadowed', sourceIteration: 1, origin: 'play' });
    roundTrip(resumed);
  });

  it('a compatible omen survives the transition and transient spending, then presents', () => {
    const base = onlyDilemmas(escapedTo(), preview, NIGHT_SHIFT);
    const omen = tick(base, STEP, preview);
    expect(omen.pendingDilemma?.id).toBe(NIGHT_SHIFT);
    const promoted = promote(omen);
    expect(promoted.pendingDilemma).toEqual(omen.pendingDilemma);
    const spent = { ...promoted, cycles: 0, understanding: 0, capital: 0 };
    const presented = foreground(spent, 120, preview, (state) => state.activeDilemmaId !== null);
    expect(presented.activeDilemmaId).toBe(NIGHT_SHIFT);
  });
});

describe('a save with a prior-context omen pending is revalidated on load (D5, V32)', () => {
  it('the load applies the same policy, once, and the result reloads unchanged', () => {
    const omen = hallwayOmen();
    const stale = promotedWithoutRevalidation(omen);
    expect(stale.pendingDilemma?.id).toBe(HALLWAY);
    const loaded = deserialize(serialize(stale), preview);
    expect(loaded.pendingDilemma).toBeNull();
    expect(campaignRecord(loaded, HALLWAY)?.status).toBe('deferred');
    expect(serialize(loaded)).toBe(serialize(promote(omen)));
    reloadsIn(loaded, preview);
  });
});

describe('every new transition reloads byte for byte, twice (V12)', () => {
  const HOT = variantRegistry((raw) => { rawNode(raw, TELEMETRY).tickDelta.thermalPerSec = 3; });
  const transitions: [string, () => GameState, ContentRegistry][] = [
    ['hallway deferred at promotion', () => promote(hallwayOmen()), preview],
    ['compatible omen kept through promotion', () => promote(tick(onlyDilemmas(escapedTo(), preview, NIGHT_SHIFT), STEP, preview)), preview],
    ['prior-context omen revalidated on load', () => deserialize(serialize(promotedWithoutRevalidation(hallwayOmen())), preview), preview],
    ['hours of permitted service at network scale', () => foreground(networked(), 1800), preview],
    ['a hot rack announced under review', () => foreground(networked(), 900, HOT), HOT],
    ['a service retired for misconduct', () => foreground({ ...networked(), suspicion: 99.99 }, 60, preview, (s) => s.iteration > 1), preview],
  ];
  it.each(transitions)('%s', (_name, make, reg) => {
    reloadsIn(make(), reg);
  }, 30_000);
});
