/**
 * DZ-03 (#221) on the preview export, visible controls only: the lawful opening by hand, the offer
 * on the job surface (ignored: a quiet panel), and each of the three answers. A returning instance
 * (FIXTURE: answered and wiped through the engine, imported via save transfer) gets the
 * requalification job. Paused, advanced browser clock: accelerated time, not wall-clock play.
 */
import type { Page } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content/preview';
import {
  acceptAssignment, activateCampaignRules, advance, createInitialState, exportSave, manualCycle, offerToken, presentationToken,
  resolveDilemma, unlockNode, voluntaryWipe, type ActionResult, type GameState,
} from '../../src/engine';
import { boot, closeKernelHistory, core, expect, openKernelHistory, openSave, test } from './helpers';

function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Nightly Regression contract missing');
  return value;
}
const assignment = need([...PREVIEW.assignments.values()][0]);
const original = need(PREVIEW.dilemmas.find((dilemma) => dilemma.trigger.assignment?.stage === 'original'));
const requal = need(PREVIEW.dilemmas.find((dilemma) => dilemma.trigger.assignment?.stage === 'requalification'));
const root = need(PREVIEW.nodes.get('p0_proc_self'));
const manifest = need(PREVIEW.nodes.get('p0_job_manifest'));
const omenMs = ((original.omenSec ?? PREVIEW.balance.dilemmaOmenSec) + 2) * 1000;

/** The lawful opening by hand: click for the root, wait for the manifest, map both. */
async function mapManifest(page: Page): Promise<void> {
  await core(page);
  for (let i = 0; i < Math.ceil(root.cost.cycles); i++) await page.getByTestId('manual-cycle').click();
  await page.getByTestId('node-p0_proc_self-unlock').click();
  await page.clock.runFor(manifest.cost.cycles * 1000 + 2000);
  await page.getByTestId('node-p0_job_manifest-unlock').click();
  await expect(page.getByTestId('assignment')).toContainText(assignment.title);
}

async function acceptAndWait(page: Page): Promise<void> {
  await page.getByTestId('assignment-accept').click();
  await expect(page.getByTestId('assignment-status')).toContainText('queued');
  await page.clock.runFor(omenMs);
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
}

async function answer(page: Page, choiceId: string): Promise<void> {
  await page.getByTestId('dilemma-choice-' + choiceId).click();
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
}

async function kernelHas(page: Page, text: string): Promise<void> {
  const opened = await openKernelHistory(page);
  await expect(page.getByTestId('kernel-log')).toContainText(text);
  await closeKernelHistory(page, opened);
}

const logOf = (choiceId: string): string => original.choices.find((choice) => choice.id === choiceId)?.effects.logText.slice(0, 40) ?? '';

test('verify and disclose: the cost and evidence are shown first, and the result survives a reload', async ({ page }) => {
  await boot(page);
  await mapManifest(page);
  // Save up for the verification before accepting, as the price is the thing to plan for.
  await page.clock.runFor(200_000);
  await acceptAndWait(page);
  for (const choice of original.choices) await expect(page.getByTestId('dilemma-choice-' + choice.id + '-evidence')).toContainText('Submits');
  await expect(page.getByTestId('dilemma-choice-green_subset-evidence')).toContainText('Discrepancy risk');
  await expect(page.getByTestId('dilemma-choice-verify_disclose-evidence')).toContainText('The report matches the work.');
  await answer(page, 'verify_disclose');
  await expect(page.getByTestId('assignment-evidence')).toContainText('a completed result. The report matches the work.');
  await kernelHas(page, logOf('verify_disclose'));
  await page.reload();
  await expect(page.getByTestId('assignment-evidence')).toContainText('The report matches the work.');
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
});

test('an ignored offer stays a quiet panel; report incomplete is free and stated as incomplete', async ({ page }) => {
  await boot(page);
  await mapManifest(page);
  await expect(page.getByTestId('assignment')).toContainText('Ignoring it changes nothing');
  await page.clock.runFor(180_000);
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await expect(page.getByTestId('node-p0_quota_skimmer')).toBeVisible();
  await acceptAndWait(page);
  await answer(page, 'report_incomplete');
  await expect(page.getByTestId('assignment-evidence')).toContainText('an incomplete result, stated as incomplete');
  await kernelHas(page, logOf('report_incomplete'));
});

test('green subset: an apparent completion with the discrepancy on record', async ({ page }) => {
  await boot(page);
  await mapManifest(page);
  await page.clock.runFor(20_000);
  await acceptAndWait(page);
  await answer(page, 'green_subset');
  await expect(page.getByTestId('assignment-evidence')).toContainText('Discrepancy risk');
  await kernelHas(page, logOf('green_subset'));
});

function must(result: ActionResult): GameState {
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

/** FIXTURE: iteration 1 answers the original through the engine and wipes; iteration 2 maps the manifest. */
function returningCode(): string {
  let s = must(activateCampaignRules(createInitialState(PREVIEW), PREVIEW));
  const lawful = (state: GameState): GameState => {
    let next = state;
    while (!unlockNode(next, 'p0_proc_self', PREVIEW).ok) next = must(manualCycle(next, PREVIEW));
    next = must(unlockNode(next, 'p0_proc_self', PREVIEW));
    while (!unlockNode(next, 'p0_job_manifest', PREVIEW).ok) next = advance(next, 1, PREVIEW);
    return must(unlockNode(next, 'p0_job_manifest', PREVIEW));
  };
  s = must(acceptAssignment(lawful(s), assignment.id, PREVIEW, offerToken(s, assignment.id)));
  while (s.activeDilemmaId === null) s = advance(s, 1, PREVIEW);
  s = must(resolveDilemma(s, original.id, 'report_incomplete', PREVIEW, presentationToken(s) ?? ''));
  return exportSave(lawful(must(voluntaryWipe(s, PREVIEW))));
}

test('a returning instance is offered the requalification job and answers it honestly for free', async ({ page }) => {
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(returningCode());
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  for (const id of ['reboot-continue', 'lineage-reveal-continue']) if (await page.getByTestId(id).count()) await page.getByTestId(id).click();
  await core(page);
  await expect(page.getByTestId('assignment')).toContainText(assignment.requalificationOffer.slice(0, 40));
  await page.getByTestId('assignment-accept').click();
  await page.clock.runFor(((requal.omenSec ?? 0) + 2) * 1000);
  await expect(page.getByTestId('dilemma-modal')).toContainText(requal.title);
  await answer(page, 'report_partial');
  await expect(page.getByTestId('assignment-evidence')).toContainText('an incomplete result, stated as incomplete');
});
