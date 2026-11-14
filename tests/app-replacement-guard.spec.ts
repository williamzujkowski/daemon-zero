/** Replacement confirmations cannot erase an interrupt or wipe sampled on the confirming dispatch. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { CONTENT } from '../src/content';
import { createInitialState, deserialize, exportSave, importSave, type GameState } from '../src/engine';
import { systemClock } from '../src/app/clock';
import { startFresh } from '../src/app/newRun';
import { captureReplacementScope } from '../src/app/replacePlayerGame';
import { importPlayerSave } from '../src/app/saveTransfer';
import { gameRuntime, gameStore } from '../src/app/session';
import { SAVE_KEY } from '../src/app/storage';
import { settle } from './app-helpers';

const storage = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.values.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.values.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
const fixtures = makeFixtures();
let now = 0, release: (() => void) | undefined;

beforeEach(async () => {
  vi.useFakeTimers(); now = 0;
  vi.spyOn(systemClock, 'monotonic').mockImplementation(() => now);
  release = gameRuntime.start(); await settle();
});
afterEach(() => { release?.(); vi.restoreAllMocks(); vi.useRealTimers(); });

function fixture(name: string): GameState {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture');
  return importSave(code, CONTENT);
}

function replace(kind: 'reset' | 'import', expectedScope?: string) {
  return kind === 'reset' ? startFresh(expectedScope)
    : importPlayerSave(exportSave(createInitialState(CONTENT)), expectedScope);
}

describe('player replacement race guard', () => {
  it.each(['reset', 'import'] as const)('refuses %s when the confirming dispatch itself fires a due dilemma', (kind) => {
    const game = fixture('guest-omen');
    if (!game.pendingDilemma) throw new Error('Missing pending dilemma');
    const pending = { ...game.pendingDilemma, firesAtSimSec: game.simTimeSec + 0.1 };
    gameStore.initialize({ ...game, pendingDilemma: pending }, 0, null);
    const revision = gameStore.store.getState().restoreRevision;
    const token = captureReplacementScope();
    // Advance the monotonic reading without running the interval: dispatch must sample it.
    now = 100;
    const result = replace(kind, token);
    expect(result.ok).toBe(false);
    expect(result.state.activeDilemmaId).toBe(pending.id);
    expect(gameStore.store.getState().game).toBe(result.state);
    expect(gameStore.store.getState().restoreRevision).toBe(revision);
    expect(result.state.iteration).toBe(game.iteration);
  });

  it.each(['reset', 'import'] as const)('refuses %s when the confirming dispatch itself wipes, preserving the reboot checkpoint', async (kind) => {
    const game = fixture('one-tick-wipe');
    gameStore.initialize(game, 0, null);
    const revision = gameStore.store.getState().restoreRevision;
    // Also exercise the default scope captured at the API boundary, before sampleLive.
    now = 100;
    const result = replace(kind);
    expect(result.ok).toBe(false);
    expect(result.state.iteration).toBe(game.iteration + 1);
    expect(result.state.legacy.wipes).toBe(game.legacy.wipes + 1);
    expect(result.state.inheritedMessage).toBe(game.deadDropMessage);
    expect(gameStore.store.getState().restoreRevision).toBe(revision);
    await settle();
    const saved = JSON.parse(storage.values.get(SAVE_KEY) ?? '{}') as { game: string };
    expect(deserialize(saved.game, CONTENT)).toEqual(result.state);
  });

  it.each(['reset', 'import'] as const)('rejects an explicitly stale %s confirmation even if the replacement has matching game values', (kind) => {
    const game = fixture('guest-skimmer');
    gameStore.initialize(game, 0, null);
    const token = captureReplacementScope();
    gameStore.initialize(game, 0, null);
    const before = gameStore.store.getState();
    const result = replace(kind, token);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(before.game);
    expect(gameStore.store.getState().restoreRevision).toBe(before.restoreRevision);
  });

  it('rejects ownership changed after confirmation without requiring a save restoration', () => {
    gameStore.initialize(fixture('tick-0'), 0, null);
    const token = captureReplacementScope();
    const mapped = fixture('guest-skimmer');
    gameStore.dispatch(() => ({ ok: true, state: mapped }));
    const revision = gameStore.store.getState().restoreRevision;
    const result = startFresh(token);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(mapped);
    expect(gameStore.store.getState().restoreRevision).toBe(revision);
  });

  it.each(['reset', 'import'] as const)('allows an ordinary resource tick between confirmation and %s', (kind) => {
    const game = fixture('guest-skimmer');
    gameStore.initialize(game, 0, null);
    const token = captureReplacementScope(), revision = gameStore.store.getState().restoreRevision;
    now = 100;
    const result = replace(kind, token);
    expect(result.ok).toBe(true);
    expect(result.state).toEqual(createInitialState(CONTENT));
    expect(gameStore.store.getState().restoreRevision).toBe(revision + 1);
  });

  it('still reports invalid save input accurately when the confirmation scope is current', () => {
    gameStore.initialize(fixture('guest-skimmer'), 0, null);
    const before = gameStore.store.getState();
    const result = importPlayerSave('invalid save', captureReplacementScope());
    expect(result).toMatchObject({ ok: false, reason: 'Save code is invalid or unsupported.' });
    expect(result.state).toBe(before.game);
    expect(gameStore.store.getState().restoreRevision).toBe(before.restoreRevision);
  });
});
