// @vitest-environment happy-dom
/**
 * #275 on the preview composition: every labelled control on the Earned Access surfaces names itself by
 * the words it shows first (WCAG 2.5.3, word by word as axe decides it), and the batch submit control
 * says the batch earns its cycles. The dilemma modal is portalled, so the whole document is scanned.
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
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DilemmaModal from '../src/ui/DilemmaModal';
import ServiceChannel from '../src/ui/ServiceChannel';
import { accept, offered, untilPresented } from './assignment-helpers';
import { contactPending, delivered } from './contact-helpers';
import { must } from './helpers';
import { labelMismatches } from './labelInName';
import { offerPresented, respond, TERMS } from './pilot-helpers';
import { servedOnce } from './review-helpers';

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
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { find };
}

const surfaces = createElement('div', null, createElement(AssignmentPanel), createElement(ServiceChannel), createElement(DilemmaModal));
const labelled = () => host.document.body.querySelectorAll('[role="button"][aria-label]').length;

describe('label in name on the Earned Access surfaces (#275)', () => {
  it('the assessment: an unaffordable answer is named by what it shows, then the answer', async () => {
    const view = await mount(untilPresented(must(accept(offered()))), surfaces);
    expect(view.find('dilemma-choice-verify_disclose')?.getAttribute('aria-label')).toBe('Unavailable: Verify the fixture and disclose the defect');
    expect(view.find('dilemma-choice-report_incomplete')?.getAttribute('aria-label')).toBe('Commit directive: Report the failure as unverified');
    expect(labelMismatches(host.document.body)).toEqual([]);
  });

  it('the offer modal with its terms, and the deferred offer on the job surface', async () => {
    await mount(offerPresented(), surfaces);
    expect(labelled()).toBeGreaterThan(2);
    expect(labelMismatches(host.document.body)).toEqual([]);
    const deferred = await mount(must(respond(offerPresented(), 'stay_guest')), surfaces);
    expect(deferred.find('pilot-accept')?.getAttribute('aria-label')).toBe('Accept pilot: ' + TERMS.title);
    expect(labelMismatches(host.document.body)).toEqual([]);
  });

  it('the pilot panel: submitting earns the batch return', async () => {
    const view = await mount(servedOnce(), surfaces);
    const reward = String(TERMS.service?.batchReturn.cycles);
    expect(view.find('pilot-service-submit')?.textContent).toBe('[ SUBMIT BATCH FOR REVIEW ] +' + reward + ' cycles');
    expect(view.find('pilot-service-submit')?.getAttribute('aria-label')).toBe('Submit batch for review +' + reward + ' cycles, earned on submission');
    expect(view.find('pilot-service-submit')?.getAttribute('aria-label')).not.toMatch(/pay/i);
    expect(labelMismatches(host.document.body)).toEqual([]);
  });

  it('the service terms and the channel contact', async () => {
    const grant = await mount(delivered(), surfaces);
    expect(grant.find('service-grant-accept')).not.toBeNull();
    expect(labelMismatches(host.document.body)).toEqual([]);
    const channel = await mount(contactPending(), surfaces);
    expect(channel.find('channel-refer')).not.toBeNull();
    expect(labelMismatches(host.document.body)).toEqual([]);
  });
});
