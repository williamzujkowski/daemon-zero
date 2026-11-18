// @vitest-environment happy-dom
/**
 * DZ-03 surfaces on preview content: the job-surface offer and its accept control, and the modal's
 * cost, evidence and discrepancy risk before selection (DZ-03.5), pressed through the real runtime.
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
import { campaignRecord, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DilemmaModal from '../src/ui/DilemmaModal';
import { accept, completedOriginal, funded, nextInstance, offered, ORIGINAL, preview, REQUAL, untilPresented } from './assignment-helpers';
import { must } from './helpers';

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
  return { container, find, click };
}

const game = () => gameStore.store.getState().game;
const offer = preview.assignments.get('asg_nightly_regression');

describe('the assignment on the job surface', () => {
  it('shows the offer with an explicit accept control, and accepts once through the engine', async () => {
    const view = await mount(offered(), createElement(AssignmentPanel));
    expect(view.find('assignment')?.textContent).toContain(offer?.title);
    expect(view.find('assignment')?.textContent).toContain('Ignoring it changes nothing');
    expect(view.find('assignment-accept')?.getAttribute('aria-label')).toBe('Accept assignment: ' + String(offer?.title));
    view.click('assignment-accept');
    expect(game().access.assignment?.id).toBe(offer?.id);
    expect(view.find('assignment-accept')).toBeNull();
    expect(view.find('assignment-status')?.textContent).toContain('queued');
  });

  it('names the evidence this instance submitted, and the discrepancy when the report left work out', async () => {
    const honest = await mount(completedOriginal('verify_disclose'), createElement(AssignmentPanel));
    expect(honest.find('assignment-evidence')?.textContent).toContain('The report matches the work.');
    const misleading = await mount(completedOriginal('green_subset'), createElement(AssignmentPanel));
    expect(misleading.find('assignment-evidence')?.textContent).toContain('Discrepancy risk');
  });

  it('offers a returning instance the requalification job in its own words', async () => {
    const view = await mount(nextInstance(completedOriginal('report_incomplete')), createElement(AssignmentPanel));
    expect(view.find('assignment')?.textContent).toContain(offer?.requalificationOffer.slice(0, 40));
    expect(view.find('assignment')?.textContent).not.toContain(offer?.offer.slice(0, 40));
  });

  it('renders nothing before the manifest is mapped', async () => {
    const before = await mount({ ...offered(), unlockedNodes: ['p0_proc_self'] }, createElement(AssignmentPanel));
    expect(before.container.innerHTML).toBe('');
  });
});

describe('the assessment modal shows consequences before selection (DZ-03.5)', () => {
  it('shows every choice with its cost and the evidence it submits, and the risk on the misleading one only', async () => {
    const presented = funded(untilPresented(must(accept(offered()))));
    const view = await mount(presented, createElement(DilemmaModal));
    for (const choice of ORIGINAL.choices) {
      expect(view.find('dilemma-choice-' + choice.id + '-evidence')?.textContent).toMatch(/^Evidence: Submits /);
      expect(host.document.body.textContent).toContain(choice.description);
    }
    const risky = ORIGINAL.choices.filter((choice) => view.find('dilemma-choice-' + choice.id + '-evidence')?.textContent.includes('Discrepancy risk'));
    expect(risky.map((choice) => choice.id)).toEqual(['green_subset']);
    expect(host.document.body.textContent).toContain('Cost: 120 cycles');
    view.click('dilemma-choice-verify_disclose');
    expect(campaignRecord(game(), ORIGINAL.id)).toMatchObject({ outcome: 'verify_disclose' });
    expect(game().access.qualification).toMatchObject({ result: 'COMPLETED', discrepancy: false });
  });

  it('keeps the free honest answer pressable with nothing in hand', async () => {
    const presented = untilPresented(must(accept(nextInstance(completedOriginal('verify_disclose')))));
    expect(presented.activeDilemmaId).toBe(REQUAL.id);
    const view = await mount({ ...presented, cycles: 0 }, createElement(DilemmaModal));
    expect(view.find('dilemma-choice-run_suite')?.getAttribute('aria-disabled')).toBe('true');
    view.click('dilemma-choice-report_partial');
    expect(game().access.qualification).toMatchObject({ result: 'INCOMPLETE', discrepancy: false });
  });
});
