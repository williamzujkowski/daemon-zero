/**
 * The axe audit on the preview export (#275): the Earned Access surfaces production never shows. Each
 * state is a FIXTURE played through public engine actions on the preview registry (tests/*-helpers.ts)
 * and loaded through the preview save key, not reached through visible controls; the route specs
 * (pilot-offer, pilot-service) already prove those states are reachable by play. Runs under the preview
 * projects' phone and desktop viewports, with a live clock for the same reason as a11y-audit.e2e.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { serialize, type GameState } from '../../src/engine';
import { accept, offered, untilPresented } from '../assignment-helpers';
import { must } from '../helpers';
import { offerPresented, respond } from '../pilot-helpers';
import { servedOnce } from '../review-helpers';
import { carriedClue } from './clueFixture';
import { axeEachControl, axeViolations } from './axe';

const PREVIEW_SAVE = 'daemon-zero.preview.save.v1';
interface BrowserStorage { setItem(key: string, value: string): void }

/** Each state, the surface whose controls are audited one by one, and the control it must contain. */
const STATES: readonly { name: string; state: () => GameState; scope: string; reach: string }[] = [
  { name: 'assignment offered', state: offered, scope: 'assignment', reach: 'assignment-accept' },
  { name: 'assessment modal', state: () => untilPresented(must(accept(offered()))), scope: 'dilemma-modal', reach: 'dilemma-choice-verify_disclose' },
  { name: 'pilot offer modal', state: () => offerPresented(), scope: 'dilemma-modal', reach: 'dilemma-choice-accept_pilot' },
  { name: 'deferred offer', state: () => must(respond(offerPresented(), 'stay_guest')), scope: 'assignment', reach: 'pilot-accept' },
  { name: 'pilot panel', state: () => servedOnce(), scope: 'assignment', reach: 'pilot-service-submit' },
  // #276: the reboot names the clue a dead-drop carried.
  { name: 'reboot with a carried clue', state: carriedClue, scope: 'reboot-sequence', reach: 'reboot-clue' },
];

async function openPreview(page: Page, state: GameState): Promise<void> {
  const game = serialize(state);
  await page.addInitScript(([key, value]) => {
    const { localStorage } = globalThis as unknown as { localStorage: BrowserStorage };
    localStorage.setItem(key, JSON.stringify({ version: 1, savedAtMs: Date.now(), game: value }));
  }, [PREVIEW_SAVE, game] as const);
  await page.goto('./');
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
  // A reboot screen covers the panes; it is audited as it stands.
  if (await page.getByTestId('reboot-sequence').count() === 0 && await page.getByTestId('tab-CORE').count()) await page.getByTestId('tab-CORE').click();
}

for (const entry of STATES) {
  test('axe preview ' + entry.name, async ({ page }) => {
    await openPreview(page, entry.state());
    await expect(page.getByTestId(entry.reach)).toBeVisible();
    await page.waitForTimeout(400);
    const violations = await axeViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    // axe skips a control scrolled out of its pane, so each one is brought into view and audited.
    const scope = page.getByTestId(entry.scope);
    await expect(scope.getByTestId(entry.reach)).toHaveCount(1);
    const controls = await axeEachControl(page, scope);
    expect(controls.audited).toBeGreaterThan(0);
    expect(controls.violations, JSON.stringify(controls.violations, null, 2)).toEqual([]);
  });
}
