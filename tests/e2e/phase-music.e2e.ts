/** Real decoded media selects only current scores and releases players on live phase changes.
 *  Music is on by default and starts on the first gesture, so these cases assert which
 *  score the running phase fetches and plays, not whether audio is enabled. */
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import tracks from '../../assets/audio/music/tracks.json';
import { FADE_IN_MS, FADE_OUT_MS } from '../../src/app/musicController';
import { boot, dismissBoot, expect, musicMediaState, observeMusicMedia, sampleScore, soundtrackVolume, test } from './helpers';

async function openAudio(page: Page) {
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
}
const fixtures = ['tick-0', 'phase-1-widgets', 'phase-2-unlocked', 'wild-shard-encounter-p3', 'shard-drift-quirk-p4', 'phase5-midgame'];

for (const track of tracks) test('phase ' + String(track.phase) + ' loads only its byte-exact score and advances decoded media', async ({ page }) => {
  const requested = new Set<string>();
  page.on('request', (request) => { if (request.url().includes('.mp3')) requested.add(request.url()); });
  await observeMusicMedia(page); await boot(page, fixtures[track.phase]); await dismissBoot(page); await openAudio(page);
  // The first gesture already started the score; the contract here is which one.
  await expect(page.getByTestId('music-status')).toContainText('Playing phase ' + String(track.phase) + ' score');
  await expect.poll(async () => (await musicMediaState(page)).time).toBeGreaterThan(.05);
  const media = await musicMediaState(page);
  expect(media.duration).toBeCloseTo(track.duration, 0);
  expect(media.count).toBe(1); expect(media.active).toBe(1); expect(media.loop).toBe(true);
  expect(media.source).toContain('/audio/music/phase-' + String(track.phase) + '/');
  expect(media.source.startsWith(new URL('assets/', page.url()).href)).toBe(true);
  expect([...requested].every((url) => url.includes('/audio/music/phase-' + String(track.phase) + '/'))).toBe(true);
  expect(requested.size).toBe(1);
  const file = await page.request.get(media.source);
  expect(file.ok()).toBe(true); expect((await file.body()).length).toBe(track.bytes);
  expect(createHash('sha256').update(await file.body()).digest('hex')).toBe(track.sha256);
});

for (const [fixture, targetPhase] of [['guest-exit-ready', 1], ['victory-ready', 5]] as const) {
  test('live purchase switches to phase ' + String(targetPhase) + ' with one active player', async ({ page }) => {
    await observeMusicMedia(page); await boot(page, fixture); await dismissBoot(page); await openAudio(page);
    await expect.poll(async () => (await musicMediaState(page)).active).toBe(1);
    await page.getByTestId('menu-close').click();
    const node = [...CONTENT.nodes.values()].find((entry) => entry.effects.unlocksPhase === targetPhase);
    if (!node) throw new Error('Missing phase transition');
    await page.getByTestId('node-' + node.id + '-unlock').click(); await dismissBoot(page);
    await openAudio(page);
    await expect(page.getByTestId('music-status')).toContainText('Playing phase ' + String(targetPhase) + ' score');
    await expect.poll(async () => (await musicMediaState(page)).time).toBeGreaterThan(.05);
    expect((await musicMediaState(page)).count).toBe(2);
    expect((await musicMediaState(page)).active).toBe(1);
    expect((await musicMediaState(page)).source).toContain('/audio/music/phase-' + String(targetPhase) + '/');
  });
}

test('a live phase change fades the old score out and the new one in, one element throughout', async ({ page }) => {
  // The cases above run on the paused clock that `boot()` installs, where a fade-in never
  // advances: their players sit at level 0 and swap at once, which is the silent path. This one
  // runs the clock, so the score is audible when the phase changes and both fades are real.
  const level = 0.3;
  await observeMusicMedia(page); await boot(page, 'guest-exit-ready', { audio: true }); await dismissBoot(page);
  // The score starts on the first gesture; a press on nothing in particular is one on every tier.
  await page.getByTestId('terminal-screen').click({ position: { x: 2, y: 2 } });
  await expect.poll(async () => (await musicMediaState(page)).active).toBe(1);
  await sampleScore(page, FADE_IN_MS);
  expect(await soundtrackVolume(page)).toBe(level);
  const node = [...CONTENT.nodes.values()].find((entry) => entry.effects.unlocksPhase === 1);
  if (!node) throw new Error('Missing phase transition');
  await page.getByTestId('node-' + node.id + '-unlock').click(); await dismissBoot(page);
  expect((await musicMediaState(page)).count, 'the next score is not created while the old one fades').toBe(1);
  expect(await soundtrackVolume(page), 'the old score has not been cut').toBe(level);

  const samples = await sampleScore(page, FADE_OUT_MS + FADE_IN_MS);
  expect(samples.map((sample) => sample.active), 'never two scores and never none').toEqual(samples.map(() => 1));
  const leaving = samples.filter((sample) => sample.source.includes('/audio/music/phase-0/')).map((sample) => sample.volume ?? Number.NaN);
  const arriving = samples.filter((sample) => sample.source.includes('/audio/music/phase-1/')).map((sample) => sample.volume ?? Number.NaN);
  expect(leaving.length + arriving.length).toBe(samples.length);
  expect(leaving.filter((value) => value > 0 && value < level).length, 'the old score passes through intermediate levels').toBeGreaterThan(0);
  expect(leaving.every((value, index) => index === 0 || value <= (leaving[index - 1] ?? 0)), 'down only: ' + leaving.join(', ')).toBe(true);
  expect(arriving[0], 'the new score starts from silence').toBe(0);
  expect(arriving.filter((value) => value > 0 && value < level).length, 'the new score passes through intermediate levels').toBeGreaterThan(0);
  expect(arriving.every((value, index) => index === 0 || value >= (arriving[index - 1] ?? 0)), 'up only: ' + arriving.join(', ')).toBe(true);
  expect(arriving.at(-1), 'and ends exactly on the preference level').toBe(level);
  expect((await musicMediaState(page)).count).toBe(2);
  // More clock moves nothing: no ramp is left running.
  await page.clock.runFor(FADE_IN_MS);
  expect(await soundtrackVolume(page)).toBe(level);
});
