/** Production web E2E, kept separate from the single Vitest component runner. */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: '**/*.e2e.ts', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: 0, workers: 2, timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', testIdAttribute: 'data-testid', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory dist', cwd: '../..',
    url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
