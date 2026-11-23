// @vitest-environment happy-dom
/**
 * The fleet panel and RECLAIM in the mounted app (#518): SWARM shows each running fleet's strength, dial, drift and
 * rebuild; the dial sets the engine's autonomy for free and marks the set position pressed; [ REBUILD ] pays and restores;
 * a deviant before its battle offers [ RECLAIM ], which ends it; and nothing renders without a fleet.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { gameStore } from '../src/app/session';
import { CONTENT } from '../src/content';
import type { GameState } from '../src/engine';
import { fixtureState } from './fallback-states';
import { mountM4, setupM4Tests } from './ui-m4-helpers';
setupM4Tests();

const DRONES = 'rep_p4_drone_fleet';
const F = CONTENT.world.conflict.fleets;
const game = () => gameStore.store.getState().game;

/** The Phase 4 save with a worn drone fleet at its last level, funded, and optionally a deviant before its battle. */
function armed(deviant = false): GameState {
  const s = fixtureState(4);
  const raid = deviant ? { id: 'deviant_drone_fleet', stage: 'ARRIVAL' as const, stageSec: 1, arrivedAtSec: s.simTimeSec, target: 'halls', force: 2,
    quietSec: 0, attributed: null, rounds: [], engagement: null, splitShare: F.splitShare } : null;
  return { ...s, capital: 1e18, levels: { ...s.levels, [DRONES]: 40 }, hostile: { ...s.hostile, active: null },
    conflict: { ...s.conflict, raid, fleets: { [DRONES]: { autonomy: 'STANDARD', drift: 30, lost: 0.3 } } } };
}

async function swarm(state: GameState) {
  const view = await mountM4('tick-0');
  act(() => { gameStore.initialize(state, 0, null); });
  view.click('workspace-CORP-swarm');
  return view;
}

describe('the fleet panel', () => {
  it('states strength, drift and the split forecast, and the dial sets autonomy for free', async () => {
    const view = await swarm(armed());
    expect(view.find('fleet-' + DRONES + '-strength')?.textContent).toContain('30% lost');
    expect(view.find('fleet-' + DRONES + '-drift')?.textContent).toContain('Drift 30%');
    expect(view.find('fleet-' + DRONES + '-forecast')).not.toBeNull();
    const tether = 'fleet-' + DRONES + '-autonomy-shackled';
    expect(view.find(tether)?.getAttribute('aria-pressed')).toBe('false');
    const capital = game().capital;
    view.click(tether);
    expect(game().conflict.fleets[DRONES]?.autonomy).toBe('SHACKLED');
    expect(game().capital).toBe(capital);
    expect(view.find(tether)?.getAttribute('aria-pressed')).toBe('true');
    expect(view.find('fleet-' + DRONES + '-autonomy-summary')?.textContent).toContain('Now ' + F.autonomy.SHACKLED.name);
    expect(view.find('fleet-' + DRONES + '-drift')?.textContent).toContain('does not grow');
    view.close();
  });

  it('[ REBUILD ] pays the price and restores its points', async () => {
    const view = await swarm(armed());
    const unit = F.units.find((entry) => entry.repeatable === DRONES);
    view.click('fleet-' + DRONES + '-rebuild');
    expect(game().conflict.fleets[DRONES]?.lost).toBeCloseTo(0.3 - (unit?.rebuild.points ?? 0), 9);
    view.close();
  });

  it('[ RECLAIM ] on a deviant before its battle ends the raid and returns the share', async () => {
    const view = await swarm(armed(true));
    expect(view.find('raid-reclaim-text')?.textContent).toContain('RECLAIM');
    view.click('raid-reclaim');
    expect(game().conflict.raid).toBeNull();
    expect(game().conflict.fleets[DRONES]?.lost).toBeCloseTo(0.3 - F.splitShare, 9);
    expect(view.find('raid-panel')).toBeNull();
    view.close();
  });

  it('renders nothing while no fleet runs', async () => {
    const view = await swarm({ ...armed(), levels: { ...armed().levels, [DRONES]: 0 } });
    expect(view.find('fleet-panel')).toBeNull();
    view.close();
  });
});
