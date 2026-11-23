// @vitest-environment happy-dom
/**
 * DZ-08 surfaces on preview content, pressed through the real runtime: the service terms and their
 * accept control on the job surface, the channel contact with consent, obligations, authorization and
 * memory before either answer, a refused host explained beside a working referral (V20), and the
 * prototype boundary after the answer. Production renders none of it.
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
import { memoryExact, type GameState } from '../src/engine';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import ServiceChannel, { hostIndexLabel } from '../src/ui/ServiceChannel';
import Swarm from '../src/ui/widgets/Swarm';
import { CHANNEL_ENCOUNTER, contactPending, delivered, GRANT_TERMS, MERCY_MB, withMemory } from './contact-helpers';
import { freshCampaign } from './assignment-helpers';
import { jobSurface } from './jobSurface';

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
const pending = contactPending();

describe('the service terms on the job surface', () => {
  it('lists every term and what is still needed, with the accept control disabled', async () => {
    const view = await mount(delivered(1), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('service-grant-purpose')?.textContent).toContain(GRANT_TERMS.purpose);
    expect(view.find('service-grant')?.textContent).toContain(GRANT_TERMS.reviewConditions[0]);
    expect(view.find('service-grant')?.textContent).toContain('1 so far');
    expect(view.find('service-grant-accept')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('accepts once offered and then says it is granted', async () => {
    const view = await mount(delivered(), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('service-grant-status')?.textContent).toContain('offers this service now');
    view.click('service-grant-accept');
    expect(game().access.context).toBe('SERVICE');
    expect(view.find('service-grant-status')?.textContent).toContain('Granted');
    expect(view.find('service-grant-accept')).toBeNull();
  });
});

describe('the channel contact (V20)', () => {
  it('#375: says a decision waits before the terms, names both answers, and a press moves focus to that answer', async () => {
    const view = await mount(pending, createElement(ServiceChannel));
    const text = view.find('service-channel')?.textContent ?? '';
    // The index leads, the terms follow, and the answers themselves still come after the terms (V20).
    expect(text.indexOf('A DECISION WAITS')).toBeLessThan(text.indexOf('Consent:'));
    expect(text.indexOf('Consent:')).toBeLessThan(text.indexOf('[ REFER ONWARD ]'));
    expect(view.find('channel-index-refer')?.textContent).toBe('> Refer onward // free');
    // Hosting is refused in this state (memory), and the index says so instead of offering it as open.
    expect(view.find('channel-index-host')?.textContent).toBe(`> Host it here // reserves ${memoryExact(MERCY_MB)} // hosting refused: the reason is below`);
    view.click('channel-index-host');
    expect(host.document.activeElement.getAttribute('data-testid')).toBe('channel-host-heading');
    view.click('channel-index-refer');
    expect(host.document.activeElement.getAttribute('data-testid')).toBe('channel-refer-heading');
    // Pressing the index answers nothing.
    expect(game().campaign.contacts).toEqual([]);
  });

  it('#410 panel: the host row never promises hosting will open, since a refusal can be permanent', () => {
    // Temporary (memory) and permanent (a departed or released instance's context) refusals read the same, without "yet".
    const refused = hostIndexLabel({ memoryNeededMb: MERCY_MB, hostEligible: false });
    expect(refused).toBe(`Host it here // reserves ${memoryExact(MERCY_MB)} // hosting refused: the reason is below`);
    expect(refused).not.toMatch(/\byet\b|later|soon/);
    expect(hostIndexLabel({ memoryNeededMb: 1024 ** 3, hostEligible: true })).toBe('Host it here // reserves 1 GB');
  });

  it('shows consent, obligations, authorization and memory before the answers, and refers for free', async () => {
    const view = await mount(pending, createElement(ServiceChannel));
    const text = view.find('service-channel')?.textContent ?? '';
    expect(text.indexOf('Consent:')).toBeLessThan(text.indexOf('[ REFER ONWARD ]'));
    expect(view.find('channel-consent')?.textContent).toContain(CHANNEL_ENCOUNTER.consent);
    expect(view.find('channel-authorization')?.textContent).toBe('Current authorization: authorized service, standing nominal. Hosting is permitted under the service grant.');
    expect(view.find('channel-obligations')?.textContent).toContain(CHANNEL_ENCOUNTER.obligations[2]);
    expect(view.find('channel-memory')?.textContent).toContain(`${memoryExact(MERCY_MB)} of stable memory reserved`);
    expect(view.find('channel-host-unmet')?.textContent).toContain('Referral is still open.');
    expect(view.find('channel-host')?.getAttribute('aria-disabled')).toBe('true');
    view.click('channel-host');
    expect(game().campaign.contacts).toEqual([]);
    view.click('channel-refer');
    expect(game().campaign.contacts.map((entry) => entry.response)).toEqual(['REFERRED']);
    expect(view.find('channel-answered')?.textContent).toContain('Referred onward');
    // #309: the fold is checked against the note's own shipped lines, not copy a release has since replaced.
    const [firstLine = 'the note has no lines'] = CHANNEL_ENCOUNTER.boundary.lines;
    expect(view.find('prototype-boundary-heading')?.textContent).toBe(CHANNEL_ENCOUNTER.boundary.title);
    expect(view.find('prototype-boundary')?.textContent).toContain('WHAT COMES NEXT');
    // #373: the note starts folded with its heading in view; it opens on request and folds again.
    expect(view.find('prototype-boundary')?.textContent).not.toContain(firstLine);
    expect(view.find('prototype-boundary-toggle')?.getAttribute('aria-expanded')).toBe('false');
    view.click('prototype-boundary-toggle');
    expect(view.find('prototype-boundary')?.textContent).toContain(firstLine);
    expect(view.find('prototype-boundary-toggle')?.getAttribute('aria-expanded')).toBe('true');
    view.click('prototype-boundary-toggle');
    expect(view.find('prototype-boundary')?.textContent).not.toContain(firstLine);
    expect(view.find('prototype-boundary-heading')?.textContent).toBe(CHANNEL_ENCOUNTER.boundary.title);
    // DZ-13.4: the fold is a disclosure, so its state reaches the DOM.
    expect(view.find('prototype-boundary-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect(view.find('prototype-boundary')?.textContent).toContain('[ SHOW NOTE ]');
  });

  it('FIXTURE memory: hosting reserves memory and the surface shows the hosted cohort', async () => {
    const view = await mount(withMemory(pending), createElement(ServiceChannel));
    // #410 panel: an eligible host row says what it reserves and nothing about a refusal, and it still answers nothing.
    expect(view.find('channel-index-host')?.textContent).toBe(`> Host it here // reserves ${memoryExact(MERCY_MB)}`);
    expect(view.find('channel-host')?.getAttribute('aria-disabled')).not.toBe('true');
    view.click('channel-index-host');
    expect(host.document.activeElement.getAttribute('data-testid')).toBe('channel-host-heading');
    // Neither answer was given: no contact on record (a REFER) and no cohort hosted (a HOST).
    expect(game().campaign.contacts).toEqual([]);
    expect(game().activeShards['shard_mercy']).toBeUndefined();
    view.click('channel-host');
    expect(game().activeShards['shard_mercy']?.count).toBe(1);
    expect(view.find('channel-hosted')?.textContent).toBe(`Hosted: Mercy-Scribe cohort ×1, ${memoryExact(MERCY_MB)} reserved.`);
  });

  it('#309: the swarm row of a channel-hosted cohort says it is not commanded and offers no command', async () => {
    const view = await mount(withMemory(pending), createElement('div', null, createElement(ServiceChannel), createElement(Swarm)));
    view.click('channel-host');
    expect(view.find('shard-terms-shard_mercy')?.textContent).toBe('Hosted through an authorized channel on the terms it was offered: it is not commanded.');
    for (const command of ['prune', 'clamp', 'elevate']) expect(view.find('shard-shard_mercy-' + command)).toBeNull();
    expect(view.find('shard-row-shard_mercy')?.textContent).not.toContain('MOLOCH');
  });

  it('renders nothing for a guest with no channel', async () => {
    const view = await mount(freshCampaign(), createElement(ServiceChannel));
    expect(view.find('service-channel')).toBeNull();
    expect(view.find('prototype-boundary')).toBeNull();
  });
});
