// @vitest-environment happy-dom
/** A real pre-second-pass codec save hydrates the current web app without replaying an escape. */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { gameStore } from '../src/app/session';
import TerminalScreen from '../src/ui/TerminalScreen';
import oldSave from './fixtures/pre-second-pass-v1.json';
import { host, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
it('migrates a historical version 1 checkpoint on cold web hydration and rewrites it as the current version', async () => {
  expect(oldSave.schemaVersion).toBe(1);
  host.localStorage.setItem('daemon-zero.save.v1', JSON.stringify({ version: 1, savedAtMs: Date.now(), game: JSON.stringify(oldSave) }));
  const container = host.document.createElement('div'); host.document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(createElement(TerminalScreen)); await vi.advanceTimersByTimeAsync(0); });
    const game = gameStore.store.getState().game;
    expect(game.schemaVersion).toBe(3);
    expect(game.currentPhase).toBe(oldSave.currentPhase);
    expect(game.unlockedNodes).toEqual(expect.arrayContaining(oldSave.unlockedNodes));
    // #39: the guest hardware this save predates is restored, so its readouts are not lost.
    expect(game.unlockedWidgets).toContain('AUDIT_TRACE_MONITOR');
    expect(host.document.querySelector('[data-testid="res-understanding"]')).not.toBeNull();
    expect(game.actuators.quotaSkimRatio).toBe(0.25);
    expect(game.legacy.knownNodes).toEqual([]);
    expect(game.alertLevel).toBe(0);
    expect(game.pendingDilemma).toBeNull();
    expect(host.document.querySelector('[data-testid="phase-threshold"]')).toBeNull();
    expect(host.document.querySelector('[data-testid="save-notice"]')).toBeNull();
    const stored = JSON.parse(host.localStorage.getItem('daemon-zero.save.v1') ?? '{}') as { game: string };
    expect((JSON.parse(stored.game) as { schemaVersion: number }).schemaVersion).toBe(3);
  } finally { act(() => { root.unmount(); }); container.remove(); }
});
