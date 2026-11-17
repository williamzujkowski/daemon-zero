/** Production web E2E, kept separate from the single Vitest component runner. */
import { defineConfig } from '@playwright/test';

// scripts/e2e-lock.sh hands each suite its own port, so suites in different checkouts can run
// at once. A bare `playwright test` gets the default.
const port = Number(process.env.DAEMON_E2E_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('DAEMON_E2E_PORT must be a port number, got ' + String(process.env.DAEMON_E2E_PORT));
// DAEMON_E2E_REMOTE_URL points the suite at a published build instead (`make e2e-remote`): then
// only the read-only remote smoke runs, and no local server is started.
const remote = remoteURL(process.env.DAEMON_E2E_REMOTE_URL);
const baseURL = remote ?? 'http://127.0.0.1:' + String(port) + (process.env.DAEMON_WEB_BASE_PATH ?? '') + '/';
// The full live playthrough takes minutes per viewport, so it has its own projects and only
// exists when asked for (`make e2e-live`); `make e2e` neither lists nor runs it.
const JOURNEY = '**/live-journey.e2e.ts';
const live = process.env.DAEMON_E2E_LIVE === '1';
// The per-phase signal measurements (six scores, six loop seams) take about a minute, so they
// run only under `make e2e-audio`; the control, duck and transition measurements always run.
const audioFull = process.env.DAEMON_E2E_AUDIO === '1';
const ignored = ['**/ui-sizes.e2e.ts', JOURNEY];

/** The published URL as a base for `./`: http(s) only, always ending in a slash. */
// `unknown`: Expo widens Node's environment index, so an unlisted variable reads as `any`.
function remoteURL(value: unknown): string | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('DAEMON_E2E_REMOTE_URL must be an http(s) URL, got ' + value);
  // A base for `./` is a directory; a query or fragment has no meaning there.
  return url.origin + url.pathname + (url.pathname.endsWith('/') ? '' : '/');
}

// Two viewports, as the local suite uses; each test gets its own fresh context and storage.
const REMOTE = '**/*.remote.ts';
const remoteProjects = [
  { name: 'remote-phone', testMatch: REMOTE, use: { viewport: { width: 390, height: 844 } } },
  { name: 'remote-desktop', testMatch: REMOTE, use: { viewport: { width: 1440, height: 900 } } },
];

export default defineConfig({
  testDir: '.', testMatch: '**/*.e2e.ts', fullyParallel: true, forbidOnly: !!process.env.CI,
  retries: 0, workers: 2, timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, testIdAttribute: 'data-testid', trace: 'retain-on-failure' },
  projects: remote ? remoteProjects : [
    { name: 'phone', testIgnore: ignored, use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', testIgnore: ignored, use: { viewport: { width: 1440, height: 900 } } },
    // Captures rendered audio samples (signalTap.ts). One viewport: the signal does not depend on
    // layout. The flag lets the capture context run before the first gesture, so a score's first
    // samples are caught; the app still waits for a gesture, as the other projects prove.
    { name: 'audio', testMatch: audioFull ? ['**/*.audio.ts', '**/*.audio-full.ts'] : '**/*.audio.ts', use: { viewport: { width: 390, height: 844 },
      launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } } },
    // Sets its own viewport per case; running it under the two projects would duplicate every load.
    { name: 'sizes', testMatch: '**/ui-sizes.e2e.ts', use: { viewport: { width: 390, height: 844 } } },
    // A trace of several thousand presses is hundreds of megabytes; the journey keeps its own
    // log and failure screenshot instead.
    ...(live ? [
      { name: 'live-phone', testMatch: JOURNEY, use: { viewport: { width: 390, height: 844 }, trace: 'off' as const } },
      { name: 'live-desktop', testMatch: JOURNEY, use: { viewport: { width: 1440, height: 900 }, trace: 'off' as const } },
    ] : []),
  ],
  ...(remote ? {} : { webServer: { command: 'python3 -m http.server ' + String(port) + ' --bind 127.0.0.1 --directory dist', cwd: '../..',
    url: baseURL, reuseExistingServer: false } }),
});
