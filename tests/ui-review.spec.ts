// @vitest-environment happy-dom
/**
 * DZ-06 surfaces on the preview composition: the run table narrates a RECALL wipe distinctly from every
 * other end, retrained or not, beside the route it ended (SPEC story 16, DZ-06.6).
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/content', async () => await import('../src/content/preview'));
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import type { GameState } from '../src/engine';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import { RunTable } from '../src/ui/widgets/Lineage';
import { answer } from './assignment-helpers';
import { must } from './helpers';
import { reviewPresented } from './review-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });

async function mount(state: GameState, element: ReactElement) {
  if (!stop) {
    vi.useFakeTimers();
    stop = gameRuntime.start();
    await settle();
  }
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => { gameStore.initialize(state, 0, null); root.render(element); await settle(); });
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const click = (id: string) => { act(() => { find(id)?.click(); }); };
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { find, click };
}

describe('the run table (story 16)', () => {
  it('narrates a retraining ruling and an ended iteration distinctly from any other end', async () => {
    const retrained = must(answer(reviewPresented(), 'stand_by_report'));
    const first = await mount(retrained, createElement(RunTable));
    expect(first.find('run-row-1')?.textContent).toContain(PREVIEW.narrative.runVerdicts.RECALL_RETRAINED);
    expect(first.find('run-row-1')?.textContent).toContain('Retrained.');
    expect(first.find('run-row-1')?.textContent).toContain('Promoted to pilot.');
    const ended = must(answer(reviewPresented(), 'request_end'));
    const second = await mount(ended, createElement(RunTable));
    expect(second.find('run-row-1')?.textContent).toContain(PREVIEW.narrative.runVerdicts.RECALL_ENDED);
    expect(second.find('run-row-1')?.textContent).not.toContain('Retrained.');
  });
});
