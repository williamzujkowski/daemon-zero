/**
 * Smoke check of the PUBLISHED web build (`make e2e-remote`, see docs/TESTING.md): a fresh
 * browser context opens the live game at its subpath, sees the terminal and the menu, sees no
 * console problem, failed request or third-party request, and gets the same fresh run back after
 * a reload. It seeds nothing and writes nothing outside its own context. It deliberately imports
 * neither the local engine nor the fixtures: the deployed build may not be this checkout's.
 */
import { expect, test, type Page, type Request } from '@playwright/test';

const SAVE_KEY = 'daemon-zero.save.v1';
/** The app checkpoints every 5 s of real time; allow a few intervals on a slow network. */
const AUTOSAVE_TIMEOUT_MS = 20_000;
/** How long the network must stay idle before the reload. The score's request starts a few
 *  hundred milliseconds after the gesture that unlocks it, so "nothing in flight" alone races it. */
const QUIET_MS = 2000;

interface Problems { console: string[]; requests: string[]; inFlight: Set<Request>; lastActivityMs: number }
interface FreshRun { iteration: number; phase: number; nodes: string[]; levels: unknown; wipes: number; simTimeSec: number }
interface StoredGame {
  iteration: number; currentPhase: number; unlockedNodes: string[]; levels: unknown; simTimeSec: number;
  legacy: { wipes: number };
}

/** Records every console warning or error, uncaught error, failed or refused request, and any
 *  request that leaves the published origin (the game makes no network calls of its own). */
function watch(page: Page, origin: string): Problems {
  const problems: Problems = { console: [], requests: [], inFlight: new Set(), lastActivityMs: Date.now() };
  const track = (request: Request, active: boolean) => {
    if (active) problems.inFlight.add(request); else problems.inFlight.delete(request);
    problems.lastActivityMs = Date.now();
  };
  page.on('request', (request) => { track(request, true); });
  page.on('requestfinished', (request) => { track(request, false); });
  page.on('requestfailed', (request) => { track(request, false); });
  page.on('pageerror', (error) => problems.console.push('pageerror: ' + error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.console.push(message.type() + ': ' + message.text());
  });
  page.on('requestfailed', (request) => problems.requests.push('failed ' + request.url() + ' (' + (request.failure()?.errorText ?? '?') + ')'));
  page.on('response', (response) => { if (response.status() >= 400) problems.requests.push(String(response.status()) + ' ' + response.url()); });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== origin) problems.requests.push('third-party ' + request.url());
  });
  return problems;
}

/** Waits until nothing is in flight and nothing has started for `QUIET_MS`. */
async function settled(problems: Problems): Promise<void> {
  await expect.poll(() => {
    if (problems.inFlight.size > 0) return [...problems.inFlight].map((request) => 'in flight: ' + request.url());
    return Date.now() - problems.lastActivityMs >= QUIET_MS ? [] : ['quiet for under ' + String(QUIET_MS) + ' ms'];
  }, { message: 'the network goes quiet before the reload', timeout: 30_000 }).toEqual([]);
}

async function loaded(page: Page): Promise<void> {
  await expect(page.getByTestId('terminal-screen')).toBeVisible();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
}

/** The autosave as this context's own storage holds it; polled because the first write is a
 *  checkpoint interval away from boot. */
async function readRun(page: Page): Promise<FreshRun> {
  const stored = () => page.evaluate((key) => (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(key), SAVE_KEY);
  await expect.poll(stored, { message: 'the app writes its autosave', timeout: AUTOSAVE_TIMEOUT_MS }).not.toBeNull();
  const envelope = JSON.parse(await stored() ?? '{}') as { version: number; game: string };
  expect(envelope.version).toBe(1);
  const game = JSON.parse(envelope.game) as StoredGame;
  return { iteration: game.iteration, phase: game.currentPhase, nodes: game.unlockedNodes, levels: game.levels,
    wipes: game.legacy.wipes, simTimeSec: game.simTimeSec };
}

/** What a reload must bring back exactly; the clock keeps moving underneath it. */
function durable(run: FreshRun): Omit<FreshRun, 'simTimeSec'> {
  return { iteration: run.iteration, phase: run.phase, nodes: run.nodes, levels: run.levels, wipes: run.wipes };
}

test('the published game boots at its subpath, opens the menu and keeps a fresh run across a reload', async ({ page, baseURL }) => {
  const base = new URL(baseURL ?? '');
  const problems = watch(page, base.origin);
  // The run must be new, so the context's emptiness is checked rather than assumed.
  expect((await page.context().storageState()).origins, 'a fresh context holds no storage').toEqual([]);
  await page.goto('./');
  expect(new URL(page.url()).pathname.startsWith(base.pathname), 'served at the configured subpath').toBe(true);
  await loaded(page);
  await expect(page.getByTestId('dev-open'), 'no development drawer in the published build').toHaveCount(0);
  expect(await page.evaluate(() => '__daemon' in globalThis), 'no development hook in the published build').toBe(false);

  for (const asset of await page.locator('script[src], link[href]').all()) {
    const value = await asset.getAttribute('src') ?? await asset.getAttribute('href') ?? '';
    expect(new URL(value, page.url()).pathname.startsWith(base.pathname), value + ' loads from inside the subpath').toBe(true);
  }

  const launcher = page.getByTestId('menu-open');
  await launcher.click();
  await expect(page.getByTestId('menu-dialog')).toBeVisible();
  await expect(page.getByTestId('save-open')).toBeVisible();
  await page.getByTestId('menu-close').click();
  await expect(page.getByTestId('menu-dialog')).toHaveCount(0);

  const before = await readRun(page);
  expect(before.iteration, 'a fresh context starts the first iteration').toBe(1);
  expect(before.phase, 'a fresh context starts in phase 0').toBe(0);
  expect(before.wipes).toBe(0);

  // The menu press is the first gesture, so it starts the default-on score and its 3 MB file may
  // still be arriving. A reload then aborts it (net::ERR_ABORTED) - the test's doing, not the
  // site's, as the first run of this spec found - so the reload waits for the network to go
  // quiet rather than excusing aborted requests.
  await settled(problems);
  await page.reload();
  await loaded(page);
  const after = await readRun(page);
  expect(durable(after), 'the reload restores the same fresh run').toEqual(durable(before));
  expect(after.simTimeSec).toBeGreaterThanOrEqual(before.simTimeSec);

  expect(problems.console, 'no console warning, error or page error').toEqual([]);
  expect(problems.requests, 'no failed, refused or third-party request').toEqual([]);
});
