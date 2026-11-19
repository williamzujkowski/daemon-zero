/**
 * Distinctions on the served build (DESIGN.md backlog item 6): an ended save, imported through the player's own save
 * control, shows exactly the distinctions the engine says its record proves, with their claims, counts the rest
 * without naming them, and still reads after a reload. tests/e2e/m7.e2e.ts reaches an ending by play and checks
 * the same block there.
 */
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT } from '../../src/content';
import { earnedAchievements, exportSave, importSave, type GameState } from '../../src/engine';
import { test, expect, boot, openSave } from './helpers';

function endedCode(): { code: string; game: GameState } {
  const ready = makeFixtures()['victory-ready'];
  if (!ready) throw new Error('Missing victory-ready fixture');
  const loaded = importSave(ready, CONTENT);
  const game: GameState = { ...loaded, ending: 'THE_ARK', traits: [], legacy: { ...loaded.legacy, traitsEver: ['GHOST'] } };
  return { code: exportSave(game), game };
}

test('an ended game names the distinctions its record proves and counts the rest', async ({ page }) => {
  const { code, game } = endedCode();
  const earned = earnedAchievements(game, CONTENT);
  expect(earned.map((entry) => entry.id)).toContain('clean_record');
  await boot(page); await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const block = page.getByTestId('ending-distinctions');
  await block.scrollIntoViewIfNeeded();
  await expect(block).toBeInViewport();
  await expect(block).toContainText(`DISTINCTIONS ${String(earned.length)} OF ${String(CONTENT.achievements.length)}`);
  for (const entry of earned) await expect(page.getByTestId('distinction-' + entry.id)).toHaveText(`${entry.title}: ${entry.claim}`);
  for (const entry of CONTENT.achievements.filter((item) => !earned.includes(item))) await expect(block).not.toContainText(entry.title);
  await page.reload();
  await expect(page.getByTestId('ending-distinctions')).toContainText(`DISTINCTIONS ${String(earned.length)} OF`);
});
