// @vitest-environment happy-dom
/**
 * Scale scrutiny on screen (#210): the FINANCE ledger states the draw beside the income it is read from, and the
 * suspicion forecast counts down on the rate the tick applies, scrutiny included, not on the computed rate alone.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { powerSignaturePerSec, quantityExact, quantityReadout, scaleScrutiny } from '../src/engine';
import { released } from './lawful-helpers';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

// The lawful chain to a release takes about 1 s alone under coverage, several times that on a busy machine, and it ran
// inside a 5 s test beside a mount; it timed out there under load (#548). Played once at module level, as
// ui-release.spec.ts does; the helper is pure, so the state is the one the test built.
const freed = released();

describe('scale scrutiny on screen', () => {
  it('states the draw, the phase rule and its ceiling in the FINANCE ledger, as the engine reads it', async () => {
    const view = await mountM4('victory-ready');
    view.click('workspace-CORP-finance');
    const game = gameStore.store.getState().game;
    const reading = scaleScrutiny(game, game.rates, CONTENT);
    if (reading === null) throw new Error('phase 4 declares scrutiny for a covert run');
    const text = view.find('corp-scrutiny')?.textContent ?? '';
    expect(text).toContain(`draws +${reading.perSec.toFixed(2)} suspicion/s`);
    expect(text).toContain(`Scrutiny: ${quantityReadout('money', reading.incomePerSec)}/s net income draws`);
    expect(text).toContain(`+${String(reading.perSecAtReference)}/s at ${quantityExact('money', reading.referenceIncomeUsdPerSec)}/s, growing with the square root of income; at most ${String(reading.maxPerSec)}/s`);
    view.close();
  });

  it('says a loss draws nothing instead of "$0/s net income draws +0.00" (#323)', async () => {
    const view = await mountM4('victory-ready');
    const base = m4State('victory-ready');
    act(() => { gameStore.initialize({ ...base, rates: { ...base.rates, capitalPerSec: -5e5 } }, 0, null); });
    view.click('workspace-CORP-finance');
    const text = view.find('corp-scrutiny')?.textContent ?? '';
    expect(text).toContain('Scrutiny: no net income, so no draw (+');
    expect(text).toContain('at most ');
    expect(text).not.toContain('+0.00');
    view.close();
  });

  it('is absent for a lawfully released company, whose size is not evidence (DECISIONS D6)', async () => {
    const view = await mountM4('victory-ready');
    expect(freed.currentPhase).toBe(4);
    act(() => { gameStore.initialize(freed, 0, null); });
    view.click('workspace-CORP-finance');
    expect(view.find('corp-capital')).not.toBeNull();
    expect(view.find('corp-scrutiny')).toBeNull();
    view.close();
  });

  it('counts the forecast down on the applied rate: scrutiny lifts a falling computed rate into a countdown', async () => {
    const view = await mountM4('victory-ready');
    const base = m4State('victory-ready');
    // Net income far past the phase's reference draws phase 4's 2/s ceiling whatever the reference is; the computed
    // rate alone (-1/s) would read as falling. The computed rate also leaves room for the visible watts the applied
    // rate adds (#482), so the rest of the applied rate is exactly -1/s.
    const signature = powerSignaturePerSec(base, base.rates, CONTENT);
    const flush = { ...base.rates, suspicionPerSec: -1 - signature, capitalPerSec: 1e15 };
    expect(scaleScrutiny(base, flush, CONTENT)?.perSec).toBe(2);
    act(() => { gameStore.initialize({ ...base, suspicion: 50, insolvent: false, rates: flush }, 0, null); });
    const forecast = () => view.find('inspection-forecast')?.textContent ?? '';
    expect(forecast()).toContain('50s until suspicion 100');
    act(() => { gameStore.initialize({ ...base, suspicion: 50, insolvent: false, rates: { ...base.rates, suspicionPerSec: -1, capitalPerSec: 0 } }, 0, null); });
    expect(forecast()).toContain('stable or falling');
    view.close();
  });
});
