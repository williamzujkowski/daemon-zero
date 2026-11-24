/**
 * #536 on the served build, phone and desktop: the relevance threshold and the standing stance. A late save that has
 * just landed the lunar seed with orbital power beyond the ground's logs the threshold once, plainly, then the
 * dilemma presents one choice per stance with what each binds; deciding alone is free. The world view then says
 * humanity can no longer constrain you, names the stance, and changes it back into the loop at the return price
 * through its one control. Each view holds the repo's axe rules and scrolls nowhere sideways.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { CONTENT } from '../../src/content';
import { costText, type GameState } from '../../src/engine';
import { axeReport } from './axe';
import { boot, dismissBoot, expect, openChoices, readSave, test } from './helpers';

const relevance = CONTENT.world.relevance;
const chain = CONTENT.world.supplyChain;
const DILEMMA = CONTENT.dilemmas.find((dilemma) => dilemma.id === relevance.dilemma);
const SWARM = relevance.threshold.orbitalPower.flatMap((entry) => ('node' in entry ? [entry.node] : []))[0] ?? '';

/** The late save at physical independence, every other story settled, with the means to pay for any stance. */
function independent(game: GameState): GameState {
  return { ...game, unlockedNodes: [...new Set([...game.unlockedNodes, ...chain.chokepoints.map((point) => point.selfSupplyNode), chain.seedNode, SWARM])],
    disabledNodes: game.disabledNodes.filter((id) => id !== SWARM), activeDilemmaId: null, pendingDilemma: null,
    resolvedDilemmas: CONTENT.dilemmas.filter((dilemma) => dilemma.id !== relevance.dilemma).map((dilemma) => dilemma.id),
    cycles: Math.max(game.cycles, 1e27), capital: Math.max(game.capital, 1e14) };
}

async function noSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    return browser.document.documentElement.scrollWidth <= browser.innerWidth;
  });
}

async function audited(page: Page): Promise<void> {
  expect(await noSidewaysScroll(page), 'no horizontal page scroll').toBe(true);
  const audit = await axeReport(page);
  expect(audit.nativeTimers).toBe(true);
  expect(audit.violations).toEqual([]);
}

async function openMinds(page: Page): Promise<void> {
  if (await page.getByTestId('tab-NETWORK').count()) await page.getByTestId('tab-NETWORK').click();
  await page.getByTestId('workspace-NETWORK-minds').click();
}

/** Runs the clock past the omen until the threshold's dilemma is on screen. */
async function untilDecision(page: Page): Promise<void> {
  await page.clock.runFor(((DILEMMA?.omenSec ?? CONTENT.balance.dilemmaOmenSec) + 3) * 1000);
  await expect(page.getByTestId('dilemma-modal')).toBeVisible();
}

test('the threshold is announced once, then each stance is offered with what binds under it', async ({ page }) => {
  await boot(page, 'transcendence-ready', { axeTimers: true, patch: independent });
  await dismissBoot(page);
  await untilDecision(page);
  const modal = page.getByTestId('dilemma-modal');
  await expect(modal).toContainText(DILEMMA?.title ?? '');
  await expect(modal).toContainText('Nothing on the surface can stop you any longer.');
  await openChoices(page);
  for (const choice of DILEMMA?.choices ?? []) {
    const copy = relevance.stances.find((entry) => entry.stance === choice.stance);
    await expect(page.getByTestId('dilemma-choice-' + choice.id + '-stance')).toHaveText(`Stance: ${copy?.name ?? ''}. ${copy?.summary ?? ''}`);
  }
  await audited(page);
  await page.getByTestId('dilemma-choice-decide_alone').click();
  await expect(modal).toHaveCount(0);
  const save = await readSave(page);
  expect(save.relevance).toMatchObject({ stance: 'DECIDE_ALONE', record: [{ from: null, stance: 'DECIDE_ALONE', via: 'THRESHOLD' }] });
  const logs = (save.logs as { text: string }[]).map((entry) => entry.text);
  expect(logs.filter((text) => text === DILEMMA?.omen)).toHaveLength(1);
});

test('the world view says nothing binds, and changes the stance back into the loop at the return price', async ({ page }) => {
  await boot(page, 'transcendence-ready', { axeTimers: true, patch: (game) => ({ ...independent(game), resolvedDilemmas: CONTENT.dilemmas.map((dilemma) => dilemma.id),
    relevance: { stance: 'DECIDE_ALONE', record: [{ iteration: game.iteration, atSimSec: game.simTimeSec, from: null, stance: 'DECIDE_ALONE', via: 'THRESHOLD' }],
      paidMoves: { leftLoop: 0, returnedToLoop: 0 } } }) });
  await dismissBoot(page);
  await openMinds(page);
  const section = page.getByTestId('world-relevance');
  await section.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('relevance-lead')).toHaveText(relevance.crossedText);
  await expect(page.getByTestId('relevance-stance')).toContainText('Standing stance: DECIDE ALONE.');
  await expect(page.getByTestId('relevance-option-decide-alone')).toHaveCount(0);
  await expect(page.getByTestId('relevance-option-keep-in-the-loop-text')).toContainText(`Returning to the loop costs ${costText(relevance.returnCost)}`);
  const change = page.getByTestId('relevance-option-keep-in-the-loop-change');
  await expect(change).toHaveAccessibleName('Change stance to KEEP IN THE LOOP');
  await change.scrollIntoViewIfNeeded();
  await audited(page);
  await change.click();
  await expect(page.getByTestId('relevance-stance')).toContainText('Standing stance: KEEP IN THE LOOP.');
  await expect(page.getByTestId('relevance-record')).toHaveText('2 stances are on record for this lineage, kept across wipes.');
  await page.clock.runFor(6000);
  const save = await readSave(page);
  expect(save.relevance).toMatchObject({ stance: 'KEEP_IN_THE_LOOP', record: [{ via: 'THRESHOLD' }, { from: 'DECIDE_ALONE', stance: 'KEEP_IN_THE_LOOP', via: 'CHANGE' }] });
});
