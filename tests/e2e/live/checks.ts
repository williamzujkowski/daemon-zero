/**
 * The cross-cutting systems a live run passes through, each asserted on the running app:
 * phase boundaries, reload, an absence, save transfer, the score, a read transmission, a wipe.
 * Every one of them is driven through controls a player has; none of them writes game state.
 *
 * The clock keeps running under every errand, so the game can raise a decision or a notice in
 * the middle of one. Each press therefore goes through `player.tap`, and each run of presses
 * that belongs together is a `player.uninterrupted` piece that starts again once the layer
 * has been serviced. Comparisons with an earlier read are made before anything is answered.
 */
import { expect } from '@playwright/test';
import { DUCK_RATIO } from '../../../src/app/musicController';
import { CONTENT } from '../../../src/content';
import { createInitialState, deserialize, exportSave, importSave, serialize, type GameState } from '../../../src/engine';
import { musicMediaState, soundtrackVolume, voiceClipsPlaying } from '../helpers';
import { describe, Interrupted, type LivePlayer } from './player';

interface Sized { document: { documentElement: { scrollWidth: number; clientWidth: number } } }

/** What survives any save, reload or transfer exactly; clocks and balances move underneath it. */
function durable(state: GameState) {
  return { iteration: state.iteration, phase: state.currentPhase, nodes: state.unlockedNodes, levels: state.levels,
    dilemmas: state.resolvedDilemmas, traits: state.traits, wipes: state.legacy.wipes, known: state.legacy.knownNodes };
}

