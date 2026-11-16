/**
 * The short live run that stays in `make e2e`: no fixture, a clock that is never paused, and
 * only on-screen controls, from a fresh profile out of the guest and into the next phase.
 * The full playthrough to an ending is `live-journey.e2e.ts` under `make e2e-live`.
 */
import { expect, test } from './helpers';
import { exportThenImport, reloadRestores } from './live/checks';
import { Journey, type Errand } from './live/journey';

const STEP_MS = 5000;
const errands: Errand[] = [
  { name: 'save-transfer', when: (state) => state.currentPhase >= 1, run: ({ player }) => exportThenImport(player) },
  { name: 'reload', when: (_state, journey) => journey.done.has('save-transfer'), run: ({ player }) => reloadRestores(player) },
];

test('a fresh profile is played live out of the guest, then reloaded and transferred', async ({ page }, info) => {
  const journey = await Journey.start(page, info, STEP_MS);
  const { player } = journey;
  await journey.record(info, async () => {
    // Pins the instrument: the player batches its manual clicks, and each one must land.
    await page.getByTestId('manual-cycle').click({ clickCount: 3 });
    await expect(page.getByTestId('manual-feedback')).toContainText('committed: 3');
    const entered = await journey.play((_state, { done, phases }) => done.size === errands.length && phases.includes(1), errands);
    // The run is still alive after the reload: the loop resumed and the clock is moving.
    await page.clock.runFor(STEP_MS * 2);
    await expect.poll(async () => (await player.read()).simTimeSec, 'the restored run keeps advancing').toBeGreaterThan(entered.simTimeSec + STEP_MS / 1000);
    expect(journey.phases).toEqual([0, 1]);
    expect(player.stats.dilemmas, 'the guest interrupt was answered on screen').toBeGreaterThan(0);
    expect([...player.unreachable], 'every move the bot made had a control on screen').toEqual([]);
    expect(player.blocked).toEqual([]);
    expect(player.problems).toEqual([]);
  });
});
