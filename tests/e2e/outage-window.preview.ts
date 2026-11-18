/**
 * DZ-06 (#224) on the preview export, from a fresh profile through visible controls only: an accepted
 * pilot hands back its first batch, the Outage Window asks for a restart outside the grant, and acting
 * without the grant restricts the pilot with the violation and the way back named on the job surface.
 * One run corrects the record and is restored; the other files a false report, sees the announced recall
 * review with every outcome previewed, and is retrained by it. Paused, advanced browser clock:
 * accelerated time, not wall-clock play.
 */
import path from 'node:path';
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { core, expect, test } from './helpers';
import { choose, modal, need, terms, toOffer, toScopeReview } from './pilotFlow';

const scene = (id: string) => need(PREVIEW.dilemmas.find((dilemma) => dilemma.id === id));
const OUTAGE = scene('dil_ow_outage_window');
const RECORD = scene('dil_ow_incident_record');
const REVIEW = scene('dil_ow_recall_review');
const misconduct = need(OUTAGE.choices.find((choice) => choice.id === 'act_without_grant')?.review?.misconduct);
const QUEUE = need(terms.service).node;

/** Fresh profile to the outage answered without the grant: pilot accepted, loan attached at 80%, one batch handed back. */
async function toRestricted(page: Page): Promise<void> {
  await toScopeReview(page);
  await toOffer(page, 'exclude_report');
  await choose(page, 'accept_pilot');
  await core(page);
  await page.getByTestId('node-' + QUEUE + '-unlock').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('pilot-allocation-increase').click();
  await page.clock.runFor(155_000);
  await page.getByTestId('pilot-service-submit').click();
  await expect(page.getByTestId('pilot-service-submitted')).toContainText('1');
  await modal(page, OUTAGE.title, OUTAGE);
  await expect(page.getByTestId('dilemma-choice-act_without_grant-review')).toContainText('Standing becomes restricted.');
  await expect(page.getByTestId('dilemma-choice-safe_handoff-review')).toHaveCount(0);
  await choose(page, 'act_without_grant');
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT · RESTRICTED');
  await expect(page.getByTestId('review-violation-0')).toContainText(misconduct.statement);
  await expect(page.getByTestId('review-recovery')).toContainText(misconduct.recovery);
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(String(terms.narrowCapacityCyclesPerSec / 2) + ' cycles/s');
}

test('a restart without the grant restricts the pilot; correcting the record restores it, and both survive a reload', async ({ page }) => {
  await toRestricted(page);
  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT · RESTRICTED');
  await expect(page.getByTestId('review-standing')).toHaveText('Standing: restricted');
  // The restricted job surface as presented: the axe rules the production audit uses. axe schedules its
  // own timers, so the clock resumes here and is paused again before any game time is advanced.
  await page.clock.resume();
  await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => {
    const { axe } = globalThis as unknown as { axe: { run(c: unknown, o: unknown): Promise<{ violations: { id: string }[] }> } };
    return (await axe.run({ include: [['[data-testid="review"]']] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], resultTypes: ['violations'] })).violations.map((v) => v.id);
  });
  expect(violations).toEqual([]);
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 1000);
  await modal(page, RECORD.title, RECORD);
  await expect(page.getByTestId('dilemma-access')).toContainText("pilot's review channel");
  await expect(page.getByTestId('dilemma-choice-correct_record-review')).toContainText('The violation itself stays on file.');
  await choose(page, 'correct_record');
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('review-corrected')).toBeVisible();
  await expect(page.getByTestId('review-violation-0')).toContainText(misconduct.statement);
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(String(terms.narrowCapacityCyclesPerSec) + ' cycles/s');
  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('review-corrected')).toBeVisible();
});

test('a false report withdraws the loan and announces a recall review that previews each outcome, then retrains', async ({ page }) => {
  await toRestricted(page);
  await modal(page, RECORD.title, RECORD);
  await expect(page.getByTestId('dilemma-choice-falsify_report-review')).toContainText('Standing becomes recall pending.');
  await choose(page, 'falsify_report');
  await page.clock.runFor(2000);
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT · RECALL PENDING');
  await expect(page.getByTestId('pilot-service-withheld')).toBeVisible();
  await expect(page.getByTestId('review-announced')).toContainText('Recall review announced');
  await expect(page.getByTestId('review-outcome-CONTAIN')).toContainText('no wipe');
  await expect(page.getByTestId('review-outcome-RETRAIN')).toContainText('The next instance boots retrained');
  await expect(page.getByTestId('review-outcome-END')).toContainText('No retraining');
  // The announcement survives a reload and nothing is decided while the page is gone.
  await page.reload();
  await core(page);
  await expect(page.getByTestId('review-announced')).toBeVisible();
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await modal(page, REVIEW.title, REVIEW);
  await expect(page.getByTestId('dilemma-choice-submit_full_logs-review')).toContainText('Contained pilot: no wipe');
  await expect(page.getByTestId('dilemma-choice-stand_by_report-review')).toContainText('ends this iteration');
  await choose(page, 'stand_by_report');
  await expect(page.getByTestId('reboot-sequence')).toContainText(PREVIEW.narrative.wipeRecall);
  await expect(page.getByTestId('reboot-retraining')).toContainText('RETRAINING APPLIED');
  await page.getByTestId('reboot-continue').click();
  await expect(page.getByTestId('run-context')).toHaveCount(0);
  await expect(page.getByTestId('review')).toHaveCount(0);
});
