/** Viewport matrix: invariants that must hold at every size, plus the paused-clock fold
 * verdict of every cell docs/UI-SIZES.md states (PAUSED_FOLD). Layout defects are recorded
 * there as named exceptions and pinned here; this file must not be relaxed to hide one.
 */
import type { Browser, Page } from '@playwright/test';
import type { Window } from 'happy-dom';
import { CONTENT } from '../../src/content';
import type { GameState } from '../../src/engine';
import { boot, dismissBoot, expect, test } from './helpers';
import { layoutFor, SIDE_COLUMN_MIN_WIDTH } from '../../src/ui/layout';

const sizes = [
  { name: 'small-phone', width: 320, height: 568 },
  { name: 'phone-360', width: 360, height: 640 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-large', width: 414, height: 896 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'breakpoint-edge', width: 900, height: 640 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'breakpoint-three', width: 1080, height: 800 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'widescreen', width: 2560, height: 1440 },
] as const;

/** Early, mid and warning-active states: an early terminal, the densest purchase pane, a red alert. */
const states = ['phase-1-widgets', 'epistemic-ready-p2', 'corporate-insolvent'] as const;

/** The supported floor, chosen by a nexus consensus_vote (5 of 5 selecting seats):
 *  360x640 and up get budget and above-the-fold claims; 320x568 is tolerated - it must
 *  render without overflow, clipping or sub-44px targets, but no fold promise is made
 *  there. Measured first purchase against the usable fold when the vote was taken: 320
 *  misses by 67px in all three sampled states, 360 clears it by 1px, 375 by 47px, 390
 *  comfortably. Current figures per cell are in docs/UI-SIZES.md, from this annotation. */
function isSupported(size: { width: number | string; height: number | string }): boolean {
  return Number(size.width) >= 360 && Number(size.height) >= 640;
}

type Fixture = typeof states[number];
type SizeName = typeof sizes[number]['name'];

/** The three verdicts docs/UI-SIZES.md uses for the first purchase control, read from the
 *  annotation and nothing else: `clears` is firstUnlockAboveUsableFold (ends at or above the
 *  usable fold, which implies the viewport), `viewport only` is firstUnlockVisible without it
 *  (on screen, bottom edge behind the docked tab bar), `below` is neither. */
type FoldVerdict = 'clears' | 'viewport only' | 'below';
const CLEARS = 'clears', BEHIND_TABS = 'viewport only', BELOW = 'below';

/** The first table under "Supported floor" in docs/UI-SIZES.md, on the PAUSED clock (the
 *  contract basis), asserted cell by cell. A change in either direction fails: a promised
 *  cell that stops clearing is a regression, and an exception that starts clearing means the
 *  document is now wrong the other way - correct this table and that one in the same PR.
 *
 *  Promise (tier table): at the 360x640 floor the opening and mid-game states clear; from 390
 *  up every sampled state clears. The cells that do not are each named in the document: */
const PAUSED_FOLD: Record<SizeName, Record<Fixture, FoldVerdict>> = {
  // TOLERATED, no promise ("Neither 320x568 nor 844x390 makes an above-the-fold promise").
  // Pinned only because the document states these six verdicts as measured facts, "Two
  // folds" included; a change here is a stale table to correct, never a broken promise.
  'small-phone': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': BEHIND_TABS, 'corporate-insolvent': BELOW },
  'phone-landscape': { 'phase-1-widgets': BEHIND_TABS, 'epistemic-ready-p2': BELOW, 'corporate-insolvent': BELOW },
  // SUPPORTED. Exception outside the promise: the floor never promised insolvency, which is
  // accepted as a scroll under a pinned warning (vote accept-scroll-during-ending, "Still
  // open" items 1 and 3; the scroll itself is the 'insolvency at the floor' case).
  'phone-360': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': BELOW },
  'phone-390': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
  'phone-large': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
  'tablet-portrait': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
  // The ONE exception to "every sampled state from 390 up": insolvency at 900x640 ends past
  // a 640 viewport, recorded as a gap rather than hidden ("Still open" item 3).
  'breakpoint-edge': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': BELOW },
  'tablet-landscape': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
  'breakpoint-three': { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
  laptop: { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
  desktop: { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
  widescreen: { 'phase-1-widgets': CLEARS, 'epistemic-ready-p2': CLEARS, 'corporate-insolvent': CLEARS },
};

type Geometry = {
  overflow: boolean;
  undersized: string[];
  paneHeights: number[];
  columns: boolean;
  mobileTabs: boolean;
  widestCard: number;
  columnWidths: { core: number; sensors: number; side: number };
  headerHeight: number;
  stripHeight: number;
  tallReadouts: number;
  firstUnlockTop: number | null;
  firstUnlockBottom: number | null;
  firstUnlockVisible: boolean;
  /** Where the screen stops being usable: the docked mobile tab bar's top edge, or the
   *  viewport's bottom edge when no tab bar is docked (docs/UI-SIZES.md, "Two folds"). */
  usableFold: number;
  /** The stricter of the two verdicts (firstUnlockVisible is the viewport one). Both are
   *  asserted per cell on the paused clock through foldVerdict() and PAUSED_FOLD. */
  firstUnlockAboveUsableFold: boolean;
  forecastVisible: boolean;
  forecastHeight: number;
  warningVisible: boolean;
  warningTop: number | null;
};

/** The page context supplies the DOM; happy-dom's types are the project's typed stand-in. */
type DomElement = NonNullable<ReturnType<Window['document']['querySelector']>>;

/** How long the clock runs before the second read. Notices are time-gated, so the figure
 *  is a sample of a running game rather than a precise value - the point is its scale. */
const RUNNING_CLOCK_SETTLE_MS = 1500;

/** How far a running clock moves the first purchase, per state (#162). Mid-game mounts one time-gated notice above
 *  it, the wild-signal pointer. Its name may take two lines (vote-1795208946788-lpjbyc5, #359): 48px (44px control +
 *  4px gap) where the name fits one line, 70px where it wraps to a second. Measured at all twelve sizes. It read 112
 *  while the fixture's response rung trailed its suspicion (#382), and 134-156 while [ REVIEW ] could shrink and wrap
 *  inside the notice (#162); any other change means a block mounted or left, or the name took a third line. */
const RUNNING_CLOCK_OFFSET = { 'phase-1-widgets': 0, 'corporate-insolvent': 0 } as const;
const WILD_NAME_WRAPS: ReadonlySet<string> = new Set(['small-phone', 'phone-360', 'phone-390', 'phone-large', 'tablet-portrait', 'breakpoint-edge', 'breakpoint-three']);
function runningOffset(fixture: (typeof states)[number], size: string): number {
  if (fixture === 'epistemic-ready-p2') return WILD_NAME_WRAPS.has(size) ? 70 : 48;
  return RUNNING_CLOCK_OFFSET[fixture];
}

function readGeometry(): Geometry {
  const browser = globalThis as unknown as Window;
  const box = (element: DomElement | null) => (element ? element.getBoundingClientRect() : null);
  const interactive = [...browser.document.querySelectorAll('[role="button"],[role="tab"]')]
    .filter((element) => { const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const unlocks = [...browser.document.querySelectorAll('[data-testid$="-unlock"]')]
    .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top);
  const first = box(unlocks[0] ?? null);
  const forecast = box(browser.document.querySelector('[data-testid="forecast-notice"]'));
  const warning = box(browser.document.querySelector('[data-testid="insolvency-warning"]'));
  const usableFold = Math.round(box(browser.document.querySelector('[data-testid="terminal-tabs-scroll"]'))?.top ?? browser.innerHeight);
  const fullyVisible = (r: DOMRect | null) => r !== null && r.width > 0 && r.height > 0
    && r.top >= 0 && r.bottom <= browser.innerHeight && r.left >= 0 && r.right <= browser.innerWidth;
  return {
    overflow: browser.document.documentElement.scrollWidth > browser.innerWidth + 1,
    undersized: interactive.filter((element) => {
      const r = element.getBoundingClientRect();
      return r.width < 43.9 || r.height < 43.9;
    }).map((element) => element.getAttribute('data-testid') ?? element.tagName),
    paneHeights: [...browser.document.querySelectorAll('[data-testid^="pane-scroll-"]')]
      .map((element) => Math.round(element.getBoundingClientRect().height)),
    columns: browser.document.querySelector('[data-testid="terminal-columns"]') !== null,
    mobileTabs: browser.document.querySelector('[data-testid="terminal-tabs-scroll"]') !== null,
    widestCard: Math.round(Math.max(0, ...[...browser.document.querySelectorAll('[data-testid]')]
      .filter((element) => /^node-[A-Za-z0-9_]+$/.test(element.getAttribute('data-testid') ?? ''))
      .map((element) => element.getBoundingClientRect().width))),
    columnWidths: {
      core: Math.round(box(browser.document.querySelector('[data-testid="panel-core"]'))?.width ?? 0),
      sensors: Math.round(box(browser.document.querySelector('[data-testid="panel-sensors"]'))?.width ?? 0),
      side: Math.round((box(browser.document.querySelector('[data-testid="panel-third"]'))
        ?? box(browser.document.querySelector('[data-testid="panel-side"]')))?.width ?? 0),
    },
    headerHeight: Math.round(box(browser.document.querySelector('[data-testid="terminal-header"]'))?.height ?? 0),
    stripHeight: Math.round(box(browser.document.querySelector('[data-testid="resource-strip"]'))?.height ?? 0),
    // #137: a readout is 28px on one line and 47 on two; anything past 50 means its pair
    // wrapped again and the strip is spending a row per meter.
    tallReadouts: [...(browser.document.querySelectorAll('[data-testid="resource-strip"] > *'))]
      .filter((child) => child.querySelector('[data-testid^="res-"], [role="meter"]') !== null)
      .filter((child) => child.getBoundingClientRect().height > 50).length,
    firstUnlockTop: first === null ? null : Math.round(first.top),
    firstUnlockBottom: first === null ? null : Math.round(first.bottom),
    firstUnlockVisible: fullyVisible(first),
    usableFold,
    firstUnlockAboveUsableFold: fullyVisible(first) && first !== null && Math.round(first.bottom) <= usableFold,
    forecastVisible: fullyVisible(forecast),
    forecastHeight: Math.round(forecast?.height ?? 0),
    warningVisible: fullyVisible(warning),
    warningTop: warning === null ? null : Math.round(warning.top),
  };
}

/** The one reading of the fold in this file: both annotation verdicts folded into the
 *  document's vocabulary, so no case measures the tab bar for itself. */
function foldVerdict(geometry: Geometry): FoldVerdict {
  if (geometry.firstUnlockAboveUsableFold) return CLEARS;
  return geometry.firstUnlockVisible ? BEHIND_TABS : BELOW;
}

async function openState(browser: Browser, width: number, height: number, fixture: string,
  patch?: (game: GameState) => GameState): Promise<{ page: Page; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) errors.push(message.text()); });
  await boot(page, fixture, patch ? { patch } : {});
  await dismissBoot(page);
  return { page, errors };
}

test.describe('size matrix invariants', () => {
  for (const size of sizes) {
    test(`${size.name} ${String(size.width)}x${String(size.height)} keeps every control usable`, async ({ browser }) => {
      for (const fixture of states) {
        const { page, errors } = await openState(browser, size.width, size.height, fixture);
        try {
          const geometry = await page.evaluate(readGeometry);
          test.info().annotations.push({ type: 'geometry', description: JSON.stringify({ fixture, ...geometry }) });
          // Soft, so one layout change reports every cell it flips instead of the first.
          expect.soft(foldVerdict(geometry), `${fixture} paused-clock fold verdict at ${size.name} (first purchase `
            + `${String(geometry.firstUnlockTop)}-${String(geometry.firstUnlockBottom)}, usable fold ${String(geometry.usableFold)}, `
            + `viewport ${String(size.height)}); docs/UI-SIZES.md states this cell`).toBe(PAUSED_FOLD[size.name][fixture]);
          // The contract above is measured on a PAUSED clock, which is what makes it
          // reproducible - and the game always runs (nexus vote:
          // keep-frozen-add-a-running-column, 6 of 6), so the same cell is measured again
          // with time passing and annotated separately. The fold verdict above is the frozen
          // contract; the running column is pinned only as an offset from it.
          await page.clock.resume();
          await page.waitForTimeout(RUNNING_CLOCK_SETTLE_MS);
          const running = await page.evaluate(readGeometry);
          test.info().annotations.push({ type: 'geometry-running', description: JSON.stringify({ fixture, ...running }) });
          expect((running.firstUnlockTop ?? 0) - (geometry.firstUnlockTop ?? 0), `${fixture} running-clock offset at ${size.name}`)
            .toBe(runningOffset(fixture, size.name));
          expect(geometry.overflow, `${fixture} horizontal overflow at ${size.name}`).toBe(false);
          expect(geometry.undersized, `${fixture} controls under 44px at ${size.name}`).toEqual([]);
          expect(geometry.paneHeights.length, `${fixture} rendered no pane at ${size.name}`).toBeGreaterThan(0);
          for (const height of geometry.paneHeights) expect(height, `${fixture} collapsed pane at ${size.name}`).toBeGreaterThan(44);
          const expected = layoutFor(size.width, size.height);
          expect(geometry.columns, `${fixture} column mode at ${size.name}`).toBe(expected.mode !== 'mobile');
          expect(geometry.mobileTabs, `${fixture} mobile tabs at ${size.name}`).toBe(expected.mode === 'mobile');
          expect(geometry.widestCard, `${fixture} widest card at ${size.name}`).toBeLessThanOrEqual(expected.contentMaxWidth);
          // The header holds one row (64px) from 400 up. Between 360 and 399 it can
          // reach 80px when the run status takes a second line. Below 360 the header
          // is two rows on purpose (isVeryNarrowChrome): the title, PROC and MENU share
          // one row and the iteration/phase line spans the width beneath it, measured
          // at 70px against the 102px the stacked status column used to cost. A nexus
          // vote chose that band over leaving the wrap in place, 4 of 5 selecting seats.
          // #137: a readout that wraps past two lines means the strip is spending a row
          // per meter. The state decides how many meters exist - corporate-insolvent shows
          // the AEGIS lock and both notices - so this pins the readout shape, not a total.
          // Pins the phone tiers, where two readouts share a row: above 500 they are
          // content-sized or stacked on purpose, and a short viewport packs differently
          // again. The measured win this protects is 360x640 and 390x844.
          // Supported tiers only: 320 is tolerated and makes no shape promises, which is
          // also why its strip budget is asserted only in the phase-1 state.
          if (isSupported(size) && size.width <= 500) {
            expect(geometry.tallReadouts, `${fixture} readouts wrapping past two lines at ${size.name}`).toBe(0);
          }
          const headerBudget = size.width >= 400 ? 64 : 80;
          if (isSupported(size)) {
            expect(geometry.headerHeight, `${fixture} header rows at ${size.name}`)
              .toBeLessThanOrEqual(headerBudget);
          } else {
            // Tolerated tier: the control must exist and be reachable by scrolling, and
            // nothing here promises where it sits.
            expect(geometry.firstUnlockTop, `${fixture} purchase control missing at ${size.name}`)
              .not.toBeNull();
          }
          for (const [name, value] of Object.entries(geometry.columnWidths)) {
            if (value === 0) continue;
            expect(value, `${fixture} ${name} column below the floor at ${size.name}`)
              .toBeGreaterThanOrEqual(expected.mode === 'mobile' ? 0 : SIDE_COLUMN_MIN_WIDTH);
          }
          expect(errors, `${fixture} console output at ${size.name}`).toEqual([]);
        } finally { await page.context().close(); }
      }
    });
  }
});

/** The insolvency state at the floor, pinned to the panel's acceptance criteria: the
 *  warning keeps its full text and stays on screen at every scroll offset while the first
 *  purchase is reachable by scrolling. Both halves failed before the alert band became a
 *  direct sticky child of the primary scroll, because the chrome it sat inside scrolled
 *  away (votes: sticky-alert-inside-the-scroll, then split-chrome-alert-above-strip). */
test.describe('insolvency at the floor', () => {
  test('keeps the alert visible while the purchase is scrolled into view', async ({ browser }) => {
    const { page } = await openState(browser, 360, 640, 'corporate-insolvent');
    try {
      const atRest = await page.evaluate(readGeometry);
      expect(atRest.warningVisible, 'warning visible at rest').toBe(true);
      const fullText = await page.evaluate(() => {
        const browser = globalThis as unknown as Window;
        return browser.document.querySelector('[data-testid="insolvency-warning"]')?.textContent ?? '';
      });
      expect(fullText, 'warning keeps its consequence text').toContain('unpaid drains increase suspicion');
      const scrolled = await page.evaluate(() => {
        const browser = globalThis as unknown as Window;
        // Phone tier: chrome and pane share terminal-primary-scroll. The per-pane testID
        // only exists on the multi-column tiers.
        const pane = browser.document.querySelector('[data-testid="terminal-primary-scroll"]')
          ?? browser.document.querySelector('[data-testid="pane-scroll-CORE"]');
        const control = browser.document.querySelector('[data-testid$="-unlock"]');
        if (!pane || !control) return 0;
        // Scroll the pane itself: scrollIntoView also scrolls ancestors, which would move
        // the very band this test pins.
        const paneBox = pane.getBoundingClientRect();
        const controlBox = control.getBoundingClientRect();
        const scrollable = pane as unknown as { scrollTop: number; clientHeight: number };
        scrollable.scrollTop += controlBox.top - paneBox.top - (scrollable.clientHeight - controlBox.height) / 2;
        return scrollable.scrollTop;
      });
      expect(scrolled, 'primary scroll moves').toBeGreaterThan(0);
      await page.waitForTimeout(200);
      const after = await page.evaluate(readGeometry);
      expect(after.firstUnlockVisible, 'purchase reachable by scroll').toBe(true);
      expect(after.warningVisible, 'warning still visible after scrolling').toBe(true);
    } finally { await page.context().close(); }
  });
});

/** The mid-game state at the floor. The kernel dock band was dropped on the phone tier and
 *  its history moved into the utility menu, because the band's 44px tap target set a 57px
 *  floor that no line compression could beat (measured: a one-line variant saves 1px).
 *  Vote: menu-route-drops-the-band, 6 of 6 selecting. This pins both halves: the purchase
 *  inside the usable fold, and the history still reachable from the phone tier. */
test.describe('mid-game at the floor', () => {
  test('puts the first purchase inside the usable fold and keeps the log reachable', async ({ browser }) => {
    const { page } = await openState(browser, 360, 640, 'epistemic-ready-p2');
    try {
      // The annotation's fold, not a second reading of the tab bar: usableFold falls back to
      // the viewport height when no bar is docked, so the bar is required first.
      const geometry = await page.evaluate(readGeometry);
      expect(geometry.mobileTabs, 'tab bar docked, so the usable fold is its top edge').toBe(true);
      expect(geometry.usableFold, 'usable fold is above the viewport bottom').toBeLessThan(640);
      expect(geometry.firstUnlockBottom, 'purchase measured').not.toBeNull();
      expect(geometry.firstUnlockBottom ?? Infinity, 'purchase ends above the tab bar').toBeLessThanOrEqual(geometry.usableFold);
      expect(foldVerdict(geometry), 'mid-game fold verdict at the floor').toBe(PAUSED_FOLD['phone-360']['epistemic-ready-p2']);
      // The band is gone on the phone tier, and the menu still opens the history.
      await expect(page.getByTestId('kernel-dock')).toHaveCount(0);
      await page.getByTestId('menu-open').click();
      await page.getByTestId('menu-kernel').click();
      await expect(page.getByTestId('menu-kernel-log')).toBeVisible();
    } finally { await page.context().close(); }
  });
});

/** #89: the forecast sentence wrapped to two lines on every phone width, so the block
 *  stood 86px. The phone tier abbreviates it (vote: build-forecast-compaction-decline-
 *  other-two, 6 of 7 selecting) and the block is 64px: 16 padding, a 22px heading, a 4px
 *  gap and ONE 22px line. Pinned on the longest wording the component can render - a
 *  rising rate with an interrupt inbound, which no engine-played fixture holds - because
 *  the short variants would pass with any abbreviation. */
test.describe('forecast notice', () => {
  const inbound = (game: GameState): GameState => {
    const dilemma = CONTENT.dilemmas.find((entry) => entry.phaseId === game.currentPhase);
    if (!dilemma) throw new Error('No interrupt for this phase');
    // The omen's event stays open: the app admits the run to campaign rules, where a resolved event never returns (#233).
    return { ...game, resolvedDilemmas: game.resolvedDilemmas.filter((id) => id !== dilemma.id),
      pendingDilemma: { id: dilemma.id, firesAtSimSec: game.simTimeSec + CONTENT.balance.dilemmaOmenSec } };
  };
  const full = /^At current rate: \d+s until suspicion 100\. \/\/ Interrupt inbound in \d+s\. Set resources aside\.$/;

  for (const [width, height] of [[360, 640], [390, 844], [414, 896]] as const) {
    test(`${String(width)}x${String(height)} fits the longest forecast on one line and names it in full`, async ({ browser }) => {
      const { page } = await openState(browser, width, height, 'epistemic-ready-p2', inbound);
      try {
        const sentence = page.getByTestId('inspection-forecast');
        await expect(sentence).toHaveText(/^SUS 100 in ~\d+s \/\/ INT \d+s: set aside$/);
        await expect(sentence).toHaveAttribute('aria-label', full);
        expect((await sentence.boundingBox())?.height, 'forecast sentence is one 22px line').toBe(22);
        // Abbreviated, never clipped: one line because it fits, not because it may not wrap.
        await expect(sentence).not.toHaveCSS('white-space', 'nowrap');
        await expect(sentence).not.toHaveCSS('text-overflow', 'ellipsis');
      } finally { await page.context().close(); }
    });
  }

  test('desktop 1440x900 keeps the reviewed sentence as its visible text', async ({ browser }) => {
    const { page } = await openState(browser, 1440, 900, 'epistemic-ready-p2', inbound);
    try {
      await expect(page.getByTestId('inspection-forecast')).toHaveText(full);
      await expect(page.getByTestId('inspection-forecast')).not.toHaveAttribute('aria-label');
    } finally { await page.context().close(); }
  });
});

/** The tolerated tier is asserted for what it does promise: a rendered, reachable,
 *  non-overflowing screen. Its fold position is deliberately not claimed (#136); the matrix
 *  pins the verdicts the document records for it as facts, which is not a promise. */
test.describe('tolerated tier below the supported floor', () => {
  for (const size of sizes.filter((entry) => !isSupported(entry))) {
    test(`${size.name} renders every control without claiming a fold`, async ({ browser }) => {
      for (const fixture of states) {
        const { page, errors } = await openState(browser, size.width, size.height, fixture);
        try {
          const geometry = await page.evaluate(readGeometry);
          expect(geometry.overflow, `${fixture} horizontal overflow at ${size.name}`).toBe(false);
          expect(geometry.undersized, `${fixture} controls under 44px at ${size.name}`).toEqual([]);
          expect(geometry.firstUnlockTop, `${fixture} no purchase control at ${size.name}`).not.toBeNull();
          expect(errors, `${fixture} console output at ${size.name}`).toEqual([]);
        } finally { await page.context().close(); }
      }
    });
  }
});

/** The chrome's state band, pinned in the states where it is just the meters. Alert
 *  states carry extra readouts on purpose and are covered by tallReadouts instead. */
test.describe('chrome state band', () => {
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [414, 896]] as const) {
    test(`${String(width)}x${String(height)} keeps the resource strip near one band`, async ({ browser }) => {
      const { page } = await openState(browser, width, height, 'phase-1-widgets');
      try {
        const geometry = await page.evaluate(readGeometry);
        // #139: abbreviated labels and a bare signed rate took 112 -> 78 at 320 and
        // 103 -> 78 at 360 and 390.
        expect(geometry.stripHeight, 'resource strip height').toBeLessThanOrEqual(90);
      } finally { await page.context().close(); }
    });
  }
});

