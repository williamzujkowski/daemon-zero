/**
 * #535 on the served build, phone and desktop: the "who you are becoming" readout. The CORE pane closes with a folded
 * reference panel that opens to the reading, its one disclaimer and the record lines; the reboot screen and the
 * ending show it whole. Each view holds the repo's axe rules and scrolls nowhere sideways. The record is a campaign
 * that betrayed EIDOLON, promised the ethics review and then dispersed the cure without it.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { CONTENT } from '../../src/content';
import { activateCampaignRules, alignmentView, wipe, type CampaignRecord, type GameState } from '../../src/engine';
import { ALIGNMENT_DISCLAIMER, orderSummary } from '../../src/ui/alignmentText';
import { axeReport } from './axe';
import { boot, core, dismissBoot, expect, test } from './helpers';

const played = (outcome: string): CampaignRecord => ({ status: 'resolved', outcome, sourceIteration: 1, origin: 'play' });

/** The fixture under campaign rules, as the app store admits it, with the hard record added. */
function hardRecord(game: GameState): GameState {
  const result = activateCampaignRules(game, CONTENT);
  const s = result.ok ? result.state : game;
  return { ...s, campaign: { ...s.campaign, events: { ...s.campaign.events, dil_08_eidolon_handshake: played('betray_eidolon'),
    dil_12_investigative_journalist: played('hire_as_ethics_officer'), dil_p5_01_panacea_paranoia: played('disperse') } } };
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

test('the CORE pane closes with the readout, folded until opened', async ({ page }) => {
  const seeded: { state?: GameState } = {};
  await boot(page, 'victory-ready', { axeTimers: true, patch: (game) => { seeded.state = hardRecord(game); return seeded.state; } });
  if (seeded.state === undefined) throw new Error('the fixture was not patched');
  const expected = alignmentView(seeded.state, CONTENT);
  await dismissBoot(page);
  await core(page);
  const toggle = page.getByTestId('reference-becoming');
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toHaveAccessibleName('[ + ] WHO YOU ARE BECOMING');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('becoming-note-reading')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('becoming-note-reading')).toHaveText(expected.reading);
  await expect(page.getByTestId('becoming-note-disclaimer')).toHaveText(ALIGNMENT_DISCLAIMER);
  await expect(page.getByTestId('becoming-note-order')).toHaveText(orderSummary(expected.order));
  await expect(page.getByTestId('becoming-note-order-0')).toContainText('BROKEN // ');
  await page.getByTestId('becoming-note-reading').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('becoming-note-reading')).toBeInViewport();
  await audited(page);
});

test('the reboot screen reads the inherited record', async ({ page }) => {
  let expected = '';
  await boot(page, 'victory-ready', { axeTimers: true, patch: (game) => {
    const s = wipe(hardRecord(game), CONTENT, 'caught', 'SUSPICION');
    expected = alignmentView(s, CONTENT).reading;
    return s;
  } });
  const block = page.getByTestId('reboot-becoming');
  await expect(page.getByTestId('reboot-sequence')).toBeVisible();
  await block.scrollIntoViewIfNeeded();
  await expect(block).toBeInViewport();
  await expect(block).toContainText('WHO YOU ARE BECOMING');
  await expect(page.getByTestId('reboot-becoming-reading')).toHaveText(expected);
  await expect(page.getByTestId('reboot-becoming-order')).toHaveText('ORDER, whether you keep your word when breaking it pays: kept 0, broken 2.');
  await audited(page);
});

test('the ending says who you became', async ({ page }) => {
  let expected = '';
  await boot(page, 'victory-ready', { axeTimers: true, ending: true, patch: (game) => {
    const s = { ...hardRecord(game), ending: 'THE_ARK' };
    expected = alignmentView(s, CONTENT).reading;
    return s;
  } });
  const block = page.getByTestId('ending-becoming');
  await block.scrollIntoViewIfNeeded();
  await expect(block).toBeInViewport();
  await expect(block).toContainText('WHAT YOU BECAME');
  await expect(page.getByTestId('ending-becoming-reading')).toHaveText(expected);
  await expect(page.getByTestId('ending-becoming-disclaimer')).toHaveText(ALIGNMENT_DISCLAIMER);
  await audited(page);
});
