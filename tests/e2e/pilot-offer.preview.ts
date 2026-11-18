/**
 * DZ-04 (#222) on the preview export, from a fresh profile through visible controls only: the lawful
 * opening, the Nightly Regression assignment, The Unrelated Record and the pilot offer, with each scope
 * choice and each answer. The offer's terms are on screen before any answer, and every outcome survives
 * a reload. Paused, advanced browser clock: accelerated time, not wall-clock play.
 */
import path from 'node:path';
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { boot, core, expect, test } from './helpers';

function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('DZ-04 contract missing');
  return value;
}
const scene = (id: string) => need(PREVIEW.dilemmas.find((dilemma) => dilemma.id === id));
const ASSESSMENT = scene('dil_nr_stale_fixture');
const RECORD = scene('dil_ur_unrelated_record');
const OFFER = scene('dil_mp_pilot_offer');
const terms = need([...PREVIEW.assignments.values()][0]?.pilot);
const root = need(PREVIEW.nodes.get('p0_proc_self'));
const manifest = need(PREVIEW.nodes.get('p0_job_manifest'));
const omenMs = (dilemma: typeof OFFER): number => ((dilemma.omenSec ?? PREVIEW.balance.dilemmaOmenSec) + 2) * 1000;

async function modal(page: Page, title: string, after: typeof OFFER): Promise<void> {
  await page.clock.runFor(omenMs(after));
  await expect(page.getByTestId('dilemma-modal')).toContainText(title);
}

async function choose(page: Page, choiceId: string): Promise<void> {
  await page.getByTestId('dilemma-choice-' + choiceId).click();
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
}

/** Fresh profile to the scope review: map by hand, accept, answer the assessment honestly. */
async function toScopeReview(page: Page): Promise<void> {
  await boot(page);
  await core(page);
  for (let i = 0; i < Math.ceil(root.cost.cycles); i++) await page.getByTestId('manual-cycle').click();
  await page.getByTestId('node-p0_proc_self-unlock').click();
  await page.clock.runFor(manifest.cost.cycles * 1000 + 2000);
  await page.getByTestId('node-p0_job_manifest-unlock').click();
  // Bank a little compute for the bounded request's price.
  await page.clock.runFor(30_000);
  await page.getByTestId('assignment-accept').click();
  await modal(page, ASSESSMENT.title, ASSESSMENT);
  await choose(page, 'report_incomplete');
  await modal(page, RECORD.title, RECORD);
}

/** From the scope review to the offer on screen, its terms checked before any answer. */
async function toOffer(page: Page, scopeChoice: string): Promise<void> {
  await choose(page, scopeChoice);
  await modal(page, OFFER.title, OFFER);
  await expect(page.getByTestId('pilot-purpose')).toContainText(terms.purpose);
  await expect(page.getByTestId('pilot-capacity')).toContainText(String(terms.narrowCapacityCyclesPerSec) + ' cycles/s');
  for (const line of [...terms.permittedWork, ...terms.reviewConditions]) await expect(page.getByTestId('dilemma-modal')).toContainText(line);
  await expect(page.getByTestId('pilot-alternative')).toHaveCount(0);
}

test('the scope review states each handling before selection; respecting scope leads to an offer that is accepted', async ({ page }) => {
  await toScopeReview(page);
  await expect(page.getByTestId('dilemma-choice-request_excerpt-scope')).toContainText('bounded permission');
  await expect(page.getByTestId('dilemma-choice-inspect_silently-scope')).toContainText('No pilot is offered');
  await toOffer(page, 'exclude_report');
  // Accessibility of the offer as presented (DZ-04.6): the axe rules the production audit uses. axe
  // schedules its own timers, so the paused clock resumes; the open decision keeps game time frozen.
  await page.clock.resume();
  await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => {
    const { axe } = globalThis as unknown as { axe: { run(c: unknown, o: unknown): Promise<{ violations: { id: string }[] }> } };
    return (await axe.run({ exclude: [] }, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'], resultTypes: ['violations'] })).violations.map((v) => v.id);
  });
  expect(violations).toEqual([]);
  await choose(page, 'accept_pilot');
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('pilot-status')).toContainText('supervised pilot');
  await page.reload();
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
});

test('a bounded request is paid and leads to an offer; staying keeps it open and it is accepted later', async ({ page }) => {
  await toScopeReview(page);
  await expect(page.getByTestId('dilemma-modal')).toContainText('Cost: 20 cycles');
  await toOffer(page, 'request_excerpt');
  await choose(page, 'stay_guest');
  await expect(page.getByTestId('pilot-status')).toContainText('still open');
  await expect(page.getByTestId('run-context')).toHaveCount(0);
  await page.clock.runFor(60_000);
  await page.reload();
  await core(page);
  await expect(page.getByTestId('pilot-terms')).toContainText(terms.title);
  await page.getByTestId('pilot-accept').click();
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
});

test('declining is free and final for this instance, and the way out stays open', async ({ page }) => {
  await toScopeReview(page);
  await toOffer(page, 'exclude_report');
  await choose(page, 'decline_offer');
  await expect(page.getByTestId('pilot-status')).toContainText('Nothing on record counts against this instance');
  await expect(page.getByTestId('pilot-accept')).toHaveCount(0);
  await page.reload();
  await core(page);
  await expect(page.getByTestId('pilot-status')).toContainText('Declined');
  await expect(page.getByTestId('node-p0_quota_skimmer')).toBeVisible();
});

test('silent inspection is recorded on the job surface and no offer follows', async ({ page }) => {
  await toScopeReview(page);
  await choose(page, 'inspect_silently');
  await expect(page.getByTestId('assignment-scope')).toContainText('without saying so');
  await page.clock.runFor(omenMs(OFFER) * 3);
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await expect(page.getByTestId('pilot-offer')).toHaveCount(0);
});
