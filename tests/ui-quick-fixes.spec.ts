// @vitest-environment happy-dom
/** UI fix batch F6 (docs/UI-REVIEW.md): rate units on the phone strip, brownout shown as paused, the SAVES
 *  label in its accessible name, and one back control on the kernel log (#370, #387, #366, #381). */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePhase1Fixtures } from '../scripts/make-fixtures';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { importSave, type GameState } from '../src/engine';
import TerminalScreen from '../src/ui/TerminalScreen';

const host = globalThis as unknown as { document: Window['document']; IS_REACT_ACT_ENVIRONMENT: boolean; localStorage: Window['localStorage'] };
host.IS_REACT_ACT_ENVIRONMENT = true;
let fixtures: Record<string, string>;
beforeAll(() => { fixtures = makePhase1Fixtures(); });
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { host.localStorage.clear(); vi.clearAllTimers(); vi.useRealTimers(); });

async function mount(width: number, patch: Partial<GameState> = {}) {
  const state = { ...importSave(fixtures['phase-1-widgets'] ?? '', CONTENT), ...patch };
  Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(host.document.documentElement, 'clientHeight', { configurable: true, value: 844 });
  const browser = globalThis as unknown as Window;
  browser.dispatchEvent(new browser.Event('resize'));
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(TerminalScreen)); await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { gameStore.initialize(state, 0, null); await vi.advanceTimersByTimeAsync(0); });
  // The game menu renders as a modal outside the container, so look in the whole document.
  const find = (id: string) => host.document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const click = (id: string) => { act(() => { find(id)?.click(); }); };
  return { find, click, close() { act(() => { root.unmount(); }); container.remove(); } };
}

describe('UI quick fixes (F6)', () => {
  it('prints the rate unit on the phone strip as on desktop (#370)', async () => {
    const phone = await mount(390);
    expect(phone.find('res-cycles')?.textContent).toMatch(/[+-][\d.,]+[KMBTP]?\/s/);
    expect(phone.find('res-understanding')?.textContent).toMatch(/\/s/);
    phone.close();
    const desktop = await mount(1440);
    expect(desktop.find('res-cycles')?.textContent).toMatch(/\(\+?-?[\d.,]+[KMBTP]?\/s\)/);
    desktop.close();
  });

  it('shows understanding as paused while a brownout halts it, in text and name (#387)', async () => {
    for (const width of [390, 1440]) {
      const view = await mount(width, { brownout: true });
      const readout = view.find('res-understanding');
      expect(readout?.textContent).toContain('paused');
      expect(readout?.textContent).not.toMatch(/\+[\d.]+/);
      expect(readout?.getAttribute('aria-label')).toContain('paused: brownout');
      expect(view.find('res-cycles')?.textContent).toMatch(/\/s/);
      view.close();
    }
  });

  it('names the SAVES button with its visible word first (#366)', async () => {
    const view = await mount(390);
    view.click('menu-open');
    const saves = view.find('save-open');
    const visible = (saves?.textContent ?? '').replace(/[[\]\s]/g, '').toLowerCase();
    expect(visible).toBe('saves');
    expect((saves?.getAttribute('aria-label') ?? '').toLowerCase().startsWith(visible)).toBe(true);
    view.close();
  });

  it('opens the kernel log under the menu chrome with no extra back control (#381)', async () => {
    const view = await mount(390);
    view.click('menu-open');
    view.click('menu-kernel');
    expect(view.find('menu-kernel-log')).not.toBeNull();
    expect(view.find('menu-back')).not.toBeNull();
    expect(view.find('kernel-back')).toBeNull();
    view.close();
  });
});
