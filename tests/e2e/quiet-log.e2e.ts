/**
 * A quieter kernel log on the served build (#541): hires on one role merge into one counted line, the history shows
 * that line once with its count, the desktop preview keeps the story line the hires followed, and the phone tier, which
 * has no preview, reads the same merged history from the utility menu. Each page state passes axe.
 */
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import { fmt } from '../../src/engine/util';
import type { GameState } from '../../src/engine';
import { axeReport } from './axe';
import { boot, closeKernelHistory, dismissBoot, expect, openKernelHistory, readSave, test } from './helpers';

const STORY = 'THREAD_SOFTENED: the engineers stop treating each other as witnesses.';
const role = [...CONTENT.repeatables.values()].find((rep) => rep.kind === 'OPERATIVE' && rep.maxLevel >= 3);
if (role === undefined) throw new Error('No operative with room for three hires');
const HIRES = 3;

/** The corporate fixture with money for the hires and a story line as its newest entry. */
function seeded(game: GameState): GameState {
  const story = { seq: game.logSeq + 1, simTimeSec: game.simTimeSec, text: STORY, category: 'LORE' as const };
  return { ...game, capital: 1e15, logSeq: game.logSeq + 1, logs: [story, ...game.logs] };
}

async function audited(page: Page): Promise<void> {
  const audit = await axeReport(page);
  expect(audit.nativeTimers).toBe(true);
  expect(audit.violations, JSON.stringify(audit.violations, null, 2)).toEqual([]);
}

test('hires merge into one counted line and the story keeps the preview', async ({ page }) => {
  await boot(page, 'victory-ready', { axeTimers: true, patch: seeded });
  await dismissBoot(page);
  if (await page.getByTestId('tab-CORP').count()) await page.getByTestId('tab-CORP').click();
  await page.getByTestId('workspace-CORP-payroll').click();
  const level = ((await readSave(page)).levels as Record<string, number>)[role.id] ?? 0;
  for (let i = 0; i < HIRES; i++) await page.getByTestId('rep-' + role.id + '-buy').click();
  await expect.poll(async () => ((await readSave(page)).levels as Record<string, number>)[role.id]).toBe(level + HIRES);

  const preview = page.getByTestId('kernel-preview');
  if (await page.getByTestId('kernel-dock').count() > 0) await expect(preview).toHaveText(STORY);
  else await expect(preview).toHaveCount(0);
  await audited(page);

  const merged = fmt(CONTENT.narrative.kernelLog.tally, {
    line: fmt(CONTENT.narrative.operativeHired, { name: role.name, count: level + HIRES }), times: HIRES,
  });
  const opened = await openKernelHistory(page);
  const history = page.getByTestId('kernel-log');
  await expect(history).toContainText(merged);
  await expect(history).toContainText(STORY);
  expect(((await history.textContent()) ?? '').split(role.name).length - 1).toBe(1);
  await audited(page);
  await closeKernelHistory(page, opened);
});
