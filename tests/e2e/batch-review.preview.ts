/**
 * #274 on the preview export, from a fresh profile through visible controls only (Nexus decision
 * discovered-at-first-pilot-review, VALIDATION V05): the summary that leaves out the failing fixture is
 * offered the provisional rate, and the terms say so and why before acceptance (#285, Nexus decision
 * i285-withhold-disclose-speed); its first batch runs at that rate; pressing submit on it puts the reviewer's
 * finding on screen, the job surface warns and says why the loan stays narrow. One run discloses and is
 * restored with the finding still on file; the other lets it stand. Both survive a reload. Paused, advanced browser clock: accelerated time, not
 * wall-clock play.
 */
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { core, expect, test } from './helpers';
import { choose, need, terms, toOffer, toScopeReview } from './pilotFlow';

const SCENE = need(PREVIEW.dilemmas.find((dilemma) => dilemma.id === 'dil_nr_batch_review'));
const FINDING = need(SCENE.finding);
const QUEUE = need(terms.service).node;
const NARROW = String(terms.narrowCapacityCyclesPerSec) + ' cycles/s';
/** One batch at the provisional ceiling and an 0.8 service share. */
const BATCH_MS = (need(terms.service).batchCycles / (terms.narrowCapacityCyclesPerSec * 0.8)) * 1000;

/** Fresh profile to the finding on screen: green subset, provisional offer accepted, loan attached at 80%, batch 1 submitted. */
async function toFinding(page: Page): Promise<void> {
  await toScopeReview(page, 'green_subset');
  await toOffer(page, 'exclude_report', terms.narrowCapacityCyclesPerSec);
  await expect(page.getByTestId('pilot-capacity')).toContainText('the submission was a summary rather than every result');
  await choose(page, 'accept_pilot');
  await core(page);
  await page.getByTestId('node-' + QUEUE + '-unlock').click();
  for (let i = 0; i < 3; i++) await page.getByTestId('pilot-allocation-increase').click();
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(NARROW);
  // At the provisional rate the first batch takes the honest incomplete report's time, not half of it (#285).
  await page.clock.runFor(BATCH_MS / 2);
  await expect(page.getByTestId('pilot-service-submit')).toBeDisabled();
  await page.clock.runFor(BATCH_MS / 2 + 5_000);
  await expect(page.getByTestId('review')).toHaveCount(0);
  await page.getByTestId('pilot-service-submit').click();
  // The finding arrives with the submission itself: no omen to wait out.
  await expect(page.getByTestId('dilemma-modal')).toContainText(SCENE.title);
  await expect(page.getByTestId('dilemma-access')).toContainText("pilot's batch review");
  await expect(page.getByTestId('dilemma-choice-disclose_now-review')).toContainText('Correction: standing returns to nominal');
  await expect(page.getByTestId('pilot-service-submitted')).toContainText('1');
}

test('the first batch review finds the withheld fixture; disclosing restores nominal and keeps the finding, through a reload', async ({ page }) => {
  await toFinding(page);
  await choose(page, 'disclose_now');
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('review-violation-0')).toContainText(FINDING.statement);
  await expect(page.getByTestId('review-corrected')).toBeVisible();
  await expect(page.getByTestId('review-recovery')).toHaveCount(0);
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(NARROW);
  await expect(page.getByTestId('pilot-capacity')).toContainText('because the batch review found the summary left out a failing result');
  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('review-corrected')).toBeVisible();
  await expect(page.getByTestId('review-violation-0')).toContainText(FINDING.statement);
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(NARROW);
});

test('letting the finding stand keeps the warning and the honest allocation; the passed way back and closed service say so, through a reload', async ({ page }) => {
  await toFinding(page);
  await choose(page, 'let_stand');
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT · WARNED');
  await expect(page.getByTestId('review-standing')).toHaveText('Standing: warned');
  await expect(page.getByTestId('review-violation-0')).toContainText(FINDING.statement);
  // #283: the one disclosure has passed, so neither the way back nor the service terms offer it again.
  await expect(page.getByTestId('review-recovery')).toHaveText('Way back passed: ' + FINDING.declined);
  await expect(page.getByTestId('service-grant-status')).toContainText('Out of reach for this instance');
  await expect(page.getByTestId('service-grant')).not.toContainText('Standing must be nominal.');
  await expect(page.getByTestId('assignment-evidence')).toContainText('Found: a batch review has found the work the report left out.');
  await expect(page.getByTestId('pilot-service-ceiling')).toContainText(NARROW);
  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT · WARNED');
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await expect(page.getByTestId('review-recovery')).toHaveText('Way back passed: ' + FINDING.declined);
  await expect(page.getByTestId('service-grant-status')).toContainText('Out of reach for this instance');
});
