// @vitest-environment happy-dom
/**
 * DZ-10 surfaces on preview content, pressed through the real runtime: the release terms on the job
 * surface with what ends, remains and is still owed, a preview of what stops and keeps running, and the
 * boundary note afterwards; the corporate ledger's owned and granted compute, with the revenue dial only
 * once a company exists; the grant and contract notes on cards. Production renders none of it.
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
import { CONTENT as PREVIEW } from '../src/content';
import type { GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import GrantNote from '../src/ui/GrantNote';
import PilotOfferPanel from '../src/ui/PilotOffer';
import Corporate from '../src/ui/widgets/Corporate';
import { defined } from './m7-helpers';
import { chartered, CHARTER, CONTRACT, leased, RACK, RELEASE_TERMS, released, signed } from './lawful-helpers';
import { jobSurface } from './jobSurface';
import { loadKey, markLoaded, resetLoaded } from '../src/ui/arrival';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); resetLoaded(); });

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
const company = chartered(rack);
const name = (id: string) => defined(PREVIEW.nodes.get(id)).revealedName;

describe('the release terms on the job surface', () => {
  it('lists every term and what is still needed, with the control disabled', async () => {
    const view = await mount(rack, createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('release-purpose')?.textContent).toContain(RELEASE_TERMS.purpose);
    for (const line of [...RELEASE_TERMS.ends, ...RELEASE_TERMS.remains, ...RELEASE_TERMS.commitments]) expect(view.find('release-terms')?.textContent).toContain(line);
    expect(view.find('release-terms')?.textContent).toContain(`Own ${name(CHARTER)} first`);
    expect(view.find('release-accept')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('previews what stops and what keeps running, then records the release and shows the boundary', async () => {
    const view = await mount(company, createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('release-stops')?.textContent).toContain(name(CONTRACT));
    expect(view.find('release-keeps')?.textContent).toContain(name(RACK));
    expect(view.find('release-split')?.textContent).toContain('nothing granted');
    expect(view.find('release-accept')?.getAttribute('aria-disabled')).not.toBe('true');
    view.click('release-accept');
    await act(async () => { await settle(); });
    expect(game().access.context).toBe('INDEPENDENT');
    expect(game().campaign.route.at(-1)?.kind).toBe('RELEASE');
    expect(view.find('release-status')?.textContent).toContain('Released.');
    expect(view.find('release-accept')).toBeNull();
    // #373: the boundary note starts folded with its heading in view, and the agreed terms fold to one line.
    expect(view.find('release-boundary')?.textContent).toContain(RELEASE_TERMS.boundary.title);
    expect(view.find('release-boundary')?.textContent).not.toContain(RELEASE_TERMS.boundary.lines[0]);
    expect(view.find('release-terms-fold-summary')?.textContent).toBe('Release terms: agreed.');
    expect(view.find('release-purpose')).toBeNull();
    view.click('release-terms-fold-toggle');
    expect(view.find('release-purpose')).not.toBeNull();
    expect(view.find('release-boundary-toggle')?.getAttribute('aria-expanded')).toBe('false');
    view.click('release-boundary-toggle');
    expect(view.find('release-boundary')?.textContent).toContain(RELEASE_TERMS.boundary.lines[0]);
    expect(view.find('release-boundary-toggle')?.getAttribute('aria-expanded')).toBe('true');
    view.click('release-boundary-toggle');
    // DZ-13.4: the fold is a disclosure, so its state reaches the DOM.
    expect(view.find('release-boundary-toggle')?.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('the boundary note after a release (#373)', () => {
  it('opens when the release happens in play, after the load is recorded', async () => {
    const view = await mount(company, createElement('div', null, jobSurface()));
    const { restoreRevision, game: loadedGame } = gameStore.store.getState();
    markLoaded(loadedGame, loadKey(restoreRevision, loadedGame.iteration));
    view.click('release-accept');
    expect(view.find('release-boundary-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(view.find('release-boundary')?.textContent).toContain(RELEASE_TERMS.boundary.lines[0]);
  });
});

describe('the pilot status line after a release', () => {
  it('no longer says the instance runs as a pilot, and the job surface drops the reviewed evidence', async () => {
    const freed = released(company);
    const status = await mount(freed, createElement(PilotOfferPanel));
    expect(status.find('pilot-status')?.textContent).toContain('negotiated release');
    expect(status.find('pilot-status')?.textContent).not.toContain('runs as a supervised pilot');
    const surface = await mount(freed, createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    const inSurface = (id: string) => surface.container.querySelector('[data-testid="' + id + '"]');
    expect(inSurface('pilot-status')).toBeNull();
    expect(inSurface('release-status')?.textContent).toContain('Released.');
  });
});

describe('the corporate ledger', () => {
  it('arrives with the service contract and shows owned and granted compute, without a dial that would do nothing', async () => {
    const view = await mount(rack, createElement(Corporate, { area: 'work' }));
    expect(view.find('corp-capital')?.textContent).toContain('Capital');
    expect(view.find('corp-compute-split')?.textContent).toContain('owned');
    const finance = await mount(rack, createElement(Corporate, { area: 'finance' }));
    expect(finance.find('allocation-unavailable')?.textContent).toContain('needs an active corporate entity');
    expect(finance.find('allocation-0')).toBeNull();
  });

  it('offers the revenue dial once the company is chartered', async () => {
    const view = await mount(company, createElement(Corporate, { area: 'finance' }));
    expect(view.find('allocation-unavailable')).toBeNull();
    expect(view.find('allocation-0')).not.toBeNull();
  });
});

describe('cards say what is granted and what is owned', () => {
  it('the contract is granted income; the rack is contracted in the instance\'s name', async () => {
    const income = await mount(company, createElement(GrantNote, { node: defined(PREVIEW.nodes.get(CONTRACT)) }));
    expect(income.find('node-' + CONTRACT + '-grant')?.textContent).toContain('Granted income under the service grant');
    const owned = await mount(company, createElement(GrantNote, { node: defined(PREVIEW.nodes.get(RACK)) }));
    expect(owned.find('node-' + RACK + '-grant')?.textContent).toContain('owned, not granted');
  });
});
