/** Real decoded media selects only current scores and releases players on live phase changes. */
import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';
import { CONTENT } from '../../src/content';
import tracks from '../../assets/audio/music/tracks.json';
import { boot, dismissBoot, expect, test } from './helpers';

interface Media { currentTime: number; duration: number; paused: boolean; loop: boolean; src: string }

async function observeMedia(page: Page) {
  await page.addInitScript(() => {
    const browser = globalThis as unknown as { Audio: new (source?: string) => Media; __musicMedia: Media[] };
    const OriginalAudio = browser.Audio;
    browser.__musicMedia = [];
    browser.Audio = class extends OriginalAudio {
      constructor(source?: string) { super(source); browser.__musicMedia.push(this); }
    };
  });
}
async function mediaState(page: Page) {
  return page.evaluate(() => {
    const media = (globalThis as unknown as { __musicMedia: Media[] }).__musicMedia;
    const current = media.at(-1);
    return { count: media.length, active: media.filter((item) => !item.paused && item.src.includes('.mp3')).length,
      source: current?.src ?? '', time: current?.currentTime ?? 0, duration: current?.duration ?? 0,
      loop: current?.loop ?? false, paused: current?.paused ?? true };
  });
}
async function openAudio(page: Page) {
  await page.getByTestId('menu-open').click(); await page.getByTestId('menu-audio').click();
}
const fixtures = ['tick-0', 'phase-1-widgets', 'phase-2-unlocked', 'wild-shard-encounter-p3', 'shard-drift-quirk-p4', 'phase5-midgame'];

for (const track of tracks) test('phase ' + String(track.phase) + ' loads only its byte-exact score and advances decoded media', async ({ page }) => {
  const requested = new Set<string>();
  page.on('request', (request) => { if (request.url().includes('.mp3')) requested.add(request.url()); });
  await observeMedia(page); await boot(page, fixtures[track.phase]); await dismissBoot(page); await openAudio(page);
  expect(requested.size).toBe(0); expect((await mediaState(page)).count).toBe(0);
  await page.getByTestId('music-toggle').click();
  await expect(page.getByTestId('music-status')).toContainText('Playing phase ' + String(track.phase) + ' score');
  await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(.05);
  const media = await mediaState(page);
  expect(media.duration).toBeCloseTo(track.duration, 0);
  expect(media.count).toBe(1); expect(media.active).toBe(1); expect(media.loop).toBe(true);
  expect(media.source).toContain('/audio/music/phase-' + String(track.phase) + '/');
  expect(media.source.startsWith(new URL('assets/', page.url()).href)).toBe(true);
  expect([...requested].every((url) => url.includes('/audio/music/phase-' + String(track.phase) + '/'))).toBe(true);
  const file = await page.request.get(media.source);
  expect(file.ok()).toBe(true); expect((await file.body()).length).toBe(track.bytes);
  expect(createHash('sha256').update(await file.body()).digest('hex')).toBe(track.sha256);
  if (track.phase === 0) {
    await page.evaluate(() => {
      const current = (globalThis as unknown as { __musicMedia: Media[] }).__musicMedia.at(-1);
      if (current) current.currentTime = current.duration - .15;
    });
    await expect.poll(async () => (await mediaState(page)).time).toBeLessThan(2);
    await page.getByTestId('music-toggle').click();
    expect((await mediaState(page)).active).toBe(0);
    await page.context().setOffline(true);
    await page.getByTestId('music-toggle').click();
    await expect(page.getByTestId('music-status')).toContainText('Playing phase 0 score');
    await page.context().setOffline(false);
  }
});

for (const [fixture, targetPhase] of [['guest-exit-ready', 1], ['victory-ready', 5]] as const) {
  test('live purchase switches to phase ' + String(targetPhase) + ' with one active player', async ({ page }) => {
    await observeMedia(page); await boot(page, fixture); await dismissBoot(page); await openAudio(page);
    await page.getByTestId('music-toggle').click();
    await expect.poll(async () => (await mediaState(page)).active).toBe(1);
    await page.getByTestId('menu-close').click();
    const node = [...CONTENT.nodes.values()].find((entry) => entry.effects.unlocksPhase === targetPhase);
    if (!node) throw new Error('Missing phase transition');
    await page.getByTestId('node-' + node.id + '-unlock').click(); await dismissBoot(page);
    await openAudio(page);
    await expect(page.getByTestId('music-status')).toContainText('Playing phase ' + String(targetPhase) + ' score');
    await expect.poll(async () => (await mediaState(page)).time).toBeGreaterThan(.05);
    expect((await mediaState(page)).count).toBe(2);
    expect((await mediaState(page)).active).toBe(1);
    expect((await mediaState(page)).source).toContain('/audio/music/phase-' + String(targetPhase) + '/');
  });
}
