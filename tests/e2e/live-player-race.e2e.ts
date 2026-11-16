/**
 * Pins the live player against the race that failed the first nightly journey: the game raises
 * a decision modal after the player has read the run and decided, and before its press lands.
 * Here the clock is paused and stepped by hand, so the modal arrives at an exact point every
 * time; the player under test is the same class the smoke and the full journey drive.
 */
import { boot, expect, test } from './helpers';
import { exportThenImport } from './live/checks';
import { LivePlayer, PRESS_TIMEOUT_MS } from './live/player';

const STEP_MS = 5000;
const modal = 'dilemma-modal';

/** A run with an interrupt counting down and nothing on screen yet; returns the clock time until it fires. */
async function bootBeforeInterrupt(player: LivePlayer): Promise<{ id: string; firesInMs: number }> {
  await boot(player.page, 'decoded-omen');
  const state = await player.read();
  const pending = state.pendingDilemma;
  if (pending === null) throw new Error('the fixture no longer has an interrupt counting down');
  expect(state.activeDilemmaId).toBeNull();
  await expect(player.page.getByTestId(modal)).toHaveCount(0);
  return { id: pending.id, firesInMs: Math.ceil((pending.firesAtSimSec - state.simTimeSec) * 1000) + 200 };
}

test('a decision that arrives between deciding and pressing is answered, and the move is decided again', async ({ page }) => {
  const probe = new LivePlayer(page, { stepMs: STEP_MS });
  const { id, firesInMs } = await bootBeforeInterrupt(probe);
  // The lag is the race: the step reads the run and decides with nothing on screen, then this
  // much of the app's clock passes before its first press, and the interrupt fires inside it.
  const player = new LivePlayer(page, { stepMs: STEP_MS, lagMs: firesInMs });
  const decided = await player.step();
  await expect(page.getByTestId(modal)).toHaveCount(0);
  expect(player.stats.dilemmas, 'the decision was answered on its modal').toBe(1);
  expect(player.stats.interrupted, 'the move decided before it was dropped, once').toBe(1);
  expect(decided.resolvedDilemmas, 'the move carried out was decided on a read from after the answer').toContain(id);
  expect(decided.activeDilemmaId).toBeNull();
  expect(player.stats.disabled, 'no control was written off as disabled because a modal covered it').toBe(0);
  expect(player.blocked).toEqual([]);
  expect([...player.unreachable]).toEqual([]);
});

test('navigation behind a decision modal services the modal instead of waiting on the press', async ({ page }, info) => {
  const player = new LivePlayer(page, { stepMs: STEP_MS });
  const { firesInMs } = await bootBeforeInterrupt(player);
  const tabs = await page.locator('[data-testid^="tab-"]').count();
  // The wider tiers show their panes side by side at this point in the run; the phone has tabs.
  if (tabs < 2) expect(info.project.name, 'the phone tier has tabs to walk here').not.toBe('phone');
  test.skip(tabs < 2, 'no tab to press behind the modal on this tier');
  await page.clock.runFor(firesInMs);
  await expect(page.getByTestId(modal)).toBeVisible();
  // This is the press that sat for 15 s on the runner: a tab, with the modal over it.
  const started = Date.now();
  const found = await player.uninterrupted('a sweep for a control no tab has', () => player.find('no-such-control'));
  expect(found).toBeNull();
  expect(Date.now() - started, 'nothing waited out the press timeout').toBeLessThan(PRESS_TIMEOUT_MS);
  await expect(page.getByTestId(modal)).toHaveCount(0);
  expect(player.stats.dilemmas).toBe(1);
  expect(player.stats.interrupted).toBe(1);
  expect(player.stats.sweeps, 'the sweep was run again from its top after the answer').toBe(2);
});

test('an errand cut into by a decision starts again once it is answered', async ({ page }) => {
  const player = new LivePlayer(page, { stepMs: STEP_MS });
  const { id, firesInMs } = await bootBeforeInterrupt(player);
  // The transfer plays ten seconds on with the menu open. Stop half of that short of the
  // interrupt, so it fires in the middle and the game closes the menu under the errand.
  expect(firesInMs).toBeGreaterThan(STEP_MS);
  await page.clock.runFor(firesInMs - STEP_MS);
  await expect(page.getByTestId(modal)).toHaveCount(0);
  expect(await exportThenImport(player)).toBe(true);
  await expect(page.getByTestId(modal)).toHaveCount(0);
  await expect(page.getByTestId('menu-dialog')).toHaveCount(0);
  expect(player.stats.dilemmas).toBe(1);
  expect(player.stats.interrupted).toBe(1);
  expect((await player.read()).resolvedDilemmas, 'the run that was exported and imported has the answer in it').toContain(id);
});
