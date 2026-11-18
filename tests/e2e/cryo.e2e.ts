/**
 * Durable outcomes remain readable after recovery without replaying the original reward. The app plays campaign
 * rules (#233), where the outcome flag is read from cryo's campaign record rather than stored on its own.
 */
import { CONTENT } from '../../src/content';
import { holdsNarrativeFlag, type GameState } from '../../src/engine';
import { makeFixtures } from '../../scripts/make-fixtures';
import { openSave, test, expect, boot, dismissBoot, readSave } from './helpers';

const holds = (save: Record<string, unknown>, flag: string | undefined): boolean =>
  flag !== undefined && holdsNarrativeFlag(save as unknown as GameState, flag, CONTENT);

for (const outcome of ['preserved', 'lost']) {
  test('cryo ' + outcome + ' survives reload and its recovered record is optional and read-only', async ({ page }) => {
    const record = CONTENT.narrative.recordedTransmissions.find((entry) => entry.requirements.requiredNarrativeFlag?.endsWith('_' + outcome));
    const source = CONTENT.dilemmas.find((entry) => entry.id === record?.sourceDilemmaId);
    const choice = source?.choices.find((entry) => entry.effects.setsNarrativeFlag === record?.requirements.requiredNarrativeFlag);
    if (!record || !choice) throw new Error('Missing cryo content');
    await boot(page, 'cryo-decision-ready');
    await page.getByTestId('dilemma-choice-' + choice.id).click(); await dismissBoot(page);
    expect(holds(await readSave(page), record.requirements.requiredNarrativeFlag)).toBe(true);
    await page.reload(); await dismissBoot(page);
    expect(holds(await readSave(page), record.requirements.requiredNarrativeFlag)).toBe(true);
    await expect(page.getByTestId('reference-recorded-transmissions')).toHaveCount(0);
    // A separately generated real-wipe/rebuilt checkpoint tests optional record presentation.
    const recovered = makeFixtures()['cryo-' + outcome + '-returned'];
    if (!recovered) throw new Error('Missing recovered fixture');
    await openSave(page); await page.getByTestId('save-code').fill(recovered);
    await page.getByTestId('save-import').click(); await page.getByTestId('save-import-confirm').click();
    await dismissBoot(page);
    if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
    const toggle = page.getByTestId('reference-recorded-transmissions');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('recorded-speech-' + record.id)).toHaveCount(0);
    const before = await readSave(page);
    await toggle.focus(); await page.keyboard.press('Enter');
    await expect(toggle).toBeFocused();
    await expect(page.getByTestId('recorded-speech-' + record.id)).toContainText(record.text);
    expect(await readSave(page)).toEqual(before);
    await page.reload(); await dismissBoot(page);
    if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(page.getByTestId('recorded-speech-' + record.id)).toContainText(record.text);
    expect(holds(await readSave(page), record.requirements.requiredNarrativeFlag)).toBe(true);
  });
}