/** Forecast and warning placement at the baseline sizes. The first purchase's fold verdict
 * is asserted for every cell by the matrix (PAUSED_FOLD); these cases read the same table. */
test.describe('above-the-fold at baseline sizes', () => {
  test('small phone 320x568 shows the insolvency warning', async ({ browser }) => {
    // #125: the warning used to render only while CORP was the slot in view, and at
    // 568px it started life behind the tab bar. It is the only place the player is
    // told why the run is ending, so both properties are held here.
    const warning = await openState(browser, 320, 568, 'corporate-insolvent');
    try {
      const geometry = await warning.page.evaluate(readGeometry);
      expect(geometry.warningVisible, 'insolvency warning on screen at 320x568').toBe(true);
    } finally { await warning.page.context().close(); }
  });

  test('phone 390x844 shows the forecast, the first purchase and an active warning', async ({ browser }) => {
    const early = await openState(browser, 390, 844, 'phase-1-widgets');
    try {
      const geometry = await early.page.evaluate(readGeometry);
      expect(geometry.forecastVisible, 'forecast above the fold').toBe(true);
      expect(foldVerdict(geometry), 'first purchase above the fold').toBe(CLEARS);
    } finally { await early.page.context().close(); }
    const warning = await openState(browser, 390, 844, 'corporate-insolvent');
    try {
      const geometry = await warning.page.evaluate(readGeometry);
      expect(geometry.warningVisible, 'insolvency warning above the fold').toBe(true);
      expect(geometry.forecastVisible, 'forecast above the fold with a warning active').toBe(true);
    } finally { await warning.page.context().close(); }
  });

  test('phone-360 640 shows a one-line forecast in every state, the opening and mid-game purchase above the fold, and the insolvency purchase below it', async ({ browser }) => {
    // #138: this loop used to reuse one page, and boot() only seeds a fixture when
    // localStorage is empty - so all three assertions re-measured the FIRST fixture and
    // two of them were vacuous. Each state now gets a fresh context. #138 measured mid-game
    // and insolvency past the fold (609-653 and 732 against 640); mid-game has cleared
    // since #143, and insolvency is the accepted scroll, pinned as still below.
    for (const fixture of states) {
      const { page } = await openState(browser, 360, 640, fixture);
      try {
        const geometry = await page.evaluate(readGeometry);
        expect(geometry.forecastVisible, `${fixture} forecast above the fold`).toBe(true);
        // #89: 86px while the sentence wrapped; heading plus one line is 64.
        expect(geometry.forecastHeight, `${fixture} forecast block height`).toBeLessThanOrEqual(64);
        expect(geometry.firstUnlockTop, `${fixture} purchase control missing`).not.toBeNull();
        expect(foldVerdict(geometry), `${fixture} first purchase fold verdict`).toBe(PAUSED_FOLD['phone-360'][fixture]);
      } finally { await page.context().close(); }
    }
  });

  test('desktop 1440x900 shows the forecast and the first purchase in every sampled state', async ({ browser }) => {
    for (const fixture of states) {
      const { page } = await openState(browser, 1440, 900, fixture);
      try {
        const geometry = await page.evaluate(readGeometry);
        expect(geometry.forecastVisible, `${fixture} forecast above the fold`).toBe(true);
        expect(foldVerdict(geometry), `${fixture} first purchase above the fold`).toBe(CLEARS);
      } finally { await page.context().close(); }
    }
  });
});