// @vitest-environment happy-dom
/** Verifies the actual web effect installs and removes development tools safely. */
import type { Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { DevHost } from '../src/app/devTools';
import { useGameLoop } from '../src/app/useGameLoop';

const host = globalThis as unknown as Window & DevHost & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const roots = new Set<Root>();
afterEach(() => { for (const root of roots) act(() => { root.unmount(); }); roots.clear(); host.localStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function Loop() { useGameLoop(); return null; }

it('installs only during its web lease and removes it on unmount', async () => {
  vi.useFakeTimers(); vi.stubGlobal('__DEV__', true);
  const root = createRoot(host.document.createElement('div'));
  roots.add(root);
  act(() => { root.render(createElement(Loop)); });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.__daemon).toBeDefined();
  act(() => { root.unmount(); });
  expect(host.__daemon).toBeUndefined();
});

it('does not leak the hook if unmounted before its lazy module settles', async () => {
  vi.useFakeTimers(); vi.stubGlobal('__DEV__', true);
  const root = createRoot(host.document.createElement('div'));
  roots.add(root);
  act(() => { root.render(createElement(Loop)); });
  act(() => { root.unmount(); });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.__daemon).toBeUndefined();
});
