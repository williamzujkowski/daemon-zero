/**
 * Reduced motion on the route surfaces (DZ-13.4), as feel.e2e.ts proves it for production: with
 * `prefers-reduced-motion: reduce` no route surface runs a CSS or Web animation or transition, or shows a
 * scramble glyph, and a node the route provisions shows its complete name at once where the default motion
 * decrypts it. FIXTURE states; headless Chromium's emulated media preference, not a device setting.
 */
import { expect, test, type Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { CONTENT as PREVIEW } from '../../src/content';
import { SEGMENT } from '../network-helpers';
import { openRouteState } from './routeSave';
import { ROUTE_STATES } from './routeStates';

/** The glyph the decrypt reveal draws in place of a letter not yet shown (src/app/useDecryptText.ts). */
const SCRAMBLE = '░';

function motionOn({ scopeId, glyph }: { scopeId: string; glyph: string }): string[] {
  const browser = globalThis as unknown as Window & { document: { getAnimations(): unknown[] } };
  const scope = browser.document.querySelector('[data-testid="' + scopeId + '"]');
  if (scope === null) return ['no surface ' + scopeId];
  const moving = browser.document.getAnimations().length > 0 ? ['running animations: ' + String(browser.document.getAnimations().length)] : [];
  for (const element of [scope, ...scope.querySelectorAll('*')]) {
    const style = browser.getComputedStyle(element);
    const id = element.getAttribute('data-testid') ?? element.tagName;
    if (style.animationName !== 'none' && style.animationName !== '') moving.push('animation on ' + id);
    if (style.transitionDuration.split(',').some((value) => Number.parseFloat(value) > 0)) moving.push('transition on ' + id);
  }
  if (scope.textContent.includes(glyph)) moving.push('scramble glyph in ' + scopeId);
  return moving;
}

for (const entry of ROUTE_STATES) {
  test('reduced motion route ' + entry.name, async ({ page }, info) => {
    test.skip(entry.phoneOnly === true && info.project.name !== 'phone', 'only the phone tier renders this surface');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openRouteState(page, entry);
    await page.waitForTimeout(300);
    expect(await page.evaluate(motionOn, { scopeId: entry.scope, glyph: SCRAMBLE })).toEqual([]);
  });
}

const segment = ROUTE_STATES.find((entry) => entry.name === 'service threshold notice');
const name = PREVIEW.nodes.get(SEGMENT)?.revealedName ?? '';

/** Provisions the segment on a paused clock, so a reveal in progress stays where it starts. */
async function provisioned(page: Page): Promise<string> {
  if (!segment) throw new Error('Missing the service threshold state');
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
  await openRouteState(page, segment);
  await page.getByTestId('phase-threshold-continue').click();
  await page.getByTestId('processes-open').click();
  const title = page.getByTestId('node-' + SEGMENT + '-title');
  await expect(title).toHaveAttribute('aria-label', new RegExp(name));
  return await title.textContent() ?? '';
}

test('reduced motion shows a provisioned route node\'s complete name at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const shown = await provisioned(page);
  expect(shown).toContain(name);
  expect(shown).not.toContain(SCRAMBLE);
});

// The control case: without the preference the same purchase starts its reveal, so the check above can fail.
test('default motion decrypts the same name over its reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await provisioned(page)).toContain(SCRAMBLE);
  await page.clock.runFor(1000);
  await expect(page.getByTestId('node-' + SEGMENT + '-title')).not.toContainText(SCRAMBLE);
});
