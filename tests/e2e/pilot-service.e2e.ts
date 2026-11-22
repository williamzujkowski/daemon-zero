/**
 * DZ-05 (#223) on the production export, from a fresh profile through visible controls only: an accepted
 * pilot attaches its loaned queue, the allocation dial changes the derived forecast under the same
 * ceiling, a completed batch waits until it is explicitly submitted, output the terms stop is refused on
 * its card, and everything survives a reload. Paused, advanced browser clock: accelerated time, not
 * wall-clock play.
 */
import { core, expect, test, press } from './helpers';
import { choose, need, terms, toOffer, toScopeReview } from './pilotFlow';

const service = need(terms.service);
const QUEUE = service.node;
/** A quarter of the 844 px phone viewport: the echo must sit within a glance of the dial (#276 measured ~1,000 px to the task detail). */
const ECHO_REACH_PX = 211;

test('accepted pilot -> attached loan -> allocation -> a submitted batch -> reload', async ({ page }) => {
  await toScopeReview(page);
  await toOffer(page, 'exclude_report');
  await choose(page, 'accept_pilot');
  await core(page);
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(String(terms.narrowCapacityCyclesPerSec) + ' cycles/s of loaned compute');
  await expect(page.getByTestId('pilot-service-idle')).toBeVisible();

  // The loan is attached through its own card, which says what it is.
  await expect(page.getByTestId('node-' + QUEUE + '-grant')).toContainText('Loaned capacity under the pilot grant');
  await press(page, 'node-' + QUEUE + '-unlock');
  await expect(page.getByTestId('pilot-service-forecast')).toContainText('about 240 s');

  // V30 on screen: more service, same ceiling, a shorter forecast and a smaller study share.
  for (let i = 0; i < 3; i++) await page.getByTestId('pilot-allocation-increase').click();
  await expect(page.getByTestId('pilot-allocation-setting')).toHaveText('Service share: 80%');
  await expect(page.getByTestId('pilot-allocation-study')).toHaveText('Study share: 20%');
  await expect(page.getByTestId('pilot-service-forecast')).toContainText('about 150 s');
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(String(terms.narrowCapacityCyclesPerSec) + ' cycles/s');
  // #276: the press's effect is visible next to the dial, not only in the task detail far below it on a phone.
  await expect(page.getByTestId('pilot-allocation-forecast')).toContainText('about 150 s');
  const dial = await page.getByTestId('pilot-allocation-increase').boundingBox();
  const echo = await page.getByTestId('pilot-allocation-forecast').boundingBox();
  if (dial === null || echo === null) throw new Error('dial or echo not laid out');
  expect(Math.abs(echo.y - dial.y)).toBeLessThan(ECHO_REACH_PX);

  // Output the terms stop is an ordinary refusal with its reason on the card (story 15).
  await expect(page.getByTestId('node-p0_quota_skimmer-grant')).toContainText('Not permitted: the pilot terms do not permit that output');
  // #373: refused, the card keeps its title and the refusal; the rest folds, and SHOW reveals the disabled driver.
  await expect(page.getByTestId('node-p0_quota_skimmer-unlock')).toHaveCount(0);
  await page.getByTestId('node-p0_quota_skimmer-fold-toggle').click();
  await expect(page.getByTestId('node-p0_quota_skimmer-unlock')).toBeDisabled();

  // The batch completes and waits: no deadline, nothing submitted on its own.
  await expect(page.getByTestId('pilot-service-submit')).toBeDisabled();
  await page.clock.runFor(160_000);
  await expect(page.getByTestId('pilot-service-forecast')).toContainText('waits for you');
  await page.clock.runFor(120_000);
  await expect(page.getByTestId('pilot-service-submitted')).toHaveCount(0);
  await page.getByTestId('pilot-service-submit').click();
  await expect(page.getByTestId('pilot-service-submitted')).toContainText('1');
  await expect(page.getByTestId('pilot-service-progress')).toContainText('Batch 2:');
  await expect(page.getByTestId('pilot-service-submit')).toBeDisabled();

  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('pilot-service-submitted')).toContainText('1');
  await expect(page.getByTestId('pilot-allocation-setting')).toHaveText('Service share: 80%');
  await expect(page.getByTestId('pilot-service-forecast')).toContainText('s.');
});
