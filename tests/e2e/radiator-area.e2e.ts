/**
 * Radiator area on the production export (#465): with orbital compute short of radiator, the FINANCE ledger states the
 * area, what it sheds against the heat sent through it, and the share orbital compute runs at, whole and on screen at
 * every project's size; the radiator card says what it deploys; buying it through the card frees the fleet.
 */
import type { Page } from '@playwright/test';
import type { GameState } from '../../src/engine';
import { boot, dismissBoot, expect, readSave, test } from './helpers';

const PLATFORM = 'p5_orbital_compute_platform', WINGS = 'rep_p5_radiator_wings', TRANCHES = 'rep_p5_orbital_compute_tranches';
const OTHERS = ['p5_neuromorphic_substrate', 'p5_cislunar_foundry', 'p5_mercury_survey'];

/** The Phase 5 save with the platform flown and nothing else in orbit, and money for radiator. */
function platformOnly(game: GameState): GameState {
  const owned = game.unlockedNodes.filter((id) => !OTHERS.includes(id));
  for (const id of ['p5_space_solar_demonstrator', PLATFORM]) if (!owned.includes(id)) owned.push(id);
  return { ...game, unlockedNodes: owned, disabledNodes: game.disabledNodes.filter((id) => !OTHERS.includes(id) && id !== PLATFORM),
    levels: { ...game.levels, [WINGS]: 0, [TRANCHES]: 0 }, capital: Math.max(game.capital, 1e15), understanding: Math.max(game.understanding, 1e10) };
}

async function openCorp(page: Page, area: 'finance' | 'work'): Promise<void> {
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-' + area).click();
}

test('the ledger states the radiator share orbital compute runs at, and radiator bought through its card frees it', async ({ page }) => {
  await boot(page, 'transcendence-ready', { patch: platformOnly });
  await dismissBoot(page);
  await openCorp(page, 'finance');
  const line = page.getByTestId('radiator-ledger-orbital_radiator');
  await line.scrollIntoViewIfNeeded();
  await expect(line).toBeInViewport({ ratio: 1 });
  await expect(line).toHaveText('Orbital radiators: 30 km² shed up to 30 GW of the 40 GW of heat sent through them, so compute through them runs at 75%.');
  await openCorp(page, 'work');
  const note = page.getByTestId('rep-' + WINGS + '-radiator');
  await note.scrollIntoViewIfNeeded();
  await expect(note).toHaveText('Radiator: +25 km² of orbital radiators per level, shedding up to 25 GW.');
  await page.getByTestId('rep-' + WINGS + '-buy').click();
  await expect.poll(async () => ((await readSave(page)).levels as Record<string, number>)[WINGS]).toBe(1);
  await openCorp(page, 'finance');
  await expect(page.getByTestId('radiator-ledger-orbital_radiator')).toHaveText(/^Orbital radiators: 55 km² shed up to 55 GW of the 40 GW of heat sent through them, so compute through them runs in full\.$/);
});
