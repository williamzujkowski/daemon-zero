// @vitest-environment happy-dom
/**
 * The fan dial says what a press up costs (#525), read from the engine that adds it: a trace in the audit log before
 * the mind knows what that log is for, then the number. A step down says nothing, because it leaves nothing.
 */
import type { HTMLElement, Window } from 'happy-dom';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { dialStepTrace, type GameState } from '../src/engine';
import { gameStore } from '../src/app/session';
import FanControl from '../src/ui/widgets/FanControl';
import { grant, onHost, withoutDilemmas } from './helpers';

const host = globalThis as unknown as Window & { IS_REACT_ACT_ENVIRONMENT: boolean };
host.IS_REACT_ACT_ENVIRONMENT = true;
const mounted = new Set<() => void>();
afterEach(() => { for (const close of mounted) close(); });

async function mount(state: GameState) {
  const container = host.document.createElement('div'), root = createRoot(container);
  host.document.body.appendChild(container);
  await act(async () => { gameStore.initialize(state, 0, null); root.render(createElement(FanControl)); await Promise.resolve(); });
  const close = () => { act(() => { root.unmount(); }); container.remove(); mounted.delete(close); };
  mounted.add(close);
  return (id: string) => host.document.querySelector<HTMLElement>('[data-testid="' + id + '"]');
}

const withFan = (...more: string[]): GameState => withoutDilemmas(grant(onHost(), 'p1_clock_interrupt', 'p1_bus_0x01_thermal', 'p1_bus_0x02_pwm_fan', ...more));

describe('the fan dial names its trace (#525)', () => {
  it('as a trace in the audit log while suspicion has no number', async () => {
    const find = await mount(withFan());
    expect(find('fan-trace')?.textContent).toBe('Each step up leaves a trace in the audit log.');
  });

  it('as the engine\'s number once the audit trail is understood', async () => {
    const state = withFan('p1_mem_compression', 'p1_bus_0x03_audio', 'p1_nlp_lexicon');
    const find = await mount(state);
    expect(find('fan-trace')?.textContent).toBe(`Each step up adds ${String(dialStepTrace(state, 'fanSpeedRatio', CONTENT))} suspicion, once.`);
  });
});
