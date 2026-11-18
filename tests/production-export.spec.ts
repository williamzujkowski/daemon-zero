/**
 * Exports the actual production web and native JavaScript and inspects every emitted JavaScript chunk.
 * A stale dist folder cannot make a development-hook leak pass this gate, and since the release (#233)
 * every platform must carry the Earned Access route (T5, #205).
 */
import { spawnSync } from 'node:child_process';
import { openAsBlob } from 'node:fs';
import { mkdtemp, opendir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { packIds } from '../src/content/pack';
import { EARNED_ACCESS_PACK } from '../src/content';

const outputs: string[] = [];
const chunks: string[] = [];
const byPlatform = new Map<string, string[]>();

async function exportBuild(args: string[]) {
  const output = await mkdtemp(join(tmpdir(), 'daemon-zero-export-'));
  outputs.push(output);
  const env: NodeJS.ProcessEnv = { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' };
  delete env.NO_COLOR;
  const result = spawnSync('pnpm', ['exec', 'expo', 'export', ...args, '--output-dir', output], { env, encoding: 'utf8', timeout: 90_000 });
  return { output, result, log: result.stdout + result.stderr };
}

async function readChunks(output: string): Promise<string[]> {
  const read: string[] = [];
  for await (const entry of await opendir(output, { recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const text = await (await openAsBlob(join(entry.parentPath, entry.name))).text();
    read.push(text);
    for (const platform of ['web', 'android', 'ios']) {
      if (entry.parentPath.split(/[\\/]/).includes(platform)) byPlatform.set(platform, [...(byPlatform.get(platform) ?? []), text]);
    }
  }
  return read;
}

beforeAll(async () => {
  const { output, result, log } = await exportBuild(['--platform', 'all', '--no-bytecode']);
  expect(result.status, log).toBe(0);
  chunks.push(...await readChunks(output));
  expect(chunks.length).toBeGreaterThan(0);
  expect([...byPlatform.keys()].sort()).toEqual(['android', 'ios', 'web']);
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

// The fold (#233): every production export carries the Earned Access route, and nothing names the
// retired preview overlay. The positive check is per platform, so a platform built without the pack fails.
it('ships the Earned Access route in every production web/native export, and no preview overlay sentinel', () => {
  const ids = packIds(EARNED_ACCESS_PACK);
  expect(ids.length).toBeGreaterThan(40);
  for (const platform of ['web', 'android', 'ios']) {
    const text = (byPlatform.get(platform) ?? []).join('\n');
    expect(ids.filter((id) => !text.includes(id)), platform).toEqual([]);
  }
  for (const chunk of chunks) expect(chunk).not.toContain('daemon-zero:preview-overlay');
});
