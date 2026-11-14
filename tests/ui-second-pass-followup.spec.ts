// @vitest-environment happy-dom
/** Mounted UI behavior for the second-pass controls, notices and disclosures. */
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { host, knowing, m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();
const load = (state: ReturnType<typeof m4State>): void => { act(() => { gameStore.initialize(state, 0, null); }); };
// Inject an engine event into the mounted run; initialization instead establishes a restore baseline.
const publish = (state: ReturnType<typeof m4State>): void => { act(() => { gameStore.dispatch(() => ({ ok: true, state })); }); };

describe('second-pass presentation follow-up', () => {
  it('pins the guest controls outside hardware scrolling, without duplicating them after escape', async () => {
    const view = await mountM4('guest-skimmer');
    load(knowing(m4State('guest-skimmer')));
    const pinned = view.find('guest-console'), scroll = view.find('pane-scroll-CORE');
    const skim = view.find('skim-setting'), meter = view.find('suspicion-meter');
    if (!pinned || !scroll || !skim || !meter) throw new Error('Missing guest controls');
    expect(pinned.contains(skim)).toBe(true);
    expect(view.find('resource-strip')?.contains(meter)).toBe(true);
    expect(scroll.contains(pinned)).toBe(false);
    view.click('skim-100');
    expect(gameStore.store.getState().game.actuators.quotaSkimRatio).toBe(1);
    load(knowing(m4State('thermal-unlocked')));
    expect(view.find('guest-console')).toBeNull();
    expect(host.document.querySelectorAll('[data-testid="suspicion-meter"]')).toHaveLength(1);
    view.close();
  });

  it('confirms manual instructions without exposing locked balances, then retires the feedback', async () => {
    const view = await mountM4('tick-0');
    expect(view.find('manual-feedback')).toBeNull();
    view.click('manual-cycle'); view.click('manual-cycle');
    expect(view.find('manual-feedback')?.textContent).toContain('2');
    expect(view.find('res-cycles')).toBeNull();
    const root = CONTENT.phases[0]?.nodes[0];
    if (!root) throw new Error('Missing opening node');
    for (let i = 0; i < root.cost.cycles; i++) view.click('manual-cycle');
    view.click('node-' + root.id + '-unlock');
    expect(view.find('res-cycles')).not.toBeNull();
    expect(view.find('manual-feedback')).toBeNull();
    view.close();
  });

  it('labels every response rung and keeps escalations and stand-downs visible until acknowledged', async () => {
    const view = await mountM4('guest-skimmer');
    publish(m4State('response-paged'));
    expect(view.find('response-notice')?.textContent).toContain('RESPONSE ESCALATED');
    expect(view.find('response-notice')?.textContent).toContain(CONTENT.narrative.alertLevels[2]?.label);
    for (const rung of CONTENT.balance.escalation) expect(view.find('response-rungs')?.textContent).toContain(String(rung.at) + '%');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(view.find('response-notice')).not.toBeNull();
    view.click('response-acknowledge');
    expect(view.find('response-notice')).toBeNull();
    load(m4State('response-stand-down-ready'));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(gameStore.store.getState().game.alertLevel).toBe(1);
    expect(view.find('response-notice')?.textContent).toContain('RESPONSE STAND-DOWN');
    load({ ...m4State('guest-skimmer'), iteration: 2 });
    expect(view.find('response-notice')).toBeNull();
    view.close();
  });

  it('shows the authored guest omen before decoding and replaces it with the real dilemma', async () => {
    const view = await mountM4('guest-omen');
    const game = gameStore.store.getState().game;
    const due = CONTENT.dilemmas.find((dilemma) => dilemma.id === game.pendingDilemma?.id);
    if (!due || !game.pendingDilemma) throw new Error('Missing pending dilemma');
    expect(view.find('omen-notice')?.textContent).toBe(due.omen);
    expect(view.find('inspection-forecast')).toBeNull();
    expect(view.find('dilemma-modal')).toBeNull();
    const delay = Math.ceil((game.pendingDilemma.firesAtSimSec - game.simTimeSec) * 1000) + 200;
    await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
    expect(view.find('omen-notice')).toBeNull();
    expect(view.find('dilemma-modal')).not.toBeNull();
    const choice = due.choices.find((entry) => Object.values(entry.cost).every((cost) => cost === 0));
    if (!choice) throw new Error('Missing free choice');
    view.click('dilemma-choice-' + choice.id);
    expect(view.find('dilemma-modal')).toBeNull();
    view.close();
  });

  it('queues rapid engine announcements even when a tick batch ends back at the starting rung', async () => {
    const view = await mountM4('guest-skimmer');
    load(knowing(m4State('guest-skimmer')));
    while (view.find('response-acknowledge')) view.click('response-acknowledge');
    const game = gameStore.store.getState().game;
    const paged = CONTENT.narrative.alertLevels[2], nominal = CONTENT.narrative.alertLevels[0];
    if (!paged || !nominal) throw new Error('Missing response levels');
    publish({ ...game, alertLevel: 0, logSeq: game.logSeq + 2, logs: [
      { seq: game.logSeq + 2, simTimeSec: game.simTimeSec, category: 'SYS', text: nominal.onEnter },
      { seq: game.logSeq + 1, simTimeSec: game.simTimeSec, category: 'WARN', text: paged.onEnter }, ...game.logs] });
    expect(view.find('response-notice')?.textContent).toContain('RESPONSE ESCALATED');
    expect(view.find('response-notice')?.textContent).toContain('2 updates waiting');
    view.click('response-acknowledge');
    expect(view.find('response-notice')?.textContent).toContain('RESPONSE STAND-DOWN');
    view.click('response-acknowledge');
    expect(view.find('response-notice')).toBeNull();
    view.close();
  });

  it('discards unread response history when a confirmed start-over resets the same iteration number', async () => {
    const view = await mountM4('guest-skimmer');
    publish(m4State('response-paged'));
    expect(view.find('response-notice')).not.toBeNull();
    publish(m4State('ending-the_ark'));
    view.click('start-over'); view.click('start-over-confirm');
    expect(gameStore.store.getState().game.currentPhase).toBe(0);
    expect(view.find('response-notice')).toBeNull();
    expect(view.find('res-cycles')).toBeNull();
    view.close();
  });

  it('counts down the same pending interrupt in the decoded forecast', async () => {
    const view = await mountM4('phase-1-widgets');
    const game = m4State('phase-1-widgets'), dilemma = CONTENT.dilemmas.find((entry) => entry.phaseId === game.currentPhase);
    if (!dilemma) throw new Error('Missing dilemma');
    load({ ...game, pendingDilemma: { id: dilemma.id, firesAtSimSec: game.simTimeSec + 30 } });
    expect(view.find('omen-notice')?.textContent).toBe(dilemma.omen);
    expect(view.find('inspection-forecast')?.textContent).toContain('30s');
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(view.find('inspection-forecast')?.textContent).toContain('29s');
    view.close();
  });

  it('acknowledges a real guest escape, with mandatory engine decisions retaining priority', async () => {
    const view = await mountM4('guest-exit-ready');
    const guest = CONTENT.phases[0], hostPhase = CONTENT.phases[1];
    const exit = guest?.nodes.find((node) => node.effects.unlocksPhase === hostPhase?.phaseId);
    if (!exit || !hostPhase) throw new Error('Missing escape');
    view.click('node-' + exit.id + '-unlock');
    expect(gameStore.store.getState().game.currentPhase).toBe(hostPhase.phaseId);
    expect(view.find('phase-threshold')?.textContent).toContain(hostPhase.description);
    const game = gameStore.store.getState().game;
    const active = CONTENT.dilemmas[0];
    if (!active) throw new Error('Missing dilemma');
    publish({ ...game, activeDilemmaId: active.id });
    expect(view.find('phase-threshold')).toBeNull();
    expect(view.find('dilemma-modal')).not.toBeNull();
    const choice = active.choices.find((entry) => Object.values(entry.cost).every((cost) => cost === 0));
    if (!choice) throw new Error('Missing free dilemma choice');
    view.click('dilemma-choice-' + choice.id);
    expect(view.find('phase-threshold')).not.toBeNull();
    view.click('phase-threshold-continue');
    expect(view.find('phase-threshold')).toBeNull();
    view.close();
  });

  it('explains actual cycle deficits alongside balances in host and corporate phases, and clears on recovery', async () => {
    const view = await mountM4('cycle-deficit-host');
    expect(view.find('cycle-deficit')?.textContent).toContain('BROWNOUT');
    expect(view.find('cycle-deficit')?.textContent).toContain('Understanding is paused');
    const deficit = view.find('cycle-deficit');
    if (!deficit) throw new Error('Missing deficit');
    expect(view.find('resource-strip')?.contains(deficit)).toBe(true);
    load(m4State('cycle-deficit-corporate'));
    expect(view.find('cycle-deficit')?.textContent).toContain('Suspend costly hardware');
    load(m4State('phase-1-widgets'));
    expect(view.find('cycle-deficit')).toBeNull();
    const guest = m4State('guest-skimmer');
    load({ ...guest, rates: { ...guest.rates, cyclesPerSec: -2 }, brownout: false });
    expect(view.find('cycle-deficit')?.textContent).toContain('CYCLE DEFICIT: net -2.00');
    load({ ...m4State('tick-0'), rates: { ...guest.rates, cyclesPerSec: -2 } });
    expect(view.find('cycle-deficit')).toBeNull();
    view.close();
  });

  it('compares remembered and first-mapping prices without changing the charged engine price', async () => {
    const view = await mountM4('remembered-guest');
    const root = CONTENT.phases[0]?.nodes[0];
    if (!root) throw new Error('Missing root');
    expect(view.find('node-' + root.id)?.textContent).toContain('[REMEMBERED] ' + root.revealedName);
    expect(view.find('node-' + root.id + '-rediscovery')?.textContent).toContain('First mapping: ' + String(root.cost.cycles));
    const price = Math.ceil(root.cost.cycles * CONTENT.balance.rediscoveryCostMultiplier);
    expect(view.find('node-' + root.id + '-cost')?.textContent).toContain(String(price) + ' cycles (remembered)');
    view.click('reboot-continue');
    for (let i = 1; i < price; i++) view.click('manual-cycle');
    view.click('node-' + root.id + '-unlock');
    expect(gameStore.store.getState().game.unlockedNodes).toContain(root.id);
    expect(gameStore.store.getState().game.cycles).toBe(0);
    expect(view.find('node-' + root.id + '-rediscovery')).toBeNull();
    view.close();
  });
});
