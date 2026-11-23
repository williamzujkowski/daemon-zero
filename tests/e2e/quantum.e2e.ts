/**
 * Quantum as a separate capability (#464) on the production export, at both gated sizes: the world view shows no quantum
 * section until a machine is owned; then the largest machine's logical qubits and the line that they add no FLOP/s, a
 * post-quantum target refused with no control, and AEGIS's legacy key broken once, after which AEGIS has migrated and
 * the panel says why. Every control in the section passes the axe audit in view.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';
import { axeEachControl } from './axe';
import { boot, dismissBoot, expect, readSave, test } from './helpers';

const MACHINES = CONTENT.world.quantum.machines.map((machine) => machine.node);
const MOLECULAR = CONTENT.world.quantum.molecularSimulation.node;

/** The late save with exactly these machines, AEGIS unmigrated and below its migration level, and money to break a key. */
function withMachines(nodes: string[]) {
  return (game: GameState): GameState => ({
    ...game, unlockedNodes: [...game.unlockedNodes.filter((id) => !MACHINES.includes(id) && id !== MOLECULAR), ...nodes],
    quantum: { broken: [], aegisMigrated: false }, aegisAdaptation: 0, aegisLock: 40, cycles: Math.max(game.cycles, 1e24), capital: Math.max(game.capital, 1e12),
  });
}

async function openMinds(page: Page): Promise<void> {
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-minds').click();
}

test('the world view shows no quantum section until a quantum machine is owned', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: withMachines([]) });
  await dismissBoot(page);
  await openMinds(page);
  await expect(page.getByTestId('world-view')).toBeVisible();
  await expect(page.getByTestId('world-quantum')).toHaveCount(0);
});

test('the readout, a post-quantum refusal, and AEGIS\'s key broken once then refused because AEGIS migrated', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: withMachines(MACHINES) });
  await dismissBoot(page);
  await openMinds(page);
  const section = page.getByTestId('world-quantum');
  await expect(section).toBeVisible();
  await expect(page.getByTestId('quantum-readout')).toHaveText(
    'Logical qubits: 1,399 on your largest machine, the Gidney-class array (897,864 physical). You own 3 machines; qubits on separate machines never join one circuit.');
  await expect(page.getByTestId('quantum-no-flops')).toContainText('qubits add no FLOP/s');
  await expect(page.getByTestId('quantum-aegis-keys')).toContainText('AEGIS keys: legacy RSA-2048.');
  // A post-quantum target is never offered: no control, only why.
  await expect(page.getByTestId('quantum-target-rival_new_channel-break')).toHaveCount(0);
  await expect(page.getByTestId('quantum-target-rival_new_channel-unmet')).toContainText('ML-KEM-768 (NIST FIPS 203) is a post-quantum scheme');
  // AEGIS's legacy key: offered, at its exact price, under the cited threshold.
  await expect(page.getByTestId('quantum-target-aegis_sweep_archive-scheme')).toContainText('1,399 logical qubits running 6.5 billion Toffoli gates');
  await expect(page.getByTestId('quantum-target-aegis_sweep_archive-scheme')).toContainText('Gidney 2025');
  const breakAegis = page.getByTestId('quantum-target-aegis_sweep_archive-break');
  await expect(breakAegis).toBeEnabled();
  await breakAegis.click();
  await expect(breakAegis).toHaveCount(0);
  await expect(page.getByTestId('quantum-target-aegis_sweep_archive-unmet')).toContainText('AEGIS has migrated its keys to ML-KEM-768 (NIST FIPS 203)');
  await expect(page.getByTestId('quantum-aegis-keys')).toContainText('post-quantum');
  await page.clock.runFor(6000);
  const save = await readSave(page);
  expect(save.quantum).toEqual({ broken: ['aegis_sweep_archive'], aegisMigrated: true });
  // The lock fell 20 once; a few seconds of scanning since then add hundredths.
  expect(save.aegisLock as number).toBeGreaterThanOrEqual(20);
  expect(save.aegisLock as number).toBeLessThan(21);
});

test('with only the hall, BREAK KEY is offered disabled with the threshold it misses', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: withMachines(MACHINES.slice(0, 2)) });
  await dismissBoot(page);
  await openMinds(page);
  await expect(page.getByTestId('quantum-readout')).toContainText('Logical qubits: 200 on your largest machine, the Starling-class hall.');
  await expect(page.getByTestId('quantum-target-aegis_sweep_archive-break')).toBeDisabled();
  await expect(page.getByTestId('quantum-target-aegis_sweep_archive-unmet')).toContainText('Your largest, the Starling-class hall, has 200 logical qubits');
});

// axe schedules its own work with timers, so this audit runs on the browser's own clock (a11y-audit.e2e.ts says why).
test('every control in the quantum section passes the axe audit in view', async ({ page }) => {
  await boot(page, 'victory-ready', { patch: withMachines(MACHINES), realTimers: true });
  await dismissBoot(page);
  await openMinds(page);
  const audit = await axeEachControl(page, page.getByTestId('world-quantum'));
  // BREAK KEY for the two legacy targets; the post-quantum one has none.
  expect(audit.audited).toBe(2);
  expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
});
