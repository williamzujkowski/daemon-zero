/** Production web E2E, kept separate from the single Vitest component runner. */
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173' + (process.env.DAEMON_WEB_BASE_PATH ?? '') + '/';

export default defineConfig({
  testDir: '.', testMatch: '**/*.e2e.ts', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: 0, workers: 2, timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, testIdAttribute: 'data-testid', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', testIgnore: '**/ui-sizes.e2e.ts', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', testIgnore: '**/ui-sizes.e2e.ts', use: { viewport: { width: 1440, height: 900 } } },
    // Sets its own viewport per case; running it under the two projects would duplicate every load.
    { name: 'sizes', testMatch: '**/ui-sizes.e2e.ts', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory dist', cwd: '../..',
    url: baseURL, reuseExistingServer: false },
});
