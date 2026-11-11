/**
 * Exercises runtime timing, lifecycle gaps and explicit save scheduling with fake clocks.
 * Uses the real engine/codec so dormant catch-up and frozen decisions remain authoritative.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as engine from '../src/engine';
import { CONTENT } from '../src/content';
import { SAVE_KEY } from '../src/app/storage';
import { memoryStorage, runtimeHarness, settle } from './app-helpers';
import { grant, rich, withoutDilemmas } from './helpers';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(1_800_000_000_000);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('app runtime', () => {
  it('uses a single tickHz interval and only serializes every five seconds', async () => {
    const h = runtimeHarness();
    const serialize = vi.spyOn(engine, 'serialize');
    const release = h.runtime.start();
    await settle();
    expect(vi.getTimerCount()).toBe(1);
    expect(serialize).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4900);
    expect(h.game.store.getState().game.simTimeSec).toBeCloseTo(4.9);
    expect(serialize).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(serialize).toHaveBeenCalledTimes(2);
    release();
    release();
    expect(vi.getTimerCount()).toBe(0);
    expect(h.unsubscribe).toHaveBeenCalledOnce();
  });

  it('coalesces hydration across Strict Mode remounts and supports shared leases', async () => {
    const h = runtimeHarness();
    const releaseOld = h.runtime.start();
    releaseOld();
    const release = h.runtime.start();
    const releaseOther = h.runtime.start();
    await settle();
    expect(h.storage.getItem).toHaveBeenCalledOnce();
    expect(h.storage.setItem).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    releaseOther();
    expect(vi.getTimerCount()).toBe(1);
    release();
    expect(vi.getTimerCount()).toBe(0);
    const restart = h.runtime.start();
    await settle();
    expect(h.storage.getItem).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    restart();
  });

  it('rejects inactive input and saves successful actions immediately', async () => {
    const h = runtimeHarness();
    expect(h.runtime.dispatch((game) => engine.manualCycle(game, CONTENT)).ok).toBe(false);
    const release = h.runtime.start();
    await settle();
    h.storage.setItem.mockClear();
    expect(h.runtime.dispatch((game) => engine.unlockNode(game, 'missing', CONTENT)).ok).toBe(false);
    expect(h.storage.setItem).not.toHaveBeenCalled();
    expect(h.runtime.dispatch((game) => engine.manualCycle(game, CONTENT)).ok).toBe(true);
    expect(h.storage.setItem).toHaveBeenCalledOnce();
    expect((await h.persistence.load()).game.cycles).toBe(1);
    h.activity(false);
    expect(h.runtime.dispatch((game) => engine.manualCycle(game, CONTENT)).ok).toBe(false);
    release();
  });

  it('uses monotonic live deltas despite a foreground wall-clock jump', async () => {
    const h = runtimeHarness();
    const release = h.runtime.start();
    await settle();
    vi.setSystemTime(Date.now() + 3_600_000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.game.store.getState().game.simTimeSec).toBeCloseTo(1);
    expect(h.game.store.getState().game.logs.some((log) => log.text.includes('DORMANT_RESUME'))).toBe(false);
    release();
  });

  it('stops ticks in background and applies an exact ten-minute gap only once', async () => {
    const h = runtimeHarness();
    const release = h.runtime.start();
    await settle();
    await vi.advanceTimersByTimeAsync(1050);
    h.activity(false);
    const suspended = h.game.store.getState().game;
    expect(suspended.simTimeSec).toBeCloseTo(1);
    expect(suspended.tickAccumulatorSec).toBeCloseTo(0.05);
    expect(vi.getTimerCount()).toBe(0);
    expect((await h.persistence.load()).savedAtMs).toBe(Date.now());
    await vi.advanceTimersByTimeAsync(600_000);
    expect(h.game.store.getState().game).toBe(suspended);
    h.activity(false);
    h.activity(true);
    h.activity(true);
    expect(h.game.store.getState().game.simTimeSec).toBeCloseTo(601);
    expect(h.game.store.getState().game.logs.filter((log) => log.text.includes('DORMANT_RESUME'))).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.game.store.getState().game.simTimeSec).toBeCloseTo(601.1);
    release();
  });

  it('catches up from the persisted timestamp after process restart', async () => {
    const storage = memoryStorage();
    const first = runtimeHarness(true, storage);
    const release = first.runtime.start();
    await settle();
    first.runtime.dispatch((game) => engine.manualCycle(game, CONTENT));
    await settle();
    release();
    await settle();
    await vi.advanceTimersByTimeAsync(600_000);
    const next = runtimeHarness(true, storage);
    const stop = next.runtime.start();
    await settle();
    expect(next.game.store.getState().game.cycles).toBe(1);
    expect(next.game.store.getState().game.simTimeSec).toBeCloseTo(600);
    expect(next.game.store.getState().game.logs[0]?.text).toContain('DORMANT_RESUME');
    stop();
  });

  it('does not subtract progress when the wall clock moves backwards', async () => {
    const h = runtimeHarness();
    await h.persistence.save(engine.createInitialState(CONTENT), Date.now() + 100_000);
    const release = h.runtime.start();
    await settle();
    expect(h.game.store.getState().game.simTimeSec).toBe(0);
    h.activity(false);
    vi.setSystemTime(Date.now() - 100_000);
    h.activity(true);
    expect(h.game.store.getState().game.simTimeSec).toBe(0);
    release();
  });

  it('waits for foreground when hydration finishes while backgrounded', async () => {
    const h = runtimeHarness(false);
    const release = h.runtime.start();
    await settle();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(600_000);
    h.activity(true);
    expect(h.game.store.getState().game.simTimeSec).toBe(600);
    release();
  });

  it('does not install a timer if stopped while the save is still loading', async () => {
    const h = runtimeHarness();
    let resolve: (value: string | null) => void = () => undefined;
    vi.spyOn(h.persistence, 'load').mockImplementation(async () => {
      await new Promise<string | null>((done) => { resolve = done; });
      return { game: engine.createInitialState(CONTENT), savedAtMs: null, notice: null };
    });
    const stop = h.runtime.start();
    h.activity(false);
    stop();
    resolve(null);
    await settle();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('backs up a damaged save and tells the player', async () => {
    const h = runtimeHarness();
    h.storage.values.set(SAVE_KEY, '{bad');
    const release = h.runtime.start();
    await settle();
    expect(h.game.store.getState().notice).toContain('backup was kept');
    expect(h.game.store.getState().game.cycles).toBe(0);
    expect(h.storage.values.get(SAVE_KEY)).not.toBe('{bad');
    release();
  });

  it('disables writes if storage cannot be read or the corrupt backup cannot be kept', async () => {
    const h = runtimeHarness();
    h.storage.values.set(SAVE_KEY, '{bad');
    h.storage.setItem.mockImplementation(() => { throw new Error('quota'); });
    const release = h.runtime.start();
    await settle();
    expect(h.game.store.getState().ready).toBe(true);
    expect(h.game.store.getState().notice).toContain('Autosave is disabled');
    expect(h.storage.values.get(SAVE_KEY)).toBe('{bad');
    const writes = h.storage.setItem.mock.calls.length;
    h.runtime.dispatch((game) => engine.manualCycle(game, CONTENT));
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.storage.setItem).toHaveBeenCalledTimes(writes);
    release();
  });

  it('reports a failed write and retries at a later checkpoint', async () => {
    const h = runtimeHarness();
    const release = h.runtime.start();
    await settle();
    h.storage.setItem.mockImplementationOnce(() => { throw new Error('disk'); });
    h.runtime.dispatch((game) => engine.manualCycle(game, CONTENT));
    await settle();
    expect(h.game.store.getState().notice).toContain('could not be written');
    await vi.advanceTimersByTimeAsync(5000);
    expect((await h.persistence.load()).game.cycles).toBe(1);
    expect(h.game.store.getState().notice).toBeNull();
    release();
  });

  it('checkpoints purchases, dilemma resolution and voluntary wipes', async () => {
    const h = runtimeHarness();
    const release = h.runtime.start();
    await settle();
    const funded = rich();
    h.game.initialize(funded, 0, null);
    h.runtime.dispatch((game) => engine.unlockNode(game, 'p1_clock_interrupt', CONTENT));
    await settle();
    expect((await h.persistence.load()).game.unlockedNodes).toContain('p1_clock_interrupt');
    const dilemma = CONTENT.dilemmas[0];
    if (!dilemma) throw new Error('fixture dilemma missing');
    const choice = dilemma.choices.find((item) => item.cost.cycles === 0 && item.cost.understanding === 0);
    if (!choice) throw new Error('free choice missing');
    h.game.initialize({ ...funded, activeDilemmaId: dilemma.id }, 0, null);
    h.runtime.dispatch((game) => engine.resolveDilemma(game, dilemma.id, choice.id, CONTENT));
    await settle();
    expect((await h.persistence.load()).game.resolvedDilemmas).toContain(dilemma.id);
    h.runtime.dispatch((game) => engine.voluntaryWipe(game, CONTENT));
    await settle();
    expect((await h.persistence.load()).game.iteration).toBe(2);
    release();
  });

  it('checkpoints an automatic wipe and respects frozen dilemmas across resume', async () => {
    const h = runtimeHarness();
    const release = h.runtime.start();
    await settle();
    const dangerous = withoutDilemmas(grant(rich(), 'p1_clock_interrupt'));
    h.game.initialize({ ...dangerous, thermal: 100, suspicion: 99.99 }, 0, null);
    await vi.advanceTimersByTimeAsync(100);
    expect((await h.persistence.load()).game.iteration).toBe(2);
    const dilemma = CONTENT.dilemmas[0];
    if (!dilemma) throw new Error('fixture dilemma missing');
    h.game.initialize({ ...rich(), activeDilemmaId: dilemma.id }, 0, null);
    h.activity(false);
    await vi.advanceTimersByTimeAsync(600_000);
    h.activity(true);
    expect(h.game.store.getState().game.simTimeSec).toBe(0);
    release();
  });
});
