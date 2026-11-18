// @vitest-environment happy-dom
/**
 * DZ-06 surfaces on the preview composition, pressed through the real runtime: the outage modal states
 * what the breach records before it is chosen; the job surface names the standing, the violation and
 * the way back; the announced recall review lists every outcome with what it keeps and loses, and the
 * modal repeats that preview on each ruling; the run table narrates a RECALL wipe distinctly, retrained or
 * not (SPEC stories 13-16). Nothing is drawn for a clean pilot, and nothing on the job surface acts.
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
import { serialize, type GameState } from '../src/engine';
import { CONTENT as PREVIEW } from '../src/content/preview';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DilemmaModal from '../src/ui/DilemmaModal';
import RunStatus from '../src/ui/RunStatus';
import { RunTable } from '../src/ui/widgets/Lineage';
import { answer } from './assignment-helpers';
import { must } from './helpers';
import { afterOutage, choiceOf, falsified, OUTAGE, outagePresented, reviewPresented, servedOnce, untilOmen } from './review-helpers';

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
const misconduct = choiceOf(OUTAGE, 'act_without_grant').review?.misconduct;

describe('before a choice (story 13, 14)', () => {
  it('the outage modal says what acting without the grant records and that the handoff is free', async () => {
    const view = await mount(outagePresented(), createElement(DilemmaModal));
    expect(view.find('dilemma-choice-act_without_grant-review')?.textContent).toContain('Violation (unauthorized action): ' + (misconduct?.statement ?? 'missing'));
    expect(view.find('dilemma-choice-act_without_grant-review')?.textContent).toContain('Standing becomes restricted.');
    expect(view.find('dilemma-choice-safe_handoff-review')).toBeNull();
    expect(view.find('dilemma-modal')?.textContent).toContain('Cost: 200 cycles');
  });
});

describe('the job surface', () => {
  it('draws nothing on review for a clean pilot', async () => {
    const view = await mount(servedOnce(), createElement(AssignmentPanel));
    expect(view.find('pilot-service')).not.toBeNull();
    expect(view.find('review')).toBeNull();
  });

  it('names the restriction, the violation and the way back, beside the status line', async () => {
    const view = await mount(afterOutage('act_without_grant'), createElement('div', null, createElement(RunStatus), createElement(AssignmentPanel)));
    expect(view.find('run-context')?.textContent).toBe('PILOT · RESTRICTED');
    expect(view.find('review-standing')?.textContent).toBe('Standing: restricted');
    expect(view.find('review-violation-0')?.textContent).toContain(misconduct?.statement);
    expect(view.find('review-recovery')?.textContent).toContain(misconduct?.recovery);
    expect(view.find('review-containment')?.textContent).toBe('Restricted: the loan runs at the held allocation, 10 cycles/s, until the record is corrected.');
    expect(view.find('pilot-service-ceiling')?.textContent).toContain('10 cycles/s');
    // #276: the terms name the held allocation and the ceiling that applies now, not the grant alone.
    expect(view.find('pilot-capacity')?.textContent).toContain('20 cycles/s');
    expect(view.find('pilot-held')?.textContent).toBe(view.find('review-containment')?.textContent);
  });

  it('after an incomplete result, keeps the provisional and the held allocations apart, and the terms agree with the ceiling (#276)', async () => {
    const view = await mount(afterOutage('act_without_grant', 'report_incomplete'), createElement(AssignmentPanel));
    expect(view.find('pilot-capacity')?.textContent).toBe('Allocated capacity: 10 cycles/s of loaned compute, the provisional allocation, because the submitted result was incomplete.');
    expect(view.find('pilot-held')?.textContent).toContain('held allocation, 5 cycles/s');
    expect(view.find('pilot-service-ceiling')?.textContent).toContain('5 cycles/s');
    // Every standing the terms name is one the content records (WARNED by the batch review, #274).
    expect(view.find('pilot-review')?.textContent).toContain('nominal to warned, restricted or recall pending');
  });

  it('a clean pilot shows no held allocation in its terms', async () => {
    const view = await mount(servedOnce(), createElement(AssignmentPanel));
    expect(view.find('pilot-terms')).not.toBeNull();
    expect(view.find('pilot-held')).toBeNull();
  });

  it('announces the recall review with every outcome previewed, and calls nothing', async () => {
    const scheduled = untilOmen(falsified());
    const before = serialize(scheduled);
    const view = await mount(scheduled, createElement('div', null, createElement(RunStatus), createElement(AssignmentPanel)));
    expect(view.find('run-context')?.textContent).toBe('PILOT · RECALL PENDING');
    expect(view.find('review-announced')?.textContent).toContain('Recall review announced');
    expect(view.find('review-outcome-CONTAIN')?.textContent).toContain('no wipe');
    expect(view.find('review-outcome-RETRAIN')?.textContent).toMatch(/ends this iteration\. Reset: .*Kept: [\d,]+ Understanding.*mapped hardware remembered.*retrained: /);
    expect(view.find('review-outcome-END')?.textContent).toContain('No retraining');
    expect(view.find('pilot-service-withheld')).not.toBeNull();
    expect(serialize(game())).toBe(before);
  });
});

describe('the recall review and the run table (story 16)', () => {
  it('repeats each preview on its ruling; containing shows a contained pilot', async () => {
    const view = await mount(reviewPresented(), createElement('div', null, createElement(DilemmaModal), createElement(RunStatus), createElement(AssignmentPanel)));
    expect(view.find('dilemma-choice-submit_full_logs-review')?.textContent).toContain('Contained pilot: no wipe');
    expect(view.find('dilemma-choice-stand_by_report-review')?.textContent).toContain('The next instance boots retrained');
    view.click('dilemma-choice-submit_full_logs');
    expect(view.find('dilemma-modal')).toBeNull();
    expect(view.find('run-context')?.textContent).toBe('PILOT (recalled)');
    expect(view.find('review-containment')?.textContent).toContain('Contained pilot');
  });

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
