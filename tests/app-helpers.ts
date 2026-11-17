/**
 * Supplies in-memory I/O and a controllable lifecycle for app integration tests.
 * Real store, save codec and runtime logic are exercised without platform services.
 */
import { vi } from 'vitest';
import { systemClock } from '../src/app/clock';
import { GameRuntime } from '../src/app/runtime';
import { createPersistence } from '../src/app/storage';
import { createGameStore } from '../src/app/store';

/**
 * The two playhead reads a fake music player needs. The position moves on every read, so a
 * fade-in that waits for the audio to flow takes its first step on its first tick, as it did
 * before it waited; the length is unknown, so the loop-seam dip never engages.
 */
export function movingPlayhead() {
  let at = 0;
  return { position: () => (at += 0.025), duration: () => 0 };
}

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
