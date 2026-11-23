// @vitest-environment happy-dom
/**
 * DZ-05 surfaces on preview content, pressed through the real runtime: the task detail's ceiling,
 * split and derived forecast; the dial in its host widget changing that forecast (V30); an explicit
 * submit; and a withdrawn loan explained on the dial, the card and the process row while the engine
 * refuses the same presses (V08: a disabled button is not the only guard).
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
import { quantityReadout, setActuator, toggleNode, type GameState } from '../src/engine';
import { TERMS } from './pilot-helpers';
import { revokeLoanedCapacity } from '../src/engine/pilotService';
import { gameRuntime, gameStore } from '../src/app/session';
import { settle } from './app-helpers';
import AssignmentPanel from '../src/ui/AssignmentPanel';
import DaemonProcesses from '../src/ui/DaemonProcesses';
import NodeCard from '../src/ui/NodeCard';
import { PilotAllocation } from '../src/ui/PilotService';
import { widgetRegistry } from '../src/ui/registry/widgetRegistry';
import { preview } from './assignment-helpers';
import { must } from './helpers';
import { piloted, QUEUE, QUEUE_NODE, SERVICE, serving, untilComplete } from './service-helpers';
import { jobSurface } from './jobSurface';
import { labelMismatches } from './labelInName';

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
const both = () => createElement('div', null, createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })), createElement(PilotAllocation));

describe('the pilot allocation dial', () => {
  it('is registered for the widget that hosts it, found by what it hosts', () => {
    expect(QUEUE_NODE.unlocksUiComponent).not.toBeNull();
    expect(widgetRegistry[QUEUE_NODE.unlocksUiComponent ?? '']).toBe(PilotAllocation);
  });
});

describe('the task detail of an accepted pilot', () => {
  it('names the ceiling and asks for the loan to be attached before any work', async () => {
    const view = await mount(piloted(), createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    // The default assessment answer earns the provisional (narrow) allocation, in FLOP/s.
    expect(view.find('pilot-service-ceiling')?.textContent).toContain(quantityReadout('computeRate', TERMS.narrowCapacityCyclesPerSec) + ' of loaned compute');
    expect(view.find('pilot-service-idle')).not.toBeNull();
    expect(view.find('pilot-service-submit')).toBeNull();
  });

  it('the dial changes the derived forecast under the same ceiling (V30)', async () => {
    const view = await mount(serving(), both());
    expect(view.find('pilot-service-forecast')?.textContent).toContain('about 240 s');
    expect(view.find('pilot-allocation-study')?.textContent).toBe('Study share: 50%');
    for (let i = 0; i < 3; i++) view.click('pilot-allocation-increase');
    expect(game().actuators.serviceAllocationRatio).toBeCloseTo(0.8, 9);
    expect(view.find('pilot-service-forecast')?.textContent).toContain('about 150 s');
    expect(view.find('pilot-service-split')?.textContent).toContain('Service ' + quantityReadout('computeRate', TERMS.narrowCapacityCyclesPerSec * 0.8) + ' to the batch');
    expect(view.find('pilot-service-ceiling')?.textContent).toContain(quantityReadout('computeRate', TERMS.narrowCapacityCyclesPerSec) + ' of loaned compute');
  });

  // #276: on a phone the task detail sits far below the dial, so the dial echoes what a press changed.
  it('echoes the forecast and the study rate beside the dial, and a press changes the echo', async () => {
    const view = await mount(serving(), createElement(PilotAllocation));
    expect(view.find('pilot-service-forecast')).toBeNull();
    expect(view.find('pilot-allocation-forecast')?.textContent).toBe('At this split the batch completes in about 240 s. Study +0.25 understanding/s.');
    for (let i = 0; i < 3; i++) view.click('pilot-allocation-increase');
    expect(view.find('pilot-allocation-forecast')?.textContent).toBe('At this split the batch completes in about 150 s. Study +0.10 understanding/s.');
  });

  it('echoes nothing until the loan is attached', async () => {
    const view = await mount(piloted(), createElement(PilotAllocation));
    expect(view.find('pilot-allocation-forecast')).toBeNull();
  });

  it('submits a completed batch only on an explicit press, once', async () => {
    const done = untilComplete(serving());
    const view = await mount(done, createElement('div', null, jobSurface(), createElement(AssignmentPanel, { placement: 'offer' })));
    expect(view.find('pilot-service-forecast')?.textContent).toContain('waits for you');
    expect(view.find('pilot-service-submit')?.getAttribute('aria-disabled')).not.toBe('true');
    view.click('pilot-service-submit');
    expect(game().access.work.batches).toBe(1);
    expect(game().cycles).toBeGreaterThanOrEqual(done.cycles + SERVICE.batchReturn.cycles);
    expect(view.find('pilot-service-submit')?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('pilot-service-submitted')?.textContent).toContain('1');
  });
});

describe('a withdrawn loan is explained where it is refused (V08, story 12)', () => {
  const revoked = (s: GameState) => must(revokeLoanedCapacity(s, preview));

  it('the dial, the task detail and the submit say why, and the engine refuses the same presses', async () => {
    const s = revoked(untilComplete(serving()));
    const view = await mount(s, both());
    expect(view.find('pilot-allocation-withheld')?.textContent).toContain('withheld under the current review standing');
    // #373: a withheld dial cannot move, so it shows its setting and why, with no dead buttons; the engine refuses below.
    expect(view.find('pilot-allocation-setting')).not.toBeNull();
    expect(view.find('pilot-allocation-increase')).toBeNull();
    expect(view.find('pilot-allocation-decrease')).toBeNull();
    expect(view.find('pilot-service-withheld')?.textContent).toContain('The work so far is kept');
    expect(view.find('pilot-service-submit')?.getAttribute('aria-disabled')).toBe('true');
    expect(setActuator(game(), 'serviceAllocationRatio', 1, preview).ok).toBe(false);
    expect(game().access.work).toEqual(s.access.work);
  });

  it('the unbought card and the stopped process row name the withheld loan', async () => {
    const card = await mount(revoked(piloted()), createElement(NodeCard, { node: QUEUE_NODE }));
    expect(card.find('node-' + QUEUE + '-grant')?.textContent).toContain('Loaned capacity, withheld');
    // #373: refused, the card keeps its title and the refusal; the rest folds, and SHOW still reveals a disabled button.
    expect(card.find('node-' + QUEUE + '-unlock')).toBeNull();
    // #417 panel: each refused card's toggle names its card, so several on one screen are told apart by a screen reader.
    const toggleName = card.find('node-' + QUEUE + '-fold-toggle')?.getAttribute('aria-label') ?? '';
    expect(toggleName).toMatch(/^Show: Card details, /);
    expect([QUEUE_NODE.blindName, QUEUE_NODE.revealedName].some((name) => toggleName.endsWith(name))).toBe(true);
    expect(labelMismatches(card.container)).toEqual([]);
    card.click('node-' + QUEUE + '-fold-toggle');
    expect(card.find('node-' + QUEUE + '-unlock')?.getAttribute('aria-disabled')).toBe('true');
    const stopped = revoked(must(toggleNode(serving(), QUEUE, preview)));
    const row = await mount(stopped, createElement(DaemonProcesses, { phase: 0 }));
    expect(row.find('node-' + QUEUE + '-grant')?.textContent).toContain('withheld');
    expect(row.find('node-' + QUEUE + '-toggle')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('a running loan is listed as a process and says what it is', async () => {
    const row = await mount(serving(), createElement(DaemonProcesses, { phase: 0 }));
    expect(row.find('node-' + QUEUE + '-grant')?.textContent).toContain('Loaned capacity under the pilot grant');
    expect(row.find('node-' + QUEUE + '-toggle')?.getAttribute('aria-disabled')).not.toBe('true');
  });
});
