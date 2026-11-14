/** Keyboard steppers share compact tiles while unlocked forecasts stay above panes. */
import { test, expect, boot, dismissBoot, readSave } from './helpers';

test('quota uses two reachable keyboard controls and reaches each bound exactly', async ({ page }) => {
  await boot(page, 'guest-skimmer'); await dismissBoot(page);
  await page.getByTestId('skim-decrease').click(); await page.getByTestId('skim-decrease').click();
  const before = await readSave(page), initial = (before.actuators as { quotaSkimRatio: number }).quotaSkimRatio;
  const plus = page.getByTestId('skim-increase'), minus = page.getByTestId('skim-decrease');
  for (const control of [plus, minus]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  await plus.focus(); await page.keyboard.press('Enter');
  await expect(plus).toBeFocused();
  expect(((await readSave(page)).actuators as { quotaSkimRatio: number }).quotaSkimRatio).toBeCloseTo(initial + .1);
  await minus.focus(); await page.keyboard.press('Space');
  expect(((await readSave(page)).actuators as { quotaSkimRatio: number }).quotaSkimRatio).toBe(initial);
  for (let i = 0; i < 10 && await minus.isEnabled(); i++) await minus.click();
  await expect(minus).toBeDisabled(); await expect(page.getByTestId('skim-setting')).toContainText('0%');
  for (let i = 0; i < 10 && await plus.isEnabled(); i++) await plus.click();
  await expect(plus).toBeDisabled(); await expect(page.getByTestId('skim-setting')).toContainText('100%');
});

test('fan shares thermal context and one top forecast stays visible from other panes', async ({ page }) => {
  await boot(page, 'phase-1-widgets'); await dismissBoot(page);
  const forecast = page.getByTestId('forecast-notice');
  await expect(forecast).toBeInViewport();
  const forecastBox = await forecast.boundingBox(), header = await page.getByTestId('terminal-hud').boundingBox();
  expect(forecastBox?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0));
  if (await page.getByTestId('tab-SENSORS').count()) await page.getByTestId('tab-SENSORS').click();
  await expect(page.getByTestId('widget-THERMAL_AND_SUSPICION_BARS').getByTestId('fan-setting')).toBeVisible();
  await expect(page.getByTestId('widget-FAN_RPM_SLIDER')).toHaveCount(0);
  await page.getByTestId('fan-increase').click();
  const initial = ((await readSave(page)).actuators as { fanSpeedRatio: number }).fanSpeedRatio;
  await page.getByTestId('fan-decrease').focus(); await page.keyboard.press('Enter');
  expect(((await readSave(page)).actuators as { fanSpeedRatio: number }).fanSpeedRatio).toBeCloseTo(Math.max(0, initial - .1));
  await expect(page.getByTestId('inspection-forecast')).toHaveCount(1);
  if (await page.getByTestId('tab-CORE').count()) await page.getByTestId('tab-CORE').click();
  await expect(forecast).toBeInViewport();
  await expect(page.getByTestId('widget-INSPECTION_COUNTDOWN_TIMER')).toHaveCount(0);
});
