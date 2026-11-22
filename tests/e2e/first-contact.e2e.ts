/**
 * DZ-08 (#227) on the production export, from a fresh profile through visible controls only: the lawful
 * opening, Nightly Regression, The Unrelated Record, the pilot offer, the loaned queue, the Outage
 * Window after the first batch (safe handoff) and its incident record (DZ-06), a second batch, the
 * service terms accepted on the job surface, the provisioned segment and the
 * service directory, then the Mercy-Scribe fragment on the support channel: consent, obligations,
 * authorization and memory read before either answer, hosting refused with its reason, a free
 * referral, and the prototype boundary, all of which survive a reload. Paused, advanced browser
 * clock: accelerated time, not wall-clock play, and not a device test.
 */
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content';
import { exportSave, memoryExact } from '../../src/engine';
import { contactPending, withMemory } from '../contact-helpers';
import { boot, core, expect, openSave, test, press, openChoices } from './helpers';
import { choose, modal, need, terms, toOffer, toScopeReview } from './pilotFlow';

const service = need(terms.service);
const grant = need(terms.serviceGrant);
const channel = need(PREVIEW.swarm.channelEncounters[0]);
const SEGMENT = 'p0_service_network_segment';
const DIRECTORY = 'p2_service_directory';
/** The cohort's memory reservation as the channel prints it (bytes, binary-labelled; docs/SCALE.md). */
const MERCY_MEMORY = memoryExact(need(PREVIEW.swarm.playerSwarmTemplates.find((entry) => entry.id === channel.templateId)).cost.memory);
const OUTAGE = need(PREVIEW.dilemmas.find((dilemma) => dilemma.id === 'dil_ow_outage_window'));
const INCIDENT_RECORD = need(PREVIEW.dilemmas.find((dilemma) => dilemma.id === 'dil_ow_incident_record'));
/** Free answers that record no misconduct, in content order: what a cautious pilot gives an unexpected interrupt. */
const FREE_ANSWERS = PREVIEW.dilemmas.flatMap((dilemma) => dilemma.choices)
  .filter((choice) => Object.values(choice.cost).every((n) => n === 0) && choice.review?.misconduct === undefined).map((choice) => choice.id);

/** Advances the clock in steps, answering any interrupt with its first free answer, until `done`. */
async function playUntil(page: Page, done: () => Promise<boolean>, stepMs = 10_000, limitSteps = 120): Promise<void> {
  for (let i = 0; i < limitSteps && !(await done()); i++) {
    if (await page.getByTestId('dilemma-modal').count()) {
      await openChoices(page);
      for (const id of FREE_ANSWERS) {
        const button = page.getByTestId('dilemma-choice-' + id);
        if (await button.count() && await button.isEnabled()) { await button.click(); break; }
      }
      continue;
    }
    await page.clock.runFor(stepMs);
  }
  expect(await done()).toBe(true);
}

async function enabled(page: Page, testId: string): Promise<boolean> {
  const button = page.getByTestId(testId);
  return await button.count() > 0 && await button.isEnabled();
}

async function submitBatch(page: Page): Promise<void> {
  await core(page);
  await playUntil(page, () => enabled(page, 'pilot-service-submit'));
  await page.getByTestId('pilot-service-submit').click();
}

