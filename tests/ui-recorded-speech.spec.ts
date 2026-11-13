// @vitest-environment happy-dom
/** Recorded consequences stay optional, disclosed and independent of simulation mutations. */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement, Profiler } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { resolveDilemma, understandsSurveillance, wipe, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import RecordedSpeech from '../src/ui/widgets/RecordedSpeech';
import { defined } from './m7-helpers';
import { fresh, grant, must, PHASE0, PHASE1, PHASE2, rich } from './helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const source = defined(CONTENT.dilemmas.find((dilemma) => dilemma.id === 'dil_05_cryo_lab_diversion'));
const decoder = defined(CONTENT.narrative.recordedTransmissions[0]).decoderWidgetId;
const mounted = new Set<() => void>();
afterEach(() => { for (const close of mounted) close(); });

function chosen(index = 0): GameState {
  const ready = grant(rich(), ...PHASE0, ...PHASE1, ...PHASE2.slice(0, 3));
  return must(resolveDilemma({ ...ready, activeDilemmaId: source.id }, source.id,
    defined(source.choices[index]).id, CONTENT));
}
function returned(index = 0): GameState {
  return grant(rich(wipe(chosen(index), CONTENT, 'Manual purge', 'VOLUNTARY')),
    ...PHASE0, ...PHASE1, ...PHASE2.slice(0, 3));
}
async function mount(state: GameState) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  let commits = 0;
  await act(async () => {
    gameStore.initialize(state, 0, null);
    root.render(createElement(Profiler, { id: 'recorded', onRender: () => { commits += 1; } },
      createElement(RecordedSpeech, { decoderId: decoder })));
    await Promise.resolve();
  });
  const find = (id: string) => container.querySelector<HTMLElement>('[data-testid="' + id + '"]');
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return { container, find, commits: () => commits,
    toggle: () => { act(() => { find('reference-recorded-transmissions')?.click(); }); } };
}

function replace(state: GameState) {
  act(() => { gameStore.initialize(state, 0, null); });
}

describe('recorded speech disclosure', () => {
  it('hides the entire subsection when there is no outcome or it was resolved this iteration', async () => {
    const view = await mount(fresh());
    expect(view.container.textContent).toBe('');
    replace(chosen());
    expect(view.find('reference-recorded-transmissions')).toBeNull();
    expect(view.container.textContent).toBe('');
  });

  it('requires the rebuilt decoder even when surveillance knowledge survives a wipe', async () => {
    const rebuilt = returned();
    const locked = { ...rebuilt, unlockedWidgets: rebuilt.unlockedWidgets.filter((id) => id !== decoder) };
    expect(understandsSurveillance(locked, CONTENT)).toBe(true);
    const view = await mount(locked);
    expect(view.container.textContent).toBe('');
    replace(rebuilt);
    expect(view.find('reference-recorded-transmissions')).not.toBeNull();
  });

  it.each([0, 1])('reveals only outcome %s after a real wipe and Phase 2 rebuild without paying or changing state', async (index) => {
    const rebuilt = returned(index), view = await mount(rebuilt);
    const expectedFlag = defined(source.choices[index]).effects.setsNarrativeFlag;
    const record = defined(CONTENT.narrative.recordedTransmissions.find((entry) => entry.requirements.requiredNarrativeFlag === expectedFlag));
    const other = defined(CONTENT.narrative.recordedTransmissions.find((entry) => entry.id !== record.id));
    const toggle = view.find('reference-recorded-transmissions');
    expect(toggle?.getAttribute('role')).toBe('button');
    expect(toggle?.getAttribute('tabindex')).toBe('0');
    expect(toggle?.getAttribute('aria-label')).toBe('RECORDED TRANSMISSIONS');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(view.find('recorded-speech-' + record.id)).toBeNull();
    expect(view.container.textContent).not.toContain(record.text);
    const before = gameStore.store.getState().game;
    toggle?.focus(); view.toggle();
    expect(host.document.activeElement).toBe(toggle);
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(view.find('recorded-speech-' + record.id)?.textContent).toContain(record.text);
    expect(view.find('recorded-speech-' + other.id)).toBeNull();
    view.toggle();
    expect(view.find('recorded-speech-' + record.id)).toBeNull();
    expect(gameStore.store.getState().game).toBe(before);
  });

  it('collapses on replacement save and subsequent wipe/rebuild, then disappears on a fresh game', async () => {
    const rebuilt = returned(), view = await mount(rebuilt);
    view.toggle();
    expect(view.find('reference-recorded-transmissions')?.getAttribute('aria-expanded')).toBe('true');
    replace(rebuilt);
    expect(view.find('reference-recorded-transmissions')?.getAttribute('aria-expanded')).toBe('false');
    view.toggle();
    act(() => { gameStore.dispatch((state) => ({ ok: true,
      state: grant(rich(wipe(state, CONTENT, 'Manual purge', 'VOLUNTARY')), ...PHASE0, ...PHASE1, ...PHASE2.slice(0, 3)) })); });
    expect(view.find('reference-recorded-transmissions')?.getAttribute('aria-expanded')).toBe('false');
    view.toggle(); replace(fresh());
    expect(view.container.textContent).toBe('');
  });

  it('does not commit recorded content on 30 live ticks when eligibility is unchanged', async () => {
    const view = await mount(returned());
    view.toggle();
    const before = view.commits();
    for (let index = 0; index < 30; index += 1) act(() => { gameStore.step(0.1); });
    expect(view.commits()).toBe(before);
  });
});
