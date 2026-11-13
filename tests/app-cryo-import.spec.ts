/** A contradictory lineage import cannot overwrite either the live game or its checkpoint. */
import { afterEach, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { exportSave } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { importPlayerSave } from '../src/app/saveTransfer';
import { SAVE_KEY } from '../src/app/storage';
import { settle } from './app-helpers';

const storage = vi.hoisted(() => ({ values: new Map<string, string>(), writes: vi.fn() }));
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.values.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.values.set(key, value); storage.writes(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
let stop: (() => void) | undefined;
afterEach(() => { stop?.(); vi.useRealTimers(); });

it('rejects exclusive cryo flags atomically through the real player import/runtime boundary', async () => {
  vi.useFakeTimers();
  stop = gameRuntime.start(); await settle();
  const current = gameStore.store.getState().game;
  expect(importPlayerSave(exportSave({ ...current, cycles: 123 })).ok).toBe(true);
  await settle();
  const before = gameStore.store.getState();
  const checkpoint = storage.values.get(SAVE_KEY);
  expect(checkpoint).toBeDefined();
  const writes = storage.writes.mock.calls.length;
  const group = CONTENT.swarm.exclusiveNarrativeFlagGroups[0];
  if (!group) throw new Error('Missing exclusive outcome group');
  const invalid = exportSave({ ...before.game, narrativeFlags: [...before.game.narrativeFlags, ...group] });
  const rejected = importPlayerSave(invalid);
  expect(rejected.ok).toBe(false);
  expect(rejected.state).toBe(before.game);
  await settle();
  expect(gameStore.store.getState().game).toBe(before.game);
  expect(gameStore.store.getState().restoreRevision).toBe(before.restoreRevision);
  expect(storage.values.get(SAVE_KEY)).toBe(checkpoint);
  expect(storage.writes.mock.calls).toHaveLength(writes);
});
