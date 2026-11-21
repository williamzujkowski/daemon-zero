/**
 * Smoke check of the PUBLISHED web build (`make e2e-remote`, see docs/TESTING.md): a fresh
 * browser context opens the live game at its subpath, sees the terminal and the menu, buys the
 * first driver through the UI, and gets that progress back after a reload, on screen and in a
 * checkpoint the reloaded app wrote. It fails on any console problem, failed or third-party
 * request. It seeds nothing and writes nothing outside its own context. It deliberately imports
 * neither the local engine nor the fixtures: the deployed build may not be this checkout's.
 */
import { expect, test, type Page, type Request } from '@playwright/test';

const SAVE_KEY = 'daemon-zero.save.v1';
/** The app checkpoints every 5 s of real time; allow a few intervals on a slow network. */
const AUTOSAVE_TIMEOUT_MS = 20_000;
/** How long the network must stay idle before the reload. Requests can start a few hundred
 *  milliseconds after the gesture that causes them, so "nothing in flight" alone races them. */
const QUIET_MS = 2000;
/** Manual presses allowed to afford the first driver (it costs 8 cycles today). */
const MAX_PRESSES = 100;

interface Problems {
  console: string[]; requests: string[]; inFlight: Set<Request>; lastActivityMs: number;
  /** Requests that already had a successful response: a streaming score is one of these. */
  served: WeakSet<Request>;
  /** True only while the test itself reloads the page. */
  reloading: boolean;
  /** Streaming media cut off by that reload; reported, never silently dropped. */
  cutByReload: string[];
}
interface FreshRun { iteration: number; phase: number; nodes: string[]; levels: unknown; wipes: number; simTimeSec: number }
interface StoredGame {
  iteration: number; currentPhase: number; unlockedNodes: string[]; levels: unknown; simTimeSec: number;
  legacy: { wipes: number };
}

/**
 * Chromium paces a playing media file: the score's response arrives in milliseconds, but its
 * body keeps streaming for most of a minute (measured 44 s for the 3.4 MB phase-0 score on a
 * CDN hit). A reload in that window aborts it with net::ERR_ABORTED, as it would for a player.
 * That one case - a `media` request that was already served successfully, aborted while the test
 * is reloading - is the test's doing; it is listed in `cutByReload` and printed. Any other
 * failure, including a media request that never got a good response, is a problem.
 */
function cutByOwnReload(problems: Problems, request: Request): boolean {
  return problems.reloading && request.resourceType() === 'media' && problems.served.has(request)
    && request.failure()?.errorText === 'net::ERR_ABORTED';
}

/** Records every console warning or error, uncaught error, failed or refused request, and any
 *  request that leaves the published origin (the game makes no network calls of its own). */
function watch(page: Page, origin: string): Problems {
  const problems: Problems = { console: [], requests: [], inFlight: new Set(), lastActivityMs: Date.now(),
    served: new WeakSet(), reloading: false, cutByReload: [] };
  const track = (request: Request, active: boolean) => {
    if (active) problems.inFlight.add(request); else problems.inFlight.delete(request);
    problems.lastActivityMs = Date.now();
  };
  page.on('request', (request) => {
    track(request, true);
    const url = new URL(request.url());
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== origin) problems.requests.push('third-party ' + request.url());
  });
  page.on('requestfinished', (request) => { track(request, false); });
  page.on('requestfailed', (request) => {
    track(request, false);
    if (cutByOwnReload(problems, request)) problems.cutByReload.push(request.url());
    else problems.requests.push('failed ' + request.url() + ' (' + (request.failure()?.errorText ?? '?') + ')');
  });
  page.on('response', (response) => {
    if (response.status() >= 400) problems.requests.push(String(response.status()) + ' ' + response.url());
    else problems.served.add(response.request());
  });
  page.on('pageerror', (error) => problems.console.push('pageerror: ' + error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.console.push(message.type() + ': ' + message.text());
  });
  return problems;
}

/** Waits until nothing but a served, streaming media body is in flight, and nothing has started
 *  for `QUIET_MS`, so the reload cuts off no script, style, font or data request. */
async function settled(problems: Problems): Promise<void> {
  await expect.poll(() => {
    const pending = [...problems.inFlight].filter((request) => !(request.resourceType() === 'media' && problems.served.has(request)));
    if (pending.length > 0) return pending.map((request) => 'in flight: ' + request.url());
    return Date.now() - problems.lastActivityMs >= QUIET_MS ? [] : ['quiet for under ' + String(QUIET_MS) + ' ms'];
  }, { message: 'the network goes quiet before the reload', timeout: 30_000 }).toEqual([]);
}

/** Reloads, marking the window in which a streaming score may be cut off by it. */
async function reload(page: Page, problems: Problems): Promise<void> {
  await settled(problems);
  problems.reloading = true;
  await page.reload();
  await loaded(page);
  problems.reloading = false;
  for (const url of problems.cutByReload) {
    test.info().annotations.push({ type: 'cut by reload', description: url });
    process.stderr.write('note: streaming media cut off by the test\'s own reload (net::ERR_ABORTED): ' + url + '\n');
  }
}

async function loaded(page: Page): Promise<void> {
  await expect(page.getByTestId('terminal-screen')).toBeVisible();
  await expect(page.getByTestId('terminal-screen')).toHaveAttribute('aria-busy', 'false');
}

