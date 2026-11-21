// @vitest-environment happy-dom
/**
 * #284 on the preview composition, mounted at 390x844 through the real terminal: a channel ticket waiting
 * on CORE while another pane is open is named by a non-modal chrome notice and a marked CORE tab, and the
 * notice opens CORE; the wider tiers always show CORE and never render it. Answering on screen moves focus
 * to the boundary note; a restored, already answered contact does not take focus. The boundary names the
 * real menu path, and the pilot status line follows the grant.
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
import ServiceChannel from '../src/ui/ServiceChannel';
import TerminalScreen from '../src/ui/TerminalScreen';
import { answer, CHANNEL_ENCOUNTER, contactPending, delivered } from './contact-helpers';
import { must } from './helpers';
import { labelMismatches } from './labelInName';
import { jobSurface } from './jobSurface';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
let stop: (() => void) | undefined;
afterEach(() => { for (const close of mounted) close(); stop?.(); stop = undefined; vi.useRealTimers(); });

function viewport(width: number, height: number): void {
  Object.defineProperty(host.document.documentElement, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(host.document.documentElement, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(host, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(host, 'innerHeight', { configurable: true, value: height });
  host.dispatchEvent(new host.Event('resize'));
}

async function mount(state: GameState, element: ReactElement, size: readonly [number, number] = [390, 844]) {
  viewport(size[0], size[1]);
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

const pending = contactPending();
const selected = (view: Awaited<ReturnType<typeof mount>>, slot: string) => view.find('tab-' + slot)?.getAttribute('aria-selected');

describe('a waiting ticket while another pane is open (#284)', () => {
  it('phone: a non-modal notice and a marked CORE tab name it, and the notice opens CORE', async () => {
    const view = await mount(pending, createElement(TerminalScreen));
    if (selected(view, 'NETWORK') !== 'true') view.click('tab-NETWORK');
    expect(selected(view, 'NETWORK')).toBe('true');
    expect(view.find('service-channel')).toBeNull();
    const notice = view.find('contact-notice');
    expect(notice?.textContent).toContain(`a ticket about the ${CHANNEL_ENCOUNTER.name} is waiting for an answer on CORE`);
    expect(notice?.getAttribute('aria-live')).toBe('polite');
    expect(view.find('dilemma-modal')).toBeNull();
    expect(view.find('tab-CORE')?.textContent).toBe('CORE •');
    expect(view.find('tab-CORE')?.getAttribute('aria-label')).toBe('CORE pane, a support ticket is waiting');
    expect(labelMismatches(host.document.body)).toEqual([]);
    view.click('contact-notice-open');
    expect(selected(view, 'CORE')).toBe('true');
    expect(view.find('service-channel')).not.toBeNull();
    expect(view.find('contact-notice')).toBeNull();
    expect(view.find('tab-CORE')?.textContent).toBe('CORE');
    expect(view.find('tab-CORE')?.getAttribute('aria-label')).toBe('CORE pane');
  });

  it('phone: nothing is marked once the ticket is answered', async () => {
    const view = await mount(must(answer(pending, 'REFER')), createElement(TerminalScreen));
    if (selected(view, 'NETWORK') !== 'true') view.click('tab-NETWORK');
    expect(view.find('contact-notice')).toBeNull();
    expect(view.find('tab-CORE')?.textContent).toBe('CORE');
  });

  it('desktop shows CORE beside the other panes, so it renders no notice', async () => {
    const view = await mount(pending, createElement(TerminalScreen), [1440, 900]);
    expect(view.find('service-channel')).not.toBeNull();
    expect(view.find('contact-notice')).toBeNull();
  });
});

describe('after an answer (#284)', () => {
  it('referring moves focus to the boundary note heading', async () => {
    const view = await mount(pending, createElement(ServiceChannel));
    view.click('channel-refer');
    await act(async () => { await settle(); });
    const heading = view.find('prototype-boundary-heading');
    expect(heading?.getAttribute('role')).toBe('heading');
    expect(heading?.textContent).toBe(CHANNEL_ENCOUNTER.boundary.title);
    expect(host.document.activeElement).toBe(heading);
  });

  it('a restored, already answered contact does not take focus', async () => {
    const view = await mount(must(answer(pending, 'REFER')), createElement(ServiceChannel));
    expect(view.find('prototype-boundary-heading')).not.toBeNull();
    expect(host.document.activeElement).not.toBe(view.find('prototype-boundary-heading'));
  });

  it('the boundary names the menu path that holds export and start fresh', () => {
    const lines = CHANNEL_ENCOUNTER.boundary.lines.join(' ');
    expect(lines).toContain('export the save from MENU > SAVES');
    expect(lines).toContain('MENU > SAVES has Start fresh from the beginning');
    expect(lines).not.toMatch(/MENU has/);
  });
});

describe('the pilot status line follows the grant (#284)', () => {
  it('reads "supervised pilot" while piloting and names the service once granted', async () => {
    const view = await mount(delivered(), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('pilot-status')?.textContent).toBe('Accepted. This instance runs as a supervised pilot.');
    view.click('service-grant-accept');
    expect(gameStore.store.getState().game.access.context).toBe('SERVICE');
    expect(view.find('pilot-status')?.textContent).toBe('Accepted. The pilot led to the authorized service below; this instance no longer runs as a pilot.');
    expect(view.find('service-grant-status')?.textContent).toContain('Granted');
  });
});
