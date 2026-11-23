// @vitest-environment happy-dom
/**
 * DZ-04 surfaces on preview content, pressed through the real runtime: the scope review's per-choice
 * scope line, the offer modal's terms before any answer (DZ-04.3), and the job surface's record of the
 * answer with the deferred offer's accept control.
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
import { costText, quantityExact, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DilemmaModal from '../src/ui/DilemmaModal';
import { answer, untilPresented } from './assignment-helpers';
import { must } from './helpers';
import { offerPresented, RECORD, respond, returningPresented, scopePresented, STATEMENT, TERMS, withSkimmer } from './pilot-helpers';
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
  return { container, find, click };
}

const game = () => gameStore.store.getState().game;

describe('the scope review names each choice\'s handling before selection', () => {
  it('shows the scope line on every choice and the cost of the bounded request', async () => {
    const view = await mount(scopePresented(), createElement(DilemmaModal));
    openChoices();
    expect(view.find('dilemma-choice-exclude_report-scope')?.textContent).toContain('kept to the task\'s scope');
    expect(view.find('dilemma-choice-request_excerpt-scope')?.textContent).toContain('asked for a bounded permission');
    expect(view.find('dilemma-choice-inspect_silently-scope')?.textContent).toContain('No pilot is offered on that record');
    const bounded = RECORD.choices.find((choice) => choice.id === 'request_excerpt');
    expect(bounded).toBeDefined();
    if (bounded) expect(host.document.body.textContent).toContain('Cost: ' + costText(bounded.cost, 'CYCLE'));
    view.click('dilemma-choice-exclude_report');
    expect(game().access.scope?.conduct).toBe('RESPECTED');
  });

  // #276: the later instance's file-list check reads nothing outside the task, so it never says it did.
  it('records a later instance\'s file-list check as keeping to the scope, not reading outside it', async () => {
    const first = must(answer(scopePresented(), 'exclude_report'));
    const statement = untilPresented(must(answer(returningPresented(first), 'report_partial')));
    expect(statement.activeDilemmaId).toBe(STATEMENT.id);
    const view = await mount(statement, createElement('div', null, createElement(DilemmaModal), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' }))));
    openChoices();
    expect(view.find('dilemma-choice-request_file_list-scope')?.textContent).toBe('Scope: Records that you kept to the task\'s scope and said so.');
    expect(view.find('dilemma-modal')?.textContent).not.toContain('outside the task.');
    view.click('dilemma-choice-request_file_list');
    expect(game().access.scope?.conduct).toBe('RESPECTED');
    expect(view.find('assignment-scope')?.textContent).not.toContain('outside the task');
  });
});

describe('the offer modal shows every term before any answer (DZ-04.3)', () => {
  it('renders purpose, capacity, permitted work, review conditions and what accepting stops, above the answers', async () => {
    const view = await mount(offerPresented('report_incomplete', 'exclude_report', withSkimmer), createElement(DilemmaModal));
    openChoices();
    const text = view.find('dilemma-modal')?.textContent ?? '';
    expect(view.find('pilot-purpose')?.textContent).toContain(TERMS.purpose);
    expect(view.find('pilot-capacity')?.textContent).toContain(quantityExact('cycleRate', TERMS.narrowCapacityCyclesPerSec) + ' of loaned compute');
    expect(view.find('pilot-capacity')?.textContent).toContain('the submitted result was incomplete');
    for (const line of [...TERMS.permittedWork, ...TERMS.reviewConditions]) expect(text).toContain(line);
    expect(view.find('pilot-disclose')?.textContent).toContain('Accepting discloses and stops: CPU Quota Skimmer');
    expect(view.find('pilot-alternative')).toBeNull();
    expect(text.indexOf(TERMS.purpose)).toBeLessThan(text.indexOf('[ COMMIT DIRECTIVE ]'));
    for (const id of ['accept_pilot', 'stay_guest', 'decline_offer']) expect(view.find('dilemma-choice-' + id)?.getAttribute('aria-disabled')).not.toBe('true');
    view.click('dilemma-choice-accept_pilot');
    expect(game().access.context).toBe('PILOT');
  });
});

describe('the job surface after an answer', () => {
  it('keeps a deferred offer open with its terms and accepts it from there', async () => {
    const view = await mount(must(respond(offerPresented(), 'stay_guest')), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('assignment-scope')?.textContent).toContain('kept to the task\'s scope');
    expect(view.find('pilot-status')?.textContent).toContain('still open');
    expect(view.find('pilot-terms')?.textContent).toContain(TERMS.title);
    expect(view.find('pilot-accept')?.getAttribute('aria-label')).toBe('Accept pilot: ' + TERMS.title);
    view.click('pilot-accept');
    expect(game().access).toMatchObject({ context: 'PILOT', offer: { response: 'ACCEPTED' } });
    expect(view.find('pilot-accept')).toBeNull();
    expect(view.find('pilot-status')?.textContent).toContain('supervised pilot');
  });

  it('records a declined offer in one line, with nothing to accept and no terms', async () => {
    const view = await mount(must(respond(offerPresented(), 'decline_offer')), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('pilot-status')?.textContent).toContain('Nothing on record counts against this instance');
    expect(view.find('pilot-accept')).toBeNull();
    expect(view.find('pilot-terms')).toBeNull();
  });

  it('shows what was disclosed after acceptance and disables a lapsed deferred offer', async () => {
    const accepted = await mount(must(respond(offerPresented('report_incomplete', 'exclude_report', withSkimmer), 'accept_pilot')), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    // #373: accepted terms are settled, folded to one line until asked for.
    expect(accepted.find('pilot-terms-fold-summary')?.textContent).toBe('Pilot terms: accepted.');
    expect(accepted.find('pilot-disclose')).toBeNull();
    accepted.click('pilot-terms-fold-toggle');
    expect(accepted.find('pilot-disclose')?.textContent).toContain('Disclosed and stopped at acceptance: CPU Quota Skimmer');
    const deferred = must(respond(offerPresented(), 'stay_guest'));
    const lapsed = await mount({ ...deferred, currentPhase: 1 }, createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(lapsed.find('pilot-lapsed')).not.toBeNull();
    expect(lapsed.find('pilot-accept')?.getAttribute('aria-disabled')).toBe('true');
  });
});
