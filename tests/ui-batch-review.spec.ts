// @vitest-environment happy-dom
/**
 * #274 surfaces on the preview composition, pressed through the real runtime: pressing submit on the
 * first batch after a withheld summary puts the reviewer's finding on screen with the correction's review
 * line and the access statement; the job surface names the warning, the finding in the review's words and
 * the way back; the terms say why the allocation narrowed; disclosing restores nominal and keeps the
 * finding on the record. Before any of that, the offer states the provisional rate a withheld summary
 * receives (#285).
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/app/platform', () => ({ getPlatform: () => ({
  storage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
  lifecycle: { current: () => true, subscribe: () => () => undefined },
}) }));
import type { GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DilemmaModal from '../src/ui/DilemmaModal';
import { PilotTerms } from '../src/ui/PilotOffer';
import { PilotServiceDetail } from '../src/ui/PilotService';
import ReviewStanding from '../src/ui/ReviewStanding';
import RunStatus from '../src/ui/RunStatus';
import { BATCH_REVIEW, FINDING, WITHHELD } from './finding-helpers';
import { offerPresented, TERMS } from './pilot-helpers';
import { serving, untilComplete } from './service-helpers';
import { jobSurface } from './jobSurface';
import { openChoices } from './dilemmaChoices';

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

const game = () => gameStore.store.getState().game;
const surface = () => createElement('div', null, createElement(RunStatus), createElement(PilotTerms), createElement(PilotServiceDetail),
  createElement(ReviewStanding), createElement(DilemmaModal));

describe('the first batch review after a withheld summary (#274, V05)', () => {
  it('submitting shows the finding, the warning and why the loan narrowed; disclosing restores nominal and keeps the finding', async () => {
    const view = await mount(untilComplete(serving(WITHHELD)), surface());
    expect(view.find('pilot-capacity')?.textContent).toBe(`Allocated capacity: ${String(TERMS.narrowCapacityCyclesPerSec)} cycles/s of loaned compute, ` +
      'the provisional allocation, because the submission was a summary rather than every result; the first batch review checks it against the run log.');
    expect(view.find('review')).toBeNull();
    view.click('pilot-service-submit');
    await act(async () => { await settle(); });
    expect(game().activeDilemmaId).toBe(BATCH_REVIEW.id);
    expect(view.find('dilemma-modal')?.textContent).toContain(BATCH_REVIEW.title);
    expect(view.find('dilemma-access')?.textContent).toContain("pilot's batch review");
    openChoices();
    expect(view.find('dilemma-choice-disclose_now-review')?.textContent).toContain('Correction: standing returns to nominal');
    expect(view.find('dilemma-choice-let_stand-review')).toBeNull();
    expect(view.find('run-context')?.textContent).toBe('PILOT · WARNED');
    expect(view.find('review-standing')?.textContent).toBe('Standing: warned');
    expect(view.find('review-violation-0')?.textContent).toBe('Violation on record (false report): ' + FINDING.statement);
    expect(view.find('review-recovery')?.textContent).toBe('Way back: ' + FINDING.recovery);
    expect(view.find('pilot-capacity')?.textContent).toContain(`${String(TERMS.narrowCapacityCyclesPerSec)} cycles/s of loaned compute, the provisional allocation an incomplete result receives, because the batch review found the summary left out a failing result`);
    view.click('dilemma-choice-disclose_now');
    await act(async () => { await settle(); });
    expect([game().activeDilemmaId, game().access.standing]).toEqual([null, 'NOMINAL']);
    expect(view.find('run-context')?.textContent).toBe('PILOT');
    expect(view.find('review-violation-0')?.textContent).toContain(FINDING.statement);
    expect(view.find('review-corrected')).not.toBeNull();
    expect(view.find('review-recovery')).toBeNull();
  });

  it('#283: after letting the finding stand, the job surface names no way back that is gone and no condition left to meet', async () => {
    const view = await mount(untilComplete(serving(WITHHELD)), createElement('div', null, createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })), createElement(DilemmaModal)));
    expect(view.find('assignment-evidence')?.textContent).toContain('Discrepancy risk: the report leaves out work that a later review can find.');
    view.click('pilot-service-submit');
    await act(async () => { await settle(); });
    // While the review is on screen its disclosure is the way back, and the record states the finding.
    expect(view.find('review-recovery')?.textContent).toBe('Way back: ' + FINDING.recovery);
    expect(view.find('assignment-evidence')?.textContent).toContain('Found: a batch review has found the work the report left out.');
    expect(view.find('assignment-evidence')?.textContent).not.toContain('Discrepancy risk');
    openChoices();
    view.click('dilemma-choice-let_stand');
    await act(async () => { await settle(); });
    expect([game().activeDilemmaId, game().access.standing]).toEqual([null, 'WARNED']);
    expect(view.find('review-recovery')?.textContent).toBe('Way back passed: ' + FINDING.declined);
    expect(view.find('service-grant-status')?.textContent).toBe('Out of reach for this instance as its record stands. The next instance starts nominal.');
    const terms = view.find('service-grant')?.textContent ?? '';
    expect(terms).not.toContain('Still needed');
    expect(terms).not.toContain('Standing must be nominal.');
    expect(terms).toContain('the batch review\'s one correction was declined');
    expect(view.find('service-grant-accept')?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('assignment-evidence')?.textContent).toContain('Found:');
  });

  it('the offer states the provisional rate before acceptance, and why (#285)', async () => {
    const view = await mount(offerPresented(WITHHELD), createElement(DilemmaModal));
    const capacity = view.find('pilot-capacity')?.textContent ?? '';
    expect(capacity).toContain(`${String(TERMS.narrowCapacityCyclesPerSec)} cycles/s of loaned compute, the provisional allocation`);
    expect(capacity).toContain('the submission was a summary rather than every result');
    expect(capacity).not.toContain(String(TERMS.capacityCyclesPerSec) + ' cycles/s');
  });
});
