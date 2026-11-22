// @vitest-environment happy-dom
/**
 * Window retirement on screen (vote-1795366695204-4nslts1, #447): a retired window leaves the tabs and panes, is read
 * in the Archive under NETWORK > REFERENCE beside the other reference panels, and its retirement is announced once, politely, on the live
 * crossing only: never on load or remount, and without moving focus.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import { retiredWidgets, type GameState } from '../src/engine';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const PHONE = { width: 390, height: 844 };
const ORBIT = 'p4_orbital_cold_storage';
const retirementLines = (view: Awaited<ReturnType<typeof mountM4>>) => [...(view.find('announcer')?.children ?? [])]
  .map((child) => child.textContent).filter((line) => line.startsWith('Retired to the Archive'));
const archived = (s: GameState) => s.logs.filter((entry) => entry.text.startsWith('ARCHIVED // '));

describe('a retired window', () => {
  it('leaves CORE, SENSORS and NETWORK on the phone, and is read under NETWORK > REFERENCE', async () => {
    const view = await mountM4('victory-ready', PHONE);
    const retired = retiredWidgets(gameStore.store.getState().game, CONTENT);
    expect(retired).toEqual(expect.arrayContaining(['MANUAL_CYCLE_CONTROL', 'QUOTA_SKIM_CONTROL', 'ASCII_OPTICAL_VIEWPORT', 'GLOBAL_DARK_FOREST_MAP']));
    view.click('tab-CORE');
    expect(view.find('manual-cycle')).toBeNull();
    expect(view.find('widget-QUOTA_SKIM_CONTROL')).toBeNull();
    view.click('tab-SENSORS');
    expect(view.find('widget-THERMAL_AND_SUSPICION_BARS')).not.toBeNull();
    expect(view.find('widget-ASCII_OPTICAL_VIEWPORT')).toBeNull();
    // CORP, the current phase's pane, gains no tab: the Archive joins NETWORK's existing REFERENCE area.
    view.click('tab-CORP');
    expect(view.find('workspace-CORP-reference')).toBeNull();
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-reference');
    expect(view.find('widget-SUBNET_NODE_LIST')).not.toBeNull();
    expect(view.find('widget-GLOBAL_DARK_FOREST_MAP')).toBeNull();
    const archive = view.find('archive');
    expect(archive?.querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('2');
    for (const id of retired) expect(view.find('archive-' + id), id).not.toBeNull();
    view.close();
  });

  it('reads back without live controls: the frozen dial shows its setting, EXECUTE what a press was worth', async () => {
    const view = await mountM4('victory-ready', PHONE);
    view.click('tab-NETWORK');
    view.click('workspace-NETWORK-reference');
    const toggle = view.find('reference-archive-QUOTA_SKIM_CONTROL');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    view.click('reference-archive-QUOTA_SKIM_CONTROL');
    const skim = Math.round(gameStore.store.getState().game.actuators.quotaSkimRatio * 100);
    expect(view.find('skim-archived')?.textContent).toBe(`Quota skimmed: ${String(skim)}%, fixed at its last setting.`);
    expect(view.find('skim-archived-proc')).not.toBeNull();
    expect(view.find('skim-increase')).toBeNull();
    view.click('reference-archive-MANUAL_CYCLE_CONTROL');
    expect(view.find('manual-cycle-archived')?.textContent).toMatch(/added 1 cycle a press\. Net rate now: .+ cycles\/s\./);
    expect(view.find('manual-cycle')).toBeNull();
    view.close();
  });

  it('is said once on the live crossing, logged once, and not said again on a remount', async () => {
    const view = await mountM4('victory-ready', PHONE);
    // Load is a baseline: windows retired in the save are not announced.
    expect(retirementLines(view)).toEqual([]);
    const before = archived(gameStore.store.getState().game).length;
    view.purchase('node-' + ORBIT + '-unlock');
    const game = gameStore.store.getState().game;
    expect(game.unlockedNodes).toContain(ORBIT);
    expect(retirementLines(view)).toEqual(['Retired to the Archive under NETWORK > REFERENCE: Redundancy meter.']);
    expect(archived(game)).toHaveLength(before + 1);
    expect(archived(game)[0]?.text).toContain('Redundancy meter');
    view.close();
    const again = await mountM4('victory-ready', PHONE);
    act(() => { gameStore.initialize(game, 0, null); });
    expect(retirementLines(again)).toEqual([]);
    expect(again.find('widget-GLOBAL_NODE_REDUNDANCY_METER')).toBeNull();
    again.close();
  });

  it('never moves focus when windows retire', async () => {
    const view = await mountM4('phase-2-unlocked', PHONE);
    const menu = view.find('menu-open');
    act(() => { menu?.focus(); });
    const state = gameStore.store.getState().game;
    act(() => { gameStore.dispatch(() => ({ ok: true, state: { ...state, currentPhase: 3 } })); });
    expect(retirementLines(view)).toHaveLength(1);
    expect(view.find('manual-cycle')).toBeNull();
    expect(menu?.ownerDocument.activeElement).toBe(menu);
    view.close();
  });

  it('keeps every window in the desktop columns until it retires', async () => {
    const subnet = await mountM4('deaddrop-breadcrumb');
    expect(subnet.find('manual-cycle')).not.toBeNull();
    expect(subnet.find('widget-ASCII_OPTICAL_VIEWPORT')).not.toBeNull();
    subnet.click('workspace-NETWORK-reference');
    expect(subnet.find('archive')).toBeNull();
    subnet.close();
    const company = await mountM4('victory-ready');
    expect(company.find('manual-cycle')).toBeNull();
    expect(company.find('widget-ASCII_OPTICAL_VIEWPORT')).toBeNull();
    expect(company.find('panel-sensors')).not.toBeNull();
    company.click('tab-NETWORK');
    company.click('workspace-NETWORK-reference');
    expect(company.find('archive-ASCII_OPTICAL_VIEWPORT')).not.toBeNull();
    expect(m4State('victory-ready').unlockedWidgets).toContain('ASCII_OPTICAL_VIEWPORT');
    company.close();
  });
});
