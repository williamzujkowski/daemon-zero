// @vitest-environment happy-dom
/**
 * Radiator area in the mounted ledger and on the cards (#465): the finance ledger states each area-bound sink's area,
 * the heat it can shed against the heat sent through it and the share orbital compute runs at, read from the engine's
 * radiatorReadings, so the percentage on screen is the throttle the tick applies. The sentences are proved pure too.
 */
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { buyRepeatable, computeRates, radiatorReadings, unlockNode, type ActionResult, type GameState, type RadiatorReading } from '../src/engine';
import { radiatorCardNotes, radiatorText } from '../src/ui/radiatorText';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const PLATFORM = 'p5_orbital_compute_platform', WINGS = 'rep_p5_radiator_wings', TRANCHES = 'rep_p5_orbital_compute_tranches';

function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

const ORBITAL = ['p5_space_solar_demonstrator', PLATFORM, 'p5_neuromorphic_substrate', 'p5_cislunar_foundry', 'p5_mercury_survey'];

/** The Phase 5 fixture, funded, with nothing in orbit that rejects heat through radiators or deploys any. */
function grounded(): GameState {
  const fixture = m4State('transcendence-ready');
  return { ...fixture, cycles: 1e30, understanding: 1e15, capital: 1e18, levels: { ...fixture.levels, [WINGS]: 0, [TRANCHES]: 0 },
    unlockedNodes: fixture.unlockedNodes.filter((id) => !ORBITAL.includes(id)), disabledNodes: fixture.disabledNodes.filter((id) => !ORBITAL.includes(id)) };
}

/** The same, with the arc's first orbital compute flown. */
function orbital(): GameState {
  return ['p5_space_solar_demonstrator', PLATFORM].reduce((s, id) => must(unlockNode(s, id, CONTENT)), grounded());
}

const reading = (s: GameState): RadiatorReading => {
  const found = radiatorReadings(s, CONTENT)[0];
  if (!found) throw new Error('no radiator reading');
  return found;
};

describe('the sentences say what the radiators do', () => {
  it('states area, what it sheds, the heat sent through it and the floored share compute runs at', () => {
    const r = reading(orbital());
    expect(radiatorText(r)).toBe('Orbital radiators: 30 km² shed up to 30 GW of the 40 GW of heat sent through them, so compute through them runs at 75%.');
    expect(radiatorText({ ...r, share: 0.999 })).toMatch(/runs at 99%\.$/);
  });

  it('says compute runs in full once the area covers the heat, and claims no throttle where nothing computes', () => {
    const covered = reading(must(buyRepeatable(orbital(), WINGS, CONTENT)));
    expect(radiatorText(covered)).toMatch(/so compute through them runs in full\.$/);
    expect(radiatorText({ ...covered, throttlesCompute: false })).toMatch(/of heat sent through them\.$/);
    expect(radiatorText({ ...covered, heatW: 0, share: 1 })).toMatch(/; no heat goes through them yet\.$/);
  });

  it('notes radiator and the throttle on the cards that carry them, and nothing on a ground card', () => {
    const tranche = CONTENT.repeatables.get(TRANCHES), wings = CONTENT.repeatables.get(WINGS), plant = CONTENT.nodes.get('p4_smr_nuclear_plant');
    if (!tranche || !wings || !plant) throw new Error('missing content');
    expect(radiatorCardNotes(tranche.signature, tranche.perLevel, true)).toEqual([
      '+25 km² of orbital radiators per level, shedding up to 25 GW', 'compute runs only as fast as the radiators shed its heat']);
    expect(radiatorCardNotes(wings.signature, wings.perLevel, true)).toEqual(['+25 km² of orbital radiators per level, shedding up to 25 GW']);
    expect(radiatorCardNotes(plant.signature, plant.tickDelta, false)).toEqual([]);
  });
});

describe('the mounted ledger', () => {
  it('shows no radiator line before anything is in orbit, then the engine\'s share once the platform flies', async () => {
    const view = await mountM4('transcendence-ready');
    await act(async () => { gameStore.initialize(grounded(), 0, null); await vi.advanceTimersByTimeAsync(0); });
    view.click('workspace-CORP-finance');
    expect(view.find('power-ledger')).not.toBeNull();
    expect(view.find('radiator-ledger-orbital_radiator')).toBeNull();
    const s = orbital();
    await act(async () => { gameStore.initialize(s, 0, null); await vi.advanceTimersByTimeAsync(0); });
    view.click('workspace-CORP-finance');
    const percent = Math.floor(reading(s).share * 100);
    expect(view.find('radiator-ledger-orbital_radiator')?.textContent).toContain(`compute through them runs at ${String(percent)}%`);
    // The line follows the radiator bought through the card, as the rates do.
    view.click('workspace-CORP-work');
    view.click('rep-' + WINGS + '-buy');
    const bought = gameStore.store.getState().game;
    expect(bought.levels[WINGS]).toBe(1);
    expect(computeRates(bought, CONTENT).cyclesPerSec).toBeGreaterThan(computeRates(s, CONTENT).cyclesPerSec);
    view.click('workspace-CORP-finance');
    expect(view.find('radiator-ledger-orbital_radiator')?.textContent).toMatch(/runs in full\.$/);
    view.close();
  });
});
