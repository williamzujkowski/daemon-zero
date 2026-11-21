/**
 * PROTOTYPE #385 (removed with it): DAEMON_ATLAS_VARIANT names a CORE ordering variant to load the page under (the app
 * accepts only whitelisted names), so the atlas and the 200% text suites can measure each variant. Unset, './'.
 * Every navigation that seeds a state goes through `gotoEntry`, which fails if the page did not load the variant asked
 * for: the #385 judgment panel found a suite that silently measured the baseline.
 */
import { expect, type Page } from '@playwright/test';

const VARIANT: string = process.env.DAEMON_ATLAS_VARIANT ?? '';
export const ENTRY = VARIANT === '' ? './' : './?variant=' + encodeURIComponent(VARIANT);

export async function gotoEntry(page: Page): Promise<void> {
  await page.goto(ENTRY);
  expect(new URL(page.url()).searchParams.get('variant') ?? '', 'the page loaded the requested CORE variant').toBe(VARIANT);
}
