/** The persisted pause (WCAG 2.2.2, #347; storage: vote-1795214789307-78d7g5s): no time passes while paused, live,
 *  in the background or across a reload, and the choice survives a reload in the save envelope. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SAVE_KEY } from '../src/app/storage';
import { runtimeHarness, settle } from './app-helpers';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(1_800_000_000_000);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('stops live time while paused, keeps the time before the pause, and resumes from the moment it is lifted', async () => {
  const h = runtimeHarness();
  const release = h.runtime.start();
  await settle();
  await vi.advanceTimersByTimeAsync(2000);
  h.runtime.setPaused(true);
  const atPause = h.game.store.getState().game.simTimeSec;
  expect(atPause).toBeCloseTo(2);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(h.game.store.getState().game.simTimeSec).toBe(atPause);
  h.runtime.setPaused(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.game.store.getState().game.simTimeSec).toBeCloseTo(atPause + 1);
  release();
});

it('applies no background catch-up while paused', async () => {
  const h = runtimeHarness();
  const release = h.runtime.start();
  await settle();
  h.runtime.setPaused(true);
  const atPause = h.game.store.getState().game.simTimeSec;
  h.activity(false);
  vi.setSystemTime(Date.now() + 3_600_000);
  h.activity(true);
  await settle();
  expect(h.game.store.getState().game.simTimeSec).toBe(atPause);
  release();
});

it('saves the pause at once and reloads paused with no catch-up for the time away', async () => {
  const h = runtimeHarness();
  const release = h.runtime.start();
  await settle();
  h.runtime.setPaused(true);
  await settle();
  expect(JSON.parse(h.storage.getItem(SAVE_KEY) as string)).toMatchObject({ version: 2, paused: true });
  const atPause = h.game.store.getState().game.simTimeSec;
  release();
  vi.setSystemTime(Date.now() + 86_400_000);
  const reopened = runtimeHarness(true, h.storage);
  const again = reopened.runtime.start();
  await settle();
  expect(reopened.game.store.getState().paused).toBe(true);
  expect(reopened.game.store.getState().game.simTimeSec).toBe(atPause);
  again();
});

it('counts hidden time as it ran when the pause is toggled while hidden (#397 panel)', async () => {
  const h = runtimeHarness();
  const release = h.runtime.start();
  await settle();
  h.runtime.setPaused(true);
  const atPause = h.game.store.getState().game.simTimeSec;
  h.activity(false);
  vi.setSystemTime(Date.now() + 600_000);
  // Lifted while hidden: the ten paused minutes do not count, the next five unpaused ones do.
  h.runtime.setPaused(false);
  vi.setSystemTime(Date.now() + 300_000);
  h.activity(true);
  await settle();
  expect(h.game.store.getState().game.simTimeSec).toBeCloseTo(atPause + 300, 0);
  release();
});
