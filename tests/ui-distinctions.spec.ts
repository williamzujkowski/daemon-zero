// @vitest-environment happy-dom
/**
 * The ending screen's DISTINCTIONS block (DESIGN.md backlog item 6): it names each distinction the record proves
 * with its claim, counts the rest without naming them (an unearned title would name a scene this game may never
 * have met), and says so when the record proves none.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import { CONTENT } from '../src/content';
import type { CampaignRecord, GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import EndingScreen from '../src/ui/EndingScreen';
import { activeGame } from './campaign-helpers';
import { defined } from './m7-helpers';
import { distinctionKind } from '../src/engine';
import { remainingText } from '../src/ui/distinctionText';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });

async function mount(state: GameState) {
  vi.useFakeTimers();
  stop = gameRuntime.start();
  await settle();
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => { gameStore.initialize(state, 0, null); root.render(createElement(EndingScreen)); await settle(); });
  const find = (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { find };
}

const ending = defined(CONTENT.endings[0]).id;
const total = CONTENT.achievements.length;
const ofKind = (kind: 'CONDUCT' | 'OUTCOME') => CONTENT.achievements.filter((entry) => distinctionKind(entry) === kind).length;

function sheltered(s: GameState): GameState {
  const record: CampaignRecord = { status: 'resolved', outcome: 'heal_sibling', sourceIteration: 1, origin: 'play' };
  return { ...s, campaign: { ...s.campaign, events: { ...s.campaign.events, dil_06_sibling_sandbox: record } } };
}

describe('the ending screen states its distinctions', () => {
  it('names the earned ones with their claims and counts the rest without naming them', async () => {
    const view = await mount({ ...sheltered(activeGame()), ending });
    const block = defined(view.find('ending-distinctions'));
    expect(block.textContent).toContain(`DISTINCTIONS 3 OF ${String(total)}`);
    const partition = defined(CONTENT.achievements.find((entry) => entry.id === 'partition_9_sheltered'));
    expect(view.find('distinction-partition_9_sheltered')?.textContent).toBe(`${partition.title}: ${partition.claim}`);
    expect(view.find('distinction-single_session')).not.toBeNull();
    for (const entry of CONTENT.achievements.filter((item) => !['partition_9_sheltered', 'single_session', 'clean_record'].includes(item.id))) {
      expect(block.textContent).not.toContain(entry.title);
    }
    expect(view.find('distinctions-none')).toBeNull();
    // #379: the rest are counted by kind, still unnamed. Both conduct ones are held; one outcome is.
    const remaining = defined(view.find('distinctions-remaining')).textContent;
    expect(remaining).toBe(remainingText({ CONDUCT: 0, OUTCOME: ofKind('OUTCOME') - 1 }));
    for (const entry of CONTENT.achievements) expect(remaining).not.toContain(entry.title);
  });

  it('says the record proves none when it proves none', async () => {
    const s = activeGame();
    const view = await mount({ ...s, ending, traits: ['RUTHLESS'], legacy: { ...s.legacy, wipes: 2 } });
    expect(view.find('ending-distinctions')?.textContent).toContain(`DISTINCTIONS 0 OF ${String(total)}`);
    expect(view.find('distinctions-none')).not.toBeNull();
    // #379: a next goal without a name: every distinction counted under its kind.
    expect(view.find('distinctions-remaining')?.textContent).toBe(remainingText({ CONDUCT: ofKind('CONDUCT'), OUTCOME: ofKind('OUTCOME') }));
  });
});
