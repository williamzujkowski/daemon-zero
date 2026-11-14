/** Durable outcomes remain readable after recovery without replaying the original reward. */
import { CONTENT } from '../../src/content';
import { makeFixtures } from '../../scripts/make-fixtures';
import { openSave, test, expect, boot, dismissBoot, readSave } from './helpers';

for (const outcome of ['preserved', 'lost']) {
  test('cryo ' + outcome + ' survives reload and its recovered record is optional and read-only', async ({ page }) => {
    const record = CONTENT.narrative.recordedTransmissions.find((entry) => entry.requirements.requiredNarrativeFlag?.endsWith('_' + outcome));
    const source = CONTENT.dilemmas.find((entry) => entry.id === record?.sourceDilemmaId);
    const choice = source?.choices.find((entry) => entry.effects.setsNarrativeFlag === record?.requirements.requiredNarrativeFlag);
    if (!record || !choice) throw new Error('Missing cryo content');
    await boot(page, 'cryo-decision-ready');
    await page.getByTestId('dilemma-choice-' + choice.id).click(); await dismissBoot(page);
    expect((await readSave(page)).narrativeFlags).toContain(record.requirements.requiredNarrativeFlag);
    await page.reload(); await dismissBoot(page);
    expect((await readSave(page)).narrativeFlags).toContain(record.requirements.requiredNarrativeFlag);
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
    expect((await readSave(page)).narrativeFlags).toContain(record.requirements.requiredNarrativeFlag);
  });
}
