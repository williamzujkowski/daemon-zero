/** Decoded speech remains readable without motion or time pressure. */
import { CONTENT } from '../../src/content';
import { openSave, test, expect, boot, dismissBoot, readSave } from './helpers';

test('reduced-motion audio exposes every eligible transmission and keeps keyboard focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, 'phase-1-widgets'); await dismissBoot(page);
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const save = await readSave(page);
  // The feed names the source of this reach (#449): on the host, the drive-head channel.
  const source = CONTENT.narrative.feedSources.find((entry) => entry.phase === Number(save.currentPhase));
  await expect(page.getByTestId('speech-source')).toHaveText(source?.label ?? '');
  // Production runs legacy rules, where no campaign fact holds, so a fact-gated line never speaks.
  const lines = CONTENT.narrative.ambientChatter.filter((line) => line.source === source?.id
    && line.minSuspicion <= Number(save.suspicion) && line.requirements?.campaignFact === undefined);
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
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
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
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('speech-follow-live')).toHaveCount(0);
});

test('Start Fresh clears held decoded speech and restoring the save starts a fresh selection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, 'phase-1-widgets'); await dismissBoot(page);
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const first = await page.getByTestId('decoded-speech').textContent();
  await page.getByTestId('speech-next').click();
  await expect(page.getByTestId('decoded-speech')).not.toHaveText(first ?? '');
  await openSave(page); await page.getByTestId('save-export').click();
  const backup = await page.getByTestId('save-code').inputValue();
  await page.getByTestId('save-reset').click(); await page.getByTestId('save-reset-confirm').click();
  await expect(page.getByTestId('decoded-speech')).toHaveCount(0);
  await expect(page.getByTestId('speech-next')).toHaveCount(0);
  await openSave(page); await page.getByTestId('save-code').fill(backup);
  await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
  await dismissBoot(page); if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('decoded-speech')).toHaveText(first ?? '');
});

test('the late feed hears its own reach, names it, and offers READ only where a clip exists', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, 'phase5-midgame', { audio: true }); await dismissBoot(page);
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  const save = await readSave(page);
  const source = CONTENT.narrative.feedSources.find((entry) => entry.phase === Number(save.currentPhase));
  await expect(page.getByTestId('speech-source')).toHaveText(source?.label ?? '');
  const own = new Set(CONTENT.narrative.ambientChatter.filter((line) => line.source === source?.id).map((line) => line.text));
  const speech = page.getByTestId('decoded-speech');
  // Every line the feed steps through is this reach's (#449): the server room is not on the air in Phase 5.
  for (let index = 0; index < own.size; index += 1) {
    expect(own.has(await speech.textContent() ?? '')).toBe(true);
    // The later sources are text-only until their clips exist, so no READ is offered on them.
    await expect(page.getByTestId('speech-read')).toHaveCount(0);
    if (await page.getByTestId('speech-next').count() === 0) break;
    await page.getByTestId('speech-next').click();
  }
});
