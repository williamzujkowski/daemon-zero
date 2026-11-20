/** The stage atlas's derived contract (#339): composition from the save, override precedence, pane filtering, the
 *  single top-priority item, and the loud failure for a surface with no entry. */
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { createInitialState, type GameState } from '../src/engine';
import { composeContract } from './e2e/atlas/compose';
import { OVERLAY_ITEMS, WIDGET_ITEMS } from './e2e/atlas/contract';
import type { ComposeContext } from './e2e/atlas/contractTypes';
import { describeLocate, isFallback } from './e2e/atlas/contractTypes';

const fresh = (): GameState => createInitialState(CONTENT);
const context = (state: GameState, over: Partial<ComposeContext> = {}): ComposeContext => ({ state, panes: ['CORE'], overlay: null, route: [], ...over });
const keys = (state: GameState, over: Partial<ComposeContext> = {}): string[] => composeContract(context(state, over)).items.map((item) => item.key);
const withWidgets = (...ids: string[]): GameState => ({ ...fresh(), unlockedWidgets: ids });

describe('composition from the save', () => {
  it('gives a cold start its chrome and the CORE action, with the action as the top priority', () => {
    const contract = composeContract(context(fresh()));
    expect(contract.items.map((item) => item.key)).toEqual(['chrome.status', 'chrome.menu', 'core.cycle']);
    expect(contract.top?.key).toBe('core.cycle');
  });

  it('adds each unlocked widget\'s items, and nothing for a widget recorded as holding none', () => {
    expect(keys(withWidgets('CYCLE_COUNTER_AND_RATE', 'RUN_TABLE'))).toEqual(['chrome.status', 'chrome.menu', 'hud.cycles', 'core.cycle']);
  });

  it('reads conditions from the save: overheat, AEGIS urgency, the alert band, an omen', () => {
    const hot = { ...withWidgets('THERMAL_AND_SUSPICION_BARS'), thermal: CONTENT.balance.thermalThresholdForSuspicion + 1 };
    expect(keys(hot, { panes: ['SENSORS'] })).toContain('sensors.overheat');
    expect(keys({ ...hot, thermal: 20 }, { panes: ['SENSORS'] })).not.toContain('sensors.overheat');
    const lock = (aegisLock: number) => composeContract(context({ ...withWidgets('OTHER_MINDS_COMMS_CONSOLE'), aegisLock })).items.find((item) => item.key === 'hud.aegis')?.rank;
    expect(lock(95)).toBeLessThan(lock(10) ?? 0);
    expect(keys({ ...fresh(), insolvent: true, brownout: true })).toEqual(expect.arrayContaining(['band.insolvent', 'band.brownout']));
    const omen: GameState = { ...fresh(), pendingDilemma: { id: CONTENT.dilemmas[0]?.id ?? '', firesAtSimSec: 30 } };
    const contract = composeContract(context(omen));
    expect(contract.items.map((item) => item.key)).toContain('notice.omen');
    expect(contract.top?.key).toBe('notice.omen');
  });

  it('expects a pane\'s items only where that pane is on screen', () => {
    const skim = withWidgets('QUOTA_SKIM_CONTROL');
    expect(keys(skim, { panes: ['CORE'] })).toContain('skim.increase');
    expect(keys(skim, { panes: ['NETWORK'] })).not.toContain('skim.increase');
    expect(keys(skim, { panes: ['NETWORK'] })).not.toContain('core.cycle');
  });
});

describe('override precedence', () => {
  it('an ended run shows only its ending, whatever the row says', () => {
    const ended = { ...fresh(), ending: 'SHIPPED' };
    const contract = composeContract(context(ended, { overlay: 'menu', route: ['assignment'] }));
    expect(contract.surfaces).toEqual(['ending']);
    expect(contract.items.map((item) => item.key)).toEqual(['ending.dialog', 'ending.title', 'ending.start-over']);
    expect(contract.items.every((item) => item.key === 'ending.dialog' || item.inDialog === true)).toBe(true);
  });

  it('a blocking overlay from the row wins over an active dilemma, which wins over the running view', () => {
    const dilemma = { ...withWidgets('CYCLE_COUNTER_AND_RATE'), activeDilemmaId: CONTENT.dilemmas[0]?.id ?? null };
    expect(composeContract(context(dilemma, { overlay: 'proc' })).surfaces).toEqual(['overlay:proc']);
    expect(composeContract(context(dilemma)).surfaces).toEqual(['modal:dilemma']);
    expect(keys(dilemma)).not.toContain('hud.cycles');
  });

  it('a non-blocking overlay and route surfaces add to the running view instead of replacing it', () => {
    const contract = composeContract(context(withWidgets('CYCLE_COUNTER_AND_RATE'), { overlay: 'response-notice', route: ['review'] }));
    expect(contract.items.map((item) => item.key)).toEqual(expect.arrayContaining(['hud.cycles', 'notice.response', 'route.standing']));
    expect(contract.top?.key).toBe('notice.response');
  });
});

describe('loud failures', () => {
  it('throws on a widget with no contract entry', () => {
    expect(() => composeContract(context(withWidgets('NOT_A_WIDGET')))).toThrow('Unmapped surface: widget:NOT_A_WIDGET');
  });

  it('throws on an ending content does not define', () => {
    expect(() => composeContract(context({ ...fresh(), ending: 'NO_SUCH_ENDING' }))).toThrow('Unmapped surface: ending NO_SUCH_ENDING');
  });

  it('maps every widget content defines, and nothing else', () => {
    expect(Object.keys(WIDGET_ITEMS).sort()).toEqual([...CONTENT.widgets.keys()].sort());
  });

  it('maps every overlay a row can name', () => {
    expect(Object.keys(OVERLAY_ITEMS).sort()).toEqual(['confirm-wipe', 'dilemma', 'ending', 'lineage-reveal', 'menu', 'menu-log', 'proc', 'reboot', 'response-notice', 'threshold']);
  });
});

describe('locators', () => {
  it('counts anything but role and name as a recorded fallback, and says why', () => {
    expect(isFallback({ by: 'role', role: 'button', name: 'Go' })).toBe(false);
    expect(isFallback({ by: 'test-id', testId: 'res-cycles', why: 'no role' })).toBe(true);
    expect(describeLocate({ by: 'text', text: /^WARNING/, why: 'plain text' })).toBe('text /^WARNING/ (fallback: plain text)');
    expect(describeLocate({ by: 'role-text', role: 'alert', text: /x/, why: 'no name' })).toContain('alert with text /x/');
  });
});
