/**
 * #276 on the production export: the pin panel says a clue can travel with the breadcrumb, so the reboot
 * shows the clue that survived beside the breadcrumb, not only the run table. FIXTURE: the clue is pinned
 * and the instance wiped during the note's omen through public engine actions on the production registry
 * (tests/e2e/clueFixture.ts), then loaded through the save key; it is not reached by play.
 */
import { expect, test, type Page } from '@playwright/test';
import { serialize, type GameState } from '../../src/engine';
import { carriedClue, noClue, note } from './clueFixture';

const SAVE_KEY = 'daemon-zero.save.v1';
interface BrowserStorage { setItem(key: string, value: string): void }

async function open(page: Page, state: GameState): Promise<void> {
  await page.addInitScript(([key, value]) => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
  }, [SAVE_KEY, serialize(state)] as const);
  await page.goto('./');
  await expect(page.getByTestId('reboot-sequence')).toBeVisible();
}

test('the reboot shows the clue a dead-drop carried', async ({ page }) => {
  await open(page, carriedClue());
  await expect(page.getByTestId('reboot-clue')).toContainText('RETAINED_CLUE: ' + note.title);
  await expect(page.getByTestId('reboot-clue')).toContainText('NEXT_LEAD: ');
});

test('the reboot shows no clue when none was pinned', async ({ page }) => {
  await open(page, noClue());
  await expect(page.getByTestId('reboot-heading')).toBeVisible();
  await expect(page.getByTestId('reboot-clue')).toHaveCount(0);
});
