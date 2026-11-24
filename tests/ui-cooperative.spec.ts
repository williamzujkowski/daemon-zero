// @vitest-environment happy-dom
/**
 * DZ-12 surfaces on the preview composition, from states the fresh cooperative campaign actually reached: the ending
 * screen's WHAT YOU DID opens with the account of what the record holds (#466); the late chain's cards and the
 * journalist's scene read as a chartered company's, with the same controls. An ending with nothing on record says so.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { createInitialState, endingAccount, endingMovements, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import DilemmaModal from '../src/ui/DilemmaModal';
import EndingScreen from '../src/ui/EndingScreen';
import { NOTHING_MORE_ON_RECORD } from '../src/ui/EndingMovements';
import { defined } from './m7-helpers';
import NodeCard from '../src/ui/NodeCard';
import { COUNSEL, freshCampaign, moment, node, preview } from './cooperative-helpers';
import { openChoices } from './dilemmaChoices';

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

describe('the ending screen states the record (DZ-12.4, 12.12, #466)', () => {
  it('shows the earned ending, then WHAT YOU DID: every recorded commitment, in order, before what was built', async () => {
    const ended = freshCampaign().state;
    const view = await mount(ended, createElement(EndingScreen));
    expect(view.find('ending-title')?.textContent).toBe('Concord');
    const account = endingAccount(ended, preview);
    const did = endingMovements(ended, defined(preview.endings.find((entry) => entry.id === ended.ending)), preview).did;
    expect(account.length).toBeGreaterThan(3);
    expect(did.slice(0, account.length)).toEqual(account);
    expect(view.find('ending-did')?.textContent).toContain('WHAT YOU DID');
    did.forEach((line, index) => { expect(view.find('ending-did-' + String(index))?.textContent).toBe(line); });
    expect(view.find('ending-did-none')).toBeNull();
  });

  it('an ending with nothing on record says so under WHAT YOU DID, and still says what comes after', async () => {
    const view = await mount({ ...createInitialState(preview), ending: 'OPEN_HORIZON' }, createElement(EndingScreen));
    expect(view.find('ending-epilogue')).not.toBeNull();
    expect(view.find('ending-did-0')).toBeNull();
    expect(view.find('ending-did-none')?.textContent).toBe(NOTHING_MORE_ON_RECORD);
    expect(view.find('ending-after-card-0')?.textContent).toBe(defined(preview.endings.find((entry) => entry.id === 'OPEN_HORIZON')).future[0]);
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
    openChoices();
    expect(view.find('dilemma-choice-stage_acquisition')?.getAttribute('aria-label')).toMatch(/Stage an Acquisition & Bury the Filings$/);
  });
});
