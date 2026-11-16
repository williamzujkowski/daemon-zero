/** Production web E2E, kept separate from the single Vitest component runner. */
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173' + (process.env.DAEMON_WEB_BASE_PATH ?? '') + '/';
// The full live playthrough takes minutes per viewport, so it has its own projects and only
// exists when asked for (`make e2e-live`); `make e2e` neither lists nor runs it.
const JOURNEY = '**/live-journey.e2e.ts';
const live = process.env.DAEMON_E2E_LIVE === '1';
const ignored = ['**/ui-sizes.e2e.ts', JOURNEY];

export default defineConfig({
  testDir: '.', testMatch: '**/*.e2e.ts', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: 0, workers: 2, timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, testIdAttribute: 'data-testid', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', testIgnore: ignored, use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', testIgnore: ignored, use: { viewport: { width: 1440, height: 900 } } },
    // Sets its own viewport per case; running it under the two projects would duplicate every load.
    { name: 'sizes', testMatch: '**/ui-sizes.e2e.ts', use: { viewport: { width: 390, height: 844 } } },
    // A trace of several thousand presses is hundreds of megabytes; the journey keeps its own
    // log and failure screenshot instead.
    ...(live ? [
      { name: 'live-phone', testMatch: JOURNEY, use: { viewport: { width: 390, height: 844 }, trace: 'off' as const } },
      { name: 'live-desktop', testMatch: JOURNEY, use: { viewport: { width: 1440, height: 900 }, trace: 'off' as const } },
    ] : []),
  ],
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory dist', cwd: '../..',
    url: baseURL, reuseExistingServer: false },
});
