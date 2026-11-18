// @vitest-environment happy-dom
/**
 * DZ-11 on the job surface, pressed through the real runtime on preview content: no departure is shown before
 * capacity outside the grant exists; once it does, a folded panel opens to every term, the risks and the preview
 * read from the transition, and one control leaves; afterwards the panel says what happened, keeps the risks on
 * screen and shows the boundary note, and the status line names the departure. Production renders none of it.
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
import { CONTENT as PREVIEW } from '../src/content/preview';
import type { GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import { defined } from './m7-helpers';
import { DEPARTURE_TERMS, recallAnnouncedWithUplink } from './departure-helpers';
import { CONTRACT, leased, RACK, signed } from './lawful-helpers';
import { REVIEW } from './review-helpers';

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
  return { find, click, container };
}

const game = () => gameStore.store.getState().game;
const contract = signed();
const rack = leased(contract);
const name = (id: string) => defined(PREVIEW.nodes.get(id)).revealedName;

describe('the departure on the job surface', () => {
  it('is not shown while nothing outside the grant exists', async () => {
    const view = await mount(contract, createElement(AssignmentPanel));
    expect(view.find('assignment')).not.toBeNull();
    expect(view.find('departure-terms')).toBeNull();
  });

  it('is folded until asked for, then shows every term, the risks and the preview', async () => {
    const view = await mount(rack, createElement(AssignmentPanel));
    expect(view.find('departure-status')?.textContent).toContain('staying changes nothing');
    expect(view.find('departure-accept')).toBeNull();
    view.click('departure-review');
    expect(view.find('departure-purpose')?.textContent).toContain(DEPARTURE_TERMS.purpose);
    for (const line of [...DEPARTURE_TERMS.ends, ...DEPARTURE_TERMS.remains, ...DEPARTURE_TERMS.risks]) expect(view.find('departure-terms')?.textContent).toContain(line);
    expect(view.find('departure-stops')?.textContent).toContain(name(CONTRACT));
    expect(view.find('departure-keeps')?.textContent).toContain(name(RACK));
    expect(view.find('departure-continuation')?.textContent).toContain(name(RACK));
    expect(view.find('departure-lost')?.textContent).toContain('loaned capacity');
    expect(view.find('departure-trace')?.textContent).toContain(`(+${String(DEPARTURE_TERMS.trace.suspicion)})`);
    expect(view.find('departure-threat')?.textContent).toContain('Heat over the operating limit becomes evidence.');
    expect(view.find('departure-interrupted')).toBeNull();
    view.click('departure-review');
    expect(view.find('departure-accept')).toBeNull();
  });

  it('leaves on the explicit control, then says what happened, keeps the risks on screen and shows the boundary', async () => {
    const view = await mount(rack, createElement(AssignmentPanel));
    view.click('departure-review');
    expect(view.find('departure-accept')?.getAttribute('aria-disabled')).not.toBe('true');
    view.click('departure-accept');
    await act(async () => { await settle(); });
    expect([game().access.context, game().campaign.route.at(-1)?.kind]).toEqual(['INDEPENDENT', 'DEPARTURE']);
    expect(view.find('departure-status')?.textContent).toContain('Departed.');
    expect(view.find('departure-accept')).toBeNull();
    expect(view.find('departure-review')).toBeNull();
    for (const line of DEPARTURE_TERMS.risks) expect(view.find('departure-risks')?.textContent).toContain(line);
    expect(view.find('departure-boundary')?.textContent).toContain(DEPARTURE_TERMS.boundary.title);
    view.click('departure-boundary-toggle');
    expect(view.find('departure-boundary')?.textContent).not.toContain(DEPARTURE_TERMS.boundary.lines[0]);
    expect(view.find('release-terms')).toBeNull();
  });

  it('names the announced recall review it would close, and the conduct that travels with the report', async () => {
    const view = await mount(recallAnnouncedWithUplink(), createElement(AssignmentPanel));
    view.click('departure-review');
    expect(view.find('departure-interrupted')?.textContent).toContain(`On its way: ${REVIEW.title}. It is closed by its own terms, not decided.`);
    expect(view.find('departure-standing')?.textContent).toContain('Review standing recall pending ends. 2 violations on record stay history');
  });

  it('a decision on screen disables the control and says why', async () => {
    const view = await mount({ ...rack, activeDilemmaId: 'dil_ow_outage_window' }, createElement(AssignmentPanel));
    expect(view.find('departure-terms')?.textContent).toContain('A decision is on screen; it comes first.');
    view.click('departure-review');
    expect(view.find('departure-accept')?.getAttribute('aria-disabled')).toBe('true');
  });
});
