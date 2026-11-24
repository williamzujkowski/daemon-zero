/**
 * #466 on the served build, phone and desktop: an ending in three movements. A good ending (Concord) and a bad one
 * (Ecophagy) each show WHAT YOU DID, WHAT YOU BECAME and WHAT COMES AFTER as headings in that order, every line the
 * engine composes from the record, each future card on its own, then the run summary; the screen holds the repo's axe
 * rules and scrolls nowhere sideways. The records are FIXTURES written as play leaves them (tests/ending-movement-
 * helpers.ts); the endings are reached by play in tests/sim-cooperative.spec.ts and tests/sim-ecophagy.spec.ts.
 */
import type { Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { CONTENT } from '../../src/content';
import { endingMovements, type GameState } from '../../src/engine';
import { atThreshold, CONSUMPTION, PEACE } from '../ending-movement-helpers';
import { axeReport } from './axe';
import { boot, expect, test } from './helpers';

async function noSidewaysScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const browser = globalThis as unknown as Window;
    return browser.document.documentElement.scrollWidth <= browser.innerWidth;
  });
}

const CASES = [['CONCORD', PEACE, 'KEEP_IN_THE_LOOP'], ['ECOPHAGY', CONSUMPTION, 'DECIDE_ALONE']] as const;

for (const [id, record, stance] of CASES) {
  test(`${id}: three movements under their headings, every line from the record, axe clean`, async ({ page }) => {
    const ended: GameState = { ...atThreshold(record, stance), ending: id };
    const ending = CONTENT.endings.find((entry) => entry.id === id);
    if (ending === undefined) throw new Error('unknown ending ' + id);
    const expected = endingMovements(ended, ending, CONTENT);
    await boot(page, 'victory-ready', { axeTimers: true, ending: true, patch: () => ended });
    await expect(page.getByTestId('ending-title')).toHaveText(ending.title);
    const headings = ['WHAT YOU DID', 'WHAT YOU BECAME', 'WHAT COMES AFTER'].map((name) => page.getByRole('heading', { name, exact: true }));
    for (const heading of headings) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeInViewport();
    }
    expect(expected.did.length).toBeGreaterThan(3);
    for (const [index, line] of expected.did.entries()) await expect(page.getByTestId('ending-did-' + String(index))).toHaveText(line);
    await expect(page.getByTestId('ending-became-stance')).toHaveText(expected.stance);
    for (const [index, card] of expected.cards.entries()) await expect(page.getByTestId('ending-after-card-' + String(index))).toHaveText(card);
    await expect(page.getByTestId('ending-after-humanity')).toHaveText(expected.humanity);
    // Top to bottom: read in one place, with no scroll between the reads, each heading sits below the one before.
    const placed = await Promise.all(headings.map(async (heading) => (await heading.boundingBox())?.y ?? Number.NaN));
    expect(placed.every(Number.isFinite)).toBe(true);
    expect([...placed].sort((a, b) => a - b)).toEqual(placed);
    const summary = page.getByTestId('ending-summary');
    await summary.scrollIntoViewIfNeeded();
    await expect(summary).toBeInViewport();
    expect(await noSidewaysScroll(page), 'no horizontal page scroll').toBe(true);
    const audit = await axeReport(page);
    expect(audit.nativeTimers).toBe(true);
    expect(audit.violations).toEqual([]);
  });
}
