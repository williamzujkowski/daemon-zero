/**
 * Reproducible accessibility audit (#111).
 *
 * The audit that opened #111 was run by hand against the export, so its result
 * could not be re-checked later. This runs the same axe-core rules against the
 * production export at the whole size matrix and every sampled state, and fails
 * on any violation - so a regression is a red gate rather than a rediscovery.
 *
 * Deliberately does NOT install the suite's paused fake clock: axe's own async
 * work never settles against a frozen clock, and the live loop changes numbers,
 * not structure.
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT } from '../../src/content';
import { importSave, serialize } from '../../src/engine';

const fixtures = makeFixtures();
const STATES = ['phase-1-widgets', 'epistemic-ready-p2', 'corporate-insolvent'] as const;
const SIZES = [[320, 568], [390, 844], [768, 1024], [900, 640], [1440, 900]] as const;
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface AxeViolation { id: string; impact: string; nodes: { target: string[] }[]; help: string }
interface AxeGlobal { axe: { run(context: unknown, options: unknown): Promise<{ violations: AxeViolation[] }> } }

async function openLive(page: Page, fixture: string): Promise<void> {
  const code = fixtures[fixture];
  if (!code) throw new Error('Missing fixture ' + fixture);
  const game = serialize(importSave(code, CONTENT));
  await page.addInitScript((value) => {
    const { localStorage } = globalThis as unknown as { localStorage: { setItem(k: string, v: string): void } };
    localStorage.setItem('daemon-zero.save.v1', JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
  }, game);
  await page.goto('./');
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  for (const id of ['reboot-continue', 'phase-threshold-continue', 'lineage-reveal-continue', 'response-acknowledge']) {
    const button = page.getByTestId(id);
    if (await button.count()) await button.click();
  }
  await page.waitForTimeout(400);
}

for (const size of SIZES) {
  for (const state of STATES) {
    test('axe ' + size.join('x') + ' ' + state, async ({ page }) => {
      await page.setViewportSize({ width: size[0], height: size[1] });
      await openLive(page, state);
      await page.addScriptTag({ path: path.join(process.cwd(), 'node_modules/axe-core/axe.min.js') });
      const violations = await page.evaluate(async (rules) => {
        const { axe } = globalThis as unknown as AxeGlobal;
        const result = await axe.run({ exclude: [] }, { runOnly: rules, resultTypes: ['violations'] });
        return result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
        }));
      }, RULES);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
}