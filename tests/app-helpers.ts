/**
 * Supplies in-memory I/O and a controllable lifecycle for app integration tests.
 * Real store, save codec and runtime logic are exercised without platform services.
 */
import { vi } from 'vitest';
import { systemClock } from '../src/app/clock';
import { GameRuntime } from '../src/app/runtime';
import { createPersistence } from '../src/app/storage';
import { createGameStore } from '../src/app/store';

export function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, text: string) => { values.set(key, text); }),
  };
}

export function runtimeHarness(active = true, storage = memoryStorage()) {
  let foreground = active;
  let changed: (next: boolean) => void = () => undefined;
  const unsubscribe = vi.fn();
  const lifecycle = {
    current: () => foreground,
    subscribe: vi.fn((listener: (next: boolean) => void) => { changed = listener; return unsubscribe; }),
  };
  const game = createGameStore();
  const persistence = createPersistence(storage);
  const runtime = new GameRuntime(game, persistence, lifecycle, systemClock);
  return {
    storage, game, persistence, runtime, lifecycle, unsubscribe,
    activity(next: boolean) { foreground = next; changed(next); },
  };
}

export async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}
