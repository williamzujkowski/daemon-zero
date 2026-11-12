/**
 * Exports the actual production web and native JavaScript and inspects every emitted JavaScript chunk.
 * A stale dist folder cannot make a development-hook leak pass this gate.
 */
import { spawnSync } from 'node:child_process';
import { openAsBlob } from 'node:fs';
import { mkdtemp, opendir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

let output = '';
const chunks: string[] = [];
const platforms = new Set<string>();
beforeAll(async () => {
  output = await mkdtemp(join(tmpdir(), 'daemon-zero-production-'));
  const env: NodeJS.ProcessEnv = { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' };
  delete env.NO_COLOR;
    const result = spawnSync('pnpm', ['exec', 'expo', 'export', '--platform', 'all', '--no-bytecode', '--output-dir', output], {
      env, encoding: 'utf8', timeout: 90_000,
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    for await (const entry of await opendir(output, { recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const chunk = await openAsBlob(join(entry.parentPath, entry.name));
      chunks.push(await chunk.text());
      for (const platform of ['web', 'android', 'ios']) {
        if (entry.parentPath.split(/[\\/]/).includes(platform)) platforms.add(platform);
      }
    }
    expect(chunks.length).toBeGreaterThan(0);
    expect([...platforms].sort()).toEqual(['android', 'ios', 'web']);
}, 100_000);

afterAll(async () => { if (output) await rm(output, { recursive: true, force: true }); });

it('never ships window.__daemon in the production web/native exports', () => {
  for (const chunk of chunks) expect(chunk).not.toContain('__daemon');
});

it('never ships the development drawer or its mutation controls in production', () => {
  for (const chunk of chunks) for (const marker of ['dev-drawer', 'dev-open', 'dev-grant', 'dev-force-wipe']) {
    expect(chunk).not.toContain(marker);
  }
});
