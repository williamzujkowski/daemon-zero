/**
 * Checks the development hook uses the save codec and live engine time.
 * The production bundle is checked separately from these direct module tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDevTools, recordNodeRender, type DevHost } from '../src/app/devTools';
import { CONTENT } from '../src/content';
import { createInitialState, exportSave } from '../src/engine';
import { makePhase1Fixtures as makeFixtures } from '../scripts/make-fixtures';
import { runtimeHarness, settle } from './app-helpers';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }); });
afterEach(() => { vi.useRealTimers(); });

describe('web development tools', () => {
  it('loads engine-generated fixtures and advances live time without dormant yields', async () => {
    const h = runtimeHarness();
    const stop = h.runtime.start();
    await settle();
    const host: DevHost = {};
    const remove = installDevTools(h.runtime, host);
    const tools = host.__daemon;
    expect(tools).toBeDefined();
    tools?.loadSaveCode(exportSave(createInitialState(CONTENT)));
    tools?.fastForward(10);
    expect(h.game.store.getState().game.simTimeSec).toBeCloseTo(10);
    expect(h.game.store.getState().game.logs.some((log) => log.text.includes('DORMANT_RESUME'))).toBe(false);
    recordNodeRender('example');
    expect(tools?.renderCounts().example).toBe(1);
    expect(() => tools?.fastForward(-1)).toThrow(RangeError);
    expect(() => tools?.fastForward(Infinity)).toThrow(RangeError);
    expect(() => tools?.fastForward(3601)).toThrow(RangeError);
    expect(() => tools?.loadSaveCode('invalid')).toThrow();
    remove();
    expect(host.__daemon).toBeUndefined();
    stop();
    expect(() => tools?.loadSaveCode(exportSave(createInitialState(CONTENT)))).toThrow('not active');
    expect(() => tools?.fastForward(1)).toThrow('not active');
  });

  it('produces every early review fixture using the real engine', () => {
    expect(Object.keys(makeFixtures())).toEqual(['tick-0', 'guest-skimmer', 'guest-omen', 'guest-dilemma', 'guest-exit-ready',
      'thermal-unlocked', 'dilemma-active', 'phase-1-widgets', 'phase-2-ready']);
  });

  it('retains card commits recorded before the hook attaches or reattaches', () => {
    const h = runtimeHarness();
    const host: DevHost = {};
    recordNodeRender('reattach');
    const remove = installDevTools(h.runtime, host);
    expect(host.__daemon?.renderCounts().reattach).toBe(1);
    remove();
    const detach = installDevTools(h.runtime, host);
    expect(host.__daemon?.renderCounts().reattach).toBe(1);
    detach();
  });
});
