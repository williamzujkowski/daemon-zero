/** The dilemma choice index jumps to its card and lands focus there (#391 follow-up, vote-1795206922704-4ljmpd2). */
import { CONTENT } from '../../src/content';
import { boot, expect, readSave, test } from './helpers';

test('an index row brings its card into view and moves focus to the card heading', async ({ page }) => {
  await boot(page, 'guest-dilemma');
  await expect(page.getByTestId('dilemma-index')).toBeInViewport();
  const raw = await readSave(page);
  const dilemma = CONTENT.dilemmas.find((entry) => entry.id === raw.activeDilemmaId);
  const last = dilemma?.choices.at(-1);
  if (!last) throw new Error('Missing dilemma choices');
  // The last card starts below the fold on a phone; on desktop it may already be in view.
  await page.getByTestId('dilemma-index-' + last.id).click();
  await expect(page.getByTestId('dilemma-card-' + last.id + '-heading')).toBeInViewport();
  await expect(page.getByTestId('dilemma-card-' + last.id + '-heading')).toBeFocused();
  await expect(page.getByTestId('dilemma-choice-' + last.id)).toBeVisible();
});