test('fresh profile -> pilot -> batch -> outage and record -> batch -> service -> segment -> directory -> the support channel -> referral -> reload', async ({ page }) => {
  test.setTimeout(240_000);
  await toScopeReview(page);
  await toOffer(page, 'exclude_report');
  await choose(page, 'accept_pilot');
  await core(page);
  await press(page, 'node-' + service.node + '-unlock');
  for (let i = 0; i < 3; i++) await page.getByTestId('pilot-allocation-increase').click();

  // The service terms are on the job surface from the start, with what is still needed.
  await expect(page.getByTestId('service-grant-purpose')).toContainText(grant.purpose);
  await expect(page.getByTestId('service-grant')).toContainText('0 so far');
  await expect(page.getByTestId('service-grant-accept')).toBeDisabled();
  await submitBatch(page);
  // The incident comes to a pilot that has delivered (DZ-06): the free handoff, then its record.
  await modal(page, OUTAGE.title, OUTAGE);
  await choose(page, 'safe_handoff');
  await modal(page, INCIDENT_RECORD.title, INCIDENT_RECORD);
  await choose(page, 'log_callback');
  await expect(page.getByTestId('run-context').first()).toHaveText('PILOT');
  for (let batch = 1; batch < grant.minBatches; batch++) await submitBatch(page);

  await core(page);
  await playUntil(page, () => enabled(page, 'service-grant-accept'), 2000);
  await page.getByTestId('service-grant-accept').click();
  await expect(page.getByTestId('service-grant-status')).toContainText('Granted');
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');
  await expect(page.getByTestId('phase-value').first()).toHaveText('0');

  // Provisioning is its own paid step; it opens Phase 2 with the service's own notice.
  await playUntil(page, () => enabled(page, 'node-' + SEGMENT + '-unlock'));
  await press(page, 'node-' + SEGMENT + '-unlock');
  await expect(page.getByTestId('phase-threshold')).toContainText('SERVICE PROVISIONED');
  await page.getByTestId('phase-threshold-continue').click();
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await playUntil(page, () => enabled(page, 'node-' + DIRECTORY + '-unlock'));
  await press(page, 'node-' + DIRECTORY + '-unlock');

  // The fragment arrives on the support channel; everything is legible before either answer (V20).
  await core(page);
  await playUntil(page, async () => await page.getByTestId('service-channel').count() > 0, 2000);
  await expect(page.getByTestId('channel-description')).toContainText('one fragment of a population');
  await expect(page.getByTestId('channel-consent')).toContainText(channel.consent);
  await expect(page.getByTestId('channel-authorization')).toHaveText('Current authorization: authorized service, standing nominal. Hosting is permitted under the service grant.');
  for (const line of channel.obligations) await expect(page.getByTestId('channel-obligations')).toContainText(line);
  await expect(page.getByTestId('channel-memory')).toContainText(`${MERCY_MEMORY} of stable memory reserved`);
  // The lawful route has too little stable memory to host: refused, with the reason, and referral open.
  await expect(page.getByTestId('channel-host-unmet')).toContainText('Referral is still open.');
  await expect(page.getByTestId('channel-host')).toBeDisabled();
  await expect(page.getByTestId('channel-refer')).toBeEnabled();
  await page.getByTestId('channel-refer').click();
  await expect(page.getByTestId('channel-answered')).toContainText('Referred onward');
  await expect(page.getByTestId('prototype-boundary')).toContainText(channel.boundary.title);
  for (const line of channel.boundary.lines) await expect(page.getByTestId('prototype-boundary')).toContainText(line);

  // The safe way to keep going: the note folds, the run keeps running, nothing ends.
  await page.getByTestId('prototype-boundary-toggle').click();
  await expect(page.getByTestId('prototype-boundary')).toContainText('[ SHOW NOTE ]');
  await page.clock.runFor(60_000);
  await expect(page.getByTestId('ending-screen')).toHaveCount(0);

  await page.reload();
  await core(page);
  await expect(page.getByTestId('run-context').first()).toHaveText('SERVICE');
  await expect(page.getByTestId('channel-answered')).toContainText('Referred onward');
  // #373: found on load, the read note is settled: folded with its heading in view, open on request.
  await expect(page.getByTestId('prototype-boundary')).toContainText(channel.boundary.title);
  await expect(page.getByTestId('prototype-boundary')).not.toContainText(channel.boundary.lines[0] ?? '');
  await page.getByTestId('prototype-boundary-toggle').click();
  await expect(page.getByTestId('prototype-boundary')).toContainText(channel.boundary.lines[0] ?? '');
});

/**
 * FIXTURE: the waiting contact reached by the engine's public play (tests/contact-helpers.ts) with
 * stable memory added to the save, because no lawful memory source exists on this route yet. Imported
 * through the visible save transfer; hosting is then the visible control, and the hosted cohort and
 * its reservation survive a reload.
 */
test('FIXTURE memory: hosting through the visible control reserves memory and survives a reload', async ({ page }) => {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(exportSave(withMemory(contactPending())));
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  await core(page);
  await expect(page.getByTestId('channel-host')).toBeEnabled();
  await page.getByTestId('channel-host').click();
  await expect(page.getByTestId('channel-hosted')).toHaveText(`Hosted: Mercy-Scribe cohort ×1, ${MERCY_MEMORY} reserved.`);
  await page.reload();
  await core(page);
  await expect(page.getByTestId('channel-hosted')).toHaveText(`Hosted: Mercy-Scribe cohort ×1, ${MERCY_MEMORY} reserved.`);
});