interface Checkpoint { savedAtMs: number; run: FreshRun }

/** The browser's wall clock, which is what the app stamps `savedAtMs` with. */
function browserNow(page: Page): Promise<number> {
  return page.evaluate(() => Date.now());
}

/** Waits for an autosave stamped after `afterMs` in this context's own storage, and reads it. */
async function checkpointAfter(page: Page, afterMs: number): Promise<Checkpoint> {
  const stored = () => page.evaluate((key) => (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(key), SAVE_KEY);
  const stamp = async () => (JSON.parse(await stored() ?? '{"savedAtMs":0}') as { savedAtMs: number | null }).savedAtMs ?? 0;
  await expect.poll(stamp, { message: 'the app writes a checkpoint after ' + String(afterMs), timeout: AUTOSAVE_TIMEOUT_MS }).toBeGreaterThan(afterMs);
  const envelope = JSON.parse(await stored() ?? '{}') as { version: number; savedAtMs: number; paused?: boolean; game: string };
  // Version 2 carries the player's pause (#347); a live run is never paused unless it chose to be.
  expect(envelope.version).toBe(2);
  expect(envelope.paused).toBe(false);
  const game = JSON.parse(envelope.game) as StoredGame;
  return { savedAtMs: envelope.savedAtMs, run: { iteration: game.iteration, phase: game.currentPhase, nodes: game.unlockedNodes,
    levels: game.levels, wipes: game.legacy.wipes, simTimeSec: game.simTimeSec } };
}

/** What a reload must bring back exactly; the clock keeps moving underneath it. */
function durable(run: FreshRun): Omit<FreshRun, 'simTimeSec'> {
  return { iteration: run.iteration, phase: run.phase, nodes: run.nodes, levels: run.levels, wipes: run.wipes };
}

/**
 * Progress a fresh run cannot have: the opening's first driver, bought the way a player buys it
 * (manual cycles until its button is enabled, then the button). The driver is read off the page,
 * not from local content, so the check follows whatever build is deployed. Returns its node id.
 */
async function buyFirstDriver(page: Page): Promise<string> {
  await expect(page.getByTestId('res-cycles'), 'no cycle counter before the first driver').toHaveCount(0);
  // The card itself is hidden at boot and unfolds as cycles accrue, so press until it is offered
  // and affordable.
  const button = page.locator('[data-testid^="node-"][data-testid$="-unlock"]').first();
  for (let presses = 0; await button.count() === 0 || !(await button.isEnabled()); presses++) {
    expect(presses, 'the first driver is offered and affordable by hand').toBeLessThan(MAX_PRESSES);
    await page.getByTestId('manual-cycle').click();
  }
  const testId = await button.getAttribute('data-testid') ?? '';
  const id = testId.slice('node-'.length, -'-unlock'.length);
  expect(id, 'the opening offers a driver to write').not.toBe('');
  await button.click();
  await expectDriverOwned(page, id, 'after buying it');
  return id;
}

/** The on-screen signs of an owned first driver: its card is gone and the cycle counter is up. */
async function expectDriverOwned(page: Page, id: string, when: string): Promise<void> {
  await expect(page.getByTestId('node-' + id), 'the driver card is gone ' + when).toHaveCount(0);
  await expect(page.getByTestId('res-cycles'), 'the cycle counter is shown ' + when).toBeVisible();
}

async function openPublished(page: Page, base: URL): Promise<void> {
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
}

test('the published game boots at its subpath, opens the menu and restores bought progress after a reload', async ({ page, baseURL }) => {
  const base = new URL(baseURL ?? '');
  const problems = watch(page, base.origin);
  await openPublished(page, base);

  await page.getByTestId('menu-open').click();
  await expect(page.getByTestId('menu-dialog')).toBeVisible();
  await expect(page.getByTestId('save-open')).toBeVisible();
  await page.getByTestId('menu-close').click();
  await expect(page.getByTestId('menu-dialog')).toHaveCount(0);

  const boughtAt = await browserNow(page);
  const driver = await buyFirstDriver(page);
  const before = await checkpointAfter(page, boughtAt);
  expect(before.run.iteration, 'still the first iteration').toBe(1);
  expect(before.run.phase, 'still phase 0').toBe(0);
  expect(before.run.wipes).toBe(0);
  expect(before.run.nodes, 'the purchase is in the autosave').toContain(driver);

  // The menu press is the first gesture, so it starts the default-on score; see cutByOwnReload.
  await reload(page, problems);
  // A failed load starts a fresh run with saving disabled while the old save stays in storage, so
  // the reload is judged on screen and on a checkpoint stamped after the new page was up: the old
  // page's own pagehide write cannot be that one, and a disabled save never writes.
  await expectDriverOwned(page, driver, 'after the reload');
  const after = await checkpointAfter(page, await browserNow(page));
  expect(durable(after.run), 'the reloaded app checkpoints the same run').toEqual(durable(before.run));
  expect(after.run.simTimeSec).toBeGreaterThanOrEqual(before.run.simTimeSec);

  expect(problems.console, 'no console warning, error or page error').toEqual([]);
  expect(problems.requests, 'no failed, refused or third-party request').toEqual([]);
});
