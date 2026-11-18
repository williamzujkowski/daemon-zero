/**
 * Reproducible accessibility audit (#111).
 *
 * The audit that opened #111 was run by hand against the export, so its result
 * could not be re-checked later. This runs the same axe-core rules against the
 * production export at five viewports (SIZES below - a subset of the twelve in
 * ui-sizes.e2e.ts: two phone, two two-column, one three-column) and every
 * sampled state, and fails on
 * any violation - so a regression is a red gate rather than a rediscovery.
 * A mandatory decision is audited too, at one phone and one desktop size: the
 * modal is where every choice button lives, and the screen states never open one,
 * so a label-in-name failure there went unseen (#275).
 *
 * Deliberately does NOT install the suite's paused fake clock: axe's own async
 * work never settles against a frozen clock, and the live loop changes numbers,
 * not structure.
 */
import { test, expect, type Page } from '@playwright/test';
import { makeFixtures } from '../../scripts/make-fixtures';
import { CONTENT } from '../../src/content';
import { importSave, serialize } from '../../src/engine';
import { axeEachControl, axeViolations } from './axe';

const fixtures = makeFixtures();
const STATES = ['phase-1-widgets', 'epistemic-ready-p2', 'corporate-insolvent'] as const;
const SIZES = [[320, 568], [390, 844], [768, 1024], [900, 640], [1440, 900]] as const;
const MODAL_SIZES = [[390, 844], [1440, 900]] as const;

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
      const violations = await axeViolations(page);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
}

for (const size of MODAL_SIZES) {
  test('axe ' + size.join('x') + ' dilemma modal', async ({ page }) => {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await openLive(page, 'dilemma-active');
    await expect(page.getByTestId('dilemma-modal')).toBeVisible();
    const violations = await axeViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    // The audit must reach the controls it is here for, each on screen, not just an open dialog.
    const controls = await axeEachControl(page, page.getByTestId('dilemma-modal'));
    expect(controls.audited).toBeGreaterThan(1);
    expect(controls.violations, JSON.stringify(controls.violations, null, 2)).toEqual([]);
  });
}
