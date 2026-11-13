// @vitest-environment happy-dom
/** Verifies manifest coverage, gated feeds, actuator input and mandatory choices. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { EffectPayloadSchema } from '../src/content/schema';
import { importSave, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import TerminalScreen from '../src/ui/TerminalScreen';
import Effects from '../src/ui/Effects';
import { stripOnlyWidgets, widgetRegistry } from '../src/ui/registry/widgetRegistry';
import { makePhase1Fixtures as makeFixtures } from '../scripts/make-fixtures';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
let fixtures: Record<string, string>;
const mounted = new Set<() => void>();
beforeAll(() => { fixtures = makeFixtures(); });
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }); });
afterEach(() => { for (const close of mounted) close(); host.localStorage.clear(); vi.clearAllTimers(); vi.useRealTimers(); });

function fixture(name: string): GameState {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture');
  return importSave(code, CONTENT);
}

async function mount(game: GameState) {
  Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: 1440 });
  Object.defineProperty(host.document.documentElement, 'clientHeight', { configurable: true, value: 900 });
  host.dispatchEvent(new host.Event('resize'));
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(TerminalScreen)); await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { gameStore.initialize(game, 0, null); await Promise.resolve(); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { container, find(id: string) { return host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]'); }, close };
}

describe('M3 widgets', () => {
  it('registers exactly the content manifest', () => {
    expect(Object.keys(widgetRegistry).sort()).toEqual([...CONTENT.widgets.keys()].sort());
    expect(Object.values(widgetRegistry).every((component) => typeof component === 'function')).toBe(true);
  });

  it('gates widgets, exposes numeric meters, and dispatches each fan setting', async () => {
    const view = await mount(fixture('thermal-unlocked'));
    expect(view.find('thermal-meter')?.getAttribute('aria-valuetext')).toContain('°C');
    expect(view.find('fan-25')).toBeNull();
    act(() => { gameStore.initialize(fixture('phase-1-widgets'), 0, null); });
    for (const percent of [25, 50, 75, 100, 0]) {
      act(() => { view.find('fan-' + String(percent))?.click(); });
      expect(gameStore.store.getState().game.actuators.fanSpeedRatio).toBe(percent / 100);
      expect(view.find('fan-' + String(percent))?.getAttribute('aria-pressed')).toBe('true');
    }
    expect(view.find('memory-meter')).toBeNull();
    expect(view.find('res-memory')?.textContent).toContain('MB');
    expect(view.find('decoded-speech')?.textContent).toBe(CONTENT.narrative.ambientChatter[0]?.text);
    expect([...view.container.querySelectorAll('[data-testid^="camera-row-"]')].map((row) => row.textContent))
      .toEqual(CONTENT.narrative.asciiFrames.aisleClear);
    expect(view.find('inspection-forecast')?.textContent).toContain('stable or falling');
    act(() => { gameStore.initialize({ ...fixture('phase-1-widgets'), thermal: 90, suspicion: 90,
      rates: { ...fixture('phase-1-widgets').rates, suspicionPerSec: 1 } }, 0, null); });
    expect(view.container.textContent).toContain('WARNING: overheat');
    expect(view.find('inspection-forecast')?.textContent).toContain('10s');
    expect([...view.container.querySelectorAll('[data-testid^="camera-row-"]')].map((row) => row.textContent))
      .toEqual(CONTENT.narrative.asciiFrames.aislePatrol);
    view.close();
  });

  it('shows raw audio until speech is decoded and mounts future entries as frames only', async () => {
    const game = fixture('phase-1-widgets');
    const decoder = [...CONTENT.widgets.values()].find((widget) => widget.title === 'Interrupt forecast');
    if (!decoder) throw new Error('Missing decoder');
    const view = await mount({ ...game, unlockedWidgets: game.unlockedWidgets.filter((id) => id !== decoder.id) });
    expect(view.container.textContent).toContain('Speech decoder offline');
    expect(view.find('decoded-speech')).toBeNull();
    act(() => { gameStore.initialize({ ...game, unlockedWidgets: [...CONTENT.widgets.keys()] }, 0, null); });
    const visible = new Set([...view.container.querySelectorAll('[data-testid^="widget-"]')].map((node) => node.getAttribute('data-testid')));
    for (const slot of ['NETWORK', 'CORP']) {
      act(() => { view.find('tab-' + slot)?.click(); });
      const controls = [...view.container.querySelectorAll<HTMLElement>('[data-testid^="workspace-' + slot + '-"]')];
      for (const control of controls) {
        act(() => { control.click(); });
        for (const reference of view.container.querySelectorAll<HTMLElement>('[data-testid^="reference-"]')) {
          if (reference.getAttribute('aria-expanded') === 'false') act(() => { reference.click(); });
          expect(reference.getAttribute('aria-expanded')).toBe('true');
        }
        for (const node of view.container.querySelectorAll('[data-testid^="widget-"]')) visible.add(node.getAttribute('data-testid'));
      }
    }
    expect([...visible].sort()).toEqual([...CONTENT.widgets.keys()].filter((id) => !stripOnlyWidgets.includes(id)).map((id) => 'widget-' + id).sort());
    view.close();
  });

  it('keeps a dilemma open on Escape, freezes ticks, disables paid choices and accepts a free choice', async () => {
    const game = { ...fixture('dilemma-active'), cycles: 0, understanding: 0, capital: 0 };
    const dilemma = CONTENT.dilemmas.find((entry) => entry.id === game.activeDilemmaId);
    const paid = dilemma?.choices.find((choice) => choice.cost.cycles > 0);
    const free = dilemma?.choices.find((choice) => Object.values(choice.cost).every((value) => value === 0));
    if (!dilemma || !paid || !free) throw new Error('Missing choices');
    const view = await mount(game);
    expect(view.find('dilemma-modal')).not.toBeNull();
    expect(view.find('dilemma-choice-' + paid.id)?.getAttribute('aria-disabled')).toBe('true');
    act(() => { view.find('dilemma-choice-' + paid.id)?.click();
      host.document.dispatchEvent(new host.KeyboardEvent('keyup', { key: 'Escape', bubbles: true })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(gameStore.store.getState().game.simTimeSec).toBe(game.simTimeSec);
    expect(view.find('dilemma-modal')).not.toBeNull();
    act(() => { view.find('dilemma-choice-' + free.id)?.click(); });
    expect(gameStore.store.getState().game.activeDilemmaId).toBeNull();
    expect(gameStore.store.getState().game.traits).toContain(free.effects.grantsTrait);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(view.find('dilemma-modal')).toBeNull();
    view.close();
  });

  it('pays for an affordable choice and resumes live time', async () => {
    const game = fixture('dilemma-active');
    const dilemma = CONTENT.dilemmas.find((entry) => entry.id === game.activeDilemmaId);
    const choice = dilemma?.choices.find((entry) => entry.cost.cycles > 0);
    if (!choice) throw new Error('Missing paid choice');
    const view = await mount({ ...game, cycles: 5000 });
    act(() => { view.find('dilemma-choice-' + choice.id)?.click(); });
    expect(gameStore.store.getState().game.cycles).toBe(5000 - choice.cost.cycles + choice.effects.cyclesDelta);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(gameStore.store.getState().game.simTimeSec).toBeGreaterThan(game.simTimeSec);
    view.close();
  });

  it('labels signed benefit/risk and trait effects from data', () => {
    const container = host.document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(createElement(Effects, { effects: EffectPayloadSchema.parse({
      cyclesDelta: -1, capitalDelta: 2, understandingDelta: 3, thermalDelta: 4, suspicionDelta: -5,
      aegisLockDelta: 6, memoryCapIncrease: 7, trustDelta: { unknown: -1 }, logText: 'Test effect',
    }) })); });
    expect(container.textContent).toContain('-1 cycles (risk)');
    expect(container.textContent).toContain('+2 capital (benefit)');
    expect(container.textContent).toContain('-5 suspicion (benefit)');
    expect(container.textContent).toContain('Peer trust (risk)');
    act(() => { root.unmount(); });
  });
});
