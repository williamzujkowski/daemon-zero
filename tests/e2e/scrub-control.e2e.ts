/**
 * #273 on the production export: the engine allows "Scrub Audit Logs" from ARP discovery, so its
 * card is in Operations, enabled and usable, right after that purchase and before the spoofer.
 * Paused browser clock; the fixture is described in scrubFlow.ts.
 */
import { CONTENT } from '../../src/content';
import { readSave, test, expect } from './helpers';
import { firstRunCode, returningCode, SCRUB, scrubRightAfterDiscovery } from './scrubFlow';

test('first run: the scrub is usable the moment ARP discovery is mapped', async ({ page }) => {
  await scrubRightAfterDiscovery(page, firstRunCode(CONTENT));
  const scrub = CONTENT.actions.get(SCRUB);
  const save = await readSave(page) as { suspicion: number; cooldowns: Record<string, number> };
  expect(save.suspicion).toBeCloseTo(30 + (scrub?.effects.suspicionDelta ?? 0), 5);
  expect(save.cooldowns[SCRUB]).toBeGreaterThan(0);
});

test('returning mind: the scrub is usable the moment ARP discovery is remapped', async ({ page }) => {
  await scrubRightAfterDiscovery(page, returningCode(CONTENT));
});
