/**
 * Saves written before the World Remembers release enter campaign rules on the served build (#301). The raw
 * stored codes go into browser storage untouched, so the app's own hydration and migration run, not the
 * test's; the checkpoint it writes back must be the current schema on campaign rules from the loaded
 * iteration. Watched by script on the published site after each deploy; this makes it a gate.
 * The unit-level equivalent is tests/release-saves.spec.ts; preview saves are tests/e2e/preview-isolation.
 */
import { readFileSync } from 'node:fs';
import { SCHEMA_VERSION } from '../../src/engine/state';
import { test, expect, dismissBoot, readSave } from './helpers';

interface BrowserStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

const SAVES: [string, string][] = [
  ['pre-release-v10', readFileSync('tests/fixtures/pre-release-v10.json', 'utf8').trim()],
  ['pre-release-v14', readFileSync('tests/fixtures/pre-release-v14.json', 'utf8').trim()],
];

for (const [name, code] of SAVES) {
  test(`a ${name} save boots on campaign rules and is checkpointed at the current schema`, async ({ page }) => {
    const stored = JSON.parse(code) as { iteration: number };
    await page.clock.install();
    await page.clock.pauseAt(Date.now() + 1000);
    await page.addInitScript((value) => {
      const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
      if (!localStorage.getItem('daemon-zero.save.v1')) localStorage.setItem('daemon-zero.save.v1', JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
    }, code);
    await page.goto('./');
    await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
    await dismissBoot(page);
    // Checkpoints run on the app's real-time interval; advance past a few of them.
    await expect(async () => {
      await page.clock.runFor(6000);
      const save = await readSave(page) as { schemaVersion: number; narrativeRules: string; iteration: number; campaign: { activatedAtIteration: number | null } };
      expect([save.schemaVersion, save.narrativeRules]).toEqual([SCHEMA_VERSION, 'campaign_v1']);
      expect(save.campaign.activatedAtIteration).toBe(save.iteration);
      expect(save.iteration).toBeGreaterThanOrEqual(stored.iteration);
    }).toPass({ timeout: 20_000 });
  });
}
