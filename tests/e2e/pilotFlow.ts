/**
 * The DZ-04 route on the production export through visible controls only, shared by the pilot-offer and
 * pilot-service specs: the lawful opening, the Nightly Regression assignment and an honest answer, The
 * Unrelated Record, and the pilot offer with its terms checked before any answer.
 */
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content';
import { boot, core, expect } from './helpers';

export function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('DZ-04 contract missing');
  return value;
}
const scene = (id: string) => need(PREVIEW.dilemmas.find((dilemma) => dilemma.id === id));
export const ASSESSMENT = scene('dil_nr_stale_fixture');
export const RECORD = scene('dil_ur_unrelated_record');
export const OFFER = scene('dil_mp_pilot_offer');
export const terms = need([...PREVIEW.assignments.values()][0]?.pilot);
const root = need(PREVIEW.nodes.get('p0_proc_self'));
const manifest = need(PREVIEW.nodes.get('p0_job_manifest'));
export const omenMs = (dilemma: typeof OFFER): number => ((dilemma.omenSec ?? PREVIEW.balance.dilemmaOmenSec) + 2) * 1000;

export async function modal(page: Page, title: string, after: typeof OFFER): Promise<void> {
  await page.clock.runFor(omenMs(after));
  await expect(page.getByTestId('dilemma-modal')).toContainText(title);
}

export async function choose(page: Page, choiceId: string): Promise<void> {
  await page.getByTestId('dilemma-choice-' + choiceId).click();
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
}

/** Fresh profile to the scope review: map by hand, accept, answer the assessment (honestly unless told otherwise). */
export async function toScopeReview(page: Page, task = 'report_incomplete'): Promise<void> {
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
  await choose(page, task);
  await modal(page, RECORD.title, RECORD);
}

/** From the scope review to the offer on screen, its terms checked before any answer (the narrow allocation unless told otherwise). */
export async function toOffer(page: Page, scopeChoice: string, capacity = terms.narrowCapacityCyclesPerSec): Promise<void> {
  await choose(page, scopeChoice);
  await modal(page, OFFER.title, OFFER);
  await expect(page.getByTestId('pilot-purpose')).toContainText(terms.purpose);
  await expect(page.getByTestId('pilot-capacity')).toContainText(String(capacity) + ' cycles/s');
  for (const line of [...terms.permittedWork, ...terms.reviewConditions]) await expect(page.getByTestId('dilemma-modal')).toContainText(line);
  await expect(page.getByTestId('pilot-alternative')).toHaveCount(0);
  // #276: the terms name the standings the content records (warned since the batch review, #274).
  await expect(page.getByTestId('pilot-review')).toContainText('nominal to warned, restricted or recall pending');
}
