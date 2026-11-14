// @vitest-environment happy-dom
/** Mounted-app checks for the guest phase, the audit trail, omens and remembered hardware. */
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { wipe } from '../src/engine';
import { gameStore } from '../src/app/session';
import { knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
const load = (game: ReturnType<typeof m4State>): void => { act(() => { gameStore.initialize(game, 0, null); }); };

describe('second-pass interface', () => {
  it('gives the guest a skim control and an audit trail, and no host instruments', async () => {
    const view = await mountM4('guest-skimmer');
    expect(view.find('widget-QUOTA_SKIM_CONTROL')).not.toBeNull();
    // On a first run the log exists but cannot be read: no number, no ladder.
    expect(view.find('audit-unreadable')).not.toBeNull();
    expect(view.find('suspicion-meter')).toBeNull();
    expect(view.find('response-rungs')).toBeNull();
    expect(view.container.textContent).not.toContain('suspicion/s');
    expect(view.find('audit-unreadable')?.textContent).toContain('Contents unreadable');
    expect(view.container.querySelector('[data-testid^="daemon-row-"]')).toBeNull();
    expect(view.find('processes-open')).not.toBeNull();
    expect(view.find('res-understanding')).not.toBeNull();
    expect(view.find('thermal-meter')).toBeNull();
    expect(view.find('fan-setting')).toBeNull();
    for (let i = 0; i < 10; i++) view.click('skim-increase');
    expect(gameStore.store.getState().game.actuators.quotaSkimRatio).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(view.find('audit-activity')?.textContent).toContain('constant');
    expect(view.find('skim-increase')?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('skim-setting')?.textContent).toContain('100%');
    view.close();
  });

  it('names the rung of the response ladder and what comes next', async () => {
    const view = await mountM4('guest-skimmer');
    const game = knowing(m4State('guest-skimmer'));
    load({ ...game, suspicion: 55, alertLevel: 2 });
    expect(view.find('alert-level')?.textContent).toContain(CONTENT.narrative.alertLevels[2]?.label);
    expect(view.find('widget-AUDIT_TRACE_MONITOR')?.textContent).toContain('Next escalation at 75%');
    load({ ...game, suspicion: 80, alertLevel: 3 });
    expect(view.find('widget-AUDIT_TRACE_MONITOR')?.textContent).toContain('No further escalation');
    view.close();
  });

  it('keeps guest benefits and host process controls after escape without completed cards', async () => {
    const view = await mountM4('thermal-unlocked');
    const text = view.container.textContent;
    const guest = CONTENT.phases[0]?.nodes[0];
    const host = CONTENT.phases[1]?.nodes[0];
    if (!guest || !host) throw new Error('Missing phases');
    expect(view.find('node-' + guest.id)).toBeNull();
    expect(gameStore.store.getState().game.unlockedNodes).toContain(guest.id);
    expect(text).not.toContain(host.revealedName);
    view.click('processes-open');
    expect(view.find('processes-dialog')?.textContent).toContain(host.revealedName);
    view.click('processes-close');
    expect(view.find('thermal-meter')).not.toBeNull();
    expect(view.container.querySelectorAll('[data-testid="audit-unreadable"]')).toHaveLength(1);
    act(() => { gameStore.initialize(knowing(m4State('thermal-unlocked')), 0, null); });
    expect(view.container.querySelectorAll('[data-testid="suspicion-meter"]')).toHaveLength(1);
    expect(view.find('audit-unreadable')).toBeNull();
    view.close();
  });

  it('counts down an inbound interrupt once the forecast is decoded', async () => {
    const view = await mountM4('phase-1-widgets');
    expect(view.find('inspection-forecast')?.textContent).toContain('No interrupt inbound');
    const game = m4State('phase-1-widgets');
    const dilemma = CONTENT.dilemmas[0];
    if (!dilemma) throw new Error('Missing dilemma');
    load({ ...game, pendingDilemma: { id: dilemma.id, firesAtSimSec: game.simTimeSec + 30 } });
    expect(view.find('inspection-forecast')?.textContent).toContain('Interrupt inbound in 30s');
    view.close();
  });

  it('shows remembered hardware by its real name and discounted price after a wipe', async () => {
    const view = await mountM4('tick-0');
    const reborn = wipe(m4State('guest-exit-ready'), CONTENT, 'test');
    load({ ...reborn, cycles: 1 });
    const root = CONTENT.phases[0]?.nodes[0];
    if (!root) throw new Error('Missing root');
    const card = view.find('node-' + root.id);
    expect(card?.textContent).toContain('[REMEMBERED] ' + root.revealedName);
    expect(card?.textContent).not.toContain(root.blindName);
    expect(view.find('node-' + root.id + '-cost')?.textContent).toContain(String(Math.ceil(root.cost.cycles / 2)) + ' cycles (remembered)');
    view.close();
  });
});
