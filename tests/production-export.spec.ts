/**
 * Exports the actual production web and native JavaScript and inspects every emitted JavaScript chunk.
 * A stale dist folder cannot make a development-hook or preview-content leak pass this gate, and a
 * preview web export proves the content scan can see what it looks for (T5, #205).
 */
import { spawnSync } from 'node:child_process';
import { openAsBlob } from 'node:fs';
import { mkdtemp, opendir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { overlayIds } from '../src/content/overlay';
import { PREVIEW_OVERLAY, PREVIEW_SENTINEL } from '../src/content/preview';

const outputs: string[] = [];
const chunks: string[] = [];
const platforms = new Set<string>();

/** Runs `expo export` with the content channel set exactly as given (undefined = unset). */
async function exportBuild(args: string[], channel: string | undefined) {
  const output = await mkdtemp(join(tmpdir(), 'daemon-zero-export-'));
  outputs.push(output);
  const env: NodeJS.ProcessEnv = { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' };
  delete env.NO_COLOR;
  delete env.DAEMON_CONTENT_CHANNEL;
  if (channel !== undefined) env.DAEMON_CONTENT_CHANNEL = channel;
  const result = spawnSync('pnpm', ['exec', 'expo', 'export', ...args, '--output-dir', output], { env, encoding: 'utf8', timeout: 90_000 });
  return { output, result, log: result.stdout + result.stderr };
}

async function readChunks(output: string, found: Set<string>): Promise<string[]> {
  const read: string[] = [];
  for await (const entry of await opendir(output, { recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const chunk = await openAsBlob(join(entry.parentPath, entry.name));
    read.push(await chunk.text());
    for (const platform of ['web', 'android', 'ios']) {
      if (entry.parentPath.split(/[\\/]/).includes(platform)) found.add(platform);
    }
  }
  return read;
}

beforeAll(async () => {
  const { output, result, log } = await exportBuild(['--platform', 'all', '--no-bytecode'], undefined);
  expect(result.status, log).toBe(0);
  chunks.push(...await readChunks(output, platforms));
  expect(chunks.length).toBeGreaterThan(0);
  expect([...platforms].sort()).toEqual(['android', 'ios', 'web']);
}, 100_000);

afterAll(async () => { for (const output of outputs) await rm(output, { recursive: true, force: true }); });

it('never ships window.__daemon in the production web/native exports', () => {
  for (const chunk of chunks) expect(chunk).not.toContain('__daemon');
});

it('never ships the development drawer or its mutation controls in production', () => {
  for (const chunk of chunks) for (const marker of ['dev-drawer', 'dev-open', 'dev-grant', 'dev-force-wipe']) {
    expect(chunk).not.toContain(marker);
  }
});

it('never ships the preview overlay, its ids or its sentinel in any production web/native chunk', () => {
  const markers = [PREVIEW_SENTINEL, ...overlayIds(PREVIEW_OVERLAY)];
  expect(PREVIEW_SENTINEL.length).toBeGreaterThanOrEqual(16);
  for (const chunk of chunks) for (const marker of markers) expect(chunk.includes(marker), marker).toBe(false);
});

describe('preview channel export', () => {
  const previewChunks: string[] = [];
  const previewPlatforms = new Set<string>();
  beforeAll(async () => {
    const { output, result, log } = await exportBuild(['--platform', 'web'], 'preview');
    expect(result.status, log).toBe(0);
    previewChunks.push(...await readChunks(output, previewPlatforms));
  }, 100_000);

  // The known positive: without it, the production scan above could pass by looking at nothing.
  it('ships the overlay sentinel in the preview web export', () => {
    expect([...previewPlatforms]).toEqual(['web']);
    expect(previewChunks.some((chunk) => chunk.includes(PREVIEW_SENTINEL))).toBe(true);
  });

  it.each(['android', 'ios'])('refuses a %s export with the preview channel set', async (platform) => {
    const { result, log } = await exportBuild(['--platform', platform, '--no-bytecode'], 'preview');
    expect(result.status, log).not.toBe(0);
    expect(log).toContain('DAEMON_CONTENT_CHANNEL=preview is web-only; refusing to bundle for ' + platform);
  }, 60_000);

  it('refuses an unknown channel instead of guessing one', async () => {
    const { result, log } = await exportBuild(['--platform', 'web'], 'staging');
    expect(result.status, log).not.toBe(0);
    expect(log).toContain('DAEMON_CONTENT_CHANNEL must be "production" or "preview"');
  }, 60_000);
});
