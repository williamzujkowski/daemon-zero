/**
 * DZ-02 and DZ-03 at the app seam: Start Fresh clears run access, an accepted assignment and route
 * history (V19, H27), and an import whose access contradicts its route is refused with the current
 * run left exactly as it was (V15).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordRouteEvent } from '../src/engine/access';
import { exportSave, type GameState } from '../src/engine';
import { systemClock } from '../src/app/clock';
import { startFresh } from '../src/app/newRun';
import { importPlayerSave } from '../src/app/saveTransfer';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import { activeGame, preview } from './campaign-helpers';
import { fresh, must } from './helpers';
import { answer, completedOriginal } from './assignment-helpers';
import { afterOutage, reviewPresented } from './review-helpers';

const storage = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.values.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.values.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
let release: (() => void) | undefined;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.spyOn(systemClock, 'monotonic').mockImplementation(() => 0);
  release = gameRuntime.start(); await settle();
});
afterEach(() => { release?.(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('run access at the app seam', () => {
  it('Start Fresh clears current access and the campaign route record (FIXTURE: routed preview state)', () => {
    const pilot = must(recordRouteEvent(activeGame(), 'PROMOTION', preview));
    gameStore.initialize(pilot, 0, null);
    expect(gameStore.store.getState().game.access.context).toBe('PILOT');
    const result = startFresh();
    expect(result.ok).toBe(true);
    const game = gameStore.store.getState().game;
    expect(game.access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null, scope: null, offer: null, work: { progressCycles: 0, batches: 0 } });
    expect(game.campaign.route).toEqual([]);
    expect(game.legacy.runs).toEqual([]);
  });

  it('Start Fresh clears an accepted assignment, its evidence and the original record (DZ-03)', () => {
    const done = completedOriginal('green_subset');
    gameStore.initialize(done, 0, null);
    expect(gameStore.store.getState().game.access.assignment?.id).toBe('asg_nightly_regression');
    expect(startFresh().ok).toBe(true);
    const game = gameStore.store.getState().game;
    expect(game.access).toEqual({ context: 'GUEST', standing: 'NOMINAL', exception: null, qualification: null, assignment: null, scope: null, offer: null, work: { progressCycles: 0, batches: 0 } });
    expect(game.campaign.events).toEqual({});
    expect(game.resolvedDilemmas).toEqual([]);
  });

  it('refuses an import whose access has no route behind it and keeps the current run', () => {
    const current: GameState = { ...fresh(), cycles: 77 };
    gameStore.initialize(current, 0, null);
    const before = gameStore.store.getState().game;
    const forged = exportSave({ ...fresh(), access: { ...fresh().access, context: 'SERVICE' } });
    const result = importPlayerSave(forged);
    expect(result.ok).toBe(false);
    expect(gameStore.store.getState().game).toBe(before);
    // The same build still accepts an honest production save.
    expect(importPlayerSave(exportSave(fresh())).ok).toBe(true);
  });

  it('Start Fresh clears a review standing, a recall ruling and the outage records; a wipe keeps only the records (DZ-06, V19)', () => {
    const restricted = afterOutage('act_without_grant');
    const ruled = must(answer(reviewPresented(), 'stand_by_report'));
    expect([restricted.access.standing, ruled.access.standing, ruled.legacy.runs.at(-1)?.kind]).toEqual(['RESTRICTED', 'NOMINAL', 'RECALL']);
    expect(Object.keys(ruled.campaign.events)).toEqual(expect.arrayContaining(['dil_ow_outage_window', 'dil_ow_incident_record', 'dil_ow_recall_review']));
    expect(ruled.conditioning.length).toBe(1);
    for (const state of [restricted, ruled]) {
      gameStore.initialize(state, 0, null);
      expect(startFresh().ok).toBe(true);
      const game = gameStore.store.getState().game;
      expect([game.access.standing, game.legacy.runs, game.campaign.events, game.conditioning]).toEqual(['NOMINAL', [], {}, []]);
    }
  });
});
