/**
 * #273 on the preview export, where DZ-09 found it (first run and returning, iterations 1 and 2): the
 * scrub card is in Operations, enabled and usable, right after ARP discovery and before the spoofer.
 * Paused browser clock; the fixture is described in scrubFlow.ts.
 */
import { CONTENT as PREVIEW } from '../../src/content/preview';
import { test } from './helpers';
import { firstRunCode, returningCode, scrubRightAfterDiscovery } from './scrubFlow';

test('first run: the scrub is usable the moment ARP discovery is mapped', async ({ page }) => {
  await scrubRightAfterDiscovery(page, firstRunCode(PREVIEW));
});

test('returning mind: the scrub is usable the moment ARP discovery is remapped', async ({ page }) => {
  await scrubRightAfterDiscovery(page, returningCode(PREVIEW));
});
