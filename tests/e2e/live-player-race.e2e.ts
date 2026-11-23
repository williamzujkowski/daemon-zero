/**
 * Pins the live player against the race that failed the first nightly journey: the game raises
 * a decision modal after the player has read the run and decided, and before its press lands.
 * Here the clock is paused and stepped by hand, so the modal arrives at an exact point every
 * time; the player under test is the same class the smoke and the full journey drive.
 */
import { makeFixtures } from '../../scripts/make-fixtures';
import { boot, expect, openSave, test } from './helpers';
import { assertBoundary, exportThenImport, scorePlaysPhase } from './live/checks';
import { decide } from './live/intents';
import { unlessCutOff } from './live/journey';
import { Interrupted, LivePlayer, MAX_INTERRUPTIONS, PRESS_TIMEOUT_MS } from './live/player';

const STEP_MS = 5000;
/** The app's autosave interval (src/app/runtime.ts): the live player decides on what was last saved. */
const SAVE_EVERY_MS = 5000;
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

/**
 * Runs the paused clock one autosave at a time until the careful bot has a move to make, so a step has a press for the
 * interrupt to land in front of. Since the rescale (#461) the fixture's moment is saving up, and the bot waits a few
 * seconds before it buys; the interrupt must still be counting down when it does. Returns the clock time until it fires.
 */
async function untilTheBotMoves(player: LivePlayer, id: string): Promise<number> {
  for (let waited = 0; waited <= 60_000; waited += SAVE_EVERY_MS) {
    const state = await player.read();
    const pending = state.pendingDilemma;
    if (pending?.id !== id) throw new Error('the interrupt fired before the bot had a move');
    if (decide(state).intents.length > 0) return Math.ceil((pending.firesAtSimSec - state.simTimeSec) * 1000) + 200;
    await player.page.clock.runFor(SAVE_EVERY_MS);
  }
  throw new Error('the careful bot never had a move before the interrupt');
}

test('a decision that arrives between deciding and pressing is answered, and the move is decided again', async ({ page }) => {
  const probe = new LivePlayer(page, { stepMs: STEP_MS });
  const { id } = await bootBeforeInterrupt(probe);
  const firesInMs = await untilTheBotMoves(probe, id);
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

test('typing into a field looks again when it cannot land promptly', async ({ page }) => {
  const player = new LivePlayer(page, { stepMs: STEP_MS });
  const { firesInMs } = await bootBeforeInterrupt(player);
  const short = 300;
  await page.clock.runFor(firesInMs - short);
  await expect(page.getByTestId(modal)).toHaveCount(0);
  // The menu is shut, so the field is not there and the fill cannot land: it looks (nothing up),
  // tries, and the interrupt fires while it is trying. The old fill then sat out the full timeout.
  const started = Date.now();
  const typing = player.fill('save-code', 'text').then(() => null, (error: unknown) => error);
  // Real time, not the app's: long enough for the first look to be over, well inside the 2 s try.
  await new Promise((resolve) => { setTimeout(resolve, 1000); });
  await page.clock.runFor(short * 2);
  const outcome = await typing;
  const took = Date.now() - started;
  expect(outcome, 'the second look found the decision and answered it').toBeInstanceOf(Interrupted);
  expect(took, 'the first look saw nothing, so the prompt try was made and ran out').toBeGreaterThan(1900);
  expect(took, 'the late layer cost the prompt wait, not the press timeout').toBeLessThan(PRESS_TIMEOUT_MS / 2);
  await expect(page.getByTestId(modal)).toHaveCount(0);
  expect(player.stats.dilemmas).toBe(1);
});

test('a piece may be interrupted exactly the stated number of times, and once more is a finding', async ({ page }) => {
  const cutShort = (times: number) => {
    const player = new LivePlayer(page, { stepMs: STEP_MS });
    let calls = 0;
    const result = player.uninterrupted('a staged piece', () => {
      calls += 1;
      return calls <= times ? Promise.reject(new Interrupted([modal])) : Promise.resolve(calls);
    });
    return { player, result };
  };
  const within = cutShort(MAX_INTERRUPTIONS);
  expect(await within.result, 'made again after every tolerated interruption').toBe(MAX_INTERRUPTIONS + 1);
  expect(within.player.stats.interrupted).toBe(MAX_INTERRUPTIONS);
  const beyond = cutShort(MAX_INTERRUPTIONS + 1);
  await expect(beyond.result).rejects.toThrow('LIVE JOURNEY FINDING: a staged piece was interrupted ' + String(MAX_INTERRUPTIONS + 1) + ' times');
  expect(beyond.player.stats.interrupted, 'the one that failed the run is not counted as serviced').toBe(MAX_INTERRUPTIONS);
});

test('an ending over a boundary check is handed back as not done instead of thrown', async ({ page }) => {
  // No tick ends a run (only a purchase does), so an ending cannot be made to arrive in the middle
  // of a check on this clock. It is staged already up: the same path, entered at its first look.
  const code = makeFixtures()['ending-shipped'];
  if (!code) throw new Error('Missing ended fixture');
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(code);
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const player = new LivePlayer(page, { stepMs: STEP_MS });
  const phase = (await player.read()).currentPhase;
  const cut = (error: unknown) => error instanceof Interrupted && error.layers.includes('ending-screen');
  expect(cut(await assertBoundary(player, phase).catch((error: unknown) => error)), 'the boundary checks report the ending').toBe(true);
  expect(cut(await scorePlaysPhase(player, phase).catch((error: unknown) => error)), 'the score check reports the ending').toBe(true);
  const journal: string[] = [];
  const log = (line: string) => { journal.push(line); };
  expect(await unlessCutOff('BOUNDARY', log, () => scorePlaysPhase(player, phase)), 'the journey puts the check off').toBe(false);
  expect(journal).toEqual(['BOUNDARY put off: interrupted by ending-screen']);
  expect(await unlessCutOff('BOUNDARY', log, () => Promise.resolve('checked'))).toBe('checked');
  await expect(unlessCutOff('BOUNDARY', log, () => Promise.reject(new Error('a real failure')))).rejects.toThrow('a real failure');
  expect(player.stats.interrupted, 'an ending is not an interruption that was serviced').toBe(0);
});
