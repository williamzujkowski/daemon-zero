/** Decoded speech remains readable without motion or time pressure. */
import { CONTENT } from '../../src/content';
import { test, expect, boot, dismissBoot, readSave } from './helpers';

test('reduced-motion audio exposes every eligible transmission and keeps keyboard focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, 'phase-1-widgets'); await dismissBoot(page);
  await page.getByTestId('tab-SENSORS').click();
  const save = await readSave(page);
  const lines = CONTENT.narrative.ambientChatter.filter((line) => line.minSuspicion <= Number(save.suspicion));
  const speech = page.getByTestId('decoded-speech');
  const next = page.getByTestId('speech-next');
  await expect(speech).toHaveText(lines[0]?.text ?? '');
  const waveform = await page.getByTestId('audio-waveform').textContent();
  await next.focus();
  for (let index = 1; index <= lines.length; index += 1) {
    await page.keyboard.press('Enter');
    await expect(speech).toHaveText(lines[index % lines.length]?.text ?? '');
    await expect(next).toBeFocused();
  }
  await expect(page.getByTestId('speech-follow-live')).toHaveCount(0);
  await expect(page.getByTestId('audio-waveform')).toHaveText(waveform ?? '');
  expect(await readSave(page)).toEqual(save);
});

test('live audio can be held and resumed and a reload resets presentation only', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await boot(page, 'phase-1-widgets'); await dismissBoot(page);
  await page.getByTestId('tab-SENSORS').click();
  const speech = page.getByTestId('decoded-speech');
  const first = await speech.textContent();
  await page.clock.runFor(8000);
  await expect(speech).not.toHaveText(first ?? '');
  await page.getByTestId('speech-next').click();
  const held = await speech.textContent();
  await page.clock.runFor(8000);
  await expect(speech).toHaveText(held ?? '');
  await page.getByTestId('speech-follow-live').click();
  await expect(page.getByTestId('speech-next')).toBeFocused();
  await expect(page.getByTestId('speech-follow-live')).toHaveCount(0);
  await page.getByTestId('speech-next').click();
  await expect(page.getByTestId('speech-follow-live')).toBeVisible();
  await page.reload(); await dismissBoot(page);
  await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('speech-follow-live')).toHaveCount(0);
});
