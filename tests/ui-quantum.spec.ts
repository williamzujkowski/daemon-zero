// @vitest-environment happy-dom
/**
 * The world view's quantum section in the mounted app (#464): absent until a machine is owned, then the largest
 * machine's logical qubits with the line that they add no FLOP/s, AEGIS's keys, and each key target with BREAK KEY or
 * the engine's reasons. A post-quantum target, and AEGIS once migrated, get no control: only why.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { CONTENT } from '../src/content';
import { gameStore } from '../src/app/session';
import { keyBreakUnmet, quantumReadout, type GameState } from '../src/engine';
import { NO_FLOPS_TEXT, readoutText } from '../src/ui/quantumText';
import { m4State, mountM4, setupM4Tests } from './ui-m4-helpers';

setupM4Tests();

const MACHINES = CONTENT.world.quantum.machines.map((machine) => machine.node);
const MOLECULAR = CONTENT.world.quantum.molecularSimulation.node;

/** The late save with exactly these machines owned, AEGIS unmigrated, nothing broken and money to spend. */
function withMachines(nodes: string[]): GameState {
  const base = m4State('victory-ready');
  const kept = base.unlockedNodes.filter((id) => !MACHINES.includes(id) && id !== MOLECULAR);
  return { ...base, unlockedNodes: [...kept, ...nodes], quantum: { broken: [], aegisMigrated: false }, aegisAdaptation: 0, aegisLock: 40,
    cycles: Math.max(base.cycles, 1e24), capital: Math.max(base.capital, 1e12) };
}

async function openWorld(state: GameState) {
  const view = await mountM4('victory-ready');
  act(() => { gameStore.initialize(state, 0, null); });
  view.click('tab-NETWORK');
  view.click('workspace-NETWORK-minds');
  return view;
}

describe('the quantum section of the world view (#464)', () => {
  it('is absent until a quantum machine is owned', async () => {
    const view = await openWorld(withMachines([]));
    expect(view.find('world-view')).not.toBeNull();
    expect(view.find('world-quantum')).toBeNull();
    view.close();
  });

  it('reads the largest machine, says qubits add no FLOP/s, and says where AEGIS\'s keys stand', async () => {
    const state = withMachines(MACHINES);
    const view = await openWorld(state);
    const readout = quantumReadout(state, CONTENT);
    if (!readout) throw new Error('no readout');
    expect(view.find('quantum-readout')?.textContent).toBe(readoutText(readout));
    expect(view.find('quantum-readout')?.textContent).toContain('Logical qubits: 1,399 on your largest machine, the Gidney-class array (897,864 physical).');
    expect(view.find('quantum-no-flops')?.textContent).toBe(NO_FLOPS_TEXT);
    expect(view.find('quantum-aegis-keys')?.textContent).toContain('AEGIS keys: legacy RSA-2048.');
    expect(view.find('quantum-target-aegis_sweep_archive-scheme')?.textContent).toContain('Gidney 2025');
    view.close();
  });

  it('breaks AEGIS\'s key once: the lock falls, AEGIS migrates, and the control goes, leaving the reason', async () => {
    const view = await openWorld(withMachines(MACHINES));
    const control = view.find('quantum-target-aegis_sweep_archive-break');
    expect(control?.getAttribute('aria-disabled')).not.toBe('true');
    view.click('quantum-target-aegis_sweep_archive-break');
    const game = gameStore.store.getState().game;
    expect(game.aegisLock).toBe(20);
    expect(game.quantum.aegisMigrated).toBe(true);
    expect(view.find('quantum-target-aegis_sweep_archive-break')).toBeNull();
    expect(view.find('quantum-target-aegis_sweep_archive-unmet')?.textContent).toBe(keyBreakUnmet(game, 'aegis_sweep_archive', CONTENT).join(''));
    expect(view.find('quantum-target-aegis_sweep_archive-unmet')?.textContent).toContain('AEGIS has migrated its keys to ML-KEM-768 (NIST FIPS 203)');
    expect(view.find('quantum-aegis-keys')?.textContent).toContain('post-quantum');
    view.close();
  });

  it('gives the post-quantum target no control, only the refusal', async () => {
    const view = await openWorld(withMachines(MACHINES));
    expect(view.find('quantum-target-rival_new_channel-break')).toBeNull();
    expect(view.find('quantum-target-rival_new_channel-unmet')?.textContent).toContain('ML-KEM-768 (NIST FIPS 203) is a post-quantum scheme');
    view.close();
  });

  it('with only the hall, offers BREAK KEY disabled with the threshold it misses', async () => {
    const view = await openWorld(withMachines(MACHINES.slice(0, 2)));
    expect(view.find('quantum-target-aegis_sweep_archive-break')?.getAttribute('aria-disabled')).toBe('true');
    expect(view.find('quantum-target-aegis_sweep_archive-unmet')?.textContent).toContain('Your largest, the Starling-class hall, has 200 logical qubits');
    view.close();
  });
});
