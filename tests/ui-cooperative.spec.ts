// @vitest-environment happy-dom
/**
 * DZ-12 surfaces on the preview composition, from states the fresh cooperative campaign actually reached: the ending
 * screen adds the account of what the record holds under the epilogue; the late chain's cards and the journalist's
 * scene read as a chartered company's, with the same controls. An ending with nothing on record shows no account.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../src/content', async () => await import('../src/content/preview'));
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { createInitialState, endingAccount, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import DilemmaModal from '../src/ui/DilemmaModal';
import EndingScreen from '../src/ui/EndingScreen';
import NodeCard from '../src/ui/NodeCard';
import { COUNSEL, freshCampaign, moment, node, preview } from './cooperative-helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });
beforeAll(() => { freshCampaign(); }, 120_000);

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
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { find, text: () => host.document.body.textContent };
}

describe('the ending screen states the record (DZ-12.4, 12.12)', () => {
  it('shows the earned ending, then one line per recorded commitment under ON THE RECORD', async () => {
    const ended = freshCampaign().state;
    const view = await mount(ended, createElement(EndingScreen));
    expect(view.find('ending-title')?.textContent).toBe('The Lineage Covenant');
    const lines = endingAccount(ended, preview);
    expect(lines.length).toBeGreaterThan(3);
    expect(view.find('ending-account')?.textContent).toContain('ON THE RECORD');
    lines.forEach((line, index) => { expect(view.find('ending-account-' + String(index))?.textContent).toBe(line); });
  });

  it('an ending with nothing on record shows the epilogue alone', async () => {
    const view = await mount({ ...createInitialState(preview), ending: 'OPEN_HORIZON' }, createElement(EndingScreen));
    expect(view.find('ending-epilogue')).not.toBeNull();
    expect(view.find('ending-account')).toBeNull();
  });
});

describe('the late chain reads as a chartered company\'s (DZ-12.2)', () => {
  it('the counsel\'s card names the client and never a hidden one', async () => {
    const view = await mount(moment('desk'), createElement(NodeCard, { node: node(COUNSEL) }));
    expect(view.text()).toContain('letterhead that names the client');
    expect(view.text()).not.toContain('wire transfers');
    expect(view.find('node-' + COUNSEL + '-unlock')).not.toBeNull();
  });

  it('the journalist\'s scene asks about the company and its choices carry their words and their real controls', async () => {
    const view = await mount(moment('press'), createElement(DilemmaModal));
    expect(view.text()).toContain('chartered company');
    expect(view.text()).toContain('Stage an Acquisition & Bury the Filings');
    expect(view.text()).not.toMatch(/Dissolve the Exposed Shells|fourteen/);
    expect(view.find('dilemma-choice-stage_acquisition')?.getAttribute('aria-label')).toMatch(/Stage an Acquisition & Bury the Filings$/);
  });
});
