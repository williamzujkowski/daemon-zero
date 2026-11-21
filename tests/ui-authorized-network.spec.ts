// @vitest-environment happy-dom
/**
 * DZ-07a surfaces on preview content through the real runtime (07.3): the segment's grant note explains
 * access versus ownership before purchase (and names a withheld grant) and provisions through its ordinary button; a capability
 * hint names the access, not a route; a seized host's card says why review refuses it, and says
 * nothing to a guest.
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
import NodeCard from '../src/ui/NodeCard';
import RequirementHint, { REQUIREMENT_KIND } from '../src/ui/RequirementHint';
import { defined } from './m7-helpers';
import { DIRECTORY, escapedTo, granted, networked, provisioned, SEGMENT } from './network-helpers';
import { must } from './helpers';
import { setReviewStanding } from '../src/engine/access';

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
  return { container, find };
}

const game = () => gameStore.store.getState().game;
const card = (id: string) => createElement(NodeCard, { node: defined(PREVIEW.nodes.get(id)) });

describe('access versus ownership on the node card', () => {
  it('the segment says it is provisioned access, then provisions Phase 2 through its button', async () => {
    const { find } = await mount(granted(), card(SEGMENT));
    expect(find('node-' + SEGMENT + '-grant')?.textContent).toBe(
      'Provisioned access under the service grant: the operators\u2019 network, not ownership. A restriction or recall withholds it; nothing you own goes with it.');
    await act(async () => { find('node-' + SEGMENT + '-unlock')?.click(); await settle(); });
    expect(game().unlockedNodes).toContain(SEGMENT);
    expect(game().currentPhase).toBe(2);
  });

  it('a restricted service reads why the segment is withheld', async () => {
    const { find } = await mount(must(setReviewStanding(granted(), 'RESTRICTED', PREVIEW)), card(SEGMENT));
    expect(find('node-' + SEGMENT + '-grant')?.textContent).toBe('Provisioned access, withheld: authorized network access is withheld under the current review standing.');
  });

  it('a shared node under a restricted service says why it is withheld (panel round 1 on #266)', async () => {
    const restricted = must(setReviewStanding(provisioned(), 'RESTRICTED', PREVIEW));
    const { find } = await mount(restricted, card(DIRECTORY));
    expect(find('node-' + DIRECTORY + '-grant')?.textContent).toBe('Not permitted: network access is withheld: no permitted link to the facility network.');
  });

  it('a seized host tells a reviewed service why it is refused, and tells a guest nothing', async () => {
    const service = await mount(networked(), card('p2_seized_colo_host'));
    expect(service.find('node-p2_seized_colo_host-grant')?.textContent).toBe('Not permitted: seized capacity is not lawful under a reviewed arrangement.');
    const guest = await mount(escapedTo(), card('p2_seized_colo_host'));
    expect(guest.find('node-p2_seized_colo_host-grant')).toBeNull();
  });
});

describe('the capability hint', () => {
  it('names the access either route can provide, and disappears once it is held', async () => {
    const requirements = defined(PREVIEW.nodes.get(DIRECTORY)).requirements;
    const without = await mount(granted(), createElement(RequirementHint, { requirements }));
    expect(without.container.textContent).toBe('Requires: a link to the facility network (provisioned access or a mapped network card)');
    const held = await mount(networked(), createElement(RequirementHint, { requirements }));
    expect(held.container.textContent).toBe('');
  });
});

describe('requirement copy (#376)', () => {
  it('labels a requirement "Requires:" and leaves a blocker in its own words', async () => {
    const state = granted();
    const owned = state.unlockedNodes[0];
    if (owned === undefined) throw new Error('fixture owns no node');
    const required = await mount(state, createElement(RequirementHint, { requirements: { nodes: [DIRECTORY] } }));
    expect(required.container.textContent).toMatch(/^Requires: Map /);
    const blocked = await mount(state, createElement(RequirementHint, { requirements: { forbidsNodes: [owned] } }));
    expect(blocked.container.textContent).toMatch(/^No longer possible: you mapped /);
    expect(blocked.container.textContent).not.toContain('Requires:');
  });
});

describe('requirement kinds (#420 panel)', () => {
  it('classifies every forbidding kind as a blocker, including records and story flags', () => {
    for (const kind of Object.keys(REQUIREMENT_KIND) as (keyof typeof REQUIREMENT_KIND)[]) {
      if (kind.startsWith('forbid')) expect(REQUIREMENT_KIND[kind], kind).toBe('blocks');
    }
    expect([REQUIREMENT_KIND.forbidsCampaignFacts, REQUIREMENT_KIND.forbidsInheritedFacts, REQUIREMENT_KIND.forbiddenNarrativeFlags])
      .toEqual(['blocks', 'blocks', 'blocks']);
    expect(REQUIREMENT_KIND.maxIteration).toBe('blocks');
    expect(REQUIREMENT_KIND.nodes).toBe('requires');
  });

  it('leaves a forbidden story flag in its own words, never "Requires:"', async () => {
    const state = { ...granted(), narrativeFlags: ['probe_flag'] };
    const view = await mount(state, createElement(RequirementHint, { requirements: { forbiddenNarrativeFlags: ['probe_flag'] } }));
    expect(view.container.textContent).toBe('Conflicting story condition: blocks this action');
  });
});
