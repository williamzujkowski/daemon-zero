/**
 * What assistive technology reads from every route surface (DZ-13.4) on the production export, from the DOM
 * the browser exposes: each control is a button named by the words it shows first (WCAG 2.5.3, the rule
 * tests/labelInName.ts shares with the mounted tests), a disabled one says so, a disclosure says whether it
 * is open, a surface is introduced by a heading, a modal is a named dialog, status lines that change are
 * live regions, and the run's arrangement is named beside the phase. FIXTURE states; not a screen-reader pass.
 */
import { expect, test, type Locator } from '@playwright/test';
import { CONTENT as PREVIEW } from '../../src/content';
import { runContextView } from '../../src/engine';
import { contextLabel } from '../../src/ui/runContext';
import { labelInName } from '../labelInName';
import { expectedLevel, outlineProblems, readOutline } from './headings';
import { openRouteState } from './routeSave';
import { ROUTE_STATES } from './routeStates';

/** Lines that change while the player reads them, and how each announces the change. */
const LIVE: Readonly<Record<string, readonly [string, string]>> = {
  // The alert is the headline only (vote-1795259663677-ebg4049); the outcome previews follow as ordinary text.
  'review-announced-alert': ['role', 'alert'],
  'release-status': ['aria-live', 'polite'],
  'departure-status': ['aria-live', 'polite'],
  'contact-notice': ['aria-live', 'polite'],
};

async function controlProblems(scope: Locator): Promise<string[]> {
  const problems: string[] = [];
  for (const button of await scope.getByRole('button').all()) {
    const id = await button.getAttribute('data-testid') ?? '?';
    const visible = (await button.textContent() ?? '').trim();
    const name = await button.getAttribute('aria-label') ?? visible;
    if (name.trim() === '') problems.push(id + ': no accessible name');
    if (!labelInName(visible, name)) problems.push(id + ': "' + visible + '" not in "' + name + '"');
    if (!await button.isEnabled() && await button.getAttribute('aria-disabled') !== 'true') problems.push(id + ': disabled without aria-disabled');
  }
  return problems;
}

test('every live line is expected by at least one route state, so none can drop out of the check', () => {
  const expected = new Set(ROUTE_STATES.flatMap((entry) => entry.live ?? []));
  expect(Object.keys(LIVE).filter((id) => !expected.has(id))).toEqual([]);
  expect([...expected].filter((id) => !(id in LIVE))).toEqual([]);
});

for (const entry of ROUTE_STATES) {
  test('semantics route ' + entry.name, async ({ page }, info) => {
    test.skip(entry.phoneOnly === true && info.project.name !== 'phone', 'only the phone tier renders this surface');
    await openRouteState(page, entry);
    const scope = page.getByTestId(entry.scope);
    expect(await controlProblems(scope)).toEqual([]);
    // A chrome notice is a status line, not a surface with a heading. A node card and a widget panel are titled by
    // a heading at their place in the outline (#302), and the outline around them must stay navigable.
    if (entry.scope !== 'contact-notice') expect(await scope.getByRole('heading').count(), 'the surface has a heading').toBeGreaterThan(0);
    if (/^(node-|widget-)/.test(entry.scope)) {
      const outline = await readOutline(page);
      const surface = outline.surfaces.find((candidate) => candidate.kind + '-' + candidate.id === entry.scope);
      expect(surface, 'the surface is titled').toBeDefined();
      expect(outlineProblems(outline)).toEqual([]);
      if (surface) await expect(scope.getByRole('heading', { level: expectedLevel(surface), name: surface.title }).first()).toBeAttached();
    }
    if (entry.disclosure !== undefined) await expect(page.getByTestId(entry.disclosure)).toHaveAttribute('aria-expanded', /^(true|false)$/);
    // An expected live line must be there: a renamed test id fails here instead of skipping (#414 panel). Live ids are
    // unique, so they are found page-wide: a scope's own root (the contact notice is both) is not inside the scope,
    // and the scoped lookup silently skipped it.
    for (const id of entry.live ?? []) await expect(page.getByTestId(id), id + ' is rendered').not.toHaveCount(0);
    for (const [id, [attribute, value]] of Object.entries(LIVE)) {
      if (await page.getByTestId(id).count()) await expect(page.getByTestId(id)).toHaveAttribute(attribute, value);
    }
    if (entry.modal === true) {
      const dialog = page.locator('[aria-modal="true"]').filter({ has: page.getByTestId(entry.reach) });
      await expect(dialog).toHaveCount(1);
      await expect(dialog).toHaveAttribute('role', 'dialog');
      return;
    }
    const label = contextLabel(runContextView(entry.state(), PREVIEW));
    if (label !== null) {
      const context = page.getByTestId('run-context').first();
      await expect(context).toHaveText(label);
      const landmark = await context.evaluate((element) => (element as unknown as { closest(selector: string): unknown })
        .closest('main, [role="main"], [role="region"], header, [role="banner"]') !== null);
      expect(landmark, 'the arrangement is read inside a landmark').toBe(true);
    }
  });
}
