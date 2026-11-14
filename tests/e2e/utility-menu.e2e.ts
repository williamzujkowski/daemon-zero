/** Utilities use one navigable surface without pausing or hiding mandatory decisions. */
import { CONTENT } from '../../src/content';
import type { HTMLElement, Window } from 'happy-dom';
import { makeFixtures } from '../../scripts/make-fixtures';
import { boot, dismissBoot, expect, openSave, readSave, test } from './helpers';

test('keyboard utility navigation cancels replacement and restores focus without stacking dialogs', async ({ page }) => {
  await boot(page);
  const launcher = page.getByTestId('menu-open');
  await launcher.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press(step < 4 ? 'Tab' : 'Shift+Tab');
    await expect(page.getByTestId('menu-dialog').locator(':focus')).toHaveCount(1);
  }
  await page.getByTestId('save-open').click();
  await page.getByTestId('save-code').fill('keep this draft');
  await page.getByTestId('save-import').click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('save-code')).toHaveValue('keep this draft');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('save-open')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(launcher).toBeFocused();
  await launcher.click(); await page.getByTestId('save-open').click();
  await page.getByTestId('save-close').click();
  await expect(launcher).toBeFocused();
  expect((await readSave(page)).iteration).toBe(1);
});

test('an arriving dilemma clears a pending utility reset and does not resurrect it', async ({ page }) => {
  await boot(page, 'guest-omen'); await dismissBoot(page);
  const before = await readSave(page);
  const pending = before.pendingDilemma as { id: string; firesAtSimSec: number };
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === pending.id);
  const choice = dilemma?.choices.find((entry) => Object.values(entry.cost).every((value) => value === 0));
  if (!choice) throw new Error('Missing free omen response');
  await openSave(page); await page.getByTestId('save-reset').click();
  await expect(page.getByTestId('save-reset-confirm')).toBeVisible();
  await page.clock.runFor(Math.ceil((pending.firesAtSimSec - Number(before.simTimeSec)) * 1000) + 200);
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
  await expect(page.getByTestId('save-reset-confirm')).toHaveCount(0);
  await page.getByTestId('dilemma-choice-' + choice.id).click();
  await expect(page.getByTestId('save-reset-confirm')).toHaveCount(0);
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  await page.getByTestId('menu-open').click();
  await expect(page.getByTestId('save-open')).toBeVisible();
  await expect(page.getByTestId('save-reset-confirm')).toHaveCount(0);
  expect((await readSave(page)).iteration).toBe(before.iteration);
});

test('ending saves use the existing ending surface and return to its epilogue', async ({ page }) => {
  const code = makeFixtures()['ending-shipped'];
  if (!code) throw new Error('Missing ended fixture');
  await boot(page); await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const ending = await page.getByTestId('ending-title').textContent();
  await openSave(page); await page.getByTestId('save-export').click();
  await expect(page.getByTestId('save-code')).not.toHaveValue('');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByTestId('save-close').click();
  await expect(page.getByTestId('ending-title')).toHaveText(ending ?? '');
  await expect(page.getByTestId('menu-open')).toBeFocused();
  await page.reload(); await expect(page.getByTestId('ending-title')).toHaveText(ending ?? '');
});

test('narrow enlarged menu labels remain inside the dialog and Back stays reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await boot(page); await openSave(page);
  await page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    for (const element of browser.document.querySelectorAll<HTMLElement>('[data-testid="menu-dialog"] [dir="auto"]')) {
      const style = browser.getComputedStyle(element);
      element.style.fontSize = String(Number.parseFloat(style.fontSize) * 2) + 'px';
      element.style.lineHeight = String(Number.parseFloat(style.lineHeight) * 2) + 'px';
    }
  });
  const bounds = await page.getByTestId('menu-dialog').boundingBox();
  if (!bounds) throw new Error('Missing utility dialog');
  for (const control of await page.getByTestId('menu-dialog').getByRole('button').all()) {
    const box = await control.boundingBox();
    if (!box) throw new Error('Missing control geometry');
    expect(box.x).toBeGreaterThanOrEqual(bounds.x);
    expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  }
  await page.getByTestId('menu-back').click();
  await expect(page.getByTestId('save-open')).toBeVisible();
  await page.getByTestId('menu-close').click();
  await expect(page.getByTestId('menu-open')).toBeFocused();
});