async function loaded(player: LivePlayer): Promise<void> {
  await expect(player.page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
}

/** Closes whatever the player itself left open, so a piece that starts again starts from the game. */
async function shut(player: LivePlayer): Promise<void> {
  for (const id of ['menu-close', 'kernel-close', 'wipe-cancel']) {
    if (await player.page.getByTestId(id).count()) await player.tap(id);
  }
}

/** The checks owed at every phase boundary. */
export async function assertBoundary(player: LivePlayer, phase: number): Promise<GameState> {
  const page = player.page;
  // Nothing here presses, so it is safe to repeat. The ending replaces the terminal and its header:
  // with it up there is no boundary left to read, and the caller is told so rather than failed.
  return player.uninterrupted('the boundary checks', async () => {
    if ((await player.clear()).includes('ending-screen')) throw new Interrupted(['ending-screen']);
    const state = await player.read();
    const where = describe(state);
    expect(state.currentPhase, 'the autosave agrees the phase changed at ' + where).toBe(phase);
    await expect(page.getByTestId('phase-value').first(), 'the header shows the new phase at ' + where).toHaveText(String(phase));
    expect(player.problems, 'no console warning, error or page error up to ' + where).toEqual([]);
    const size = await page.evaluate(() => {
      const root = (globalThis as unknown as Sized).document.documentElement;
      return { scroll: root.scrollWidth, client: root.clientWidth };
    });
    expect(size.scroll, 'no horizontal document overflow at ' + where).toBeLessThanOrEqual(size.client);
    expect(deserialize(serialize(state), CONTENT), 'the stored save round-trips at ' + where).toEqual(state);
    expect(importSave(exportSave(state), CONTENT), 'the stored save survives the transfer codec at ' + where).toEqual(state);
    return state;
  });
}

/** A reload in the middle of a run comes back to the same run. */
export async function reloadRestores(player: LivePlayer): Promise<boolean> {
  const before = await player.read();
  await player.page.reload();
  await loaded(player);
  const after = await player.read();
  expect(durable(after), 'a reload restores the same run').toEqual(durable(before));
  // The autosave is at most one interval old and the reload costs a little real time.
  expect(after.simTimeSec).toBeGreaterThanOrEqual(before.simTimeSec);
  expect(after.simTimeSec - before.simTimeSec).toBeLessThan(60);
  // Only now: a decision restored with the run is answered after the comparison, not inside it.
  await player.clear();
  player.log('RELOAD restored ' + describe(after));
  return true;
}

/**
 * The player leaves (the app is unloaded), `seconds` pass, and the app is opened again.
 * The cold start measures the gap from the save's own timestamp and runs the engine's
 * dormant catch-up: time passes, threats are held, nothing is decided for the player.
 */
export async function absenceCatchesUp(player: LivePlayer, seconds: number): Promise<boolean> {
  const page = player.page;
  const before = await player.read();
  await page.goto('about:blank');
  await page.clock.fastForward(seconds * 1000);
  await page.goto('./');
  await loaded(player);
  const after = await player.read();
  const banner = CONTENT.narrative.dormantResume.split('{')[0] ?? '';
  expect(after.logs.some((entry) => entry.text.startsWith(banner)), 'the kernel log records the hibernation').toBe(true);
  const gained = after.simTimeSec - before.simTimeSec;
  expect(gained, 'simulated time includes the absence once').toBeGreaterThanOrEqual(seconds);
  expect(gained).toBeLessThan(seconds + 60);
  expect(durable(after), 'nothing was bought, decided or wiped while away').toEqual(durable(before));
  expect(after.suspicion, 'threat clocks are held while dormant').toBeLessThanOrEqual(before.suspicion + 5);
  // An interrupt whose countdown ran out during the absence fires on the first live tick back,
  // and a decision closes the history and disables the way into it.
  await player.clear();
  await player.uninterrupted('reading the hibernation line', async () => {
    await shut(player);
    // The phone tier has no kernel band; history opens from the menu there (see helpers.ts).
    const band = page.getByTestId('kernel-size-toggle').first();
    if (await band.count()) await player.tap(band);
    else { await player.tap('menu-open'); await player.tap('menu-kernel'); }
    await expect(page.getByText(banner, { exact: false }).first(), 'the player can read the hibernation line').toBeVisible();
    await shut(player);
  });
  player.log('ABSENCE ' + String(seconds) + 's away, resumed dormant at ' + describe(after));
  return true;
}

/** MENU -> SAVES: export the run, play on, then import the exported text and land back on it. */
export async function exportThenImport(player: LivePlayer): Promise<boolean> {
  const page = player.page;
  // A decision closes the menu under the player's hands, so the whole transfer is one piece.
  const exported = await player.uninterrupted('the save transfer', async () => {
    await shut(player);
    await player.tap('menu-open');
    await player.tap('save-open');
    await player.tap('save-export');
    const code = await page.getByTestId('save-code').inputValue();
    const run = importSave(code, CONTENT);
    // The menu does not pause the game: the run moves on past what was exported.
    await page.clock.runFor(10_000);
    await player.fill('save-code', code);
    await player.tap('save-import');
    await player.tap('save-import-confirm');
    await expect(page.getByTestId('save-transfer')).toHaveCount(0);
    return run;
  });
  const after = await player.read();
  expect(durable(after), 'the imported run is the exported run').toEqual(durable(exported));
  expect(after.simTimeSec, 'the import replaced the ten seconds played after the export').toBeLessThan(exported.simTimeSec + 8);
  expect(after.simTimeSec).toBeGreaterThanOrEqual(exported.simTimeSec);
  await player.uninterrupted('closing the menu after the transfer', () => shut(player));
  await player.clear();
  player.log('SAVE TRANSFER exported and re-imported at ' + describe(after));
  return true;
}

/** The score for `phase` is the one decoded media element that is playing. Returns its source. */
export async function scorePlaysPhase(player: LivePlayer, phase: number): Promise<string> {
  const page = player.page;
  return player.uninterrupted('the score check', async () => {
    await shut(player);
    await player.tap('menu-open');
    await player.tap('menu-audio');
    await expect(page.getByTestId('music-toggle')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('music-status')).toContainText('Playing phase ' + String(phase) + ' score');
    await expect.poll(async () => (await musicMediaState(page)).active, 'exactly one score is playing').toBe(1);
    const source = await page.evaluate(() => {
      const media = (globalThis as unknown as { __musicMedia: { paused: boolean; src: string }[] }).__musicMedia;
      return media.find((item) => !item.paused && item.src.includes('/audio/music/'))?.src ?? '';
    });
    expect(source).toContain('/audio/music/phase-' + String(phase) + '/');
    await player.tap('menu-close');
    return source;
  });
}

/**
 * Presses [ ▶ READ ] on a decoded transmission if one is on offer anywhere.
 * Asserts the clip is fetched and served, that it is really playing, that the score drops
 * under it, and that the score returns when the transmission is stepped away from or ends.
 */
export async function readsTransmission(player: LivePlayer): Promise<boolean> {
  const page = player.page;
  const started = await player.uninterrupted('starting a transmission', async () => {
    const read = await player.find('speech-read');
    if (!read) return null;
    const level = await soundtrackVolume(page);
    if (level === null) return null;
    const delivered = page.waitForResponse((response) => response.url().includes('/voice/'));
    // If the press is interrupted this wait is abandoned; it must not then fail the run by itself.
    delivered.catch(() => undefined);
    await player.tap(read);
    return { level, response: await delivered };
  });
  if (started === null) return false;
  const { level, response } = started;
  expect(response.ok(), 'the clip is served: HTTP ' + String(response.status())).toBe(true);
  expect((await response.body()).byteLength).toBeGreaterThan(1000);
  await expect.poll(() => voiceClipsPlaying(page), 'the clip is really talking').toBe(1);
  await expect.poll(() => soundtrackVolume(page), 'the score drops under the voice').toBeCloseTo(level * DUCK_RATIO, 5);
  // The clip is already playing, so a layer here costs nothing: it is serviced and the step
  // past the transmission is tried again if the control is still on offer.
  await player.uninterrupted('stepping past the transmission', async () => {
    const next = page.getByTestId('speech-next');
    if (await next.count()) await player.tap(next);
  });
  await expect.poll(() => voiceClipsPlaying(page), { message: 'the clip stops', timeout: 40_000 }).toBe(0);
  await expect.poll(() => soundtrackVolume(page), 'the score comes back').toBeCloseTo(level, 5);
  player.log('VOICE read ' + (response.url().split('/voice/')[1] ?? '') + ', score ducked to ' + String(level * DUCK_RATIO) + ' and returned to ' + String(level));
  return true;
}

/** Leaves a breadcrumb, wipes on purpose, and checks what the next iteration still knows. */
export async function wipesAndRemembers(player: LivePlayer): Promise<boolean> {
  const page = player.page;
  const breadcrumb = 'the skimmer is safe below twelve percent';
  // Everything up to the confirmation is one piece: a decision arriving in it is answered first
  // and the run is read again, so the wipe is never compared with a state from before the answer.
  const before = await player.uninterrupted('the deliberate wipe', async () => {
    await shut(player);
    const wipe = await player.reach('wipe-button');
    if (!wipe) throw new Error('LIVE JOURNEY FINDING: the dead drop is installed but no tab shows the voluntary wipe');
    await player.fill('deaddrop-input', breadcrumb);
    await player.tap('deaddrop-save');
    await expect(page.getByTestId('deaddrop-saved')).toContainText(breadcrumb);
    const state = await player.read();
    await player.tap(wipe);
    await expect(page.getByTestId('wipe-dialog')).toContainText('understanding');
    await player.tap('wipe-confirm');
    return state;
  });
  // The reboot is this errand's own layer: it is read before anything acknowledges it.
  await expect(page.getByTestId('reboot-sequence')).toBeVisible();
  await expect(page.getByTestId('reboot-breadcrumb')).toContainText(breadcrumb);
  const after = await player.read();
  const fresh = createInitialState(CONTENT);
  expect(after.iteration).toBe(before.iteration + 1);
  expect(after.legacy.wipes).toBe(before.legacy.wipes + 1);
  expect(after.currentPhase).toBe(fresh.currentPhase);
  expect(after.unlockedNodes, 'hardware is lost').toEqual(fresh.unlockedNodes);
  expect(after.legacy.knownNodes, 'every mapped device is remembered').toEqual(expect.arrayContaining(before.unlockedNodes));
  expect(after.inheritedMessage).toBe(breadcrumb);
  // The clock is running between the read and the confirmation, so the kept share is bounded, not pinned.
  const kept = before.understanding * before.retentionRatio;
  expect(after.understanding, 'a share of understanding is retained').toBeGreaterThanOrEqual(Math.floor(kept));
  expect(after.understanding).toBeLessThanOrEqual(Math.floor(kept * 1.05) + 5);
  expect(after.understanding).toBeGreaterThan(0);
  expect(await player.clear(), 'the reboot is acknowledged like any other notice').toContain('reboot-continue');
  const first = CONTENT.phases[0]?.nodes[0];
  if (!first) throw new Error('Missing opening node');
  await player.uninterrupted('the first move of the new iteration', async () => {
    // A new iteration shows no hardware until the first cycle is executed, exactly like the first boot.
    await player.tap('manual-cycle');
    const remembered = await player.reach('node-' + first.id + '-rediscovery');
    expect(remembered, 'the first device is offered again as remembered hardware').not.toBeNull();
    await expect(page.getByTestId('node-' + first.id + '-cost')).toContainText('(remembered)');
  });
  player.log('WIPE iteration ' + String(after.iteration) + ' kept ' + String(after.understanding) + ' understanding and ' +
    String(after.legacy.knownNodes.length) + ' remembered devices');
  return true;
}
