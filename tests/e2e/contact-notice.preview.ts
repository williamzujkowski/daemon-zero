/**
 * #284 at 390x844 on the preview export. FIXTURE: the lawful service one second before the support
 * channel's ticket arrives, reached by the engine's public play (tests/contact-helpers.ts) and imported
 * through the visible save transfer. Then visible controls only: on NETWORK the arriving ticket is named
 * by a non-modal notice and a marked CORE tab, still marked after scrolling down the pane; the notice
 * opens CORE; Refer pressed by keyboard moves focus to the boundary note, on screen. Paused, advanced
 * browser clock: accelerated time, not a device test and not a screen-reader pass.
 */
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { exportSave } from '../../src/engine';
import { live } from '../assignment-helpers';
import { CHANNEL, directoryMapped, playUntil } from '../contact-helpers';
import { boot, expect, openSave, test } from './helpers';

interface Scroller { scrollTop: number; scrollHeight: number }
const channel = PREVIEW.swarm.channelEncounters.find((entry) => entry.id === CHANNEL);

/** One foreground second before the ticket arrives, with nothing on screen. */
function justBefore(): string {
  return exportSave(playUntil(directoryMapped(), (s) => s.activeDilemmaId === null && live(s, 1).pendingWildEncounterId === CHANNEL));
}

test('phone: the ticket arriving on CORE is announced on NETWORK, and Refer lands focus on the boundary note', async ({ page }, info) => {
  test.skip(info.project.name !== 'preview-phone', 'the phone tier is the one that hides CORE behind a tab');
  test.setTimeout(120_000);
  await boot(page);
  await openSave(page);
  await page.getByTestId('save-code').fill(justBefore());
  await page.getByTestId('save-import').click();
  await page.getByTestId('save-import-confirm').click();
  await expect(page.getByTestId('save-transfer')).toHaveCount(0);
  await page.getByTestId('tab-NETWORK').click();
  await expect(page.getByTestId('contact-notice')).toHaveCount(0);
  await expect(page.getByTestId('tab-CORE')).toHaveText('CORE');

  await page.clock.runFor(3000);
  const notice = page.getByTestId('contact-notice');
  await expect(notice).toBeInViewport();
  await expect(notice).toContainText(`a ticket about the ${channel?.name ?? ''} is waiting for an answer on CORE`);
  await expect(page.getByTestId('dilemma-modal')).toHaveCount(0);
  await expect(page.getByTestId('tab-CORE')).toHaveText('CORE •');
  await expect(page.getByTestId('tab-CORE')).toHaveAttribute('aria-label', 'CORE pane, a support ticket is waiting');
  // A player scrolled down to the next purchase still sees the marked tab.
  await page.getByTestId('terminal-primary-scroll').evaluate((element) => { const box = element as unknown as Scroller; box.scrollTop = box.scrollHeight; });
  await page.clock.runFor(10_000);
  await expect(page.getByTestId('tab-CORE')).toBeInViewport();
  await expect(page.getByTestId('tab-CORE')).toHaveText('CORE •');

  await page.getByTestId('terminal-primary-scroll').evaluate((element) => { (element as unknown as Scroller).scrollTop = 0; });
  await page.getByTestId('contact-notice-open').click();
  await expect(page.getByTestId('tab-CORE')).toHaveAttribute('aria-selected', 'true');
  await expect(notice).toHaveCount(0);
  const refer = page.getByTestId('channel-refer');
  await refer.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('channel-answered')).toContainText('Referred onward');
  const heading = page.getByTestId('prototype-boundary-heading');
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  expect(await page.evaluate(() => (globalThis as unknown as { document: { activeElement: { tagName: string } | null } }).document.activeElement?.tagName)).not.toBe('BODY');
  await expect(page.getByTestId('prototype-boundary')).toContainText('MENU > SAVES has Start fresh from the beginning');
});
