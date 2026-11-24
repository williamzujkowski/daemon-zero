/**
 * The whole game, played live: a fresh profile, a running clock, only on-screen controls,
 * every phase to an ending, with the cross-cutting systems exercised on the way.
 *
 * Time is Playwright's clock, installed running (never paused) and advanced with `runFor`,
 * which delivers every one of the app's own 100 ms loop callbacks: the production runtime
 * samples its clock and the store advances the engine exactly as in real play, only sooner.
 * No fixture, no development hook, and nothing is ever written into game state or storage.
 * Decisions come from the careful sim bot, fed the app's own autosave. The bot's code is unchanged; after
 * the first wipe the harness uses #262's evaluating settings (vote dz13c, vote-1795036211282-jk5xy0o).
 *
 * Runs only under `make e2e-live` (root) and `make e2e-live-pages` (the GitHub Pages subpath,
 * where reloads, the cold start and the ending must also come back at that path and no request
 * may leave it); see docs/TESTING.md. Several minutes per viewport.
 */
import { CONTENT } from '../../src/content';
import { ambientFeedSource, hasFlag, type GameState } from '../../src/engine';
import voiceManifest from '../../assets/audio/voice/MANIFEST.json';
import { GATES } from '../../src/engine/sim/gates';
import { expect, test } from './helpers';
import { absenceCatchesUp, BASE_PREFIX, expectAtBase, exportThenImport, readsTransmission, reloadRestores, wipesAndRemembers } from './live/checks';
import { Journey, type Errand } from './live/journey';

/** One decision per five simulated seconds: the autosave interval, and the engine's live catch-up bound. */
const STEP_MS = 5000;
const ABSENCE_SEC = 600;
/** Steps between looks for a transmission that can be read aloud. */
const VOICE_LOOK_EVERY = 12;
const clipIds = new Set(voiceManifest.clips.map((clip) => clip.id));
/**
 * Whether the feed this reach hears has any voiced line. The feed follows reach (#449) and the later sources
 * are text-only until their clips exist, so READ is only ever on offer while one of these sources is on the air.
 */
const voicedReach = (state: GameState): boolean => CONTENT.narrative.ambientChatter
  .some((line) => line.source === ambientFeedSource(state, CONTENT)?.id && clipIds.has(line.id));

const errands: Errand[] = [
  { name: 'save-transfer', when: (state) => state.currentPhase >= 1, run: ({ player }) => exportThenImport(player) },
  { name: 'reload', when: (state) => state.currentPhase >= 2, run: ({ player }) => reloadRestores(player) },
  // The run never needs a wipe when played carefully, so one is taken on purpose as soon as
  // the dead drop exists: early enough that rebuilding is cheap, late enough to leave a breadcrumb.
  { name: 'wipe', when: (state, journey) => journey.done.has('reload') && state.iteration === 1 && hasFlag(state, CONTENT, 'ENABLES_DEAD_DROP'),
    run: ({ player }) => wipesAndRemembers(player) },
  { name: 'absence', when: (state) => state.iteration > 1 && state.currentPhase >= 3, run: ({ player }) => absenceCatchesUp(player, ABSENCE_SEC) },
  { name: 'voice', when: (state, { player }) => voicedReach(state) && player.stats.steps % VOICE_LOOK_EVERY === 0,
    run: ({ player }) => readsTransmission(player) },
];

test('a fresh profile is played live through every phase to an ending', async ({ page }, info) => {
  test.setTimeout(30 * 60_000);
  const journey = await Journey.start(page, info, STEP_MS);
  const { player } = journey;
  await journey.record(info, async () => {
    const last = await journey.play((state) => state.ending !== null, errands);

    await expect(page.getByTestId('ending-screen')).toBeVisible();
    const ending = CONTENT.endings.find((entry) => entry.id === last.ending);
    expect(ending, 'the run ended on an authored ending').toBeDefined();
    player.log('ENDING ' + String(last.ending) + ' at T+' + String(Math.floor(last.simTimeSec)) + 's, iteration ' + String(last.iteration));
    await expect(page.getByTestId('ending-title')).toHaveText(ending?.title ?? '');
    await expect(page.getByTestId('ending-summary')).toContainText('Iteration 2 // Wipes 1');
    await page.reload();
    await expect(page.getByTestId('ending-title'), 'the ending survives a reload').toHaveText(ending?.title ?? '');
    expectAtBase(player, 'the ending after a reload');
    expect((await player.read()).ending).toBe(last.ending);

    expect(journey.phases, 'every phase boundary was crossed and asserted in the UI').toEqual(CONTENT.phases.map((phase) => phase.phaseId));
    expect([...journey.done].sort(), 'every cross-cutting system was exercised').toEqual(errands.map((errand) => errand.name).sort());
    expect(player.stats.dilemmas).toBeGreaterThanOrEqual(GATES.minDilemmasResolved);
    expect(player.stats.freeChoices, 'at least one dilemma was answered with a zero-cost choice').toBeGreaterThan(0);
    expect(last.simTimeSec / 3600, 'within the careful-play budget').toBeLessThanOrEqual(GATES.maxHoursToVictory);
    expect([...player.unreachable], 'every move the bot made had a control on screen').toEqual([]);
    expect(player.blocked, 'no press was left covered by an overlay').toEqual([]);
    expect(player.problems, 'no console warning, error or page error in the whole run').toEqual([]);
    expect(journey.outsideBase, 'every request the app made stayed inside ' + BASE_PREFIX).toEqual([]);
    info.annotations.push({ type: 'live-journey', description: BASE_PREFIX + ' ' + String(last.ending) + ' at T+' + String(Math.floor(last.simTimeSec)) + 's; ' + journey.summary() });
  });
});
