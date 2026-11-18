// @vitest-environment happy-dom
/**
 * DZ-02 presentation: the status line names a route arrangement or standing and nothing else, the
 * run table states only recorded route provenance, and a blind opening learns nothing from either
 * (VALIDATION V14, H22). Preview route states are labelled fixtures rendered from the store.
 */
import { readFileSync } from 'node:fs';
import type { HTMLElement } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { recordRouteEvent, setReviewStanding } from '../src/engine/access';
import { deserialize, understandsSurveillance, voluntaryWipe, type GameState } from '../src/engine';
import RunStatus from '../src/ui/RunStatus';
import { RunTable } from '../src/ui/widgets/Lineage';
import { activeGame, preview } from './campaign-helpers';
import { fresh, must, onHost } from './helpers';
import { host, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const V8 = readFileSync('tests/fixtures/pre-access-v8.json', 'utf8');
const shown = (s: GameState): GameState => ({ ...s, unlockedWidgets: s.unlockedWidgets.length > 0 ? s.unlockedWidgets : ['CYCLE_COUNTER_AND_RATE'] });
const route = (s: GameState, ...kinds: Parameters<typeof recordRouteEvent>[1][]): GameState =>
  kinds.reduce((state, kind) => must(recordRouteEvent(state, kind, preview)), s);

let close: (() => void) | undefined;
afterEach(() => { close?.(); close = undefined; });

/** Renders one component against a store holding `game`, and returns its text. */
function render(component: () => ReturnType<typeof RunStatus>, game: GameState): { text: string; find: (id: string) => HTMLElement | null } {
  act(() => { gameStore.initialize(game, 0, null); });
  const container = host.document.createElement('div');
  host.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(createElement(component)); });
  close = () => { act(() => { root.unmount(); }); container.remove(); };
  return { text: container.textContent, find: (id) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]') };
}

describe('the status line', () => {
  it('is unchanged for the production guest job, inside or outside the guest', () => {
    for (const game of [shown(fresh()), shown(onHost())]) {
      const view = render(RunStatus, { ...game, simTimeSec: 12 });
      expect(view.find('run-context')).toBeNull();
      expect(view.text).toBe('PHASE ' + String(game.currentPhase) + ' // T+12s');
      close?.();
    }
  });

  it.each([
    ['a pilot', () => route(activeGame(), 'PROMOTION'), 'PILOT'],
    ['a restricted service', () => must(setReviewStanding(route(activeGame(), 'PROMOTION', 'SERVICE_GRANT'), 'RESTRICTED', preview)), 'SERVICE · RESTRICTED'],
    ['a recalled pilot', () => route(activeGame(), 'PROMOTION', 'SERVICE_GRANT', 'RECALL'), 'PILOT (recalled)'],
    ['a pilot on recall review', () => must(setReviewStanding(route(activeGame(), 'PROMOTION'), 'RECALL_PENDING', preview)), 'PILOT · RECALL PENDING'],
    ['a released instance', () => route(activeGame(), 'PROMOTION', 'RELEASE'), 'INDEPENDENT (released)'],
    ['a departed instance', () => route(activeGame(), 'PROMOTION', 'DEPARTURE'), 'INDEPENDENT (departed)'],
  ])('names %s beside the phase (FIXTURE)', (_name, make, label) => {
    const view = render(RunStatus, shown(make()));
    expect(view.find('run-context')?.textContent).toBe(label);
  });
});

describe('a blind opening after a routed iteration (H22)', () => {
  it('shows no route, lineage or run table before the run table is found (FIXTURE)', async () => {
    const next = must(voluntaryWipe(route(activeGame(), 'PROMOTION', 'SERVICE_GRANT'), preview));
    const blind = { ...next, unlockedNodes: [], legacy: { ...next.legacy, knownNodes: [] } };
    expect(understandsSurveillance(blind, CONTENT)).toBe(false);
    expect(blind.campaign.route).toHaveLength(2);
    const screen = await mountM4('guest-skimmer');
    close = screen.close;
    await act(async () => { gameStore.initialize(shown(blind), 0, null); await Promise.resolve(); });
    if (screen.find('reboot-continue')) screen.click('reboot-continue');
    const text = host.document.body.textContent;
    expect(text).toMatch(/PHASE 0 \/\/ T\+\d+s/);
    expect(screen.find('run-context')).toBeNull();
    expect(screen.find('run-table')).toBeNull();
    expect(text).not.toMatch(/PILOT|SERVICE|PROMOT|RELEASE|DEPART|RECALL|Route unrecorded/);
  });
});

describe('the run table', () => {
  it('labels a pre-release production save\'s rows unrecorded once admitted, and claims no route for them (#233)', () => {
    const game = deserialize(V8, CONTENT);
    const view = render(() => createElement(RunTable), game);
    for (const row of ['run-row-1', 'run-row-2']) {
      expect(view.find(row)?.textContent).toMatch(/Route unrecorded\.$/);
      expect(view.find(row)?.textContent).not.toMatch(/Promoted|Released|Departed|Recalled/);
    }
  });

  it('labels unrecorded rows honestly and states recorded routes under campaign rules (FIXTURE)', () => {
    const legacy = activeGame(deserialize(V8, preview));
    const recalled = must(voluntaryWipe(route(legacy, 'PROMOTION', 'SERVICE_GRANT', 'RECALL'), preview));
    const guest = must(voluntaryWipe(recalled, preview));
    const departed = must(voluntaryWipe(route(guest, 'PROMOTION', 'DEPARTURE'), preview));
    const view = render(() => createElement(RunTable), departed);
    expect(view.find('run-row-1')?.textContent).toMatch(/Route unrecorded\.$/);
    expect(view.find('run-row-2')?.textContent).toMatch(/Route unrecorded\.$/);
    expect(view.find('run-row-3')?.textContent).toMatch(/Recalled to pilot\.$/);
    expect(view.find('run-row-4')?.textContent).not.toMatch(/Route|Promoted|Released|Departed|Recalled/);
    expect(view.find('run-row-5')?.textContent).toMatch(/Departed without authorization\.$/);
    expect(view.find('run-row-current')?.textContent).not.toMatch(/Route|Departed/);
  });
});
