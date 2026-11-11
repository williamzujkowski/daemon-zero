/**
 * Exports the actual production app and inspects every emitted JavaScript chunk.
 * A stale dist folder cannot make a development-hook leak pass this gate.
 */
import { spawnSync } from 'node:child_process';
import { openAsBlob } from 'node:fs';
import { mkdtemp, opendir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('never ships window.__daemon in the production web export', async () => {
  const output = await mkdtemp(join(tmpdir(), 'daemon-zero-production-'));
  const env: NodeJS.ProcessEnv = { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' };
  delete env.NO_COLOR;
  try {
    const result = spawnSync('pnpm', ['exec', 'expo', 'export', '--platform', 'web', '--output-dir', output], {
      env, encoding: 'utf8', timeout: 90_000,
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    let chunks = 0;
    for await (const entry of await opendir(output, { recursive: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      const chunk = await openAsBlob(join(entry.parentPath, entry.name));
      expect(await chunk.text()).not.toContain('__daemon');
      chunks += 1;
    }
    expect(chunks).toBeGreaterThan(0);
  } finally { await rm(output, { recursive: true, force: true }); }
}, 100_000);
