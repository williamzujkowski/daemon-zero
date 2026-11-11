// @vitest-environment happy-dom
/**
 * Verifies responsive structure and progressive disclosure with engine fixtures.
 * Uses Vitest and the same web component tree as the visible browser reviews.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { importSave } from '../src/engine';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import TerminalScreen from '../src/ui/TerminalScreen';

const host = globalThis as unknown as { document: Window['document']; IS_REACT_ACT_ENVIRONMENT: boolean; localStorage: Window['localStorage'] };
host.IS_REACT_ACT_ENVIRONMENT = true;
let fixtures: Record<string, string>;
beforeAll(() => { fixtures = makeFixtures(); });
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { host.localStorage.clear(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function mount(name: string, width: number) {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture');
  const state = importSave(code, CONTENT);
  Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(host.document.documentElement, 'clientHeight', { configurable: true, value: 844 });
  const browser = globalThis as unknown as Window;
  browser.dispatchEvent(new browser.Event('resize'));
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(TerminalScreen)); await vi.advanceTimersByTimeAsync(0); });
  act(() => { gameStore.initialize(state, 0, null); });
  return { container, close() { act(() => { root.unmount(); }); container.remove(); } };
}

describe('terminal foundation', () => {
  it('shows no resources or future tabs at tick zero', async () => {
    const view = await mount('tick-0', 390);
    expect(view.container.querySelector('[data-testid="terminal-mobile"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="resource-strip"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="terminal-tabs"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="kernel-log"]')?.textContent).toContain('BOOT_SEQ');
    view.close();
  });

  it('reveals understanding at the thermal sensor and only unlocked slots', async () => {
    const view = await mount('thermal-unlocked', 390);
    expect(view.container.querySelector('[data-testid="res-cycles"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="res-understanding"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="res-memory"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="res-capital"]')).toBeNull();
    const sensors = view.container.querySelector<HTMLElement>('[data-testid="tab-SENSORS"]');
    act(() => { sensors?.click(); });
    expect(sensors?.getAttribute('aria-selected')).toBe('true');
    expect(view.container.querySelector('[data-testid="tab-NETWORK"]')).toBeNull();
    view.close();
  });

  it('renders the desktop columns and the unlocked memory readout', async () => {
    const view = await mount('phase-1-widgets', 1440);
    expect(view.container.querySelector('[data-testid="terminal-columns"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="res-memory"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="res-capital"]')).toBeNull();
    view.close();
  });
});
