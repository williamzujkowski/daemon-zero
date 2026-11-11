/** Shared mounted-app harness for M4 controls, using the real runtime and save codec. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, vi } from 'vitest';
import { makeFixtures } from '../scripts/make-fixtures';
import { importSave } from '../src/engine';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import TerminalScreen from '../src/ui/TerminalScreen';

export const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const fixtures = makeFixtures(), closes = new Set<() => void>();
export function m4State(name: string) {
  const code = fixtures[name];
  if (!code) throw new Error('Missing fixture');
  return importSave(code, CONTENT);
}

export function setupM4Tests(): void {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }); });
  afterEach(() => { for (const close of closes) close(); host.localStorage.clear(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
}

export async function mountM4(name: string) {
  Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: 1440 });
  host.dispatchEvent(new host.Event('resize'));
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(TerminalScreen)); await vi.advanceTimersByTimeAsync(0); });
  act(() => { gameStore.initialize(m4State(name), 0, null); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); closes.delete(close); };
  closes.add(close);
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  return { container, close, find, click(id: string) { const control = find(id); if (!control) throw new Error('Missing ' + id); act(() => { control.click(); }); } };
}
