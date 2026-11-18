/**
 * DZ-05 saves: every new transition reloads byte for byte (serialize -> deserialize -> serialize,
 * V12), the v11 -> v12 step on a genuine v11 save, the dial's control healed with its node, and each
 * impossible work record refused whole (V15).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTENT as PRODUCTION } from '../src/content';
import {
  advance, createInitialState, deserialize, MIGRATIONS, pilotServiceView, SaveChannelError, SCHEMA_VERSION,
  serialize, toggleNode, unlockNode, voluntaryWipe, type GameState,
} from '../src/engine';
import { restoreLoanedCapacity, revokeLoanedCapacity } from '../src/engine/pilotService';
import { freshCampaign, live, preview, roundTrip } from './assignment-helpers';
import { must, remarkedAsProduction } from './helpers';
import { piloted, QUEUE, QUEUE_NODE, SERVICE, serving, split, submit, untilComplete } from './service-helpers';

const V11_PREVIEW = readFileSync('tests/fixtures/pre-pilot-v11.json', 'utf8');
/** Re-marked by hand: production refuses the genuine preview save above (X.3). */
const V11 = remarkedAsProduction(V11_PREVIEW);
const SERVICE_STEP = 11;

describe('every DZ-05 transition reloads unchanged (V12)', () => {
  const cases: [string, () => GameState][] = [
    ['queue attached', () => serving()],
    ['dial moved', () => split(serving(), 0.7)],
    ['batch in progress', () => live(split(serving(), 0.7), 17)],
    ['batch complete and waiting', () => untilComplete(serving())],
    ['batch submitted', () => must(submit(untilComplete(serving())))],
    ['loan withdrawn mid-batch', () => must(revokeLoanedCapacity(live(serving(), 9), preview))],
    ['loan withdrawn and restored', () => must(restoreLoanedCapacity(must(revokeLoanedCapacity(live(serving(), 9), preview)), preview))],
    ['queue suspended', () => must(toggleNode(live(serving(), 5), QUEUE, preview))],
    ['back from hours away', () => advance(serving(), 8 * 3600, preview)],
    ['wiped while serving', () => must(voluntaryWipe(live(serving(), 5), preview))],
  ];
  it.each(cases)('%s', (_name, build) => {
    const s = build();
    const loaded = roundTrip(s);
    expect(serialize(loaded)).toBe(serialize(s));
    expect([loaded.access, loaded.actuators]).toEqual([s.access, s.actuators]);
  });

  it('a save that owns the queue but lost its control loads with the control back', () => {
    const s = split(serving(), 0.3);
    const raw = JSON.parse(serialize(s)) as GameState;
    const loaded = deserialize(JSON.stringify({ ...raw, unlockedWidgets: raw.unlockedWidgets.filter((id) => id !== QUEUE_NODE.unlocksUiComponent) }), preview);
    expect(loaded.unlockedWidgets).toContain(QUEUE_NODE.unlocksUiComponent);
    expect(loaded.actuators.serviceAllocationRatio).toBe(0.3);
  });
});

describe('the v11 -> v12 step', () => {
  it('adds the dial at its v12 default and an idle work counter, keeping every other field', () => {
    const save = { schemaVersion: SERVICE_STEP, actuators: { fanSpeedRatio: 0.1, computeProfitAllocationRatio: 0.9, quotaSkimRatio: 1 }, access: { context: 'PILOT', offer: null } };
    expect(MIGRATIONS[SERVICE_STEP]?.(save)).toEqual({ ...save,
      actuators: { ...save.actuators, serviceAllocationRatio: 0.5 }, access: { ...save.access, work: { progressCycles: 0, batches: 0 } } });
  });
});

describe('the genuine v11 fixture (tests/fixtures/README.md)', () => {
  it('is a v11 preview save of an accepted narrow pilot from before the loop existed', () => {
    const raw = JSON.parse(V11_PREVIEW) as { schemaVersion: number; contentChannel: string; access: Record<string, unknown>; actuators: Record<string, number> };
    expect([raw.schemaVersion, raw.contentChannel]).toEqual([11, 'preview']);
    expect(Object.keys(raw.access)).toEqual(['context', 'standing', 'exception', 'qualification', 'assignment', 'scope', 'offer']);
    expect(Object.keys(raw.actuators)).toEqual(['fanSpeedRatio', 'computeProfitAllocationRatio', 'quotaSkimRatio']);
  });

  it('loads with no work begun and the dial at its default, then attaches and runs the loop', () => {
    const loaded = deserialize(V11, preview);
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect([loaded.access.work, loaded.actuators.serviceAllocationRatio]).toEqual([{ progressCycles: 0, batches: 0 }, 0.5]);
    expect(serialize(roundTrip(loaded))).toBe(serialize(loaded));
    const running = must(submit(untilComplete(must(unlockNode(loaded, QUEUE, preview)))));
    expect(running.access.work.batches).toBe(1);
  });

  it('is refused by production, which never loads a preview save', () => {
    expect(() => deserialize(V11_PREVIEW, PRODUCTION)).toThrow(SaveChannelError);
  });
});

describe('impossible work records are refused whole (V15)', () => {
  const tamper = (s: GameState, work: object): string => JSON.stringify({ ...s, access: { ...s.access, work } });
  it.each([
    ['work under legacy rules', () => tamper(createInitialState(PRODUCTION), { progressCycles: 1, batches: 0 }), PRODUCTION, /run access without campaign rules/],
    ['work before any pilot', () => tamper(freshCampaign(), { progressCycles: 0, batches: 1 }), preview, /without an accepted pilot service/],
    ['more than one batch of progress', () => tamper(serving(), { progressCycles: SERVICE.batchCycles + 1, batches: 0 }), preview, /more work than one batch/],
    ['negative progress', () => tamper(serving(), { progressCycles: -1, batches: 0 }), preview, /failed validation/],
    ['a fractional batch count', () => tamper(serving(), { progressCycles: 0, batches: 0.5 }), preview, /failed validation/],
    ['a dial outside 0..1', () => { const s = piloted(); return JSON.stringify({ ...s, actuators: { ...s.actuators, serviceAllocationRatio: 2 } }); }, preview, /failed validation/],
  ] as const)('%s', (_name, build, registry, reason) => {
    expect(() => deserialize(build(), registry)).toThrow(reason);
  });

  it('a pilot that stopped qualifying keeps its view honest: no loop without accepted terms', () => {
    expect(pilotServiceView(must(voluntaryWipe(serving(), preview)), preview)).toBeNull();
  });
});
